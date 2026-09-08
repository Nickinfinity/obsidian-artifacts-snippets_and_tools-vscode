import { getCreateFormTypes, getAllTypes, getEntry } from '../../services/artifact-type-config.service.js';
import { escHtml, styleLinkTags } from '../../utils/html.js';
// THE create-id scheme — same authority insert.command.ts's artifactCommandId is
// for insert. Constructing the id inline here would be a second spelling.
import { createCommandId } from '../../commands/create-from-surface.command.js';
// THE insert-id scheme, for the same reason.
import { artifactCommandId } from '../../commands/insert.command.js';
import type { ArtifactType } from '../../types/parsed-artifact.types.js';

/** Command id the pane's Settings row runs — registered by `openSettings.command.ts`. */
export const SETTINGS_COMMAND_ID = 'obsidian-artifacts.settings';

/**
 * One row in the main pane's idle-mode create list.
 */
export interface CreateItem {
    /** Canonical artifact type this row creates. */
    type: ArtifactType;
    /** Row label — literal `Create ` prefix + `getEntry(type).name`. */
    label: string;
}

// ── Data ─────────────────────────────────────────────────────────────────────

/**
 * Builds the idle-mode "create" row data, one row per create-form-enabled
 * artifact type.
 *
 * Order and membership come from `getCreateFormTypes()` (`ARTIFACTS`
 * declaration order) — the main pane never hardcodes a type list, so a new
 * create-form type in `ARTIFACTS` surfaces here automatically.
 *
 * @returns One `CreateItem` per create-form-enabled type, in `ARTIFACTS` order.
 *
 * @example
 * buildCreateItems()[0] // → { type: 'Snippet', label: 'Create Snippets' }
 */
export function buildCreateItems(): CreateItem[] {
    return getCreateFormTypes().map(type => ({ type, label: `Create ${getEntry(type).name}` }));
}

/**
 * Resolves the base create command id for a `createType` webview message,
 * or `undefined` when `type` is not a create-form type.
 *
 * `type` crosses the webview boundary untrusted: `getEntry` alone would
 * accept any of the six `ArtifactType` literals (including `Variables`,
 * which has no create form), resolving to an `obsidian-artifacts.create.*`
 * id that is never registered. Gating on membership in the same
 * `getCreateFormTypes()` list the rows are built from keeps the two in
 * lockstep — a type can never be clickable here without also being a valid
 * target.
 *
 * @param type - Raw `type` value from a `{ command: 'createType', type }` message.
 * @returns `obsidian-artifacts.create.<dir>` for a create-form type, else `undefined`.
 *
 * @example
 * resolveCreateCommandId('Snippet')   // → 'obsidian-artifacts.create.snippets'
 * resolveCreateCommandId('Variables') // → undefined — not a create-form type
 */
export function resolveCreateCommandId(type: string): string | undefined {
    const createType = getCreateFormTypes().find(t => t === type);
    if (!createType) {
        return undefined;
    }
    return createCommandId(getEntry(createType).dir);
}

/**
 * Builds the idle-mode "browse" row data — one row per artifact type.
 *
 * Every type is browsable (unlike create, which only some types support), so
 * this reads `getAllTypes()` rather than `getCreateFormTypes()`. Membership
 * still comes from `ARTIFACTS`, so a new type appears here with no edit.
 *
 * @returns One `CreateItem` per artifact type, in `ARTIFACTS` order.
 *
 * @example
 * buildBrowseItems()[0] // → { type: 'Snippet', label: 'Snippets' }
 */
export function buildBrowseItems(): CreateItem[] {
    return getAllTypes().map(type => ({ type, label: getEntry(type).name }));
}

/**
 * Resolves the insert/browse command id for a `browseType` webview message.
 *
 * Gated against `getAllTypes()` for the same reason `resolveCreateCommandId`
 * gates against `getCreateFormTypes()`: `type` crosses the webview boundary
 * untrusted, and an ungated value would build an `obsidian-artifacts.insert.*`
 * id that was never registered.
 *
 * @param type - Raw `type` value from a `{ command: 'browseType', type }` message.
 * @returns `obsidian-artifacts.insert.<dir>` for a known type, else `undefined`.
 *
 * @example
 * resolveBrowseCommandId('Snippet')  // → 'obsidian-artifacts.insert.snippets'
 * resolveBrowseCommandId('Nonsense') // → undefined
 */
