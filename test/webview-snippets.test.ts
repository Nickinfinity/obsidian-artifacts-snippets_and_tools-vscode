import * as assert from 'node:assert';
import { escHtml } from '../src/utils/html.js';
import { labelForVar } from '../src/ui/panels/artifactPicker/preview.helpers.js';
import { WEBVIEW_ESC_LBL_JS } from '../src/ui/panels/artifactPicker/webviewSnippets.js';
import { CODE_BLOCK_CLIENT_JS } from '../src/ui/panels/artifactPicker/codeBlock.js';
import { PREVIEW_CLIENT_JS } from '../src/ui/panels/artifactPicker/preview.clientJs.js';
import { FORM_CLIENT_JS } from '../src/ui/panels/artifactForm/form.clientJs.js';

/**
 * Unit tests for Phase 6's shared webview `esc`/`lbl` snippet
 * (`webviewSnippets.ts`) and the security fix it enables in
 * `form.clientJs.ts`'s `renderVarsSection`.
 *
 * This test runtime is the VS Code *extension host* process
 * (`@vscode/test-electron`), which — unlike a webview — has no `document`/
 * `window` DOM. `esc`/`lbl` themselves are pure string functions with no DOM
 * dependency, so they can be extracted and evaluated directly. Anything that
 * needs a real `innerHTML`/`.textContent` round-trip is instead proven with a
 * hand-written decoder for the exact five named entities `esc` ever produces
 * — the standard, unambiguous HTML5 decoding for those five references, and
 * the same thing `.textContent` returns after `innerHTML` parses them. No
 * DOM library (e.g. jsdom) is added for this — see CLAUDE.md "No runtime
 * dependencies".
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Count non-overlapping occurrences of a regex in a string. */
function countMatches(html: string, pattern: RegExp): number {
    return (html.match(new RegExp(pattern.source, `g${pattern.flags.replace('g', '')}`)) ?? []).length;
}

/**
 * Evaluates `WEBVIEW_ESC_LBL_JS` and returns its `esc`/`lbl` functions as
 * real callables, so the tests below exercise the actual shipped source
 * text rather than a hand-copied re-implementation.
 *
 * @returns `{ esc, lbl }` extracted from the snippet.
 */
function loadWebviewEscLbl(): { esc: (s: string) => string; lbl: (name: string) => string } {
    const factory = new Function(`${WEBVIEW_ESC_LBL_JS}\nreturn { esc: esc, lbl: lbl };`) as () => {
        esc: (s: string) => string;
        lbl: (name: string) => string;
    };
    return factory();
}

/**
 * Decodes the five named entities `esc`/`escHtml` ever produce, in the order
 * that avoids re-corrupting a literal `&` that was itself part of an entity
 * (decode `&amp;` last — the mirror image of `esc` encoding it first).
 *
 * @param s - Text containing `&amp; &lt; &gt; &quot; &#39;` entities.
 * @returns Decoded plain text.
 */
function decodeEntities(s: string): string {
    return s
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
}

// ── esc matches canonical escHtml ───────────────────────────────────────────

suite('WEBVIEW_ESC_LBL_JS — esc matches canonical escHtml', () => {

    test('escapes the same 5 characters as escHtml, same output', () => {
        const { esc } = loadWebviewEscLbl();
        const sample = `it's "quoted" <tag> & more`;
        assert.strictEqual(esc(sample), escHtml(sample));
    });

    test('each of & < > " \' individually matches escHtml', () => {
        const { esc } = loadWebviewEscLbl();
        for (const ch of ['&', '<', '>', '"', "'"]) {
            assert.strictEqual(esc(ch), escHtml(ch));
        }
    });

    test('ampersand is escaped once, not double-escaped (order matches escHtml)', () => {
        const { esc } = loadWebviewEscLbl();
        assert.strictEqual(esc('&lt;'), escHtml('&lt;'));
    });
});

// ── esc round-trips through decode (proxy for a webview .textContent read) ─

suite('WEBVIEW_ESC_LBL_JS — esc round-trip', () => {

    test('a string containing " and \' round-trips through decode(esc(x))', () => {
        const { esc } = loadWebviewEscLbl();
        const raw = `He said "don't" & <run>`;
        assert.strictEqual(decodeEntities(esc(raw)), raw);
    });

    test('a string with only a double quote round-trips', () => {
        const { esc } = loadWebviewEscLbl();
        const raw = 'value with "quotes" inside';
        assert.strictEqual(decodeEntities(esc(raw)), raw);
    });

    test('a string with only a single quote round-trips', () => {
        const { esc } = loadWebviewEscLbl();
        const raw = "it's a value";
        assert.strictEqual(decodeEntities(esc(raw)), raw);
    });
});

// ── lbl matches canonical labelForVar (pinned inputs) ───────────────────────

