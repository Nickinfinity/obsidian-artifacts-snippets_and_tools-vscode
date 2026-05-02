import * as vscode from 'vscode';
import { ARTIFACTS } from '../types/constants.js';

/**
 * Argument passed to `obsidian-artifacts.insert.artifact` by menu items.
 * The `dir` field matches the artifact's `dir` property in ARTIFACTS.
 */
export interface InsertArtifactArg {
	dir: string;
}

/**
 * Registers the two insert-related commands:
 *
 * - `obsidian-artifacts.insert.artifact` — single parameterised command for all artifact
 *   insert operations. Menu items pass `{"dir": "<ArtifactDir>"}` as the argument so one
 *   handler covers every artifact type. Adding a new artifact to constants.ts only requires
 *   a new menu entry in package.json — no new command registration.
 *
 * - `obsidian-artifacts.edit.variables` — dedicated command for the Variables artifact,
 *   which is an edit/view operation rather than an insert.
 *
 * Both are placeholders — replace the showInformationMessage body with real picker UI.
 *
 * @param {vscode.ExtensionContext} context - Extension context for subscription management
 */
export function registerInsertCommands(context: vscode.ExtensionContext): void {
	// Parameterised insert command — receives {dir} from the menu item's "args" field
	const insertDisposable = vscode.commands.registerCommand(
		'obsidian-artifacts.insert.artifact',
		(arg: InsertArtifactArg) => {
			// Look up the artifact by dir to get its display name
			const artifact = ARTIFACTS.find(a => a.dir === arg?.dir);
			const label = artifact?.name ?? arg?.dir ?? 'Artifact';

			// TODO: replace with quick-pick file picker from the vault directory
			vscode.window.showInformationMessage(
				`Obsidian Artifacts: Insert ${label} — coming soon!`
			);
		}
	);
	context.subscriptions.push(insertDisposable);

	// Dedicated command for Variables — edit/view semantics, not an insert
	const variablesDisposable = vscode.commands.registerCommand(
		'obsidian-artifacts.edit.variables',
		() => {
			// TODO: open variable picker / editor
			vscode.window.showInformationMessage(
				'Obsidian Artifacts: Edit/See Variables — coming soon!'
			);
		}
	);
	context.subscriptions.push(variablesDisposable);
}
