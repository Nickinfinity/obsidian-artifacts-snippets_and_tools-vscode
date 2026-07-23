import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ARTIFACTS } from '../src/types/constants.js';
import type { ArtifactContext } from '../src/types/artifact.types.js';
import { artifactCommandId } from '../src/commands/insert.command.js';

/**
 * Drift guard: `package.json` menu contributions ↔ `ARTIFACTS`.
 *
 * Every other consumer of the artifact set (command registration, context keys,
 * vault-dir detection, settings toggles) loops over `ARTIFACTS`, so adding a
 * type there wires those automatically. `package.json` is the lone exception —
 * VS Code reads it *before* the extension activates, so it cannot derive from
 * constants at runtime and must be hand-maintained. A new artifact added to
 * `ARTIFACTS` but forgotten in `package.json` produces **no error**: its
 * context-menu entry simply never appears (the exact "Insert Template not
 * showing" class of report). This suite fails loudly instead.
 *
 * It reuses the real derivers (`artifactCommandId`) rather than re-deriving the
 * command-ID pattern, so the guard is pinned to what actually registers.
 */
suite('package.json menus ↔ ARTIFACTS drift guard', () => {

	// Compiled tests run from dist/test → repo root is two levels up.
	const pkg = JSON.parse(
		fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'),
	) as {
		contributes: {
			commands: { command: string; title?: string }[];
			menus: Record<string, { command?: string }[]>;
		};
	};

	const ALL_SURFACES: ArtifactContext[] = ['editor', 'terminal', 'explorer'];

	/**
	 * Expands an artifact's declared `contexts` to concrete menu surfaces.
	 * `'all'` fans out to every surface; otherwise the listed surfaces pass through.
	 *
	 * @param contexts - The artifact's `contexts` field from ARTIFACTS.
	 * @returns The concrete surfaces the artifact must appear in.
	 * @example
	 * surfacesFor(['all'])       // → ['editor', 'terminal', 'explorer']
	 * surfacesFor(['explorer'])  // → ['explorer']
	 */
	function surfacesFor(contexts: readonly ArtifactContext[]): ArtifactContext[] {
		return contexts.includes('all')
			? [...ALL_SURFACES]
			: ALL_SURFACES.filter(s => contexts.includes(s));
	}

	/**
	 * True if a `package.json` menu list contains an entry for the given command.
	 *
	 * @param menuKey - Key into `contributes.menus` (e.g. `'explorer/context'`).
	 * @param commandId - The command ID to look for.
	 * @returns Whether any entry in that menu references the command.
	 * @example
	 * menuHasCommand('explorer/context', 'obsidian-artifacts.insert.templates') // → true
	 */
	function menuHasCommand(menuKey: string, commandId: string): boolean {
		const entries = pkg.contributes.menus[menuKey] ?? [];
		return entries.some(e => e.command === commandId);
	}

	test('every artifact has a contributes.commands entry with a non-empty title', () => {
		for (const a of ARTIFACTS) {
			const id = artifactCommandId(a.dir);
			const cmd = pkg.contributes.commands.find(c => c.command === id);
			assert.ok(cmd, `package.json contributes.commands is missing ${id}`);
			assert.ok(
				typeof cmd.title === 'string' && cmd.title.length > 0,
				`${id} has no menu title (VS Code labels the entry from this)`,
			);
		}
	});

	test('every artifact appears in each declared context surface (direct entry)', () => {
		for (const a of ARTIFACTS) {
			const id = artifactCommandId(a.dir);
			for (const surface of surfacesFor(a.contexts)) {
				assert.ok(
					menuHasCommand(`${surface}/context`, id),
					`${id} missing from ${surface}/context (contexts: ${a.contexts.join(',')})`,
				);
			}
		}
	});

	test('every artifact appears in each declared submenu (multi-artifact case)', () => {
		for (const a of ARTIFACTS) {
			const id = artifactCommandId(a.dir);
			for (const surface of surfacesFor(a.contexts)) {
				assert.ok(
					menuHasCommand(`obsidian-artifacts.submenu.${surface}`, id),
					`${id} missing from obsidian-artifacts.submenu.${surface}`,
				);
			}
		}
	});
});
