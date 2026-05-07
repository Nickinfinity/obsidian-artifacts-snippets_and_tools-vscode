# REFACTOR PLAN — `artifactPicker.panel.ts` (1182 lines)

> **Read-only plan. No code moves yet.**
> Source-of-truth file: `src/ui/panels/artifactPicker.panel.ts`
> Generated: 2026-05-07

---

## 0. Symbol inventory (every class / function / constant in the file)

### 0.1 Imports (external)
| Symbol | Source |
|---|---|
| `vscode` | `vscode` |
| `parseFromContent`, `resolveVars`, `extractVars` | `../../services/parser.service.js` |
| `renderCodeHtml`, `renderCodeRowsHtml` | `../../services/render.service.js` |
| `patchFrontmatterField`, `patchVarDefaults` | `../../services/artifact-patcher.service.js` |
| `PreviewModeController`, `SectionKey` | `../../services/preview-mode.service.js` |
| `getNonce` | `../../utils/helpers.js` |
| `ParsedArtifactFile`, `ParsedBlock`, `ParsedVar` | `../../types/parsed-artifact.types.js` |

### 0.2 File-level constants
| Name | Purpose | Used by |
|---|---|---|
| `POPUP_VIEW_TYPE` | WebviewPanel viewType id | `showPreviewPanel`, `showMultiBlockPreviewPanel` |
| `PREVIEW_DEBOUNCE_MS` | QP active-item debounce | `ArtifactNavigator.run` |
| `out` | `OutputChannel` for diagnostics | almost every method |

### 0.3 Top-level interface
| Name | Shape | Used by |
|---|---|---|
| `ArtifactItem` | extends `QuickPickItem` + `{ uri?, isDirectory?, isBack?, block? }` | `ArtifactNavigator.qp`, `buildItem`, `loadDir`, `loadBlocks`, `handleAccept`, `handleActiveChange` |

### 0.4 Top-level functions
| Name | Calls | Called by | Depends on |
|---|---|---|---|
| `openArtifactPicker(dir, name, extUri)` | `vscode.workspace.fs.stat`, `new ArtifactNavigator().run` | external (`insert.command.ts`) | `vscode` |
| `blockAsArtifact(block, parent)` | — (pure) | `handleActiveChange`, `handleAccept` | `ParsedBlock`, `ParsedArtifactFile` |
| `buildItem(uri, isDir, fallback, parsed, rootFs)` | `relFsPath` | `loadDir`, `refreshItem` | `ParsedArtifactFile`, `ArtifactItem` |
| `relFsPath(uri, rootFs)` | — (pure) | `buildItem` | `vscode.Uri` |
| `performInsert(editor, artifact, vars)` | `resolveVars`, `vscode.window.activeTerminal/createTerminal`, `editor.edit`, `vscode.env.clipboard` | `handleInsert` | `ParsedArtifactFile`, `vscode` |
| `renderPreviewHtml(a, codeHtml, nonce, cssUri, cspSource)` | `escHtml`, `labelForVar` | `showPreviewPanel` | `ParsedArtifactFile` |
| `renderMultiBlockPreviewHtml(a, highlightedBlocks, cssUri, cspSource)` | `escHtml`, `popupShell` | `showMultiBlockPreviewPanel` | `ParsedArtifactFile`, `ParsedVar` |
| `renderPopupEmptyHtml(cssUri, cspSource)` | `popupShell` | `handleActiveChange` | — |
| `popupShell(body, cssUri, cspSource?)` | — (pure) | `renderMultiBlockPreviewHtml`, `renderPopupEmptyHtml` | — |
| `escHtml(s)` | — (pure) | `renderPreviewHtml`, `renderMultiBlockPreviewHtml` | — |
| `labelForVar(name)` | — (pure) | `renderPreviewHtml` | — |

