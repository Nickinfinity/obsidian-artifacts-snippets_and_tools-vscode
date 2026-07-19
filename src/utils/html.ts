/**
 * HTML escaping for webview output.
 *
 * Single source of truth — before this module the same function existed three
 * times (`artifactPicker/preview.helpers.ts`, `artifactForm/form.helpers.ts`,
 * and a private 4-character variant inside `services/render.service.ts`).
 * Every value interpolated into generated webview HTML goes through here.
 */

// ── Escape table ──────────────────────────────────────────────────────────────

/**
 * Character → entity map.
 *
 * Hoisted to module scope so the object literal is built once rather than once
 * per replaced character.
 */
const HTML_ESCAPE_MAP: Readonly<Record<string, string>> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

/** Matches every character that must be escaped before HTML interpolation. */
const HTML_ESCAPE_RE = /[&<>"']/g;

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Escapes `&`, `<`, `>`, `"`, and `'` for safe HTML text content.
 *
 * Both quote forms are escaped so the result is safe inside a single- or
 * double-quoted attribute as well as in element text.
 *
 * @param s - Plain text to escape.
 * @returns HTML-safe string.
 *
 * @example
 * escHtml('<div>')       // → '&lt;div&gt;'
 * escHtml(`it's "x"`)    // → 'it&#39;s &quot;x&quot;'
 */
export function escHtml(s: string): string {
    return s.replaceAll(HTML_ESCAPE_RE, c => HTML_ESCAPE_MAP[c]!);
}

/**
 * Builds `<link rel="stylesheet">` tags for one or more webview stylesheet URIs.
 *
 * The stylesheet was a single 953-line file until the services-dry refactor
 * split it per feature, so every webview now loads a small set rather than one
 * monolith. Accepts a bare string as well as an array so existing single-sheet
 * callers keep emitting byte-identical markup.
 *
 * @param uris - One webview URI, or an ordered list of them. Empty entries are
 *               skipped; order is preserved because CSS cascade depends on it.
 * @returns Newline-joined `<link>` tags, or `''` when nothing is supplied.
 *
 * @example
 * styleLinkTags('vscode-resource://x/base.css')
 * // → '<link rel="stylesheet" href="vscode-resource://x/base.css">'
 * styleLinkTags(['/base.css', '/form.css'])
 * // → two <link> tags, base first
 */
export function styleLinkTags(uris: string | string[]): string {
    const list = typeof uris === 'string' ? [uris] : uris;
    return list
        .filter(u => u !== '')
        .map(u => `<link rel="stylesheet" href="${escHtml(u)}">`)
        .join('\n');
}
