import type { ArtifactsArray } from './artifact.types.js';

/**
 * All Obsidian vault artifact directories known to this extension.
 *
 * Each entry drives four things simultaneously:
 *  1. Which vault directories are created / detected (vault.service.ts)
 *  2. Which VS Code context keys are set (context.service.ts)
 *  3. Which insert commands are registered and where they appear (insert.command.ts + package.json)
 *  4. Per-type create-form behaviour — language mode, label, multi-block (artifact-type-config.service.ts)
 *
 * Context key and command ID are derived from `dir.toLowerCase()`:
 *   context key — `obsidian-artifacts.<dir.toLowerCase()>Active`
 *   command     — `obsidian-artifacts.insert.<dir.toLowerCase()>`
 *
 * `contexts: ['all']` means the artifact surfaces in every VS Code context menu.
 *
 * `type` is the canonical ArtifactType literal — direct lookup key used by the
 * parser, serializer, and helper services (never derived from `dir` at runtime).
 */
export const ARTIFACTS: ArtifactsArray = [
	{
		type: 'snippet',
		name: 'Snippets',
		dir: 'Snippets',
		default: true,
		contexts: ['editor'],
		createForm: true,
		form: {
			language: { mode: 'free', default: '' },
			label: { singular: 'snippet' },
			multiBlock: true,
		},
	},
	{
		type: 'agent',
		name: 'Agents Config',
		dir: 'AgentsConf',
		default: true,
		contexts: ['explorer'],
	},
	{
		type: 'command',
		name: 'Commands',
		dir: 'Commands',
		default: false,
		contexts: ['terminal'],
		createForm: true,
		form: {
			language: { mode: 'locked', default: 'bash' },
			label: { singular: 'command' },
			multiBlock: true,
		},
	},
	{
		type: 'template',
		name: 'Templates',
		dir: 'Templates',
		default: false,
		contexts: ['editor', 'explorer'],
	},
	{
		type: 'variables',
		name: 'Variables',
		dir: 'Variables',
		default: false,
		contexts: ['all'],
	},
];
