/**
 * Adaptive main-pane width — widen the sidebar when a preview opens, narrow
 * it back by the same step count when the preview ends (plan §1, VSX-237).
 *
 * The platform gives no way to read a `WebviewView`'s current width — no
 * such member exists anywhere in the stable `@types/vscode` surface — and
 * no way to request an absolute size, only step-based "increase/decrease
 * view width" workbench commands that act on whichever view has focus. The
 * design that follows from that: **never read a width, apply equal and
 * opposite steps.** N widen-steps on preview open, N narrow-steps on preview
 * close returns the pane to whatever it was before, without this module
 * ever knowing what that was — which is exactly why it works the same for a
 * user who has resized their sidebar and one who never has.
 *
 * Accepted limitation, not compensated for: if the user drags the sash
 * while a preview is open, the restore is off by their drag, because
 * nothing here can re-sync a width it never read. Do not add a
 * compensating heuristic for this — a wrong correction is worse than a
 * known, honest offset.
 *
 * `vscode`-free: the workbench-command runner is injected (`CommandRunner`),
 * so this unit-tests without an extension host.
 */

/**
 * The undocumented workbench command ids this controller drives.
 *
 * **Internal, unversioned VS Code workbench commands** — absent from
 * `@types/vscode` (there is no width/size member on `WebviewView` at all,
 * verified against the stable 1.116.0 typings), found only by enumerating
 * `getCommands(true)` live inside the extension host. A future VS Code
 * release can rename or remove either id with no compile error to catch it.
 * This constant is the **one** place either id may be spelled.
 */
export const PANE_WIDTH_COMMANDS = {
    widen: 'workbench.action.increaseViewWidth',
    narrow: 'workbench.action.decreaseViewWidth',
} as const;

import { MAX_PANE_WIDTH_PX } from '../types/constants.js';

/** Runs one workbench command by id. Injected so this module never calls `vscode.commands.executeCommand` itself. */
export type CommandRunner = (commandId: string) => Promise<void>;

/** What the webview can measure about itself; `undefined` when it did not answer. */
export interface PaneMetrics {
    /** The pane's own width in CSS px (`window.innerWidth` inside the webview). */
    paneWidth: number;
    /** The screen's available width (`screen.availWidth`) — the stand-in for the VS Code window. */
    availWidth: number;
}

/** Asks the webview to measure itself. Injected; resolves `undefined` on timeout or a dead view. */
export type PaneMeasurer = () => Promise<PaneMetrics | undefined>;

/** Fraction of `availWidth` the pane is widened towards. */
export const TARGET_WIDTH_FRACTION = 1 / 3;

/**
 * Absolute ceiling in CSS px — on a wide monitor a third is more pane than
 * the preview needs. Declared in `types/constants.ts` and re-exported here so
 * the value has one home while callers of this service keep one import.
 */
export { MAX_PANE_WIDTH_PX as MAX_TARGET_WIDTH_PX } from '../types/constants.js';

/**
 * The width to widen towards: one third of the screen, capped.
 *
 * @param availWidth - `screen.availWidth` as reported by the webview.
 * @returns The target width in CSS px.
 *
 * @example
 * targetWidthPx(3840); // → 700 (a third would be 1280)
 * targetWidthPx(1440); // → 480
 */
export function targetWidthPx(availWidth: number): number {
    return Math.min(availWidth * TARGET_WIDTH_FRACTION, MAX_PANE_WIDTH_PX);
}

/**
 * Hard ceiling on closed-loop widen steps.
 *
 * The loop re-measures after every step, so it stops on its own once the
 * target is met. This cap is the backstop for the case where stepping stops
 * changing the width at all — the pane has hit VS Code's own maximum — which
 * would otherwise spin forever against a target it can never reach.
 */
export const MAX_WIDEN_STEPS = 24;

/** Pause after each widen step so the webview has relaid out before it is re-measured. */
export const SETTLE_MS = 50;

