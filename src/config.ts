import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getNonce } from './helpers.js';
import { VAULT_DIRS } from './config.constants.js';

export function activateConfig(context: vscode.ExtensionContext) {
	const configFilePath = path.join(context.globalStorageUri.fsPath, 'ai_obsidian_sandt.conf');

	const disposable = vscode.commands.registerCommand('obsidian-notes-and-snippets.config', () => {
		const panel = vscode.window.createWebviewPanel(
			'config',
			'AI Obsidian Snippets & Tools - CONFIG',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'src')]
			}
		);

		panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

		panel.webview.onDidReceiveMessage(async (message) => {
			if (message.command === 'selectFolder') {
				const folderUri = await vscode.window.showOpenDialog({
					canSelectFiles: false,
					canSelectFolders: true,
					canSelectMany: false,
					openLabel: 'Select Vault'
				});

				if (folderUri && folderUri[0]) {
					const selectedFolderPath = folderUri[0].fsPath;

					if (!validateObsidianVault(selectedFolderPath)) {
						return;
					}

					const detectedDirs = detectVaultDirs(selectedFolderPath);

					if (!fs.existsSync(context.globalStorageUri.fsPath)) {
						fs.mkdirSync(context.globalStorageUri.fsPath, { recursive: true });
					}

					fs.writeFileSync(configFilePath, selectedFolderPath, 'utf8');
					vscode.window.showInformationMessage(`Obsidian vault path saved: ${selectedFolderPath}`);
					panel.webview.postMessage({ command: 'updatePath', path: selectedFolderPath, dirs: detectedDirs });
				} else {
					vscode.window.showWarningMessage('No folder selected.');
				}
			}
		});

		if (fs.existsSync(configFilePath)) {
			const savedPath = fs.readFileSync(configFilePath, 'utf8');
			panel.webview.postMessage({ command: 'updatePath', path: savedPath });
		}
	});

	context.subscriptions.push(disposable);
}

function validateObsidianVault(vaultPath: string): boolean {
	const obsidianDir = path.join(vaultPath, '.obsidian');
	if (!fs.existsSync(obsidianDir)) {
		vscode.window.showErrorMessage(
			`"${vaultPath}" is not a valid Obsidian vault. The selected folder must contain a .obsidian directory.`
		);
		return false;
	}
	return true;
}

function detectVaultDirs(vaultPath: string): Array<{ name: string; active: boolean; exists: boolean }> {
	return VAULT_DIRS.map((dir) => {
		const dirPath = path.join(vaultPath, dir.name);
		let exists = fs.existsSync(dirPath);
		if (dir.active && !exists) {
			fs.mkdirSync(dirPath, { recursive: true });
			exists = true;
		}
		return { ...dir, exists };
	});
}

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
	const nonce = getNonce();
	const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'styles.css'));

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>AI Obsidian Snippets & Tools - CONFIG</title>
</head>
<body>
  <div id="webviewContent">
    <div class="logo-row">
      <span class="logo-icon">🔮</span>
      <h1>Obsidian Notes &amp; Snippets</h1>
    </div>
  <p class="tagline">Bring your Obsidian vault into VS Code</p>

  <hr>

  <div class="intro">
    <p>This extension connects VS Code to your <strong>Obsidian vault</strong>, letting you browse notes, insert snippets, and create new entries without leaving the editor.</p>
    <p>To get started, point the extension to your vault's root folder — the directory that contains your <code>.obsidian/</code> folder. Your selection is saved locally and persists across sessions.</p>
  </div>

  <p class="section-label">Vault Location</p>

  <div class="vault-card">
    <span class="vault-icon">📁</span>
    <span id="folderPath">No vault selected</span>
  </div>

  <button id="selectFolderButton">
    <span>Select Vault Folder</span>
  </button>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    document.getElementById('selectFolderButton').addEventListener('click', () => {
      vscode.postMessage({ command: 'selectFolder' });
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.command === 'updatePath') {
        const el = document.getElementById('folderPath');
        el.textContent = message.path;
        el.classList.add('has-path');
      }
    });
  </script>
</div>
</body>
</html>`;
}
