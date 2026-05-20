import * as assert from 'node:assert';
import { ARTIFACTS } from '../src/types/constants.js';
import type { ArtifactType } from '../src/types/parsed-artifact.types.js';

/**
 * Unit tests for the per-type form configuration carried on ARTIFACTS entries.
 *
 * Phase 0.5 of the artifact-form feature requires each entry to advertise:
 *   - `type: ArtifactType` — direct lookup key (replaces dir.toLowerCase() parsing)
 *   - `createForm?: boolean` — gates the create-flow type picker
 *   - `form?: ArtifactTypeFormConfig` — language mode/default, label.singular, multiBlock
 *
 * See ARTIFACT_FORM_PLAN.md §1.6 for the full spec.
 */
suite('ARTIFACTS per-type form config', () => {

    function findByType(t: ArtifactType) {
        return ARTIFACTS.find(a => a.type === t);
    }

    // ── type field present on every entry ────────────────────────────────────

    test('every entry has a typed `type` field', () => {
        for (const entry of ARTIFACTS) {
            assert.ok(typeof entry.type === 'string' && entry.type.length > 0,
                `ARTIFACTS entry ${entry.dir} missing type literal`);
        }
    });

    test('snippet entry exists with type snippet', () => {
        assert.ok(findByType('snippet'), 'no ARTIFACTS entry with type === "snippet"');
    });

    test('command entry exists with type command', () => {
        assert.ok(findByType('command'), 'no ARTIFACTS entry with type === "command"');
    });

    // ── snippet form config ──────────────────────────────────────────────────

    test('snippet: createForm === true', () => {
        assert.strictEqual(findByType('snippet')!.createForm, true);
    });

    test('snippet: form.language.mode === free', () => {
        assert.strictEqual(findByType('snippet')!.form!.language.mode, 'free');
    });

    test('snippet: form.language.default === "" (plain text)', () => {
        assert.strictEqual(findByType('snippet')!.form!.language.default, '');
    });

    test('snippet: form.label.singular === "snippet"', () => {
        assert.strictEqual(findByType('snippet')!.form!.label.singular, 'snippet');
    });

    test('snippet: form.multiBlock === true', () => {
        assert.strictEqual(findByType('snippet')!.form!.multiBlock, true);
    });

    // ── command form config ──────────────────────────────────────────────────

    test('command: createForm === true', () => {
        assert.strictEqual(findByType('command')!.createForm, true);
    });

    test('command: form.language.mode === locked', () => {
        assert.strictEqual(findByType('command')!.form!.language.mode, 'locked');
    });

    test('command: form.language.default === "bash"', () => {
        assert.strictEqual(findByType('command')!.form!.language.default, 'bash');
    });

    test('command: form.label.singular === "command"', () => {
        assert.strictEqual(findByType('command')!.form!.label.singular, 'command');
    });

    test('command: form.multiBlock === true', () => {
        assert.strictEqual(findByType('command')!.form!.multiBlock, true);
    });

    // ── excluded types: createForm !== true ──────────────────────────────────

    test('template: createForm !== true (deferred)', () => {
        assert.notStrictEqual(findByType('template')!.createForm, true);
    });

    test('agent: createForm !== true (different authoring flow)', () => {
        assert.notStrictEqual(findByType('agent')!.createForm, true);
    });

    test('variables: createForm !== true (own save-as flow)', () => {
        assert.notStrictEqual(findByType('variables')!.createForm, true);
    });

    // ── invariants ───────────────────────────────────────────────────────────

    test('every createForm === true entry has a form object', () => {
        for (const entry of ARTIFACTS) {
            if (entry.createForm === true) {
                assert.ok(entry.form, `entry ${entry.dir} has createForm but no form config`);
            }
        }
    });

    test('every entry with form defined has non-empty form.label.singular', () => {
        for (const entry of ARTIFACTS) {
            if (entry.form) {
                assert.ok(entry.form.label.singular.length > 0,
                    `entry ${entry.dir} form.label.singular is empty`);
            }
        }
    });

    test('every locked language mode has a non-empty default', () => {
        for (const entry of ARTIFACTS) {
            if (entry.form?.language.mode === 'locked') {
                assert.ok(entry.form.language.default !== undefined && entry.form.language.default.length > 0,
                    `entry ${entry.dir} is locked but has no language.default`);
            }
        }
    });
});
