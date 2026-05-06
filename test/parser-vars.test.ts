import * as assert from 'node:assert';
import { extractVars, resolveVars } from '../src/services/parser.service.js';

/**
 * Unit tests for extractVars(code: string): ParsedVar[].
 *
 * The function scans a string for <VK-hint> tokens — where "VK-" is a required
 * prefix and "hint" is a non-empty identifier — and returns one deduplicated
 * ParsedVar per unique token, with defaultValue always ''.
 *
 * The function does NOT exist yet; all tests here should fail until it is
 * implemented and exported from parser.service.ts.
 */
suite('extractVars', () => {

    // ── Positive matches ─────────────────────────────────────────────────────

    test('single var returns one ParsedVar with the full token as name and empty defaultValue', () => {
        const result = extractVars('<VK-items>');
        assert.deepStrictEqual(result, [{ name: 'VK-items', defaultValue: '' }]);
    });

    test('multiple distinct vars in one string are all returned in order of first appearance', () => {
        const result = extractVars('<VK-host> <VK-port> <VK-path>');
        assert.deepStrictEqual(result, [
            { name: 'VK-host',  defaultValue: '' },
            { name: 'VK-port',  defaultValue: '' },
            { name: 'VK-path',  defaultValue: '' },
        ]);
    });

    test('repeated var is deduplicated — only the first occurrence is kept', () => {
        const result = extractVars('<VK-items> and <VK-items> and <VK-items>');
        assert.deepStrictEqual(result, [{ name: 'VK-items', defaultValue: '' }]);
    });

    test('camelCase hint <VK-myVar> is valid', () => {
        const result = extractVars('<VK-myVar>');
        assert.deepStrictEqual(result, [{ name: 'VK-myVar', defaultValue: '' }]);
    });

    test('UPPER_SNAKE_CASE hint <VK-MY_VAR> is valid', () => {
        const result = extractVars('<VK-MY_VAR>');
        assert.deepStrictEqual(result, [{ name: 'VK-MY_VAR', defaultValue: '' }]);
    });

    test('PascalCase hint <VK-MyComponent> is valid', () => {
        const result = extractVars('<VK-MyComponent>');
        assert.deepStrictEqual(result, [{ name: 'VK-MyComponent', defaultValue: '' }]);
    });

    test('mixed-casing vars in one string all extracted correctly', () => {
        const result = extractVars('<VK-myVar> <VK-MY_VAR> <VK-MyComponent>');
        assert.deepStrictEqual(result, [
            { name: 'VK-myVar',       defaultValue: '' },
            { name: 'VK-MY_VAR',      defaultValue: '' },
            { name: 'VK-MyComponent', defaultValue: '' },
        ]);
    });

    test('vars embedded in real JS code are all extracted', () => {
        const code = 'const x = <VK-items>.filter(i => i.<VK-prop> === <VK-value>)';
        const result = extractVars(code);
        assert.deepStrictEqual(result, [
            { name: 'VK-items', defaultValue: '' },
            { name: 'VK-prop',  defaultValue: '' },
            { name: 'VK-value', defaultValue: '' },
        ]);
    });

    // ── Negative matches — nothing should be extracted ───────────────────────

    test('plain HTML tags <div> and <span> produce no matches', () => {
        assert.deepStrictEqual(
            extractVars('<div><span>Hello</span></div>'),
            [],
        );
    });

    test('Vue-style components <v-btn> and <v-card> produce no matches', () => {
        assert.deepStrictEqual(
            extractVars('<v-btn @click="go"><v-card></v-card></v-btn>'),
            [],
        );
    });

    test('TypeScript generics Array<string> and Map<K,V> produce no matches', () => {
        assert.deepStrictEqual(
            extractVars('const a: Array<string> = []; const m: Map<K,V> = new Map();'),
            [],
        );
    });

    test('JSX component <MyComponent> produces no match', () => {
        assert.deepStrictEqual(
            extractVars('<MyComponent prop="val" />'),
            [],
        );
    });

    test('old {{variable}} placeholder syntax produces no matches', () => {
        assert.deepStrictEqual(
            extractVars('Hello {{name}}, your order {{orderId}} is ready.'),
            [],
        );
    });

    test('<VK> with no hyphen and no hint produces no match', () => {
        assert.deepStrictEqual(extractVars('<VK>'), []);
    });

    test('<VK-> with empty hint produces no match', () => {
        assert.deepStrictEqual(extractVars('<VK->'), []);
    });

    test('empty string returns empty array', () => {
        assert.deepStrictEqual(extractVars(''), []);
    });

});

