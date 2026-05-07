/**
 * HTML escape used inside the codeBlock client-side script (string-template
 * builder).  Kept in its own module so the JS payload string in `codeBlock.ts`
 * stays focused on logic, and so future tests can target the helper directly.
 *
 * @param s - Raw text to escape.
 * @returns HTML-safe string.
 *
 * @example
 * escForJsTemplate('<a>') // → '&lt;a&gt;'
 */
export function escForJsTemplate(s: string): string {
    return s.replaceAll(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
