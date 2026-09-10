import { CODE_BLOCK_CLIENT_JS } from './codeBlock.js';

/**
 * Client-side JavaScript bundle for the interactive artifact preview popup.
 *
 * Intended to be embedded inside one outer IIFE that provides
 * `const vscode = acquireVsCodeApi()` — call that exactly once per webview
 * (see `preview.render.ts:renderPreviewHtml`). Includes `CODE_BLOCK_CLIENT_JS`
 * first (which also carries the shared `esc`/`lbl` helpers — see
 * `webviewSnippets.ts`), then layers in preview-panel-specific interactivity:
 * variable inputs, Insert/Edit/Cancel buttons, and the Variable-Set apply/
 * save flow.
 *
 * Responsibilities:
 * 1. Include CODE_BLOCK_CLIENT_JS — exposes `window.__codeBlock` + shared
 *    `esc`/`lbl`.
 * 2. Collect `[data-var]` input values; wire Insert/Copy/Edit/
 *    Cancel buttons and Ctrl/Cmd+Enter to Insert.
 * 3. Apply/Save-as Variable Set buttons; clears a var's `from:` badge on
 *    manual edit.
 * 4. `updateVars` / `fileUpdated` messages → rebuild the variable inputs,
 *    preserving already-typed values.
 * 5. `showVarSetDiff` / `varSetApplied` / `varSetCancelled` messages → diff
 *    preview swap-in/restore.
 *
 * @example
 * panel.webview.html = `<script nonce="${nonce}">(function(){
 *   const vscode = acquireVsCodeApi();
 *   ${PREVIEW_CLIENT_JS}
 * })();</script>`;
 */
