/**
 * Pure domain logic for the Templates-as-files feature.
 *
 * A Template artifact is a whole file: invoking it writes its single code block
 * to disk with `<VK-xxx>` variables resolved. This module owns the two pure
 * decisions that need no `vscode`:
 *  - `resolveTemplateFileName` — the D3 extension-precedence chain
 *  - `validateTemplateBlocks`  — the D1 single-block restriction
 *
 * Both are `vscode`-free so they are unit-testable without an extension host.
 * The extension helpers come from `language-map.service.ts` (the single home
 * for language↔extension mapping since W0/O1).
 */
import { extForLang, normalizeLangId } from './language-map.service.js';
import type { ParsedArtifactFile } from '../types/parsed-artifact.types.js';

/** Inputs to `resolveTemplateFileName`. All optional — precedence fills the gaps. */
export interface TemplateFileNameArgs {
    /** The name the user typed (may already carry its own extension). */
    typed?: string;
    /** Frontmatter `extension:` value, with or without a leading dot. */
    frontmatterExt?: string;
    /** Fence language id (`artifact.frontmatter.language`) — the last-resort source. */
    langId?: string;
    /** Base name to use when nothing is typed (e.g. the artifact title/fileName). */
    fallbackBase?: string;
}

/** Result of the single-block guard — a discriminated union so callers narrow on `ok`. */
export type TemplateBlockCheck =
    | { ok: true }
    | { ok: false; reason: string };

// ── Security ────────────────────────────────────────────────────────────────────

/** Path-injection characters/sequences that must never reach a filename segment. */
const PATH_INJECTION_RE = /[/\\\0]|\.\./;

/**
 * Rejects a value that could break out of a single path segment. `extension:`
 * and the typed filename are both attacker-influenced (plan §5.2), so a value
 * carrying a separator, a `..`, or a NUL **throws** — it is never sanitised into
 * something plausible.
 *
 * @param value - The untrusted string (typed name or frontmatter extension).
 * @param label - Human label used in the thrown message.
 * @throws {Error} When `value` contains `/`, `\`, `..`, or a NUL byte.
 *
 * @example
 * assertNoPathInjection('Button.tsx', 'filename'); // ok
 * assertNoPathInjection('../x', 'filename');        // throws
 */
function assertNoPathInjection(value: string, label: string): void {
    if (PATH_INJECTION_RE.test(value)) {
        throw new Error(`Invalid ${label}: "${value}" contains a path separator, "..", or a NUL byte.`);
    }
}

/**
 * Reports whether a name already carries a usable extension: a dot that is not
 * the first character and has at least one non-dot/-separator char after it.
 *
 * @param name - The candidate filename.
 * @returns `true` when the name ends in `.<ext>` (leading-dot dotfiles excluded).
 *
 * @example
 * carriesExtension('Button.tsx')  // true
 * carriesExtension('Makefile')    // false
 * carriesExtension('.gitignore')  // false — a dotfile, not an extension
 */
function carriesExtension(name: string): boolean {
    const lastDot = name.lastIndexOf('.');
    return lastDot > 0 && lastDot < name.length - 1;
}

/**
 * Strips trailing `.` characters from a base name via a linear scan.
 *
 * Used instead of `replace(/\.+$/, '')` — an anchored `\.+$` trips SonarLint's
 * super-linear-backtracking heuristic (S8786); a character scan is unambiguously
 * linear and reads the same.
 *
 * @param s - The candidate base name.
 * @returns `s` with any trailing dots removed.
 *
 * @example
 * stripTrailingDots('name...') // 'name'
 * stripTrailingDots('name')    // 'name'
 */
function stripTrailingDots(s: string): string {
    let end = s.length;
    while (end > 0 && s[end - 1] === '.') { end--; }
    return s.slice(0, end);
}

// ── Exports ─────────────────────────────────────────────────────────────────────

/**
 * Resolves the output filename for a template following D3 precedence:
 * **user-typed → frontmatter `extension:` → fence language**.
 *
 * A typed name that already carries an extension wins whole. Otherwise the base
 * comes from `typed` (or `fallbackBase`, or `'template'`) and the extension from
 * `frontmatterExt` (dot optional) or, last, `extForLang(normalizeLangId(langId))`.
 * `typed` and `frontmatterExt` are path-injection vectors and throw on a
 * separator / `..` / NUL rather than being sanitised (§5.2).
 *
 * @param args - Typed name, frontmatter extension, fence langId, fallback base.
 * @returns The resolved filename (e.g. `'Button.tsx'`).
 * @throws {Error} When `typed` or `frontmatterExt` carries a path-injection char.
 *
 * @example
 * resolveTemplateFileName({ typed: 'Button', langId: 'tsx' })            // 'Button.tsx'
 * resolveTemplateFileName({ typed: 'Button.jsx', frontmatterExt: 'mjs' }) // 'Button.jsx'
 * resolveTemplateFileName({ typed: 'Button', frontmatterExt: '.mjs' })    // 'Button.mjs'
 */
