/**
 * All VS Code UI surfaces where an artifact's command can appear.
 *
 * - `editor`   — main editor context menu
 * - `terminal` — integrated terminal context menu
 * - `explorer` — Explorer (file tree) context menu
 * - `all`      — every standard VS Code context menu surface
 */
export type ArtifactContext = 'editor' | 'terminal' | 'explorer' | 'all';

/** A single Obsidian vault artifact directory and its VS Code UI configuration */
export interface Artifact {
	/** Human-readable display name */
	name: string;
	/** Folder name on disk inside the vault root */
	dir: string;
	/** Auto-create this directory on first vault selection when true */
	default: boolean;
	/** Context menu surfaces where this artifact's action should appear */
	contexts: readonly ArtifactContext[];
}

export type ArtifactsArray = readonly Artifact[];