### 0.5 `ArtifactNavigator` class — properties
| Name | Type | Mutated by |
|---|---|---|
| `qp` | `QuickPick<ArtifactItem>` | `loadDir`, `loadBlocks`, `refreshItem`, `handleAccept` |
| `rootUri` | `Uri` | constructor only |
| `artifactName` | `string` | constructor only |
| `targetEditor` | `TextEditor \| undefined` | constructor only |
| `extensionUri` | `Uri` | constructor only |
| `parseCache` | `Map<string, ParsedArtifactFile>` | `getOrParse`, `handleSaveSection`, `onFullEditSave` |
| `refreshedUris` | `Set<string>` | `loadDir`, `refreshItem` |
| `currentDir` | `Uri` | `loadDir` |
| `dirStack` | `Uri[]` | `loadDir`, `loadBlocks`, `handleAccept` |
| `debounceTimer` | `Timeout` | `run`, `onDidHide` |
| `currentArtifact` | `ParsedArtifactFile?` | `loadBlocks`, `handleActiveChange`, `handleAccept` |
| `popupPanel` | `WebviewPanel?` | `showPreviewPanel`, `showMultiBlockPreviewPanel`, `handlePreviewMessage(cancel)`, `onDidDispose`, `onDidHide` |
| `keepPopupOnHide` | `boolean` | `handleAccept` |
| `lastPreviewedUri` | `string` | `loadDir`, `handleActiveChange` |
| `cssUri` | `string` | `showPreviewPanel`, `showMultiBlockPreviewPanel` |
| `cspSource` | `string` | `showPreviewPanel`, `showMultiBlockPreviewPanel` |
| `currentPreviewArtifact` | `ParsedArtifactFile?` | `showPreviewPanel`, `handleSaveSection`, `onFullEditSave` |
| `modeController` | `PreviewModeController?` | `showPreviewPanel`, `handlePreviewMessage` |
| `previewMsgSub` | `Disposable?` | `setupPreviewMessageHandler`, `onDidDispose` |
| `fullEditSubs` | `Disposable[]` | `setupFullEdit`, `tearDownFullEdit` |
| `fullEditDebounce` | `Timeout?` | `setupFullEdit`, `flushFullEditVarSync`, `tearDownFullEdit` |

### 0.6 `ArtifactNavigator` class — methods
| Method | Calls (internal) | Calls (external) |
|---|---|---|
| `constructor` | — | `vscode.window.createQuickPick` |
| `run` | `loadDir`, `handleActiveChange`, `handleAccept` (via listeners), `popupPanel.dispose`, `qp.dispose` | `qp.show`, listener wiring |
| `loadDir(uri)` | `relPath`, `buildItem`, `prefetchItems`, `handleActiveChange` (via setTimeout), `getOrParse`(indirect cache read) | `vscode.workspace.fs.readDirectory`, `Uri.joinPath` |
| `loadBlocks(artifact)` | — | `qp.items =` |
| `prefetchItems(items)` | `getOrParse`, `refreshItem` | — |
| `handleActiveChange(items)` | `showPreviewPanel`, `showMultiBlockPreviewPanel`, `getOrParse`, `refreshItem`, `blockAsArtifact`, `renderPopupEmptyHtml` | — |
| `showMultiBlockPreviewPanel(a)` | `renderCodeHtml` (extern), `renderMultiBlockPreviewHtml` | `vscode.window.createWebviewPanel`, `webview.asWebviewUri`, `popupPanel.reveal` |
| `getOrParse(uri)` | `parseFromContent` (extern) | `vscode.workspace.fs.readFile`, `TextDecoder` |
| `refreshItem(uri, a)` | `buildItem` | — |
| `showPreviewPanel(a)` | `tearDownFullEdit`, `new PreviewModeController` (extern), `renderCodeRowsHtml` (extern), `renderPreviewHtml`, `setupPreviewMessageHandler`, `getNonce` (extern) | `vscode.window.createWebviewPanel`, `webview.asWebviewUri`, `popupPanel.reveal` |
| `handleAccept()` | `loadDir`, `loadBlocks`, `getOrParse`, `blockAsArtifact`, `showPreviewPanel` | `qp.hide`, `popupPanel.reveal`, `vscode.window.showErrorMessage` |
| `setupPreviewMessageHandler()` | `handlePreviewMessage` | `webview.onDidReceiveMessage` |
| `handlePreviewMessage(msg)` | `modeController.*`, `handleFullEdit`, `handleSaveSection`, `handleInsert`, `popupPanel.dispose` | — |
| `handleSaveSection(msg)` | `patchFrontmatterField`/`patchVarDefaults` (extern), `parseFromContent` (extern), `modeController.stopEditingSection` | `fs.readFile/writeFile`, `webview.postMessage` |
| `handleFullEdit()` | `modeController.enterFullEdit`, `setupFullEdit` | `vscode.window.showTextDocument` |
| `handleInsert(msg)` | `parseFromContent` (extern), `performInsert`, `tearDownFullEdit` | `vscode.workspace.textDocuments.find`, `popupPanel.dispose`, `qp.hide` |
| `setupFullEdit(fileUri)` | `tearDownFullEdit`, `onFullEditSave`, `flushFullEditVarSync` | `vscode.workspace.onDidSaveTextDocument`, `onDidChangeTextDocument` |
| `flushFullEditVarSync(doc)` | `extractVars` (extern) | `webview.postMessage` |
| `onFullEditSave(content, uri)` | `parseFromContent` (extern) | `webview.postMessage` |
| `tearDownFullEdit()` | — | dispose array |
| `relPath(uri)` | — | — |

