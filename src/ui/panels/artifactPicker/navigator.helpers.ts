import * as vscode from 'vscode';
import type { ParsedArtifactFile, ParsedBlock } from '../../../types/parsed-artifact.types.js';

/** Debounce window for QuickPick `onDidChangeActive` → preview render. */
export const PREVIEW_DEBOUNCE_MS = 120;

/** QuickPick item with optional vault-specific metadata. */
export interface ArtifactItem extends vscode.QuickPickItem {
    uri?: vscode.Uri;
    isDirectory?: boolean;
    isBack?: boolean;
    /** Set when this item represents a `##`-headed block inside a multi-block file. */
    block?: ParsedBlock;
}

/**
 * Computes a forward-slash relative filesystem path from a URI to a root path.
 *
 * Returns the absolute path unchanged when the URI does not live inside the root,
 * which keeps logging useful even when called with an unexpected URI.
 *
 * @param uri    - File or directory URI.
 * @param rootFs - Absolute filesystem path of the artifact root directory.
 * @returns Relative POSIX-style path, or the original `fsPath` when outside the root.
 *
 * @example
 * relFsPath(vscode.Uri.file('/vault/Snippets/sub/foo.md'), '/vault/Snippets')
 * // → 'sub/foo.md'
 */
export function relFsPath(uri: vscode.Uri, rootFs: string): string {
    const p = uri.fsPath;
    return (p.startsWith(rootFs + '/') || p.startsWith(rootFs + '\\'))
        ? p.slice(rootFs.length + 1).replaceAll('\\', '/')
        : p;
}

/**
 * Builds a richly populated `ArtifactItem`.
 *
 * - `label`       — `$(file)  <title>` (filename fallback).
 * - `description` — Parsed description (relative-path fallback when absent).
 * - `detail`      — `$(symbol-variable) key=val | key=val    $(tag) #tag1 #tag2` (omitted when both empty).
 *
 * @param uri      - File or directory URI.
 * @param isDir    - True when the entry is a directory.
 * @param fallback - Display name to use before the file is parsed.
 * @param parsed   - Parsed metadata, or `undefined` if not yet loaded.
 * @param rootFs   - Absolute filesystem path of the artifact root directory.
 * @returns A fully-populated QuickPick item.
 *
 * @example
 * buildItem(uri, false, 'express-route', parsed, '/vault/Snippets')
 */
export function buildItem(
    uri: vscode.Uri,
    isDir: boolean,
    fallback: string,
    parsed: ParsedArtifactFile | undefined,
    rootFs: string
): ArtifactItem {
    if (isDir) {
        return { label: `$(folder)  ${fallback}`, uri, isDirectory: true };
    }

    const title       = parsed?.frontmatter.title || fallback;
    const description = parsed?.frontmatter.description || relFsPath(uri, rootFs);

    // ── detail: vars then tags, each section prefixed with a codicon ─────────
    const varsPart = parsed?.vars.length
        ? `$(symbol-variable)  ${parsed.vars.map(v => (v.name.startsWith('VK-') ? v.name.slice(3) : v.name) + (v.defaultValue ? '=' + v.defaultValue : '')).join('  |  ')}`
        : '';
    const tagsPart = parsed?.frontmatter.tags?.length
        ? `$(tag)  ${parsed.frontmatter.tags.map(t => '#' + t).join(' ')}`
        : '';
    const detail = varsPart || tagsPart
        ? [varsPart, tagsPart].filter(Boolean).join('    ')
        : undefined;

    return { label: `$(file)  ${title}`, description, detail, uri, isDirectory: false };
}