export function resolveBrowseCommandId(type: string): string | undefined {
    const known = getAllTypes().find(t => t === type);
    if (!known) {
        return undefined;
    }
    return artifactCommandId(getEntry(known).dir);
}

// ── HTML ─────────────────────────────────────────────────────────────────────

/**
 * Renders the idle-mode webview HTML — one clickable row per create item.
 *
 * Every interpolated value is escaped via `escHtml`. Clicking (or pressing
 * Enter/Space on) a row posts `{ command: 'createType', type }` to the
 * extension host.
 *
 * Every row uses the same vendored codicon "add" glyph
 * (`Artifact.icon` is unpopulated by every `ARTIFACTS` entry today, so a
 * per-type icon branch would be five identical fallbacks dressed up as a
 * feature that does not exist).
 *
 * @param items     - Rows to render, from `buildCreateItems()`.
 * @param cssUris   - Webview URIs for the stylesheets — `base.css` first.
 * @param cspSource - Webview CSP source token (`webview.cspSource`).
 * @param nonce     - CSP nonce shared by the `<style>` and `<script>` tags.
 * @returns Complete HTML document string for `webview.html`.
 *
 * @example
 * renderIdleHtml(buildCreateItems(), [baseCssUri, codiconCssUri], webview.cspSource, getNonce())
 */
export function renderIdleHtml(
    items: CreateItem[],
    cssUris: string | string[],
    cspSource: string,
    nonce: string,
    browseItems: CreateItem[] = [],
): string {
    const rows = renderRows(items, 'createType', 'add');
    const browseRows = renderRows(browseItems, 'browseType', 'search');
    const browseSection = browseItems.length > 0
        ? `<p class="pane-section-label">Open</p><div class="create-list">${browseRows}</div>`
        : '';

    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}'; font-src ${cspSource};">
${styleLinkTags(cssUris)}
<style nonce="${nonce}">
  .create-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin-bottom: 4px;
    text-align: left;
  }
  .create-row-label { flex: 1; }
  /* Pins Settings to the bottom without a fixed height: the body is the flex
     column and the spacer takes whatever is left over. */
  body.popup-body { display: flex; flex-direction: column; min-height: 100vh; }
  .pane-spacer { flex: 1 1 auto; }
  .pane-section-label {
    margin: 14px 0 6px;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--vscode-descriptionForeground);
  }
  .pane-footer {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--vscode-widget-border, transparent);
  }
</style>
</head>
<body class="popup-body">
  <p class="pane-section-label">New</p>
  <div class="create-list">${rows}</div>
  ${browseSection}
  <div class="pane-spacer"></div>
  <div class="pane-footer">
    <button class="create-row" id="paneSettingsBtn">
      <span class="codicon codicon-gear" aria-hidden="true"></span>
      <span class="create-row-label">Settings</span>
    </button>
  </div>
<script nonce="${nonce}">
(function () {
  const vscode = acquireVsCodeApi();
  document.querySelectorAll('.create-row[data-type]').forEach(function (el) {
    el.addEventListener('click', function () {
      vscode.postMessage({ command: el.dataset.action, type: el.dataset.type });
    });
  });
  const settingsBtn = document.getElementById('paneSettingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', function () {
      vscode.postMessage({ command: 'openSettings' });
    });
  }
})();
</script>
</body>
</html>`;
}

/**
 * Renders one list of clickable rows.
 *
 * The row carries its own `data-action`, so the click handler posts the right
 * command without a second `querySelectorAll` per section — one listener, one
 * message shape, whatever the section.
 *
 * @param items  - Rows to render.
 * @param action - Message `command` a click posts (`createType` / `browseType`).
 * @param icon   - Vendored codicon glyph name, without the `codicon-` prefix.
 * @returns The rows' HTML, every interpolation escaped.
 *
 * @example
 * renderRows(buildBrowseItems(), 'browseType', 'search')
 */
function renderRows(items: CreateItem[], action: string, icon: string): string {
    return items.map(item => `
      <button class="create-row" data-type="${escHtml(item.type)}" data-action="${escHtml(action)}">
        <span class="codicon codicon-${escHtml(icon)}" aria-hidden="true"></span>
        <span class="create-row-label">${escHtml(item.label)}</span>
      </button>`).join('');
}