---

## 1. Bucket A — QuickPick navigator

### 1.1 Members
- **Class skeleton** of `ArtifactNavigator` (constructor, `run`, `relPath`, lifecycle wiring in `onDidHide`)
- Property storage: `qp`, `rootUri`, `artifactName`, `targetEditor`, `extensionUri`, `parseCache`, `refreshedUris`, `currentDir`, `dirStack`, `debounceTimer`, `currentArtifact`, `lastPreviewedUri`, `keepPopupOnHide`
- Methods: `loadDir`, `loadBlocks`, `prefetchItems`, `handleActiveChange` (only the routing/QP part — see "shared" note), `getOrParse`, `refreshItem`, `handleAccept`
- Functions: `openArtifactPicker`, `buildItem`, `relFsPath`
- Interface: `ArtifactItem`
- Constants: `PREVIEW_DEBOUNCE_MS`

### 1.2 Internal call edges (within bucket)
```
openArtifactPicker → ArtifactNavigator.run
                       ├─ loadDir → buildItem → relFsPath
                       │            prefetchItems → getOrParse
                       │                            refreshItem → buildItem
                       │            handleActiveChange  (delegates to bucket C)
                       └─ handleAccept → loadDir
                                        loadBlocks
                                        getOrParse
                                        blockAsArtifact (bucket C)
                                        showPreviewPanel (bucket C)
```

### 1.3 Cross-bucket dependencies (calls OUT)
- `handleActiveChange` → `showPreviewPanel`, `showMultiBlockPreviewPanel`, `renderPopupEmptyHtml`, `blockAsArtifact` (bucket C)
- `handleAccept` → `showPreviewPanel`, `blockAsArtifact` (bucket C); `tearDownFullEdit` indirectly via `showPreviewPanel` (bucket D)
- `loadDir` → no cross-bucket calls itself, but its setTimeout fires `handleActiveChange`

### 1.4 Data types touched
`vscode.QuickPick`, `vscode.QuickPickItem`, `vscode.Uri`, `vscode.FileType`, `ArtifactItem`, `ParsedArtifactFile`, `ParsedBlock`

### 1.5 Target file
**`src/ui/panels/picker/quickPickNavigator.ts`**
- Exports: `openArtifactPicker`, `ArtifactNavigator` (class)
- Co-located helpers: `buildItem`, `relFsPath`, `ArtifactItem`, `PREVIEW_DEBOUNCE_MS`

---

## 2. Bucket B — Code block preview

### 2.1 Members IN THIS FILE
- **None directly.** Code rendering already lives in `src/services/render.service.ts` (`renderCodeHtml`, `renderCodeRowsHtml`, `renderLineHtml`, `escHtml`, `VK_TOKEN_RE`, hljs integration).
- This file *consumes* those exports inside `showMultiBlockPreviewPanel` (`renderCodeHtml`) and `showPreviewPanel` (`renderCodeRowsHtml`).

