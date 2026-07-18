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
