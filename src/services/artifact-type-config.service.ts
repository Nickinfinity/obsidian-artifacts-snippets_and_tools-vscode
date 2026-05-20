import { ARTIFACTS } from '../types/constants.js';
import type { Artifact, ArtifactTypeFormConfig, LanguageMode } from '../types/artifact.types.js';
import type { ArtifactType } from '../types/parsed-artifact.types.js';

/**
 * Locates the `ARTIFACTS` entry for a given type literal.
 *
 * Thin private helper so every public accessor delegates here — the rest of
 * the codebase never traverses `ARTIFACTS` directly. Throws on miss so a
 * caller passing an unrecognised type fails loudly instead of silently
 * receiving `undefined`.
 *
 * @param type - Canonical `ArtifactType` literal.
 * @returns The matching `Artifact` entry.
 * @throws When no entry has a matching `type` field.
 *
 * @example
 * findEntry('snippet'); // → { type: 'snippet', dir: 'Snippets', form: { ... }, ... }
 */
function findEntry(type: ArtifactType): Artifact {
    const entry = ARTIFACTS.find(e => e.type === type);
    if (!entry) {
        throw new Error(`Unknown artifact type: ${type}`);
    }
    return entry;
}

/**
 * Returns the per-type form configuration for a create-form-enabled type.
 *
 * Throws when the requested type is not create-form-enabled (e.g. `agent`,
 * `template`, `variables`) — the form UI should never reach this code path
 * for an excluded type. Use `getCreateFormTypes()` to drive the type picker
 * so excluded types are never offered.
 *
 * @param type - Canonical `ArtifactType` literal.
 * @returns The `ArtifactTypeFormConfig` for the type.
 * @throws When the type is unknown or `createForm !== true`.
 *
 * @example
 * getFormConfig('command'); // → { language: { mode: 'locked', default: 'bash' }, label: { singular: 'command' }, multiBlock: true }
 */
export function getFormConfig(type: ArtifactType): ArtifactTypeFormConfig {
    const entry = findEntry(type);
    if (entry.createForm !== true || !entry.form) {
        throw new Error(`Artifact type "${type}" is not create-form-enabled`);
    }
    return entry.form;
}

/**
 * Returns the language-selector mode (`free` | `locked` | `hidden`) for a
 * create-form-enabled type.
 *
 * Drives whether the form renders an enabled dropdown, a disabled pre-filled
 * field, or no language field at all.
 *
 * @param type - Canonical `ArtifactType` literal.
 * @returns The `LanguageMode` for the type.
 * @throws When the type is not create-form-enabled.
 *
 * @example
 * getLanguageMode('snippet'); // → 'free'
 * getLanguageMode('command'); // → 'locked'
 */
export function getLanguageMode(type: ArtifactType): LanguageMode {
    return getFormConfig(type).language.mode;
}

/**
 * Returns the default language for a create-form-enabled type.
 *
 * For `locked` mode this is the serializer's emitted language (e.g. `bash`
 * for `command`). For `free` mode this is the language new blocks start
 * with (`''` for plain text on `snippet`). For `hidden` mode this is the
 * fence info-string the serializer emits unconditionally.
 *
 * @param type - Canonical `ArtifactType` literal.
 * @returns The default language string (may be empty).
 * @throws When the type is not create-form-enabled.
 *
 * @example
 * getDefaultLanguage('command'); // → 'bash'
 * getDefaultLanguage('snippet'); // → ''
 */
export function getDefaultLanguage(type: ArtifactType): string {
    return getFormConfig(type).language.default ?? '';
}

/**
 * Returns the singular noun label for a create-form-enabled type.
 *
 * Drives dynamic UI strings such as `+ Add additional <singular>`,
 * `× This <singular> block will be deleted`, and `Delete entire <singular>`.
 *
 * @param type - Canonical `ArtifactType` literal.
 * @returns The singular noun (e.g. `'snippet'`, `'command'`).
 * @throws When the type is not create-form-enabled.
 *
 * @example
 * getTypeSingular('snippet'); // → 'snippet'
 */
export function getTypeSingular(type: ArtifactType): string {
    return getFormConfig(type).label.singular;
}

/**
 * Returns whether a create-form-enabled type allows multiple blocks.
 *
 * `true` → the form renders the `+ Add additional <singular>` button.
 * `false` → single block forced; `+` and per-block `×` buttons never render.
 *
 * @param type - Canonical `ArtifactType` literal.
 * @returns `true` when multi-block is allowed.
 * @throws When the type is not create-form-enabled.
 *
 * @example
 * canMultiBlock('snippet'); // → true
 */
export function canMultiBlock(type: ArtifactType): boolean {
    return getFormConfig(type).multiBlock;
}

/**
 * Returns the list of types that surface in the create-flow type picker.
 *
 * Derived from `ARTIFACTS` — any entry with `createForm === true` is
 * included. Adding a new create-form type is a `constants.ts` change only;
 * downstream pickers and tests pick it up automatically.
 *
 * @returns Array of `ArtifactType` literals (order matches `ARTIFACTS` order).
 *
 * @example
 * getCreateFormTypes(); // → ['snippet', 'command']
 */
export function getCreateFormTypes(): ArtifactType[] {
    return ARTIFACTS.filter(e => e.createForm === true).map(e => e.type);
}
