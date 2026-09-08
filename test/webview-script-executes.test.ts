import * as assert from 'node:assert';
import { PREVIEW_CLIENT_JS } from '../src/ui/panels/artifactPicker/preview.clientJs.js';
import { FORM_CLIENT_JS } from '../src/ui/panels/artifactForm/form.clientJs.js';
import { MAIN_PANE_CLIENT_JS } from '../src/ui/panels/settings.panel.helpers.js';

/**
 * Executes each webview client script against a DOM stub.
 *
 * **Every other webview test in this repo asserts on the script's source
 * text** — that a function name appears, that a message id is present. None of
 * them ever ran it. That gap shipped a real defect: a `const` referenced above
 * its own declaration threw a Temporal Dead Zone `ReferenceError` on load, so
 * the entire preview script aborted — no message listeners, no variable-set
 * buttons, and every extension-to-webview message silently ignored — while
 * 1205 tests passed.
 *
 * A `ReferenceError`, a `SyntaxError`, or a throw during setup is invisible to
 * the extension host: the webview simply does nothing. This suite is the only
 * thing standing between that and a release.
 *
 * It deliberately proves *loadability*, not behaviour — the stub is not a
 * browser and cannot tell you a button is reachable. That remains an F5 check.
 */

/** A DOM element stub that accepts every call the client scripts make on one. */
function stubElement(): Record<string, unknown> {
    const el: Record<string, unknown> = {
        addEventListener: () => { /* recorded nowhere; loadability only */ },
        removeEventListener: () => { /* ditto */ },
        appendChild: () => { /* ditto */ },
        remove: () => { /* ditto */ },
        setPointerCapture: () => { /* ditto */ },
        releasePointerCapture: () => { /* ditto */ },
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 300, height: 600 }),
        querySelector: () => null,
        querySelectorAll: () => [],
        closest: () => null,
        focus: () => { /* ditto */ },
        classList: { contains: () => false, add: () => { /* ditto */ }, remove: () => { /* ditto */ } },
        dataset: {},
        style: { setProperty: () => { /* ditto */ }, display: '' },
        innerHTML: '',
        textContent: '',
        value: '',
        hidden: false,
        checked: false,
        files: [],
    };
    return el;
}

/**
 * Runs one client script under a DOM stub.
 *
 * @param script - The client-JS bundle to execute.
 * @returns The window event types the script subscribed to.
 *
 * @example
 * runScript(PREVIEW_CLIENT_JS); // → ['message']
 */
function runScript(script: string): string[] {
    const windowListeners: string[] = [];
    const doc = {
        getElementById: () => stubElement(),
        querySelector: () => stubElement(),
        querySelectorAll: () => [] as unknown[],
        createElement: () => stubElement(),
        createRange: () => ({
            setStart: () => { /* stub */ },
            collapse: () => { /* stub */ },
            selectNodeContents: () => { /* stub */ },
        }),
        addEventListener: () => { /* stub */ },
        execCommand: () => true,
        body: stubElement(),
        documentElement: stubElement(),
    };
    const win = {
        addEventListener: (type: string) => { windowListeners.push(type); },
        getSelection: () => ({ removeAllRanges: () => { /* stub */ }, addRange: () => { /* stub */ } }),
        getComputedStyle: () => ({ getPropertyValue: () => '' }),
        innerWidth: 300,
        innerHeight: 600,
        screen: { availWidth: 1920, availHeight: 1080 },
        clipboardData: { getData: () => '' },
        setTimeout: (fn: () => void) => { void fn; return 0; },
        clearTimeout: () => { /* stub */ },
    };
    const vscode = { postMessage: () => { /* stub */ }, getState: () => undefined, setState: () => { /* stub */ } };

    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function('vscode', 'document', 'window', 'setTimeout', 'clearTimeout', script);
    fn(vscode, doc, win, win.setTimeout, win.clearTimeout);
    return windowListeners;
}

suite('webview client scripts actually load', () => {

    test('PREVIEW_CLIENT_JS runs without throwing and installs its message listener', () => {
        // The listener is the load-bearing part: without it every ext→webview
        // message (updateVars, fileUpdated, codeStaged, setVarsHeight,
        // measurePane, varSet*) is silently dropped.
        const listeners = runScript(PREVIEW_CLIENT_JS);
        assert.ok(
            listeners.includes('message'),
            'the preview script did not register its window message listener — it aborted during setup',
        );
    });

    test('FORM_CLIENT_JS runs without throwing', () => {
        assert.doesNotThrow(() => runScript(FORM_CLIENT_JS));
    });

    test('MAIN_PANE_CLIENT_JS runs without throwing', () => {
        // This one is a fragment concatenated into the settings panel's script,
        // so it is executed the same way the panel executes it.
        assert.doesNotThrow(() => runScript(MAIN_PANE_CLIENT_JS));
    });
});
