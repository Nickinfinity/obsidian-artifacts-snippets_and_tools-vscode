import { escHtml } from '../../../utils/html.js';
import { labelForVar } from '../artifactPicker/preview.helpers.js';
import { FREE_LANGUAGE_OPTIONS } from './form.helpers.js';
import type { ArtifactFormBlock, ArtifactFormModel } from '../../../types/artifact-form.types.js';
import type { ParsedVar } from '../../../types/parsed-artifact.types.js';
import type { LanguageMode } from '../../../types/artifact.types.js';

// ── Language selector ─────────────────────────────────────────────────────────

/**
 * Builds a language `<select>` element for a block.
 *
 * - `free`: enabled dropdown with `FREE_LANGUAGE_OPTIONS`; current value pre-selected.
 * - `locked`: disabled single-option select showing the locked language.
 * - `hidden`: returns empty string (selector not rendered).
 *
 * @param blockIndex   - Zero-based block index (for element ids).
 * @param currentLang  - Currently selected language value.
 * @param mode         - Language selector mode from artifact type config.
 * @param lockedLang   - Language to show when `mode === 'locked'`.
 * @returns HTML string for the selector field row, or `''` when hidden.
 *
 * @example
 * buildLanguageSelector(0, 'javascript', 'free', '')
 */
export function buildLanguageSelector(
    blockIndex:  number,
    currentLang: string,
    mode:        LanguageMode,
    lockedLang:  string,
): string {
    if (mode === 'hidden') { return ''; }

    const id       = `block-${blockIndex}-lang`;
    const dataAttr = `data-block="${blockIndex}"`;

    if (mode === 'locked') {
        const safe = escHtml(lockedLang);
        return `<div class="field-row lang-row">
  <label class="slabel" for="${id}">Language</label>
  <select id="${id}" class="lang-select" ${dataAttr} disabled>
    <option value="${safe}" selected>${safe}</option>
  </select>
</div>`;
    }

    // free mode — full dropdown
    const options = FREE_LANGUAGE_OPTIONS.map(val => {
        const label  = val === '' ? 'Plain text' : val;
        const safeV  = escHtml(val);
        const safeL  = escHtml(label);
        const selStr = val === currentLang ? ' selected' : '';
        return `    <option value="${safeV}"${selStr}>${safeL}</option>`;
    }).join('\n');

    return `<div class="field-row lang-row">
  <label class="slabel" for="${id}">Language</label>
  <select id="${id}" class="lang-select" ${dataAttr}>
${options}
  </select>
</div>`;
}

// ── Vars table ────────────────────────────────────────────────────────────────

/**
 * Builds the variables table for a block.
 *
 * Renders one input row per detected `<VK-xxx>` variable. Returns empty string
 * when the block has no vars.
 *
 * @param vars       - Variable list from `block.vars`.
 * @param blockIndex - Zero-based block index (for element ids/data attrs).
 * @returns HTML string for the vars section, or `''` when empty.
 *
 * @example
 * buildVarsTable([{ name: 'VK-host', defaultValue: 'localhost' }], 0)
 */
export function buildVarsTable(vars: ParsedVar[], blockIndex: number): string {
    if (vars.length === 0) { return ''; }
    const rows = vars.map(v => {
        const safeName  = escHtml(v.name);
        const safeVal   = escHtml(v.defaultValue);
        const safeLabel = escHtml(labelForVar(v.name));
        return `      <tr class="var-row" data-var="${safeName}" data-block="${blockIndex}">
        <td class="var-name">${safeLabel}</td>
        <td class="var-default">
          <input type="text" class="var-input" data-var="${safeName}" data-block="${blockIndex}" value="${safeVal}" placeholder="Default value">
        </td>
      </tr>`;
    }).join('\n');
    return `<div class="vars-section">
  <div class="slabel">Variables</div>
  <table class="vars-table"><tbody>
${rows}
  </tbody></table>
</div>`;
}

// ── Single block (inline, no card chrome) ─────────────────────────────────────

/**
 * Builds the inline block content for a single-block form.
 *
 * No card chrome, no heading/description inputs (hidden in single-block mode).
 *
 * @param block        - The sole block from the model.
 * @param blockIndex   - Always `0` for single-block.
 * @param mode         - Language selector mode.
 * @param lockedLang   - Locked language string (used when `mode === 'locked'`).
 * @param codeBlockHtml - Editable code-block HTML builder.
 * @returns HTML string for the block content.
 *
 * @example
 * buildSingleBlockContent(model.blocks[0], 0, 'free', '', codeBlockHtml)
 */
