import * as vscode from 'vscode';

/**
 * VS Code settings section name for this extension.
 *
 * The single source of truth for the section string literal — every
 * `getConfiguration` / `affectsConfiguration` call in the extension routes
 * through this constant so the section can be renamed in one place.
 *
 * @example
 * vscode.workspace.getConfiguration(CONFIG_SECTION)
 */
export const CONFIG_SECTION = 'obsidianArtifacts';

/**
 * Reads the configured vault path from VS Code settings, trimmed.
 *
 * The single vault-path reader for the whole extension — every site that
 * used to open-code `getConfiguration('obsidianArtifacts').get<string>(...)`
 * calls this instead.
 *
 * @returns The trimmed `obsidianArtifacts.vaultPath` setting, or `''` when unset.
 *
 * @example
 * const vaultPath = getVaultPath();
 * if (!vaultPath) { return; }
 */
export function getVaultPath(): string {
    return vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .get<string>('vaultPath', '')
        .trim();
}

/**
 * Resolves the configured vault path to a `vscode.Uri`.
 *
 * @returns `vscode.Uri.file(getVaultPath())` when a vault is configured,
 *          otherwise `undefined`.
 *
 * @example
 * const root = getVaultRootUri();
 * if (root) { vscode.Uri.joinPath(root, 'Snippets'); }
 */
export function getVaultRootUri(): vscode.Uri | undefined {
    const vaultPath = getVaultPath();
    return vaultPath.length > 0 ? vscode.Uri.file(vaultPath) : undefined;
}
