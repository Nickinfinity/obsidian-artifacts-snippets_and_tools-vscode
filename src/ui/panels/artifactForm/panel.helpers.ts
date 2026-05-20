import type { ArtifactFormBlock, ArtifactFormModel } from '../../../types/artifact-form.types.js';
import type { ParsedVar } from '../../../types/parsed-artifact.types.js';

// ── mergeBlockVars ────────────────────────────────────────────────────────────

/**
 * Merges the current var list with freshly detected vars from a code change.
 *
 * Rules (§3.5):
 * - Detected var already in current → keep the current `defaultValue` (preserves
 *   what the user typed).
 * - Detected var not in current → add it with `defaultValue: ''`.
 * - Var in current but absent from detected (orphan) → keep if `defaultValue`
 *   is non-empty; drop if empty.
 *
 * @param currentVars  - Vars currently displayed in the form (may have user-typed defaults).
 * @param detectedVars - Vars newly detected from `extractVars(code)` (all defaultValue `''`).
 * @returns Merged var list preserving user-typed defaults and non-empty orphans.
 *
 * @example
 * mergeBlockVars([{ name: 'VK-host', defaultValue: 'localhost' }], [{ name: 'VK-host', defaultValue: '' }])
 * // → [{ name: 'VK-host', defaultValue: 'localhost' }]
 */
export function mergeBlockVars(currentVars: ParsedVar[], detectedVars: ParsedVar[]): ParsedVar[] {
    const currentMap = new Map(currentVars.map(v => [v.name, v.defaultValue]));
    const merged: ParsedVar[] = detectedVars.map(v => ({
        name:         v.name,
        defaultValue: currentMap.get(v.name) ?? '',
    }));
    // Preserve orphans with non-empty defaults
    const detectedSet = new Set(detectedVars.map(v => v.name));
    for (const v of currentVars) {
        if (!detectedSet.has(v.name) && v.defaultValue !== '') {
            merged.push({ name: v.name, defaultValue: v.defaultValue });
        }
    }
    return merged;
}

// ── pruneVarsForSave ──────────────────────────────────────────────────────────

/**
 * Prunes the var list of each block at save time per §3.5 rules.
 *
 * - Token `<VK-xxx>` present in `block.code` → keep var (any default).
 * - Token absent AND `defaultValue === ''`  → drop (no orphan default).
 * - Token absent AND `defaultValue !== ''`  → keep as orphan default
 *   (serializer will emit it in the `vks` fence; parser preserves it on
 *   round-trip).
 *
 * @param blocks - Blocks from the form model before serialization.
 * @returns New blocks array with pruned var lists; original is not mutated.
 *
 * @example
 * pruneVarsForSave([{ code: 'x', vars: [{ name: 'VK-gone', defaultValue: '' }], ... }])
 * // → [{ code: 'x', vars: [], ... }]
 */
export function pruneVarsForSave(blocks: ArtifactFormBlock[]): ArtifactFormBlock[] {
    return blocks.map(block => {
        const prunedVars = block.vars.filter(v => {
            const token  = '<' + v.name + '>';
            const inCode = block.code.includes(token);
            return inCode || v.defaultValue !== '';
        });
        return { ...block, vars: prunedVars };
    });
}

// ── validateForSave ───────────────────────────────────────────────────────────

/**
 * Validates a form model against the §3.7 save-time rules.
 *
 * Returns an `errors` map keyed by field path; empty map means valid.
 * Keys used: `'title'`, `'blocks'`, `'block:N.heading'` (N = zero-based index).
 *
 * @param model - The form model to validate.
 * @returns `{ ok, errors }` where `errors` is empty when `ok === true`.
 *
 * @example
 * validateForSave({ title: '', blocks: [{ code: 'x', ... }], ... })
 * // → { ok: false, errors: { title: 'Title is required.' } }
 */
export function validateForSave(model: ArtifactFormModel): { ok: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    if (!model.title.trim()) {
        errors['title'] = 'Title is required.';
    }

    const hasCode = model.blocks.some(b => b.code.trim().length > 0);
    if (!hasCode) {
        errors['blocks'] = 'At least one block must have code.';
    }

    if (model.blocks.length > 1) {
        model.blocks.forEach((b, i) => {
            if (!b.heading.trim()) {
                errors[`block:${i}.heading`] = 'Block heading is required.';
            }
        });
    }

    return { ok: Object.keys(errors).length === 0, errors };
}

// ── reorderBlocks ─────────────────────────────────────────────────────────────

/**
 * Swaps two blocks in the list by index and returns a new array.
 *
 * When `fromIdx === toIdx` the original order is returned unchanged.
 * Does not mutate the input array.
 *
 * @param blocks  - Current block list.
 * @param fromIdx - Index of the block to move.
 * @param toIdx   - Destination index (the block it swaps with).
 * @returns New blocks array with the two positions exchanged.
 *
 * @example
 * reorderBlocks([A, B, C], 0, 1) // → [B, A, C]
 */
export function reorderBlocks(blocks: ArtifactFormBlock[], fromIdx: number, toIdx: number): ArtifactFormBlock[] {
    const copy = [...blocks];
    const a = copy[fromIdx];
    const b = copy[toIdx];
    if (a !== undefined && b !== undefined) {
        copy[fromIdx] = b;
        copy[toIdx]   = a;
    }
    return copy;
}