### 2.2 Webview-side (inside `renderPreviewHtml`'s `<script>` tag)
The contenteditable code area carries a duplicated JS implementation that runs in the webview:
- `extractCode()` — reads `.code-content` text-node content per row
- `escHtml()` (JS, separate from TS top-level `escHtml`)
- `vkWrap()` — wraps `<VK-xxx>` matches in `<span class="vk-var">`
- `renderRows(code)` — line-numbered row HTML
- `getCaretOffset()`, `setCaretOffset()`, `placeCaret()` — caret preservation across re-render
- `scheduleRender()` — 150 ms debounce

These are JS-source-as-string today. They duplicate render.service logic. Future work: extract into `src/ui/webview/codeEditable.client.js` and load via `<script src>`.

### 2.3 Speculative names from prompt that DO NOT EXIST
- `highlightCode` — not in this file (was removed; superseded by render.service)
- `MAX_CODE_PREVIEW_CHARS` — does not exist anywhere
- VK var highlighting + line numbers — exist as both TS in render.service AND JS string inside renderPreviewHtml

### 2.4 Cross-bucket dependencies
- Nothing in this file qualifies for moving into bucket B because the relevant code already lives in `src/services/render.service.ts`. Bucket B remains an **import-only** dependency for buckets A and C.

### 2.5 Target file
**`src/services/render.service.ts`** — already exists; no change. The webview-side JS extraction is a follow-up:
- `src/ui/webview/codeEditable.client.js` (deferred)

---

## 3. Bucket C — Preview panel (popup webview)

### 3.1 Members
- Methods on `ArtifactNavigator`: `showPreviewPanel`, `showMultiBlockPreviewPanel`, `setupPreviewMessageHandler`, `handlePreviewMessage`, `handleSaveSection`, `handleInsert`
- Properties: `popupPanel`, `cssUri`, `cspSource`, `currentPreviewArtifact`, `modeController`, `previewMsgSub`
- Top-level functions: `renderPreviewHtml`, `renderMultiBlockPreviewHtml`, `renderPopupEmptyHtml`, `popupShell`, `escHtml`, `labelForVar`, `blockAsArtifact`, `performInsert`
- Constant: `POPUP_VIEW_TYPE`

### 3.2 Internal call edges
```
showPreviewPanel → renderCodeRowsHtml (bucket B import)
                   renderPreviewHtml → escHtml, labelForVar
                   setupPreviewMessageHandler → handlePreviewMessage
                                                 ├─ modeController.*
                                                 ├─ handleFullEdit (bucket D)
                                                 ├─ handleSaveSection
                                                 ├─ handleInsert → performInsert
                                                 └─ popupPanel.dispose

showMultiBlockPreviewPanel → renderCodeHtml (bucket B import)
                             renderMultiBlockPreviewHtml → escHtml, popupShell
```

### 3.3 Cross-bucket dependencies
- `handlePreviewMessage` → `handleFullEdit` (bucket D)
- `handleInsert` → `tearDownFullEdit` (bucket D)
- `showPreviewPanel` → `tearDownFullEdit` (bucket D)
- `showPreviewPanel` / `showMultiBlockPreviewPanel` consume `extensionUri`, `popupPanel` (state owned by bucket A — must remain accessible)

### 3.4 "Cancel" message handling
`handlePreviewMessage(cancel)` calls `popupPanel.dispose()` — must close gracefully without bypassing bucket A's `onDidHide` cleanup logic.

### 3.5 Data types touched
`vscode.WebviewPanel`, `vscode.Webview`, `ParsedArtifactFile`, `ParsedVar`, `ParsedBlock`, `PreviewModeController`, `SectionKey`, `vscode.Disposable`

### 3.6 Target files
- **`src/ui/panels/picker/previewPanel.controller.ts`** — `PreviewPanelController` class wrapping the lifecycle (own `popupPanel`, `cssUri`, `cspSource`, `modeController`, `previewMsgSub`, `currentPreviewArtifact`); methods `show`, `showMultiBlock`, `dispose`, `setupMessageHandler`, `handleSaveSection`, `handleInsert`
- **`src/ui/panels/picker/previewPanel.html.ts`** — `renderPreviewHtml`, `renderMultiBlockPreviewHtml`, `renderPopupEmptyHtml`, `popupShell`
- **`src/ui/panels/picker/previewPanel.adapters.ts`** — `blockAsArtifact`, `performInsert`
- **`src/ui/panels/picker/_shared/htmlEscape.ts`** — `escHtml`, `labelForVar`
- Constant `POPUP_VIEW_TYPE` co-locates with `previewPanel.controller.ts`