export const PREVIEW_CLIENT_JS: string = `${CODE_BLOCK_CLIENT_JS}
  // ── Buttons ──────────────────────────────────────────────────────────────
  function collectVars() {
    const out = {};
    document.querySelectorAll('[data-var]').forEach(function (el) { out[el.dataset.var] = el.value; });
    return out;
  }
  document.getElementById('insertBtn').addEventListener('click', function () {
    window.__codeBlock.flushPendingRender();
    vscode.postMessage({ command: 'insert', vars: collectVars(), code: window.__codeBlock.extractCode() });
  });
  document.getElementById('copyBtn').addEventListener('click', function () {
    window.__codeBlock.flushPendingRender();
    vscode.postMessage({ command: 'copy', vars: collectVars(), code: window.__codeBlock.extractCode() });
  });
  document.getElementById('editBtn').addEventListener('click', function () {
    vscode.postMessage({ command: 'fullEdit' });
  });

  // ── Staged-edit state ────────────────────────────────────────────────────
  // Editing here changes only what gets inserted; the .md is untouched until
  // Overwrite. Both editing surfaces (this code area and the expanded editor)
  // funnel through markStaged so the notice cannot appear for one and not the
  // other.
  const dirtyNotice  = document.getElementById('dirtyNotice');
  const overwriteBtn = document.getElementById('overwriteBtn');

  function markStaged() {
    if (dirtyNotice)  { dirtyNotice.hidden  = false; }
    if (overwriteBtn) { overwriteBtn.hidden = false; }
  }
  function clearStaged() {
    if (dirtyNotice)  { dirtyNotice.hidden  = true; }
    if (overwriteBtn) { overwriteBtn.hidden = true; }
  }

  const codeArea = document.getElementById('codeWrapper');
  if (codeArea) { codeArea.addEventListener('input', markStaged); }

  const expandBtn = document.getElementById('expandCodeBtn');
  if (expandBtn) {
    expandBtn.addEventListener('click', function () {
      vscode.postMessage({ command: 'editBlock' });
    });
  }
  if (overwriteBtn) {
    overwriteBtn.addEventListener('click', function () {
      window.__codeBlock.flushPendingRender();
      vscode.postMessage({ command: 'overwrite', code: window.__codeBlock.extractCode() });
    });
  }
  document.getElementById('cancelBtn').addEventListener('click', function () {
    vscode.postMessage({ command: 'cancel' });
  });
  document.addEventListener('keydown', function (ev) {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
      ev.preventDefault();
      document.getElementById('insertBtn').click();
    }
  });

  const varsSection = document.getElementById('varsSection');
  // #varsSection's children are replaced wholesale on every diff-view swap
  // (showDiffView / restoreVarsView), which mints a fresh #varInputs node —
  // a const captured once at load would go stale after the first round-trip.
  function varInputsEl() { return varsSection ? varsSection.querySelector('#varInputs') : null; }

  // ── Variables-section resize ─────────────────────────────────────────────
  // The extension cannot read this pane's size, so the drag is resolved here:
  // pointer position becomes a fraction of the pane, applied locally for
  // instant feedback and posted once on release. The extension clamps and
  // persists it — this side never decides what is in range.
  const varsResizeHandle = document.getElementById('varsResizeHandle');
  if (varsResizeHandle && varsSection) {
    let dragging = false;

    function fractionFromPointer(clientY) {
      const top = varsSection.getBoundingClientRect().top;
      const paneHeight = window.innerHeight || 1;
      return (clientY - top) / paneHeight;
    }

    function applyLocal(fraction) {
      // Local feedback only; the authoritative bounds live in the extension.
      document.documentElement.style.setProperty('--oa-vars-height', (fraction * 100) + 'vh');
    }

    varsResizeHandle.addEventListener('pointerdown', function (ev) {
      dragging = true;
      varsResizeHandle.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });
    varsResizeHandle.addEventListener('pointermove', function (ev) {
      if (!dragging) { return; }
      applyLocal(fractionFromPointer(ev.clientY));
    });
    varsResizeHandle.addEventListener('pointerup', function (ev) {
      if (!dragging) { return; }
      dragging = false;
      varsResizeHandle.releasePointerCapture(ev.pointerId);
      vscode.postMessage({ command: 'varsHeightChanged', fraction: fractionFromPointer(ev.clientY) });
    });
  }

  // ── Variable-set buttons ─────────────────────────────────────────────────
  let savedVarsHtml = null;  // snapshot of inputs HTML used to restore on cancelApply

  function refreshSaveBtn() {
    const btn = document.getElementById('saveAsVarSetBtn');
    if (!btn) { return; }
    const hasValue = Object.values(collectVars()).some(function (v) { return v && v.length > 0; });
    btn.style.display = hasValue ? '' : 'none';
  }

  // Delegated from #varsSection, which is never itself replaced by a diff-view
  // swap — only its children are. A direct bind on #applyVarSetBtn /
  // #saveAsVarSetBtn / #varInputs dies the moment showDiffView/restoreVarsView
  // mints new nodes for those ids; delegation survives because the listener
  // lives on the one element that never gets swapped.
  if (varsSection) {
    varsSection.addEventListener('click', function (ev) {
      const t = ev.target;
      if (!t || !t.id) { return; }
      if (t.id === 'applyVarSetBtn') {
        vscode.postMessage({ command: 'pickVarSet', values: collectVars() });
      } else if (t.id === 'saveAsVarSetBtn') {
        vscode.postMessage({ command: 'saveAsVarSet', values: collectVars() });
      }
    });
    varsSection.addEventListener('input', function (ev) {
      const t = ev.target;
      if (t && t.dataset && t.dataset.var) {
        // Manual edit removes the source badge for this var.
        const box = varInputsEl();
        const badge = box ? box.querySelector('[data-var-source="' + t.dataset.var + '"]') : null;
        if (badge) {
          badge.remove();
          vscode.postMessage({ command: 'clearVarSource', name: t.dataset.var });
        }
      }
      refreshSaveBtn();
    });
  }
  refreshSaveBtn();

  // ── updateVars / fileUpdated incoming messages ──────────────────────────
  function rebuildVarInputs(vars) {
    const box = varInputsEl();
    if (!box) { return; }
    const existing = collectVars();
    if (!vars || vars.length === 0) {
      box.innerHTML = '<p class="muted">No variables defined.</p>';
      return;
    }
    box.innerHTML = vars.map(function (v) {
      const value = existing[v.name] !== undefined ? existing[v.name] : (v.defaultValue || '');
      return '<div class="input-row">' +
        '<label for="v-' + esc(v.name) + '">' + esc(lbl(v.name)) + '</label>' +
        '<input id="v-' + esc(v.name) + '" data-var="' + esc(v.name) + '" type="text" value="' + esc(value) + '" placeholder="' + esc(lbl(v.name)) + '">' +
      '</div>';
    }).join('');
  }
  // ── Var-set diff / applied / cancelled handlers ─────────────────────────
  function showDiffView(html) {
    if (!varsSection) { return; }
    if (savedVarsHtml === null) { savedVarsHtml = varsSection.innerHTML; }
    varsSection.innerHTML = html;
    const applyBtn  = document.getElementById('varSetApplyBtn');
    const cancelBtn = document.getElementById('varSetCancelBtn');
    if (applyBtn)  { applyBtn.addEventListener('click',  function () { vscode.postMessage({ command: 'confirmApply' }); }); }
    if (cancelBtn) { cancelBtn.addEventListener('click', function () { vscode.postMessage({ command: 'cancelApply'  }); }); }
  }
  function restoreVarsView() {
    if (!varsSection || savedVarsHtml === null) { return; }
    varsSection.innerHTML = savedVarsHtml;
    savedVarsHtml = null;
    refreshSaveBtn();
  }
  function applyValuesAndBadges(values, subSetName, varNames) {
    restoreVarsView();
    const inputs = document.querySelectorAll('[data-var]');
    inputs.forEach(function (el) {
      const name = el.dataset.var;
      if (Object.prototype.hasOwnProperty.call(values, name)) { el.value = values[name]; }
    });
    const box = varInputsEl();
    const flagged = new Set(varNames || []);
    flagged.forEach(function (name) {
      if (!box) { return; }
      const input = box.querySelector('[data-var="' + name + '"]');
      if (!input) { return; }
      const row = input.closest('.input-row');
      if (!row) { return; }
      const existing = row.querySelector('[data-var-source]');
      if (existing) { existing.remove(); }
      const badge = document.createElement('span');
      badge.className = 'var-source';
      badge.dataset.varSource = name;
      badge.textContent = 'from: ' + subSetName;
      row.appendChild(badge);
    });
    refreshSaveBtn();
  }

  window.addEventListener('message', function (event) {
    const msg = event.data || {};
    if (msg.command === 'updateVars')  { rebuildVarInputs(msg.vars); refreshSaveBtn(); }
    if (msg.command === 'fileUpdated' && msg.artifact) {
      window.__codeBlock.setCode(msg.artifact.code || '');
      rebuildVarInputs(msg.artifact.vars);
      refreshSaveBtn();
    }
    if (msg.command === 'showVarSetDiff') { showDiffView(msg.html); }
    if (msg.command === 'varSetApplied')  { applyValuesAndBadges(msg.values || {}, msg.subSetName || '', msg.varNames || []); }
    if (msg.command === 'varSetCancelled'){ restoreVarsView(); }
    // Saved in the expanded editor: same staged state as typing here.
    if (msg.command === 'codeStaged') {
      window.__codeBlock.setCode(msg.code || '');
      markStaged();
    }
    if (msg.command === 'overwriteDone') { clearStaged(); }
    // Authoritative height from the extension (config, already clamped).
    if (msg.command === 'setVarsHeight' && msg.value) {
      document.documentElement.style.setProperty('--oa-vars-height', msg.value);
    }
    // The extension host cannot read this pane's width — no such member exists
    // on WebviewView. The webview can: it is a real DOM. Reported back so the
    // widen loop can stop at a target instead of stepping blind.
    if (msg.command === 'measurePane') {
      vscode.postMessage({
        command: 'paneMetrics',
        paneWidth: window.innerWidth,
        availWidth: window.screen ? window.screen.availWidth : 0,
      });
    }
  });
`;
