/**
 * Client-side JS text fragments shared by more than one webview panel.
 *
 * A webview `<script>` cannot `import` the TS `escHtml` / `labelForVar`
 * helpers — it runs in an isolated browser context, not the extension host —
 * so every webview that needs the same behaviour has historically hand-rolled
 * its own copy. This module holds the one shared source string instead of a
 * copy per webview.
 *
 * Concatenate the exported constant(s) INSIDE an existing outer IIFE. They
 * never call `acquireVsCodeApi()` themselves — that call is legal only once
 * per webview, and stays owned by each panel's own outer script.
 */

/**
 * Webview-side `esc` / `lbl` helpers.
 *
 * `esc` mirrors `escHtml` (`src/utils/html.ts`) — the same five characters
 * (`& < > " '`), escaped in the same order, so extension-rendered HTML and
 * webview-re-rendered HTML never disagree on what needs escaping.
 *
 * `lbl` mirrors `labelForVar` (`preview.helpers.ts`) — strips a leading
 * `VK-`, replaces every `_` with a space, lowercases the result, then
 * capitalises the first character.
 *
 * Bundled inside `CODE_BLOCK_CLIENT_JS` (`codeBlock.ts`): every consumer of
 * that constant (`preview.clientJs.ts`, `form.clientJs.ts`) already
 * concatenates it first, so `esc`/`lbl` come along for free without a second
 * inclusion — which would print the function bodies twice into the same
 * generated document.
 *
 * @example
 * const script = `${WEBVIEW_ESC_LBL_JS}\nconsole.log(esc('<x>'), lbl('VK-api_key'));`
 * // → defines esc() and lbl() in the enclosing scope
 */
export const WEBVIEW_ESC_LBL_JS = /* javascript */`
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function lbl(name) {
    const hint = name.indexOf('VK-') === 0 ? name.slice(3) : name;
    const j    = hint.split('_').join(' ').toLowerCase();
    return j.charAt(0).toUpperCase() + j.slice(1);
  }
`;
