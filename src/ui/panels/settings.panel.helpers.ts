import {
    MIN_VARS_HEIGHT_FRACTION,
    MAX_VARS_HEIGHT_FRACTION,
} from '../../services/pane-layout.service.js';
import { MAX_PANE_WIDTH_PX } from '../../types/constants.js';

/**
 * The settings keys this section owns, without the `obsidianArtifacts.` prefix.
 *
 * Named here so the panel's message handler cannot be asked to write an
 * arbitrary settings key: a `setMainPane` message naming anything outside this
 * list is dropped. Webview messages are untrusted input, and this panel is the
 * **only** writer of the config section.
 */
export const MAIN_PANE_KEYS = [
    'mainPane.previewWidthSteps',
    'mainPane.variablesHeightFraction',
] as const;

/** One of the settings keys this section may write. */
export type MainPaneKey = (typeof MAIN_PANE_KEYS)[number];

/**
 * Narrows an untrusted webview payload to a writable settings key.
 *
 * @param raw - Candidate key from a webview message.
 * @returns The key when it is one this section owns, otherwise `undefined`.
 *
 * @example
 * isMainPaneKey('mainPane.previewWidthSteps'); // → true
 * isMainPaneKey('vaultPath');                  // → false (not this section's to write)
 */
export function isMainPaneKey(raw: unknown): raw is MainPaneKey {
    return typeof raw === 'string' && (MAIN_PANE_KEYS as readonly string[]).includes(raw);
}

/**
 * The Preview Pane section's markup.
 *
 * Kept out of `settings.panel.ts` so that file stays inside the ~400-line
 * guideline; it is a static fragment with no interpolation, so nothing here
 * needs escaping.
 *
 * @example
 * `${MAIN_PANE_SECTION_HTML}`
 */
export const MAIN_PANE_SECTION_HTML = /* html */`
    <div class="settings-group">
      <div class="settings-group-head">
        <p class="section-label">Preview Pane</p>
        <button id="resetMainPane" class="link-btn" title="Restore both values to their defaults">Reset</button>
      </div>

      <div class="setting">
        <div class="setting-text">
          <label for="varsFraction">Variables height</label>
          <span class="setting-hint">Share of the pane before the list scrolls</span>
        </div>
        <div class="setting-control">
          <input type="range" id="varsFraction"
                 min="${MIN_VARS_HEIGHT_FRACTION}" max="${MAX_VARS_HEIGHT_FRACTION}" step="0.01">
          <output id="varsFractionOut" for="varsFraction">—</output>
        </div>
      </div>

      <div class="setting">
        <div class="setting-text">
          <label for="widthSteps">Widen on open</label>
          <span class="setting-hint">Fallback only — the pane measures itself and targets a third of your screen, up to ${MAX_PANE_WIDTH_PX}px</span>
        </div>
        <div class="setting-control">
          <input type="range" id="widthSteps" min="0" max="20" step="1">
          <output id="widthStepsOut" for="widthSteps">—</output>
        </div>
      </div>
    </div>
`;

/**
 * Styles for the Preview Pane section.
 *
 * Every colour is a `var(--vscode-…)` token so both themes work untouched —
 * the same rule the pane's own stylesheet is guarded on.
 *
 * @example
 * `<style nonce="${nonce}">${MAIN_PANE_SECTION_CSS}</style>`
 */
export const MAIN_PANE_SECTION_CSS = /* css */`
  .settings-group {
    margin-top: 28px;
    padding-top: 16px;
    border-top: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
  }
  .settings-group-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .link-btn {
    background: none;
    border: none;
    padding: 0;
    width: auto;
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    font-size: 0.85rem;
  }
  .link-btn:hover { color: var(--vscode-textLink-activeForeground); text-decoration: underline; }
  .setting {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 12px 0;
  }
  .setting + .setting { border-top: 1px solid var(--vscode-widget-border, transparent); }
  .setting-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .setting-text label { font-size: 0.95rem; }
  .setting-hint {
    font-size: 0.8rem;
    color: var(--vscode-descriptionForeground);
  }
  .setting-control {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 0 0 auto;
  }
  .setting-control input[type="range"] { width: 140px; accent-color: var(--vscode-focusBorder); }
  .setting-control output {
    min-width: 3.5ch;
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: var(--vscode-descriptionForeground);
  }
`;

/**
 * Client-side wiring for the Preview Pane section.
 *
 * Concatenated into the panel's existing `<script>` block, so it reuses that
 * script's single `acquireVsCodeApi()` handle — it must never call it again,
 * as the API may be acquired only once per webview.
 *
 * @example
 * `<script nonce="${nonce}">const vscode = acquireVsCodeApi(); ${MAIN_PANE_CLIENT_JS}</script>`
 */
export const MAIN_PANE_CLIENT_JS = /* js */`
    const stepsInput = document.getElementById('widthSteps');
    const varsInput  = document.getElementById('varsFraction');
    const stepsOut   = document.getElementById('widthStepsOut');
    const varsOut    = document.getElementById('varsFractionOut');
    const resetBtn   = document.getElementById('resetMainPane');

    function sendMainPane(key, raw) {
      const value = Number(raw);
      if (!Number.isFinite(value)) { return; }
      vscode.postMessage({ command: 'setMainPane', key: key, value: value });
    }

    // A fraction reads as a percentage; a step count reads as itself, with 0
    // spelled out because "0" alone looks like a missing value rather than a
    // deliberate "don't resize".
    function paintVars(v)  { if (varsOut)  { varsOut.textContent  = Math.round(Number(v) * 100) + '%'; } }
    function paintSteps(v) { if (stepsOut) { stepsOut.textContent = Number(v) === 0 ? 'Off' : String(v); } }

    function wireSlider(input, paint, key) {
      if (!input) { return; }
      // 'input' fires continuously while dragging — repaint only, so the
      // settings file is not rewritten on every pixel of travel.
      input.addEventListener('input', function () { paint(input.value); });
      input.addEventListener('change', function () { sendMainPane(key, input.value); });
    }

    wireSlider(varsInput,  paintVars,  'mainPane.variablesHeightFraction');
    wireSlider(stepsInput, paintSteps, 'mainPane.previewWidthSteps');

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        vscode.postMessage({ command: 'resetMainPane' });
      });
    }

    function applyMainPaneConfig(msg) {
      if (stepsInput && typeof msg.widthSteps === 'number') {
        stepsInput.value = msg.widthSteps;
        paintSteps(msg.widthSteps);
      }
      if (varsInput && typeof msg.varsFraction === 'number') {
        varsInput.value = msg.varsFraction;
        paintVars(msg.varsFraction);
      }
    }
`;
