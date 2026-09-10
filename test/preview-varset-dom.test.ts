import * as assert from 'node:assert';
import { makePreviewDom } from './webview-dom-harness.js';

/**
 * Proves the preview's variable-set flow survives its own `#varsSection`
 * innerHTML round-trip (Apply → diff view → Cancel/Apply).
 *
 * The defect: `PREVIEW_CLIENT_JS` binds `#applyVarSetBtn` / `#saveAsVarSetBtn`
 * click listeners, and the `input` listener that clears a var-set `from:`
 * badge, directly to the nodes present at script load. `showDiffView` /
 * `restoreVarsView` replace `#varsSection`'s children wholesale on every
 * diff-view swap, which mints *new* nodes for those same ids — the old,
 * listener-bearing nodes are simply gone. One round-trip (Apply → cancel the
 * diff) is enough to kill Apply, Save, and the badge-clearing input listener.
 *
 * `test/webview-script-executes.test.ts` cannot see this: its stub returns a
 * fresh, disposable element from every `getElementById`, so it never notices
 * a listener bound to a node that later stops being "the" `#id` node.
 * `webview-dom-harness.ts` models identity and the innerHTML round-trip
 * precisely so this defect is reachable.
 */
suite('preview var-set flow survives its own innerHTML round-trip', () => {

    test('harness self-check: innerHTML replacement mints a new element identity', () => {
        const dom = makePreviewDom();
        const before = dom.el('#applyVarSetBtn');
        dom.dispatch({ command: 'showVarSetDiff', html: '<button id="varSetApplyBtn"></button>' });
        dom.dispatch({ command: 'varSetCancelled' });
        assert.notStrictEqual(
            dom.el('#applyVarSetBtn'), before,
            'the harness does not model identity replacement - every later assertion is decorative',
        );
    });

    test('Apply survives a diff round-trip, and the badge-clearing input listener still posts after', () => {
        const dom = makePreviewDom();

        dom.fire(dom.el('#applyVarSetBtn'), 'click');
        dom.dispatch({ command: 'showVarSetDiff', html: '<button id="varSetApplyBtn"></button>' });
        dom.dispatch({ command: 'varSetCancelled' });
        dom.fire(dom.el('#applyVarSetBtn'), 'click');

        assert.strictEqual(
            dom.posted.filter((m) => m.command === 'pickVarSet').length, 2,
            'the second Apply click posted nothing - its listener died with the replaced DOM',
        );

        // Continuation of the exact sequence above, same dom/script instance — load-bearing.
        // Standalone (no prior diff swap) this assertion is green today: restoreVarsView
        // early-returns on savedVarsHtml === null, the badge is built off the still-live
        // original varInputs, and clearVarSource does post. It only goes red once a diff
        // swap has actually happened, which is why it must not be split into its own test.
        dom.dispatch({
            command: 'varSetApplied',
            values: { 'VK-host': 'x' },
            subSetName: 'Dev',
            varNames: ['VK-host'],
        });
        dom.fire(dom.el('[data-var="VK-host"]'), 'input');
        assert.ok(
            dom.posted.some((m) => m.command === 'clearVarSource'),
            'the input listener is bound to a detached node',
        );
    });
});
