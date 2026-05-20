import * as assert from 'node:assert';
import {
    getFormConfig,
    getLanguageMode,
    getDefaultLanguage,
    getTypeSingular,
    canMultiBlock,
    getCreateFormTypes,
} from '../src/services/artifact-type-config.service.js';
import type { ArtifactType } from '../src/types/parsed-artifact.types.js';

/**
 * Unit tests for the per-type form-config helper service.
 *
 * The service wraps `ARTIFACTS` from `src/types/constants.ts` so the rest of
 * the codebase never traverses the constants array directly. Per-type behaviour
 * is data-driven — adding a new createForm type should require only a
 * `constants.ts` change, never a code change here or downstream.
 */
suite('artifact-type-config.service', () => {

    // ── getFormConfig ────────────────────────────────────────────────────────

    suite('getFormConfig', () => {
        test('snippet returns its form object', () => {
            const cfg = getFormConfig('snippet');
            assert.strictEqual(cfg.language.mode, 'free');
            assert.strictEqual(cfg.language.default, '');
            assert.strictEqual(cfg.label.singular, 'snippet');
            assert.strictEqual(cfg.multiBlock, true);
        });

        test('command returns its form object', () => {
            const cfg = getFormConfig('command');
            assert.strictEqual(cfg.language.mode, 'locked');
            assert.strictEqual(cfg.language.default, 'bash');
            assert.strictEqual(cfg.label.singular, 'command');
            assert.strictEqual(cfg.multiBlock, true);
        });

        test('agent throws (not create-form-enabled)', () => {
            assert.throws(() => getFormConfig('agent'), /agent/);
        });

        test('template throws (deferred)', () => {
            assert.throws(() => getFormConfig('template'), /template/);
        });

        test('variables throws (own save-as flow)', () => {
            assert.throws(() => getFormConfig('variables'), /variables/);
        });

        test('unknown type throws', () => {
            assert.throws(() => getFormConfig('bogus' as ArtifactType));
        });
    });

    // ── getLanguageMode ──────────────────────────────────────────────────────

    suite('getLanguageMode', () => {
        test('snippet === free', () => {
            assert.strictEqual(getLanguageMode('snippet'), 'free');
        });

        test('command === locked', () => {
            assert.strictEqual(getLanguageMode('command'), 'locked');
        });

        test('throws for non-create-form type', () => {
            assert.throws(() => getLanguageMode('agent'));
        });
    });

    // ── getDefaultLanguage ───────────────────────────────────────────────────

    suite('getDefaultLanguage', () => {
        test('snippet === "" (plain text)', () => {
            assert.strictEqual(getDefaultLanguage('snippet'), '');
        });

        test('command === "bash"', () => {
            assert.strictEqual(getDefaultLanguage('command'), 'bash');
        });

        test('throws for non-create-form type', () => {
            assert.throws(() => getDefaultLanguage('template'));
        });
    });

    // ── getTypeSingular ──────────────────────────────────────────────────────

    suite('getTypeSingular', () => {
        test('snippet === "snippet"', () => {
            assert.strictEqual(getTypeSingular('snippet'), 'snippet');
        });

        test('command === "command"', () => {
            assert.strictEqual(getTypeSingular('command'), 'command');
        });

        test('throws for non-create-form type', () => {
            assert.throws(() => getTypeSingular('variables'));
        });
    });

    // ── canMultiBlock ────────────────────────────────────────────────────────

    suite('canMultiBlock', () => {
        test('snippet === true', () => {
            assert.strictEqual(canMultiBlock('snippet'), true);
        });

        test('command === true', () => {
            assert.strictEqual(canMultiBlock('command'), true);
        });

        test('throws for non-create-form type', () => {
            assert.throws(() => canMultiBlock('agent'));
        });
    });

    // ── getCreateFormTypes ───────────────────────────────────────────────────

    suite('getCreateFormTypes', () => {
        // If this list changes, update `constants.ts` — never edit this test
        // to satisfy code drift. The helper derives the list from
        // ARTIFACTS[*].createForm === true. Adding a new createForm type
        // anywhere must extend the result automatically.
        test('returns exactly [snippet, command] (order-insensitive)', () => {
            const sorted = [...getCreateFormTypes()].sort();
            assert.deepStrictEqual(sorted, ['command', 'snippet']);
        });
    });
});