/**
 * Pinned expected labels for `labelForVar` — see services-dry.md Phase 6:
 * three different hand-rolled implementations existed before this phase and
 * were claimed to "differ on edge cases (multiple underscores, leading
 * underscore, digits)". These are the concrete inputs the plan named.
 */
const LABEL_CASES: [string, string][] = [
    ['VK-host',     'Host'],
    ['VK-api_key',  'Api key'],
    ['VK-API_KEY',  'Api key'],
    ['VK-a_b_c',    'A b c'],
    ['VK-_leading', ' leading'],
    ['VK-x2y',      'X2y'],
    ['VK-UPPER',    'Upper'],
];

suite('labelForVar — pinned canonical values', () => {
    for (const [input, expected] of LABEL_CASES) {
        test(`labelForVar(${JSON.stringify(input)}) === ${JSON.stringify(expected)}`, () => {
            assert.strictEqual(labelForVar(input), expected);
        });
    }
});

suite('WEBVIEW_ESC_LBL_JS — lbl matches canonical labelForVar on every pinned input', () => {
    const { lbl } = loadWebviewEscLbl();
    for (const [input] of LABEL_CASES) {
        test(`lbl(${JSON.stringify(input)}) === labelForVar(${JSON.stringify(input)})`, () => {
            assert.strictEqual(lbl(input), labelForVar(input));
        });
    }
});

// ── Single definition per generated webview document ────────────────────────

suite('shared esc/lbl — defined exactly once per generated client-JS bundle', () => {

    test('CODE_BLOCK_CLIENT_JS defines esc and lbl exactly once', () => {
        assert.strictEqual(countMatches(CODE_BLOCK_CLIENT_JS, /function esc\(/), 1);
        assert.strictEqual(countMatches(CODE_BLOCK_CLIENT_JS, /function lbl\(/), 1);
    });

    test('PREVIEW_CLIENT_JS defines esc and lbl exactly once (inherited from CODE_BLOCK_CLIENT_JS)', () => {
        assert.strictEqual(countMatches(PREVIEW_CLIENT_JS, /function esc\(/), 1);
        assert.strictEqual(countMatches(PREVIEW_CLIENT_JS, /function lbl\(/), 1);
    });

    test('FORM_CLIENT_JS defines esc and lbl exactly once (inherited from CODE_BLOCK_CLIENT_JS)', () => {
        assert.strictEqual(countMatches(FORM_CLIENT_JS, /function esc\(/), 1);
        assert.strictEqual(countMatches(FORM_CLIENT_JS, /function lbl\(/), 1);
    });

    test('PREVIEW_CLIENT_JS no longer defines its own local lbl/esc inside rebuildVarInputs', () => {
        // Before this phase, rebuildVarInputs() nested its own `function lbl(...)`
        // and `function esc(...)` — collapsing to the shared snippet means those
        // nested definitions are gone, not merely renamed.
        const rebuildVarInputsBody = PREVIEW_CLIENT_JS.slice(PREVIEW_CLIENT_JS.indexOf('function rebuildVarInputs'));
        assert.strictEqual(countMatches(rebuildVarInputsBody, /function lbl\(/), 0);
        assert.strictEqual(countMatches(rebuildVarInputsBody, /function esc\(/), 0);
    });
});

// ── Security fix: form.clientJs.ts renderVarsSection escapes both attrs ─────

suite('FORM_CLIENT_JS renderVarsSection — variable name/default are escaped', () => {

    test('does not contain the old unescaped data-var interpolation', () => {
        assert.ok(!FORM_CLIENT_JS.includes(`data-var="' + v.name + '"`));
    });

    test('does not contain the old unescaped value interpolation', () => {
        assert.ok(!FORM_CLIENT_JS.includes(`value="' + v.defaultValue + '"`));
    });

    test('routes v.name through esc() for the data-var attribute', () => {
        assert.match(FORM_CLIENT_JS, /const safeName = esc\(v\.name\);/);
    });

    test('routes v.defaultValue through esc() for the value attribute', () => {
        assert.match(FORM_CLIENT_JS, /value="\s*'\s*\+\s*esc\(v\.defaultValue\)\s*\+/);
    });

    test('a defaultValue containing " and < renders as escaped entities', () => {
        const { esc } = loadWebviewEscLbl();
        const value = 'bad" <script>';
        const rendered = esc(value);
        assert.ok(!rendered.includes('"'));
        assert.ok(!rendered.includes('<'));
        assert.strictEqual(rendered, 'bad&quot; &lt;script&gt;');
    });

    test('data-var round-trips: decoding esc(name) recovers the original name', () => {
        const { esc } = loadWebviewEscLbl();
        const name = `VK-weird"name'`;
        assert.strictEqual(decodeEntities(esc(name)), name);
    });
});