export function resolveTemplateFileName(args: TemplateFileNameArgs): string {
    const typed = args.typed?.trim() ?? '';
    const fmExt = args.frontmatterExt?.trim() ?? '';

    if (typed !== '') { assertNoPathInjection(typed, 'filename'); }
    if (fmExt !== '') { assertNoPathInjection(fmExt, 'extension'); }

    // ── A typed name with its own extension is authoritative ──────────────────
    if (typed !== '' && carriesExtension(typed)) {
        return typed;
    }

    // ── Compose base + resolved extension ─────────────────────────────────────
    const rawBase = typed !== '' ? typed : (args.fallbackBase?.trim() ?? '');
    const base = stripTrailingDots(rawBase) || 'template';

    const ext = resolveExtension(fmExt, args.langId);
    return ext !== '' ? `${base}.${ext}` : base;
}

/**
 * Resolves the output filename for an **agent** create-file flow.
 *
 * Unlike a template, an agent's `target:` frontmatter (`CLAUDE.md`, `.cursorrules`,
 * `AGENTS.md`) **is already the complete intended filename** — it must be used
 * verbatim, never routed through the extension-appending chain (which would turn a
 * dotfile like `.cursorrules` into `.cursorrules.md`). When `target` is absent the
 * name falls back to the title/fileName, defaulting to a `.md` extension since agent
 * configs are markdown. `target` and the fallback base are path-injection vectors
 * and **throw** on a separator / `..` / NUL rather than being sanitised.
 *
 * @param args - `target` (frontmatter, may be empty) and `fallbackBase` (title/fileName).
 * @returns The resolved filename.
 * @throws {Error} When `target` or the fallback base carries a path-injection char.
 *
 * @example
 * resolveAgentFileName({ target: 'CLAUDE.md' })              // 'CLAUDE.md'
 * resolveAgentFileName({ target: '.cursorrules' })           // '.cursorrules'
 * resolveAgentFileName({ target: '', fallbackBase: 'Claude reviewer' }) // 'Claude reviewer.md'
 */
export function resolveAgentFileName(args: { target?: string; fallbackBase?: string }): string {
    const target = args.target?.trim() ?? '';
    if (target !== '') {
        assertNoPathInjection(target, 'target');
        return target;
    }
    const base = stripTrailingDots(args.fallbackBase?.trim() ?? '') || 'agent';
    assertNoPathInjection(base, 'filename');
    return carriesExtension(base) ? base : `${base}.md`;
}

/**
 * Picks the extension: frontmatter value (leading dot stripped) if present, else
 * the fence language resolved through the language map. Returns `''` when no
 * source yields one — the caller then writes an extension-less file.
 *
 * @param fmExt  - Frontmatter extension (already injection-checked, may be `''`).
 * @param langId - Fence language id (may be `undefined`).
 * @returns A bare extension without the leading dot, or `''`.
 *
 * @example
 * resolveExtension('.mjs', 'tsx') // 'mjs'
 * resolveExtension('', 'python')  // 'py'
 * resolveExtension('', undefined) // ''
 */
function resolveExtension(fmExt: string, langId: string | undefined): string {
    if (fmExt !== '') {
        return fmExt.replace(/^\.+/, '');
    }
    const lang = langId?.trim();
    if (lang !== undefined && lang !== '') {
        return extForLang(normalizeLangId(lang));
    }
    return '';
}

/**
 * Enforces D1: a template is a single code block. A parsed file with two or more
 * `##` blocks is a validation error (surfaced in the preview, no write happens).
 * An empty `blocks` array is the classic single-block shape — always ok.
 *
 * The same single-block rule guards the `agent` create-file flow — an agent
 * config is one file — so the human label is a parameter (`'template'` by
 * default, `'agent config'` for agents) rather than hardcoded in the message.
 *
 * @param parsed - The parsed file-writing artifact (template or agent).
 * @param label  - Singular noun for the message (defaults to `'template'`).
 * @returns `{ ok: true }` for 0–1 blocks; `{ ok: false, reason }` naming the count otherwise.
 *
 * @example
 * validateTemplateBlocks({ ...parsed, blocks: [] })                 // { ok: true }
 * validateTemplateBlocks({ ...parsed, blocks: [b1, b2] }, 'agent config') // { ok: false, reason: '…2 blocks…' }
 */
export function validateTemplateBlocks(parsed: ParsedArtifactFile, label = 'template'): TemplateBlockCheck {
    const count = parsed.blocks.length;
    if (count > 1) {
        return {
            ok: false,
            reason: `A ${label} must be a single code block, but this file has ${count} blocks. Split it into separate ${label} files.`,
        };
    }
    return { ok: true };
}
