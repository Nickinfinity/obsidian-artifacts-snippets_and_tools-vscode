/**
 * Maps VS Code `languageId` strings to the conventional hljs / Obsidian fence
 * info-strings used in vault `.md` files.
 *
 * VS Code sometimes uses different identifiers than the fence info-strings that
 * hljs and Obsidian expect (e.g. `typescriptreact` vs `tsx`). This module
 * provides a single lookup point so all callers stay consistent.
 *
 * Adding a new alias is a one-line change to `MAP`.
 */

// ── Mapping table ─────────────────────────────────────────────────────────────

/** VS Code languageId → conventional fence info-string. */
const MAP: Readonly<Record<string, string>> = {
    typescriptreact: 'tsx',
    javascriptreact: 'jsx',
    shellscript: 'bash',
    dockerfile: 'dockerfile',
    'objective-c': 'objc',
    'objective-cpp': 'objcpp',
};

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Converts a VS Code `languageId` to the fence info-string used in vault `.md`
 * files. Unknown ids are returned unchanged so callers never receive an empty
 * string when the id is simply not in the table.
 *
 * @param id - The VS Code `languageId` (e.g. `'typescriptreact'`).
 * @returns The fence info-string (e.g. `'tsx'`), or `id` if not mapped.
 *
 * @example
 * mapLanguageId('typescriptreact') // 'tsx'
 * mapLanguageId('javascript')      // 'javascript'
 * mapLanguageId('')                // ''
 */
export function mapLanguageId(id: string): string {
    return MAP[id] ?? id;
}
