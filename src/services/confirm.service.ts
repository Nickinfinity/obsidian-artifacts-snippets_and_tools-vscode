import * as vscode from 'vscode';

/**
 * Shows a modal confirmation and reports whether the user accepted.
 *
 * **THE** modal-confirm helper. Every destructive or overwriting action in the
 * extension routes through it, because the same three-line shape was being
 * written per call site and the important part — that Cancel *and* Escape both
 * mean no — is easy to get subtly wrong: `showWarningMessage` resolves
 * `undefined` for either, so the single equality check below covers both, and
 * a hand-rolled `!== 'Cancel'` would treat Escape as consent.
 *
 * @param opts - `message` (the question), optional `detail` (consequences),
 *               and `action` (the confirming button's label).
 * @returns `true` only when the user pressed the action button.
 *
 * @example
 * if (await confirmModal({ message: 'Overwrite demo.md?', action: 'Overwrite' })) { … }
 */
export async function confirmModal(opts: {
    message: string;
    detail?: string;
    action: string;
}): Promise<boolean> {
    const answer = await vscode.window.showWarningMessage(
        opts.message,
        { modal: true, ...(opts.detail ? { detail: opts.detail } : {}) },
        opts.action,
    );
    return answer === opts.action;
}
