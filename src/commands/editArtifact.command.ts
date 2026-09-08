import * as vscode from 'vscode';
import { parseArtifactFile } from '../services/parser.service.js';
import { artifactToFormModel } from './create-prefill.helpers.js';
import { openArtifactFormPanel } from '../ui/panels/artifactForm/panel.js';
import { getVaultRootUri } from '../services/config.service.js';

/** Command id the preview pane's Edit action runs. */
export const EDIT_ARTIFACT_COMMAND_ID = 'obsidian-artifacts.editArtifact';

/**
 * Registers the edit-artifact command.
 *
 * Exists as a command rather than a direct call because `openArtifactFormPanel`
 * needs the `ExtensionContext`, which the preview controller does not carry —
 * the same reason every create entry point is a command. Routing Edit through
 * here means editing opens the *same* panel, in the same editor column, as
 * creating: one form, two modes.
 *
 * @param context - Extension context, forwarded to the form panel.
 * @returns The command registration, for `context.subscriptions`.
 *
 * @example
 * context.subscriptions.push(registerEditArtifactCommand(context));
 */
export function registerEditArtifactCommand(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand(EDIT_ARTIFACT_COMMAND_ID, (filePath: unknown) => {
        if (typeof filePath !== 'string' || filePath.length === 0) {
            return;
        }
        const vaultRoot = getVaultRootUri();
        if (!vaultRoot) {
            vscode.window.showErrorMessage('Could not open artifact for editing: vault not configured.');
            return;
        }
        // `parseArtifactFile` answers null for an unreadable or malformed file
        // rather than throwing, so this is the only failure branch to handle.
        const parsed = parseArtifactFile(filePath, vaultRoot.fsPath);
        if (!parsed) {
            vscode.window.showErrorMessage(`Could not read artifact: ${filePath}`);
            return;
        }
        const prefill = artifactToFormModel(parsed);
        const type = prefill.artifactType;
        if (!type) {
            vscode.window.showErrorMessage('Could not open artifact for editing: unrecognised artifact type.');
            return;
        }
        openArtifactFormPanel(context, {
            mode:      'edit',
            type,
            prefill,
            sourceUri: vscode.Uri.file(filePath),
        });
    });
}
