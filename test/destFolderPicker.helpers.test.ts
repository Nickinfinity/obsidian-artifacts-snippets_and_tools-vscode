import * as assert from 'node:assert';
import * as vscode from 'vscode';
import {
    buildBreadcrumb,
    isWithinRoot,
    filterDirEntries,
} from '../src/ui/panels/destFolderPicker.panel.js';

/**
 * Unit tests for the three pure helper exports from `destFolderPicker.panel`.
 *
 * All helpers are stateless and do not require disk I/O, so they can be tested
 * synchronously without a temp directory.
 */

// ── buildBreadcrumb ───────────────────────────────────────────────────────────

suite('buildBreadcrumb', () => {

    test('returns "/" when currentUri equals rootUri', () => {
        const root = vscode.Uri.file('/vault/Snippets');
        assert.strictEqual(buildBreadcrumb(root, root), '/');
    });

    test('returns POSIX relative path for a direct child', () => {
        const root = vscode.Uri.file('/vault/Snippets');
        const child = vscode.Uri.joinPath(root, 'Web');
        assert.strictEqual(buildBreadcrumb(root, child), 'Web');
    });

    test('returns POSIX relative path for a nested child', () => {
        const root = vscode.Uri.file('/vault/Snippets');
        const nested = vscode.Uri.joinPath(root, 'Web', 'React');
        assert.strictEqual(buildBreadcrumb(root, nested), 'Web/React');
    });
});

// ── isWithinRoot ──────────────────────────────────────────────────────────────

suite('isWithinRoot', () => {

    test('returns true when candidate equals root', () => {
        const root = vscode.Uri.file('/vault/Snippets');
        assert.strictEqual(isWithinRoot(root, root), true);
    });

    test('returns true for direct child', () => {
        const root = vscode.Uri.file('/vault/Snippets');
        const child = vscode.Uri.joinPath(root, 'Web');
        assert.strictEqual(isWithinRoot(root, child), true);
    });

    test('returns true for deeply nested path', () => {
        const root = vscode.Uri.file('/vault/Snippets');
        const deep = vscode.Uri.joinPath(root, 'a', 'b', 'c');
        assert.strictEqual(isWithinRoot(root, deep), true);
    });

    test('returns false for sibling directory that shares prefix', () => {
        const root = vscode.Uri.file('/vault/Snippets');
        const sibling = vscode.Uri.file('/vault/Snippets-extra');
        assert.strictEqual(isWithinRoot(root, sibling), false);
    });

    test('returns false for completely unrelated path', () => {
        const root = vscode.Uri.file('/vault/Snippets');
        const other = vscode.Uri.file('/tmp/evil');
        assert.strictEqual(isWithinRoot(root, other), false);
    });
});

// ── filterDirEntries ──────────────────────────────────────────────────────────

suite('filterDirEntries', () => {

    const Dir  = vscode.FileType.Directory;
    const File = vscode.FileType.File;

    test('keeps directories, drops files', () => {
        const entries: [string, vscode.FileType][] = [
            ['Web',         Dir],
            ['snippet.md',  File],
            ['Components',  Dir],
        ];
        const result = filterDirEntries(entries);
        assert.deepStrictEqual(result.map(([n]) => n), ['Web', 'Components']);
    });

    test('drops dotfile directories', () => {
        const entries: [string, vscode.FileType][] = [
            ['.hidden', Dir],
            ['Visible',  Dir],
        ];
        const result = filterDirEntries(entries);
        assert.deepStrictEqual(result.map(([n]) => n), ['Visible']);
    });

    test('returns empty array when no directories', () => {
        const entries: [string, vscode.FileType][] = [
            ['foo.md', File],
            ['bar.md', File],
        ];
        assert.deepStrictEqual(filterDirEntries(entries), []);
    });

    test('returns empty array for empty input', () => {
        assert.deepStrictEqual(filterDirEntries([]), []);
    });

    test('preserves order of directory entries', () => {
        const entries: [string, vscode.FileType][] = [
            ['Zebra',   Dir],
            ['Alpha',   Dir],
            ['Middle',  Dir],
        ];
        const result = filterDirEntries(entries);
        assert.deepStrictEqual(result.map(([n]) => n), ['Zebra', 'Alpha', 'Middle']);
    });
});