export function buildSingleBlockContent(
    block:        ArtifactFormBlock,
    blockIndex:   number,
    mode:         LanguageMode,
    lockedLang:   string,
    codeBlockHtml:(code: string, lang: string) => string,
): string {
    const langSelector = buildLanguageSelector(blockIndex, block.language, mode, lockedLang);
    const resolvedLang = mode === 'locked' ? lockedLang : block.language;
    const codeHtml     = codeBlockHtml(block.code, resolvedLang);
    const varsHtml     = buildVarsTable(block.vars, blockIndex);
    return `<div class="block" data-block-index="${blockIndex}">
${langSelector}
<div class="block-code">
${codeHtml}
</div>
${varsHtml}
</div>`;
}

// ── Multi-block area (accordion cards) ────────────────────────────────────────

/**
 * Builds the full multi-block area as accordion cards.
 *
 * @param model         - Form model with `blocks.length > 1`.
 * @param mode          - Language mode for the type.
 * @param lockedLang    - Locked language (used when `mode === 'locked'`).
 * @param codeBlockHtml - Editable code-block HTML builder.
 * @returns HTML string for all block cards.
 *
 * @example
 * buildMultiBlockArea(model, 'free', '', codeBlockHtml)
 */
export function buildMultiBlockArea(
    model:        ArtifactFormModel,
    mode:         LanguageMode,
    lockedLang:   string,
    codeBlockHtml:(code: string, lang: string) => string,
): string {
    const total = model.blocks.length;
    return model.blocks.map((block, idx) =>
        buildBlockCard(block, idx, total, mode, lockedLang, codeBlockHtml)
    ).join('\n');
}

/**
 * Builds one accordion card for a block in multi-block mode.
 *
 * Card header: heading input, language selector, reorder buttons, remove
 * button, expand chevron. Card body: description, code area, vars.
 * Reorder `↑` disabled on block 0; `↓` disabled on the last block.
 *
 * @param block         - Block data.
 * @param blockIndex    - Zero-based index within model.blocks.
 * @param total         - Total number of blocks (for boundary detection).
 * @param mode          - Language mode.
 * @param lockedLang    - Locked language string.
 * @param codeBlockHtml - Editable code-block HTML builder.
 * @returns HTML string for the block card.
 *
 * @example
 * buildBlockCard(block, 0, 2, 'free', '', codeBlockHtml)
 */
function buildBlockCard(
    block:        ArtifactFormBlock,
    blockIndex:   number,
    total:        number,
    mode:         LanguageMode,
    lockedLang:   string,
    codeBlockHtml:(code: string, lang: string) => string,
): string {
    const isFirst      = blockIndex === 0;
    const isLast       = blockIndex === total - 1;
    const upDisabled   = isFirst ? ' disabled' : '';
    const downDisabled = isLast  ? ' disabled' : '';
    const headingVal   = escHtml(block.heading);
    const descVal      = escHtml(block.description);
    const langSelector = buildLanguageSelector(blockIndex, block.language, mode, lockedLang);
    const resolvedLang = mode === 'locked' ? lockedLang : block.language;
    const codeHtml     = codeBlockHtml(block.code, resolvedLang);
    const varsHtml     = buildVarsTable(block.vars, blockIndex);
    const bodyClass    = isFirst ? 'card-body expanded' : 'card-body';

    return `<div class="block-card" data-block-index="${blockIndex}">
  <div class="card-header">
    <input type="text" id="block-${blockIndex}-heading" class="block-heading-input" value="${headingVal}" data-block="${blockIndex}" placeholder="Block heading">
    ${langSelector}
    <button class="reorder-btn" data-action="up" data-block="${blockIndex}"${upDisabled}>↑</button>
    <button class="reorder-btn" data-action="down" data-block="${blockIndex}"${downDisabled}>↓</button>
    <button class="remove-block-btn" data-block="${blockIndex}">×</button>
    <button class="expand-btn" data-block="${blockIndex}" aria-label="Toggle block">⌄</button>
  </div>
  <div class="${bodyClass}" data-block="${blockIndex}">
    <div class="field-row">
      <label class="slabel" for="block-${blockIndex}-desc">Description</label>
      <textarea id="block-${blockIndex}-desc" class="form-input form-textarea" data-block="${blockIndex}" rows="2" placeholder="Optional block description">${descVal}</textarea>
    </div>
    <div class="block-code">
${codeHtml}
    </div>
${varsHtml}
  </div>
</div>`;
}