---

## 4. Bucket D — Full editor (real `.md` file editing)

### 4.1 Members
- Methods on `ArtifactNavigator`: `handleFullEdit`, `setupFullEdit`, `flushFullEditVarSync`, `onFullEditSave`, `tearDownFullEdit`
- Properties: `fullEditSubs`, `fullEditDebounce`

### 4.2 Internal call edges
```
handleFullEdit → modeController.enterFullEdit (bucket C state)
                vscode.window.showTextDocument
                setupFullEdit → tearDownFullEdit
                                onFullEditSave → parseFromContent → webview.postMessage
                                flushFullEditVarSync → extractVars → webview.postMessage
```

### 4.3 Cross-bucket dependencies
- Reads `currentPreviewArtifact` (bucket C state)
- Mutates `parseCache` (bucket A state) on save
- Posts messages to `popupPanel.webview` (bucket C state)
- Called by `handlePreviewMessage` (bucket C router)
- `tearDownFullEdit` is called from bucket C's `showPreviewPanel` and `handleInsert`

### 4.4 No use of `TempDocument`
Despite the bucket name, this code does **not** use `src/services/temp-document.service.ts`. It opens the real vault file via `vscode.window.showTextDocument(fileUri)` and watches it. `temp-document.service.ts` exists in `src/services/` but is unused by this file.

### 4.5 Data types touched
`vscode.TextDocument`, `vscode.Uri`, `vscode.Disposable`, `vscode.workspace.onDidSaveTextDocument`, `onDidChangeTextDocument`, `ParsedArtifactFile`

### 4.6 Target file
**`src/ui/panels/picker/fullEdit.controller.ts`**
- Exports: `FullEditController` class (owns `fullEditSubs`, `fullEditDebounce`)
- Methods: `start(fileUri, modeController)`, `teardown()`, internal `flushVarSync`, `onSave`
- Constructor takes a callback bag: `{ getCurrentArtifact, getRootFs, postMessage, updateCache }` so it never reaches into `ArtifactNavigator` directly

---

## 5. Shared / cross-bucket helpers

| Symbol | Used by buckets | Proposed home |
|---|---|---|
| `escHtml` (top-level TS) | C (renderPreviewHtml, renderMultiBlockPreviewHtml) — also indirectly bucket A through `buildItem`'s plain strings? No — buildItem doesn't use it. **C only.** | `picker/_shared/htmlEscape.ts` |
| `labelForVar` | C (renderPreviewHtml only) | `picker/_shared/htmlEscape.ts` (or `labels.ts`) |
| `popupShell` | C (multi-block, empty) | `picker/previewPanel.html.ts` |
| `blockAsArtifact` | A (handleActiveChange, handleAccept), C (showPreviewPanel target) — bridges A→C | `picker/previewPanel.adapters.ts` (called from A but conceptually a preview adapter) |
| `performInsert` | C (handleInsert) only | `picker/previewPanel.adapters.ts` |
| `out` (`OutputChannel`) | A, C, D (all) | `picker/_shared/output.ts` (export const `out`) |
| `POPUP_VIEW_TYPE` | C only | co-locates with `previewPanel.controller.ts` |
| `PREVIEW_DEBOUNCE_MS` | A only | co-locates with `quickPickNavigator.ts` |
| `parseCache` (`Map`) | A owns; C (`handleSaveSection`) and D (`onFullEditSave`) write to it | A continues to own; expose typed `setCache(uri, parsed)` callback to C/D |
| `popupPanel` | A creates lifecycle; C uses heavily; D posts messages | C owns the panel; A keeps a *handle* to it for `onDidHide`/`keepPopupOnHide` coordination |

---

## 6. Refactor — explicit 4-part split (user-directed)

