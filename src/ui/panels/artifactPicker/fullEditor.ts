import * as vscode from 'vscode';
import { extractVars, parseFromContent } from '../../../services/parser.service.js';
import type { ParsedArtifactFile } from '../../../types/parsed-artifact.types.js';
import { FULL_EDIT_VAR_SYNC_DEBOUNCE_MS } from './fullEditor.helpers.js';

/** Callback bag the controller uses to push state back to the navigator/preview owner. */
export interface FullEditCallbacks {
    /** Absolute filesystem path of the artifact root (passed to `parseFromContent`). */
    rootFs: string;
    /** Returns the artifact currently being previewed (or `undefined` if none). */
    getCurrentArtifact: () => ParsedArtifactFile | undefined;
    /** Updates the owner's `currentPreviewArtifact` after a save round-trip. */
    setCurrentArtifact: (artifact: ParsedArtifactFile) => void;
    /** Writes a freshly parsed artifact into the navigator's parse cache. */
    setCache: (uri: vscode.Uri, parsed: ParsedArtifactFile) => void;
    /** Posts a message to the preview webview (or no-op if the panel is gone). */
    postMessage: (msg: unknown) => void;
}

/**
 * Manages the side-effect surface of the **full-edit** mode: opening the real
 * `.md` file in a VS Code editor tab and watching it for changes.
 *
 * - `start(fileUri)` opens the file beside the popup and subscribes to save +
 *   change events.  Save → re-parse → `fileUpdated` post-message.  Change →
 *   debounced `updateVars` post-message (500 ms).
 * - `teardown()` disposes all watchers and cancels the debounce timer.  Safe to
 *   call multiple times; should always run before disposing the popup panel
 *   (otherwise a save could post into a disposed webview).
 *
 * @example
 * const fullEdit = new FullEditController({ rootFs, getCurrentArtifact, ... });
 * fullEdit.start(vscode.Uri.file(artifact.filePath));
 * // …later, when picker closes:
 * fullEdit.teardown();
 */
export class FullEditController {
    private subs: vscode.Disposable[] = [];
    private debounceTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(private readonly cb: FullEditCallbacks) {}

    /**
     * Opens the file beside the popup panel and wires `onDidSaveTextDocument`
     * + `onDidChangeTextDocument` listeners scoped to that URI.
     *
     * Replaces any previously active subscriptions before re-arming.
     *
     * @param fileUri - The real artifact file to edit.
     *
     * @example
     * controller.start(vscode.Uri.file('/vault/Snippets/foo.md'));
     */
    start(fileUri: vscode.Uri): void {
        this.teardown();
        void vscode.window.showTextDocument(fileUri, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false });

        const uriKey = fileUri.toString();
        this.subs.push(
            vscode.workspace.onDidSaveTextDocument(doc => {
                if (doc.uri.toString() !== uriKey) { return; }
                void this.onSave(doc.getText(), fileUri);
            }),
            vscode.workspace.onDidChangeTextDocument(change => {
                if (change.document.uri.toString() !== uriKey) { return; }
                if (this.debounceTimer) { clearTimeout(this.debounceTimer); }
                this.debounceTimer = setTimeout(
                    () => this.flushVarSync(change.document),
                    FULL_EDIT_VAR_SYNC_DEBOUNCE_MS,
                );
            }),
        );
    }

    /**
     * Disposes all active subscriptions and cancels any pending debounce timer.
     * Safe to call multiple times.
     *
     * @example
     * controller.teardown();
     */
    teardown(): void {
        this.subs.forEach(s => s.dispose());
        this.subs = [];
        if (this.debounceTimer) { clearTimeout(this.debounceTimer); this.debounceTimer = undefined; }
    }

    private flushVarSync(doc: vscode.TextDocument): void {
        this.debounceTimer = undefined;
        const vars = extractVars(doc.getText());
        this.cb.postMessage({ command: 'updateVars', vars });
    }

    private async onSave(content: string, fileUri: vscode.Uri): Promise<void> {
        const artifact = this.cb.getCurrentArtifact();
        if (!artifact) { return; }
        const updated = parseFromContent(content, fileUri.fsPath, this.cb.rootFs);
        this.cb.setCache(fileUri, updated);
        this.cb.setCurrentArtifact(updated);
        this.cb.postMessage({ command: 'fileUpdated', artifact: updated });
    }
}