/**
 * Normalises an untrusted step count — e.g. read from user `settings.json`,
 * which VS Code does not hard-enforce against the `package.json` schema —
 * into a safe, whole, non-negative number of commands to run.
 *
 * Non-finite input (`NaN`, `Infinity`, a non-number) becomes `0`, the
 * safest no-op. A negative count clamps to `0` rather than running a
 * backwards loop. A fractional count truncates towards zero (`3.7` → `3`)
 * rather than rounding, so this never runs a fraction of a command.
 *
 * @param raw - The configured step count; not assumed pre-validated.
 * @returns A whole number `>= 0`.
 * @example
 * normalizeStepCount(3.7);  // 3
 * normalizeStepCount(-2);   // 0
 * normalizeStepCount(NaN);  // 0
 */
export function normalizeStepCount(raw: number): number {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) { return 0; }
    return Math.max(0, Math.trunc(raw));
}

/**
 * Widens the main pane for a preview, then restores it afterwards, by
 * running equal and opposite step counts through an injected command
 * runner — never by reading a width (see module doc: there is no API to
 * read one).
 *
 * @example
 * const calls: string[] = [];
 * const controller = new PaneWidthController(async id => { calls.push(id); }, 3);
 * await controller.widenForPreview();
 * await controller.restoreAfterPreview();
 * // calls: 3x increaseViewWidth, then 3x decreaseViewWidth
 */
export class PaneWidthController {
    private readonly steps: number;
    /**
     * `0` means "not currently widened". A non-zero value is both the
     * "already widened" flag and the exact count `restoreAfterPreview` must
     * undo — one stored fact, not two hand-maintained numbers, so symmetry
     * is by construction rather than by keeping two counters in sync.
     */
    private widenedSteps = 0;
    /**
     * Which command id actually grew the pane, learned by probing.
     *
     * These workbench commands act on the **focused** view, and the focused
     * view is frequently the editor group rather than this pane — in which
     * case `increaseViewWidth` widens the editor and *shrinks* the sidebar,
     * exactly inverting the intent. Focus cannot be reliably forced (the
     * QuickPick holds it during hover previews), so the direction is measured
     * instead of assumed: one probe step decides it, and `restoreAfterPreview`
     * undoes with whichever id is the opposite of the one that worked.
     */
    private growCmd: string = PANE_WIDTH_COMMANDS.widen;
    private shrinkCmd: string = PANE_WIDTH_COMMANDS.narrow;

    /**
     * @param run - Injected workbench-command runner — `vscode.commands.executeCommand` at the real call site; this module never imports `vscode`.
     * @param steps - Configured step count, normalised via `normalizeStepCount` at construction.
     */
    constructor(
        private readonly run: CommandRunner,
        steps: number,
        private readonly measure?: PaneMeasurer,
    ) {
        this.steps = normalizeStepCount(steps);
    }

    /**
     * Widens until the pane reaches one third of `availWidth`, counting the
     * steps it actually took.
     *
     * Closed-loop because a step's size is not knowable in advance: it
     * re-measures after each step and stops on the target, on the step cap, or
     * as soon as a step stops moving the width (the pane is already at VS
     * Code's own maximum). Symmetry is preserved exactly as in the open-loop
     * path — the count that ran is the count `restoreAfterPreview` undoes.
     *
     * @returns How many widen steps ran.
     *
     * @example
     * const used = await controller.widenToTarget(); // e.g. 7
     */
    private async widenToTarget(measure: PaneMeasurer): Promise<number> {
        const first = await measure();
        if (!first || first.availWidth <= 0) { return 0; }

        const target = targetWidthPx(first.availWidth);
        if (first.paneWidth >= target) { return 0; }

        const probed = await this.probeDirection(measure, first.paneWidth);
        if (probed === undefined) { return 0; }

        let width  = probed.width;
        let used   = probed.used;
        let stalls = 0;

        while (width < target && used < MAX_WIDEN_STEPS) {
            await this.runStep(this.growCmd);
            used++;
            await this.settle();
            const next = await measure();
            if (!next) { break; }
            if (next.paneWidth <= width) {
                // Tolerate one slow frame; two in a row means the pane really
                // has stopped growing (VS Code's own maximum).
                if (++stalls >= 2) { break; }
            } else {
                stalls = 0;
                width  = next.paneWidth;
            }
        }
        return used;
    }