### 6.1 Why
`artifactPicker.panel.ts` is 1182 lines mixing four unrelated concerns: QuickPick navigation, code-block rendering for preview, preview-panel chrome (badges/inputs/buttons), and full-editor (.md file) controller. Reading any one part requires loading the others into head. Test surface, ownership, and message routing are all entangled.

### 6.2 The four parts (explicitly)

| # | Part | Owns |
|---|---|---|
| **1** | **QuickPick navigator** | Hierarchical file/folder browse, parse cache, item builder, accept/active routing |
| **2** | **Code block preview** | The contenteditable code area: HTML structure + client-side JS (caret preservation, debounced re-render, paste/Enter intercept, var sync). Bridges `render.service.ts` output to webview live editing |
| **3** | **Preview panel (rest)** | Webview chrome — title/badges/desc/tags/var inputs/Insert·Edit·Cancel buttons, multi-block stacked view, empty state, popupShell, message handler, save-section to .md |
| **4** | **Full editor** | Opens real `.md` in VS Code editor tab, watches save (`onDidSaveTextDocument`) + change (`onDidChangeTextDocument`, debounced 500 ms → `updateVars`), re-parses & posts `fileUpdated` |

### 6.3 Helpers files (one per part)
Each part gets a sibling `*.helpers.ts` for pure functions / item builders / adapters that do not own state. Keeps the main file per part lean and focused on orchestration.

### 6.4 New file layout

```
src/ui/panels/
├── artifactPicker.panel.ts                    # 1-line re-export shim — back-compat for insert.command.ts
└── artifactPicker/
    ├── navigator.ts                           # Part 1 — ArtifactNavigator class + openArtifactPicker
    ├── navigator.helpers.ts                   # Part 1 — buildItem, relFsPath, ArtifactItem, PREVIEW_DEBOUNCE_MS
    ├── codeBlock.ts                           # Part 2 — buildCodeBlockHtml(code, lang, nonce) + buildCodeBlockClientScript(nonce)
    ├── codeBlock.helpers.ts                   # Part 2 — escHtmlForClient (string-template helper)
    ├── preview.ts                             # Part 3 — PreviewPanelController + render* + setupMessageHandler + handleSaveSection + handleInsert
    ├── preview.helpers.ts                     # Part 3 — escHtml, labelForVar, popupShell, blockAsArtifact, performInsert, POPUP_VIEW_TYPE
    ├── fullEditor.ts                          # Part 4 — FullEditController class
    ├── fullEditor.helpers.ts                  # Part 4 — debounce/var-sync helpers
    └── shared.ts                              # `out` OutputChannel singleton (single channel, multi-file)
```

### 6.5 Connection plan: how the code block plugs in
Part 2 exports two strings:
- `buildCodeBlockHtml(rowsHtml: string)` → returns `<div id="codeWrapper" class="code-block-wrapper editable" contenteditable="true">${rowsHtml}</div>` plus the `<div class="slabel">…</div>` label above it.
- `buildCodeBlockClientScript(nonce)` → returns the `<script nonce="…">…</script>` block containing `extractCode`/`renderRows`/caret + Enter/paste handlers + `codeChanged` posting.

Part 3's `renderPreviewHtml` calls `buildCodeBlockHtml(renderCodeRowsHtml(code, lang))` and concatenates `buildCodeBlockClientScript(nonce)` into the body. Part 3 owns the *outer* script that wires Insert/Edit/Cancel buttons + `updateVars`/`fileUpdated` message handlers; Part 2 owns only the code-area script. Both scripts share the same `vscode = acquireVsCodeApi()` global — Part 2's script must run **after** Part 3's `acquireVsCodeApi` line, so Part 3 emits its outer script first.

This keeps the JS-string source of truth for the code area in one file (Part 2) and makes the `<VK-xxx>` highlight logic + caret preservation testable in isolation.

### 6.6 State ownership after split

