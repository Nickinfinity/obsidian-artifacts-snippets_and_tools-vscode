import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { activateConfig } from './config';

export function activate(context: vscode.ExtensionContext) {
	activateConfig(context);
}

export function deactivate() {}