    /**
     * Runs one step to learn which command id actually grows this pane.
     *
     * If the probe shrank the pane, the commands are landing on another view
     * and the ids are swapped for the rest of the session; the probe step is
     * undone first so the caller starts from the original width with a step
     * count of zero.
     *
     * @param measure  - The webview measurer.
     * @param baseline - Width before the probe.
     * @returns The width and net step count to continue from, or `undefined`
     *          if the view stopped answering.
     *
     * @example
     * const p = await this.probeDirection(measure, 300); // { width: 340, used: 1 }
     */
    private async probeDirection(
        measure: PaneMeasurer,
        baseline: number,
    ): Promise<{ width: number; used: number } | undefined> {
        await this.runStep(PANE_WIDTH_COMMANDS.widen);
        await this.settle();
        const after = await measure();
        if (!after) { return undefined; }

        if (after.paneWidth > baseline) {
            return { width: after.paneWidth, used: 1 };
        }

        if (after.paneWidth < baseline) {
            // Wrong view: undo the probe with the id that is "narrow" for the
            // focused view but "grow" for this pane, then swap for the session.
            this.growCmd   = PANE_WIDTH_COMMANDS.narrow;
            this.shrinkCmd = PANE_WIDTH_COMMANDS.widen;
            await this.runStep(this.growCmd);
            await this.settle();
            const restored = await measure();
            return { width: restored?.paneWidth ?? baseline, used: 0 };
        }

        // No movement at all — nothing learned, continue with the default ids.
        return { width: baseline, used: 1 };
    }

    /**
     * Applies `steps` widen commands, once per preview. Idempotent by
     * construction: a second call before `restoreAfterPreview()` sees
     * `widenedSteps` already non-zero (whenever `steps > 0`) and returns
     * without running anything further.
     *
     * @returns Resolves once every step has run — a rejected step is
     *   swallowed (see `runStep`), so this itself never rejects.
     */
    async widenForPreview(): Promise<void> {
        if (this.widenedSteps > 0) { return; }
        if (this.measure) {
            this.widenedSteps = await this.widenToTarget(this.measure);
            return;
        }
        for (let i = 0; i < this.steps; i++) {
            await this.runStep(PANE_WIDTH_COMMANDS.widen);
        }
        this.widenedSteps = this.steps;
    }

    /**
     * Applies exactly as many narrow commands as the matching
     * `widenForPreview` applied widen commands, then clears the record. A
     * call with nothing recorded — never widened, or already restored — is
     * a no-op: the defect this guards against is a double restore
     * narrowing a pane nobody re-widened.
     *
     * @returns Resolves once every step has run (or been swallowed).
     */
    async restoreAfterPreview(): Promise<void> {
        const count = this.widenedSteps;
        if (count === 0) { return; }
        this.widenedSteps = 0;
        for (let i = 0; i < count; i++) {
            await this.runStep(this.shrinkCmd);
        }
    }

    /**
     * Runs one command through the injected runner, swallowing a
     * rejection — a cosmetic resize must never break an insert, so this
     * controller can never be the reason a caller's `await` throws.
     *
     * @param commandId - One of `PANE_WIDTH_COMMANDS`.
     * @returns Resolves always, regardless of whether `run` rejected.
     */
    /**
     * Waits for the pane to finish relaying out after a widen step.
     *
     * Injected-free and deliberately crude: there is no layout-settled signal
     * to await, so a short fixed pause is the only option.
     *
     * @returns Resolves after {@link SETTLE_MS}.
     *
     * @example
     * await this.settle();
     */
    private settle(): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, SETTLE_MS));
    }

    private async runStep(commandId: string): Promise<void> {
        try {
            await this.run(commandId);
        } catch {
            // Silent and harmless by design — see module doc.
        }
    }
}
