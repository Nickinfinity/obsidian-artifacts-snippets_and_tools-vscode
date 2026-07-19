import * as assert from 'node:assert';
import { escHtml } from '../src/utils/html.js';

/**
 * Unit tests for escHtml — the single HTML escaper shared by every webview
 * renderer (Phase 1 of the services-dry refactor merged three copies into it).
 *
 * The 5-character set matters: the two panel copies escaped `'` while the
 * private copy in render.service.ts did not. The unified function escapes all
 * five, so output is safe inside single-quoted attributes too.
 */

// ── Per-character coverage ────────────────────────────────────────────────────

suite('escHtml — individual characters', () => {

    /**
     * @example
     * escHtml('&') === '&amp;'
     */
    test('ampersand', () => {
        assert.strictEqual(escHtml('&'), '&amp;');
    });

    test('less-than', () => {
        assert.strictEqual(escHtml('<'), '&lt;');
    });

    test('greater-than', () => {
        assert.strictEqual(escHtml('>'), '&gt;');
    });

    test('double quote', () => {
        assert.strictEqual(escHtml('"'), '&quot;');
    });

    test('single quote — the character the render.service copy missed', () => {
        assert.strictEqual(escHtml("'"), '&#39;');
    });
});

// ── Combined / real-world input ───────────────────────────────────────────────

suite('escHtml — combined input', () => {

    /**
     * @example
     * escHtml('<script>') === '&lt;script&gt;'
     */
    test('escapes a script tag', () => {
        assert.strictEqual(escHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    test('escapes every character of a mixed string', () => {
        assert.strictEqual(escHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
    });

    test('ampersand is escaped once, not double-escaped', () => {
        assert.strictEqual(escHtml('&lt;'), '&amp;lt;');
    });

    test('escapes a VK token so it renders as text', () => {
        assert.strictEqual(escHtml('<VK-host>'), '&lt;VK-host&gt;');
    });

    test('leaves text with no special characters unchanged', () => {
        assert.strictEqual(escHtml('const x = 1;'), 'const x = 1;');
    });

    test('empty string returns empty string', () => {
        assert.strictEqual(escHtml(''), '');
    });

    test('repeated calls are independent (no shared regex lastIndex leak)', () => {
        assert.strictEqual(escHtml('<a>'), '&lt;a&gt;');
        assert.strictEqual(escHtml('<a>'), '&lt;a&gt;');
        assert.strictEqual(escHtml('<a>'), '&lt;a&gt;');
    });
});
