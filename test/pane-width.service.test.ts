import * as assert from 'node:assert';
import {
    PaneWidthController,
    PANE_WIDTH_COMMANDS,
    normalizeStepCount,
} from '../src/services/pane-width.service.js';

/**
 * Unit tests for `PaneWidthController` (VSX-237, plan §1).
 *
 * The platform gives no way to read a `WebviewView`'s width — every
 * assertion here is about *which command ids ran, how many times, in what
 * order* through an injected fake runner. Never about a width value: there
 * is none to read, and a test pretending otherwise would be fiction.
 */

/** Records every command id passed to the injected runner, in call order. */
function fakeRunner(): { run: (id: string) => Promise<void>; calls: string[] } {
    const calls: string[] = [];
    return { run: async (id: string) => { calls.push(id); }, calls };
}

suite('PaneWidthController', () => {

    test('widenForPreview then restoreAfterPreview: N widen ids followed by exactly N narrow ids', async () => {
        const { run, calls } = fakeRunner();
        const controller = new PaneWidthController(run, 3);

        await controller.widenForPreview();
        await controller.restoreAfterPreview();

        assert.deepStrictEqual(calls, [
            PANE_WIDTH_COMMANDS.widen,
            PANE_WIDTH_COMMANDS.widen,
            PANE_WIDTH_COMMANDS.widen,
            PANE_WIDTH_COMMANDS.narrow,
            PANE_WIDTH_COMMANDS.narrow,
            PANE_WIDTH_COMMANDS.narrow,
        ]);
    });

    test('idempotent widen: widening twice for one preview widens once', async () => {
        const { run, calls } = fakeRunner();
        const controller = new PaneWidthController(run, 3);

        await controller.widenForPreview();
        await controller.widenForPreview();

        assert.strictEqual(calls.length, 3);
        assert.ok(calls.every(id => id === PANE_WIDTH_COMMANDS.widen));
    });

    test('idempotent restore: restoring when nothing was widened does nothing', async () => {
        const { run, calls } = fakeRunner();
        const controller = new PaneWidthController(run, 3);

        await controller.restoreAfterPreview();

        assert.deepStrictEqual(calls, []);
    });

    test('idempotent restore: a second restore after one widen runs no extra narrow commands', async () => {
        const { run, calls } = fakeRunner();
        const controller = new PaneWidthController(run, 3);

        await controller.widenForPreview();
        await controller.restoreAfterPreview();
        await controller.restoreAfterPreview();

        assert.strictEqual(calls.filter(id => id === PANE_WIDTH_COMMANDS.narrow).length, 3);
    });

    test('zero configured steps: widen and restore run no commands at all', async () => {
        const { run, calls } = fakeRunner();
        const controller = new PaneWidthController(run, 0);

        await controller.widenForPreview();
        await controller.restoreAfterPreview();

        assert.deepStrictEqual(calls, []);
    });

    test('a rejected run is swallowed — a cosmetic resize must never throw out of widenForPreview', async () => {
        const controller = new PaneWidthController(async () => { throw new Error('boom'); }, 2);
        await assert.doesNotReject(async () => controller.widenForPreview());
    });

    test('a rejected run is swallowed — restoreAfterPreview never throws either', async () => {
        const controller = new PaneWidthController(async () => { throw new Error('boom'); }, 2);
        await controller.widenForPreview().catch(() => { /* first call must not throw, asserted above */ });
        await assert.doesNotReject(async () => controller.restoreAfterPreview());
    });

    test('normalizeStepCount: clamps negative to 0, truncates fractional, NaN/non-finite to 0', () => {
        assert.strictEqual(normalizeStepCount(3.7), 3);
        assert.strictEqual(normalizeStepCount(-2), 0);
        assert.strictEqual(normalizeStepCount(NaN), 0);
        assert.strictEqual(normalizeStepCount(Infinity), 0);
        assert.strictEqual(normalizeStepCount(0), 0);
    });

    /**
     * Closed-loop widening against a simulated workbench.
     *
     * The commands act on the *focused* view, which is often the editor group
     * and not this pane — in which case `increaseViewWidth` shrinks the
     * sidebar. That is not hypothetical: it is what the extension actually did
     * in a real window while every open-loop test above stayed green, because
     * none of them models a width that responds to the commands at all.
     */
    suite('closed-loop widening', () => {

        /** A fake pane whose width responds to the commands, optionally inverted. */
        function fakePane(opts: { start: number; avail: number; step: number; inverted: boolean }) {
            let width = opts.start;
            const calls: string[] = [];
            const run = async (id: string): Promise<void> => {
                calls.push(id);
                const grows = opts.inverted
                    ? id === PANE_WIDTH_COMMANDS.narrow
                    : id === PANE_WIDTH_COMMANDS.widen;
                width += grows ? opts.step : -opts.step;
            };
            const measure = async () => ({ paneWidth: width, availWidth: opts.avail });
            return { run, measure, calls, width: () => width };
        }

        test('an inverted view still ends up wider, not narrower', async () => {
            const pane = fakePane({ start: 300, avail: 1500, step: 50, inverted: true });
            const controller = new PaneWidthController(pane.run, 3, pane.measure);

            await controller.widenForPreview();

            assert.ok(pane.width() >= 500,
                `inverted view left the pane at ${pane.width()}px, short of the 500px target — the widen ran the wrong direction`);
        });

        test('an inverted view restores to the exact original width', async () => {
            const pane = fakePane({ start: 300, avail: 1500, step: 50, inverted: true });
            const controller = new PaneWidthController(pane.run, 3, pane.measure);

            await controller.widenForPreview();
            await controller.restoreAfterPreview();

            assert.strictEqual(pane.width(), 300,
                'restore did not return the pane to its pre-preview width');
        });

        test('a normal view widens to the target and restores exactly', async () => {
            const pane = fakePane({ start: 300, avail: 1500, step: 50, inverted: false });
            const controller = new PaneWidthController(pane.run, 3, pane.measure);

            await controller.widenForPreview();
            assert.ok(pane.width() >= 500, `stopped at ${pane.width()}px, short of target`);

            await controller.restoreAfterPreview();
            assert.strictEqual(pane.width(), 300);
        });

        test('target is capped at 700px on a very wide screen', async () => {
            const pane = fakePane({ start: 300, avail: 6000, step: 50, inverted: false });
            const controller = new PaneWidthController(pane.run, 3, pane.measure);

            await controller.widenForPreview();

            assert.ok(pane.width() >= 700, `stopped at ${pane.width()}px, below the cap`);
            assert.ok(pane.width() < 700 + 50 * 2,
                `overshot the 700px cap to ${pane.width()}px — a third of 6000 is 2000, the cap did not apply`);
        });

        test('already at target: no commands run at all', async () => {
            const pane = fakePane({ start: 900, avail: 1500, step: 50, inverted: false });
            const controller = new PaneWidthController(pane.run, 3, pane.measure);

            await controller.widenForPreview();

            assert.deepStrictEqual(pane.calls, []);
        });

        test('a view that stops answering aborts without stepping forever', async () => {
            const calls: string[] = [];
            const controller = new PaneWidthController(
                async id => { calls.push(id); },
                3,
                async () => undefined,
            );

            await controller.widenForPreview();

            assert.deepStrictEqual(calls, [], 'stepped despite never getting a measurement');
        });
    });

    test('a negative configured step count behaves as 0 steps, not a thrown error or negative loop', async () => {
        const { run, calls } = fakeRunner();
        const controller = new PaneWidthController(run, -5);

        await controller.widenForPreview();

        assert.deepStrictEqual(calls, []);
    });
});
