import * as assert from 'node:assert';
import { parseBlocks } from '../src/services/parser.service.js';

/**
 * Unit tests for parseBlocks(content: string): ParsedBlock[].
 *
 * Structural tests (heading, description, fenceLang, multi-line code) pass today.
 * Var-detection tests FAIL until the implementation is updated to scan for
 * <VK-xxx> tokens instead of the legacy {{PLACEHOLDER}} pattern.
 */
suite('parseBlocks', () => {

    // ── Single block ──────────────────────────────────────────────────────────

    test('single heading and fence returns a one-element array', () => {
        const content = [
            '---',
            'type: snippet',
            '---',
            '',
            '## Greeting',
            '```bash',
            'echo hello',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].heading, 'Greeting');
        assert.strictEqual(blocks[0].code, 'echo hello');
    });

    // ── Multiple blocks ───────────────────────────────────────────────────────

    test('multiple headings are returned in document order', () => {
        const content = [
            '## Alpha',
            '```js',
            'a();',
            '```',
            '',
            '## Beta',
            '```js',
            'b();',
            '```',
            '',
            '## Gamma',
            '```js',
            'c();',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.strictEqual(blocks.length, 3);
        assert.strictEqual(blocks[0].heading, 'Alpha');
        assert.strictEqual(blocks[1].heading, 'Beta');
        assert.strictEqual(blocks[2].heading, 'Gamma');
    });

    // ── Description ───────────────────────────────────────────────────────────

    test('description is the text between the heading line and the opening fence', () => {
        const content = [
            '## Deploy',
            'Deploys the current build to the target environment.',
            '```bash',
            'npm run deploy',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.strictEqual(blocks[0].description, 'Deploys the current build to the target environment.');
    });

    test('heading immediately followed by a fence has an empty description', () => {
        const content = [
            '## Silent',
            '```bash',
            'true',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.strictEqual(blocks[0].description, '');
    });

    // ── Fence language ────────────────────────────────────────────────────────

    test('fence language tag is captured in fenceLang', () => {
        const content = [
            '## Module',
            '```javascript',
            'const x = 1;',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.strictEqual(blocks[0].fenceLang, 'javascript');
    });

    test('fence with no language tag leaves fenceLang undefined', () => {
        const content = [
            '## Raw',
            '```',
            'raw content',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.strictEqual(blocks[0].fenceLang, undefined);
    });

    // ── Multi-line code ───────────────────────────────────────────────────────

    test('multi-line code block is captured in full with internal newlines preserved', () => {
        const content = [
            '## Script',
            '```bash',
            'line one',
            'line two',
            'line three',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.strictEqual(blocks[0].code, 'line one\nline two\nline three');
    });

    // ── Var auto-detection via <VK-xxx> ───────────────────────────────────────
    // These tests fail until parseBlocks is updated to use the <VK-xxx> pattern.

    test('block with no VK tokens has vars: []', () => {
        const content = [
            '## Static',
            '```bash',
            'echo done',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.deepStrictEqual(blocks[0].vars, []);
    });

    test('VK tokens in block code are extracted as vars in order of appearance', () => {
        const content = [
            '## Endpoint',
            '```bash',
            'curl <VK-host>/<VK-path>',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.deepStrictEqual(blocks[0].vars, [
            { name: 'VK-host', defaultValue: '' },
            { name: 'VK-path', defaultValue: '' },
        ]);
    });

    test('repeated VK token within one block is deduplicated', () => {
        const content = [
            '## Repeated',
            '```bash',
            'echo <VK-env> && echo <VK-env>',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.deepStrictEqual(blocks[0].vars, [{ name: 'VK-env', defaultValue: '' }]);
    });

    test('same var name in two blocks is listed independently in each block', () => {
        const content = [
            '## Dev',
            '```bash',
            'http://<VK-host>/dev',
            '```',
            '',
            '## Prod',
            '```bash',
            'https://<VK-host>/prod',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.deepStrictEqual(blocks[0].vars, [{ name: 'VK-host', defaultValue: '' }]);
        assert.deepStrictEqual(blocks[1].vars, [{ name: 'VK-host', defaultValue: '' }]);
    });

    test('vars are scoped to their block — adjacent blocks do not bleed', () => {
        const content = [
            '## WithVar',
            '```bash',
            'echo <VK-name>',
            '```',
            '',
            '## NoVar',
            '```bash',
            'echo static',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.deepStrictEqual(blocks[0].vars, [{ name: 'VK-name', defaultValue: '' }]);
        assert.deepStrictEqual(blocks[1].vars, []);
    });

    // ── Edge cases ────────────────────────────────────────────────────────────

    test('content with no ## headings returns empty array (single-block file path)', () => {
        const content = [
            '---',
            'type: snippet',
            '---',
            '',
            '```bash',
            'echo hello',
            '```',
        ].join('\n');
        assert.deepStrictEqual(parseBlocks(content), []);
    });

    test('frontmatter is stripped and not parsed as a block', () => {
        const content = [
            '---',
            'type: snippet',
            'title: Only One Block',
            '---',
            '',
            '## First Block',
            '```bash',
            'echo hi',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].heading, 'First Block');
    });

    test('empty string returns empty array', () => {
        assert.deepStrictEqual(parseBlocks(''), []);
    });

    // ── Vars-fence support (multi-block variable sets) ────────────────────────

    test('```vks fence parses KEY=value pairs into block.vars', () => {
        const content = [
            '## Local Dev',
            '```vks',
            'VK-host=localhost',
            'VK-port=3000',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].fenceLang, 'vks');
        assert.deepStrictEqual(blocks[0].vars, [
            { name: 'VK-host', defaultValue: 'localhost' },
            { name: 'VK-port', defaultValue: '3000' },
        ]);
    });

    test('```vks fence with empty value yields defaultValue: ""', () => {
        const content = [
            '## Empty Defaults',
            '```vks',
            'VK-token=',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.deepStrictEqual(blocks[0].vars, [{ name: 'VK-token', defaultValue: '' }]);
    });

    test('multi-block variable file: each ```vks fence yields its own KEY=value vars', () => {
        const content = [
            '## Dev',
            '```vks',
            'VK-host=localhost',
            '```',
            '',
            '## Prod',
            '```vks',
            'VK-host=prod.example.com',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.deepStrictEqual(blocks[0].vars, [{ name: 'VK-host', defaultValue: 'localhost' }]);
        assert.deepStrictEqual(blocks[1].vars, [{ name: 'VK-host', defaultValue: 'prod.example.com' }]);
    });

    // ── Code fence + trailing ```vks fence: default values for detected vars ──

    test('```vks fence after a code fence applies defaults to detected VK vars', () => {
        const content = [
            '## Filter',
            'Filter items.',
            '```javascript',
            'const <VK-result> = <VK-array>.filter(i => i.<VK-prop> === <VK-value>);',
            '```',
            '```vks',
            'VK-result=filtered',
            'VK-array=items',
            'VK-prop=status',
            'VK-value="active"',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].fenceLang, 'javascript');
        assert.strictEqual(blocks[0].code, 'const <VK-result> = <VK-array>.filter(i => i.<VK-prop> === <VK-value>);');
        assert.strictEqual(blocks[0].description, 'Filter items.');
        assert.deepStrictEqual(blocks[0].vars, [
            { name: 'VK-result', defaultValue: 'filtered' },
            { name: 'VK-array', defaultValue: 'items' },
            { name: 'VK-prop', defaultValue: 'status' },
            { name: 'VK-value', defaultValue: '"active"' },
        ]);
    });

    test('detected var with no matching ```vks line keeps defaultValue: ""', () => {
        const content = [
            '## Partial',
            '```javascript',
            'const <VK-a> = <VK-b>;',
            '```',
            '```vks',
            'VK-a=1',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.deepStrictEqual(blocks[0].vars, [
            { name: 'VK-a', defaultValue: '1' },
            { name: 'VK-b', defaultValue: '' },
        ]);
    });

    test('```vks line with no matching code token is appended after detected vars', () => {
        const content = [
            '## Extra',
            '```javascript',
            'const <VK-a> = 1;',
            '```',
            '```vks',
            'VK-a=10',
            'VK-unused=99',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.deepStrictEqual(blocks[0].vars, [
            { name: 'VK-a', defaultValue: '10' },
            { name: 'VK-unused', defaultValue: '99' },
        ]);
    });

    test('code+vars fence pairs are scoped per block', () => {
        const content = [
            '## One',
            '```javascript',
            'f(<VK-x>);',
            '```',
            '```vks',
            'VK-x=alpha',
            '```',
            '',
            '## Two',
            '```javascript',
            'g(<VK-x>);',
            '```',
            '```vks',
            'VK-x=beta',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.deepStrictEqual(blocks[0].vars, [{ name: 'VK-x', defaultValue: 'alpha' }]);
        assert.deepStrictEqual(blocks[1].vars, [{ name: 'VK-x', defaultValue: 'beta' }]);
        assert.strictEqual(blocks[0].code, 'f(<VK-x>);');
        assert.strictEqual(blocks[1].code, 'g(<VK-x>);');
    });

    test('arbitrary marker text between code fence and ```vks fence is ignored', () => {
        const content = [
            '## Group',
            'Bucket an array.',
            '```javascript',
            'const <VK-result> = <VK-array>.reduce(acc => acc, {});',
            '```',
            '',
            '### VKs:',
            '',
            '```vks',
            'VK-result=grouped',
            'VK-array=items',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].heading, 'Group');
        assert.strictEqual(blocks[0].description, 'Bucket an array.');
        assert.strictEqual(blocks[0].code, 'const <VK-result> = <VK-array>.reduce(acc => acc, {});');
        assert.deepStrictEqual(blocks[0].vars, [
            { name: 'VK-result', defaultValue: 'grouped' },
            { name: 'VK-array', defaultValue: 'items' },
        ]);
    });

    test('marker text + ```vks scoped per block across two sections', () => {
        const content = [
            '## One',
            '```javascript',
            'f(<VK-x>);',
            '```',
            'whatever marker',
            '```vks',
            'VK-x=alpha',
            '```',
            '',
            '## Two',
            '```javascript',
            'g(<VK-x>);',
            '```',
            '--- notes ---',
            '```vks',
            'VK-x=beta',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.deepStrictEqual(blocks[0].vars, [{ name: 'VK-x', defaultValue: 'alpha' }]);
        assert.deepStrictEqual(blocks[1].vars, [{ name: 'VK-x', defaultValue: 'beta' }]);
    });

    test('code fence with no trailing ```vks fence still yields empty-default vars', () => {
        const content = [
            '## NoDefaults',
            '```javascript',
            'const <VK-z> = 1;',
            '```',
        ].join('\n');
        const blocks = parseBlocks(content);
        assert.deepStrictEqual(blocks[0].vars, [{ name: 'VK-z', defaultValue: '' }]);
    });

});