/**
 * Unit tests for resolveVars(code: string, vars: Record<string, string>): string.
 *
 * The function replaces every <VK-hint> token in `code` whose key exists in `vars`
 * with the corresponding value. Tokens absent from the map are left unchanged.
 * Non-VK syntax (<div>, Array<string>, ${x}, {{x}}) is never touched.
 *
 * The function does NOT exist yet; all tests here should fail until it is
 * implemented and exported from parser.service.ts.
 */
suite('resolveVars', () => {

    // ── Single and multiple replacements ─────────────────────────────────────

    test('single token is replaced with its mapped value', () => {
        const result = resolveVars('<VK-name>', { 'VK-name': 'Alice' });
        assert.strictEqual(result, 'Alice');
    });

    test('multiple distinct tokens in one string are all replaced', () => {
        const result = resolveVars(
            'Host: <VK-host>, Port: <VK-port>',
            { 'VK-host': 'localhost', 'VK-port': '8080' },
        );
        assert.strictEqual(result, 'Host: localhost, Port: 8080');
    });

    test('repeated token is replaced in every position', () => {
        const result = resolveVars(
            '<VK-env>/<VK-env>/<VK-env>',
            { 'VK-env': 'prod' },
        );
        assert.strictEqual(result, 'prod/prod/prod');
    });

    // ── Unresolved tokens survive ─────────────────────────────────────────────

    test('token absent from the map is left as-is', () => {
        const result = resolveVars('<VK-unknown>', {});
        assert.strictEqual(result, '<VK-unknown>');
    });

    test('unmapped token is preserved while mapped token is replaced', () => {
        const result = resolveVars(
            'Bearer <VK-token> for <VK-user>',
            { 'VK-token': 'abc123' },
        );
        assert.strictEqual(result, 'Bearer abc123 for <VK-user>');
    });

    // ── No-op cases ───────────────────────────────────────────────────────────

    test('code with no VK tokens is returned unchanged', () => {
        const code = 'console.log("hello world");';
        assert.strictEqual(resolveVars(code, { 'VK-x': 'y' }), code);
    });

    test('empty vars map returns code unchanged', () => {
        const code = 'const url = <VK-host>/<VK-path>';
        assert.strictEqual(resolveVars(code, {}), code);
    });

    // ── Non-VK syntax is never touched ───────────────────────────────────────

    test('plain HTML tags are left unchanged', () => {
        const code = '<div class="app"><span>text</span></div>';
        assert.strictEqual(resolveVars(code, {}), code);
    });

    test('TypeScript generic syntax Array<string> is left unchanged', () => {
        const code = 'const items: Array<string> = [];';
        assert.strictEqual(resolveVars(code, {}), code);
    });

    test('template literal ${expr} is left unchanged', () => {
        const code = 'const msg = `Hello ${name}`;';
        assert.strictEqual(resolveVars(code, {}), code);
    });

    test('Handlebars {{variable}} syntax is left unchanged', () => {
        const code = 'Hello {{firstName}} {{lastName}}';
        assert.strictEqual(resolveVars(code, {}), code);
    });

    test('mix of non-VK syntax and VK tokens — only VK tokens replaced', () => {
        const code = '<div>{{greeting}} <VK-name>, you have ${count} items.</div>';
        const result = resolveVars(code, { 'VK-name': 'Bob' });
        assert.strictEqual(result, '<div>{{greeting}} Bob, you have ${count} items.</div>');
    });

});