| State | Owner | Read by |
|---|---|---|
| `qp` (QuickPick) | navigator.ts | navigator.ts only |
| `parseCache`, `refreshedUris` | navigator.ts | preview.ts (write on save), fullEditor.ts (write on save) — exposed via `setCache(uri, parsed)` callback |
| `popupPanel` | preview.ts (PreviewPanelController) | navigator.ts (read for `keepPopupOnHide` coordination), fullEditor.ts (postMessage via callback) |
| `currentPreviewArtifact` | preview.ts | fullEditor.ts (read via getter callback) |
| `modeController` | preview.ts | fullEditor.ts (call `enterFullEdit` via callback) |
| `fullEditSubs`, `fullEditDebounce` | fullEditor.ts | fullEditor.ts only |
| `targetEditor` | navigator.ts | preview.ts (passed into `performInsert`) |

### 6.7 Callback bag pattern
`PreviewPanelController` constructor receives:
```ts
{
  extensionUri: vscode.Uri,
  rootFs: string,
  targetEditor: vscode.TextEditor | undefined,
  setCache: (uri: vscode.Uri, parsed: ParsedArtifactFile) => void,
  onDispose: () => void,           // notifies navigator
  openFullEditor: (artifact) => void,  // delegates to FullEditController
  closePicker: () => void,         // navigator.qp.hide()
}
```

`FullEditController` constructor receives:
```ts
{
  rootFs: string,
  getCurrentArtifact: () => ParsedArtifactFile | undefined,
  setCurrentArtifact: (a: ParsedArtifactFile) => void,
  setCache: (uri, parsed) => void,
  postMessage: (msg: unknown) => void,
}
```

This breaks the giant class without introducing two-way coupling.

### 6.8 Move order (smallest leaf first)
1. `shared.ts` (just `out`)
2. `preview.helpers.ts` (escHtml, labelForVar, popupShell, blockAsArtifact, performInsert, POPUP_VIEW_TYPE)
3. `navigator.helpers.ts` (buildItem, relFsPath, ArtifactItem, PREVIEW_DEBOUNCE_MS)
4. `codeBlock.helpers.ts` then `codeBlock.ts`
5. `fullEditor.helpers.ts` then `fullEditor.ts`
6. `preview.ts` (uses 1, 2, 4)
7. `navigator.ts` (uses 1, 3; constructs 6 + 5)
8. `artifactPicker.panel.ts` → 1-line re-export
9. `npx tsc --noEmit && npm run lint`

The existing `artifactPicker.panel.ts` becomes a 1-line re-export so `commands/insert.command.ts` and any other importer keeps working without an edit during the move.

---

## 7. Move-order constraints

1. **First** create `_shared/htmlEscape.ts` and `_shared/output.ts` — pure-leaf, no inbound deps.
2. Then `previewPanel.html.ts` — depends only on shared helpers + `ParsedArtifactFile`/`ParsedVar`.
3. Then `previewPanel.adapters.ts` — depends on parser/render imports + types.
4. Then `fullEdit.controller.ts` — depends on parser + types; receives callbacks from caller.
5. Then `previewPanel.controller.ts` — depends on previous 4; receives panel + state.
6. **Last** `quickPickNavigator.ts` — orchestrator; constructs `PreviewPanelController` and `FullEditController`, wires them together.
7. Replace original file body with re-export.

---

## 8. Risks / things to watch

- `popupPanel` ownership is tangled today — both `ArtifactNavigator.onDidHide` and `popupPanel.onDidDispose` mutate it. Splitting into a controller means defining one canonical owner (proposed: `PreviewPanelController` owns; navigator gets disposal events via callback).
- `handleInsert` calls `tearDownFullEdit` THEN `popupPanel.dispose()`. Order matters — fullEdit watchers must stop before the panel goes away, otherwise `onDidSaveTextDocument` could post into a disposed webview.
- `parseCache` is mutated from three buckets. Either keep a single owner (A) and pass write-callbacks down, or hoist into a tiny `picker/_shared/parseCache.ts` module.
- The webview-side `<script>` block inside `renderPreviewHtml` duplicates VK-var/line-number rendering logic from `render.service.ts`. Out-of-scope for this refactor but worth noting — the source-of-truth divergence is a known smell.
- `out.appendLine(...)` calls are scattered — keep them after move to preserve diagnostics; verify no doubled-up channel registrations.
