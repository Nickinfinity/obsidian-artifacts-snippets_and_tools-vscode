/**
 * Re-export shim for back-compatibility with `commands/insert.command.ts`.
 *
 * The implementation lives under `./artifactPicker/` split into four parts:
 *   1. navigator.ts          — QuickPick hierarchical browser
 *   2. codeBlock.ts          — editable code-area HTML + client script
 *   3. preview.ts            — popup webview controller + chrome HTML
 *   4. fullEditor.ts         — real `.md` file watcher controller
 *
 * Each part has a sibling `*.helpers.ts`.  See `REFACTOR_PLAN.md`.
 */
export { openArtifactPicker } from './artifactPicker/navigator.js';
