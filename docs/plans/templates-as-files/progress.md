# Templates as whole files — progress ledger

Derived from [`plan.md`](plan.md), which is the authority. **Only the orchestrator writes this
file** — two workers editing it race.

Statuses: `todo` · `wip` · `done` · `blocked` · `dropped` (with reason).

**Record the test count on every gate run.** A silent drop means a test was deleted; per
`CLAUDE.md` that is allowed only loudly, with the relocated assertion named in the commit.

---

## Baseline

| Item | Value |
|---|---|
| Branch | `feature/templates` (from `origin/develop` @ `fa38817`) |
| Gate | `rm -rf dist && npm test && npx tsc --noEmit` |
| Baseline test count | 512 (pre-flight gate, `rm -rf dist && npm test`) |
| Baseline gate | pass — `npm test` green, `npx tsc --noEmit` clean |

---

## Tasks

| Task | Wave | Owner | Status | Test count | Gate | Review rounds | Notes |
|------|------|-------|--------|-----------|------|---------------|-------|
| O1 | 0 | orchestrator | done | 515 | pass | n/a | Helpers → `language-map.service.ts`; `blockEditor.helpers.ts` deleted; 19 assertions relocated into `language-map.test.ts`. Net 0 (see P7). |
| O2 | 0 | orchestrator | done | 515 | pass | n/a | `ARTIFACTS.template` → explorer-only, `createForm`, `multiBlock: false`. Forced 3 T7-owned `artifact-type-config.test.ts` fixes now (P8). |
| O3 | 0 | orchestrator | done | 515 | pass | n/a | `ParsedFrontmatter.extension?` added; `tsc` clean |
| T1 | 1 | self | done | 550 | pass | 0 (self-review) | `extension` in both key lists; serializer emits it; round-trip holds. +`ArtifactFormModel.extension?` + `artifact-serializer.test.ts` order assertion (P9/P10). +6 tests |
| T2 | 1 | self | done | 550 | pass | 0 (self-review) | 🔒 `template.service.ts` — D3 precedence + D1 guard. §5 trace PASS (typed/frontmatterExt throw; langId laundered). +19 tests |
| T3 | 1 | self | done | 550 | pass | 0 (self-review) | 🔒 `validateTargetFileName` = `runCommonChecks` passthrough (allows `.md`, rejects separators/NUL/reserved). §5 trace PASS. +10 tests |
| T4 | 2 | self | done | 564 | pass | 0 (self-review) | `classifyDestination` (pure, +4) + `resolveDestination` wrapper (+2). No-URI picker branch → H1. |
| T5 | 2 | self | done | 564 | pass | 0 (self-review) | 🔒 `template-writer.service.ts` — reuses exported `isWithinRoot` + `WriteResult`. Two containment gates pre-I/O; no dir created. §5 trace PASS. +8 tests |
| T6 | 3 | self | done | 569 | pass | 0 (self-review) | 🔒 `Create File` label + server-side `insert` branch → create-file flow; `destUri` threaded; D1 enforced via template-aware nav routing + `validateTemplateBlocks` in handler. §5 trace PASS (3 gates). +2 tests. preview.ts 424 lines (P12) |
| T7 | 3 | self | done | 569 | pass | 0 (self-review) | Template extension field (template-only) + client collector. `panel.ts` unchanged (spread+serializer carry it). `multiBlock:false` add-btn hidden by O2. +3 tests (P11) |
| O4 | 4 | self | done | 569 | pass | n/a | Handler accepts `(uri?, uris?)` → forwards first URI as `destUri`. Non-template behaviour unchanged. |
| O5 | 4 | self | done | 569 | pass | n/a | Title → "New File from Template"; removed from `editor/context` + `submenu.editor`; Explorer entries + feature description updated. JSON valid. |
| D1 | 4 | self | done | 569 | pass | 0 | `ARTIFACT_FILE_FORMAT.md` §5 template row corrected + new §5.1 (single-block D1, `extension` key, D3 precedence, containment). |
| D2 | 4 | self | done | 569 | pass | 0 | `CREATING_A_PLAN.md` §6 gate → `rm -rf dist && npm test && npx tsc --noEmit`; stale `pnpm test`/mocha claim removed. |
| D3 | 4 | self | done | 569 | pass | 0 | CHANGELOG Added/Changed — breaking change (Templates leave editor menu) in user terms. |

🔒 = security-critical. Reviewer's manual §5 trace is mandatory; a `SEC:` finding never expires on
a round cap.

---

## Gate log

One row per gate run. `rm -rf dist` before each — stale `dist/` inflates counts.

| When | Wave | Result | Tests | Notes |
|------|------|--------|-------|-------|
| pre-flight | — | pass | 512 | Baseline before any task lands; tsc clean |
| W0 close | 0 | pass | 515 | O1 net 0 (19 assertions relocated), O2 net +3, O3 type-only; tsc clean |
| W1 close | 1 | pass | 550 | T1 +6, T2 +19, T3 +10; tsc clean. Two out-of-Owns test fixes (P9) + model field (P10) |
| W2 close | 2 | pass | 564 | T4 +6, T5 +8; tsc clean. No out-of-Owns edits. SonarLint IDE diagnostics not emitting this session → gate degraded to ESLint+tsc+manual (§3.1), all green |
| W3 close | 3 | pass | 569 | T6 +2, T7 +3; tsc clean. Goldens (demo-snippet, form-html) byte-intact. SonarLint began emitting mid-wave (S1854/S1128, all cleared by using the symbols). |
| W4 close | 4 | pass | 569 | O4/O5 wiring + D1/D2/D3 docs; no test-count change; tsc clean; package.json valid JSON. Awaiting H1+H2 (F5). |

---

## Human gates

| Gate | When | Asks | Status |
|---|---|---|---|
| H1 | end of W3 | F5 Explorer flow: menu renders, file lands in the right folder, opens | **pending human** — merged with H2 (P14) |
| H2 | end of W4 | Breaking change (Templates leave the editor menu) acceptable; CHANGELOG wording | **pending human** — merged with H1 (P14) |

---

## Decisions and deviations

Every `ESCALATE` resolution, every deviation from `plan.md`, recorded the moment it happens.
An empty table at the end means the plan survived contact with reality — record it, do not assume it.

| # | Wave | Decision | Rationale |
|---|---|---|---|
| P1 | plan eval | T6 also owns `navigator.ts` | The destination URI threads `openArtifactPicker` → `ArtifactNavigator` → `PreviewCallbacks`; all three live in `navigator.ts`/`preview.ts`. `navigator.ts` had **no owner** — O4 could not forward a URI to an un-widened signature. |
| P2 | plan eval | T7 also owns `form.clientJs.ts` + `artifact-form.types.ts` | `form.clientJs.ts` builds the posted `model`; without it the `extension` input is collected nowhere and silently dropped. The model type must carry `extension?`. |
| P3 | plan eval | Template create uses the existing `insert` message, routed server-side | A new `createFile` message would force edits to `preview.clientJs.ts` + `webview-messages.types.ts` (both unowned) for no behavioural gain — `handleInsert`/`performInsert` already branch on type. |
| P4 | plan eval | T2 input renamed `fenceLang` → `langId`, sourced from `frontmatter.language` | The parser folds the root fence into `frontmatter.language` (parser.service.ts:376); there is no separate root `fenceLang`. A task coded against `artifact.fenceLang` gets `undefined`. |
| P5 | plan eval | Filename prompt prefills the **raw** title (editable), not slugified | User decision. `validateTargetFileName` still guards illegal chars on confirm. |
| P6 | plan eval | Entry UX = full preview panel (reuse picker+preview as-is) | User decision. Lighter flows would require building a new InputBox var-collection path — more code, not less. |
| P7 | W0/O1 | `blockEditor.helpers.ts` **deleted** (not left as an empty shim); its 3 helpers now live in `language-map.service.ts`; the 19 assertions merged into `language-map.test.ts` beside the existing `mapLanguageId` suites. `test/language-consistency.test.ts` (**not** in O1 Owns) had its import repointed to the service — 1 line. | The helpers had 3 importers, one outside O1 Owns. Deleting the dead file + centralising in the service is the shorter, honester diff than a back-compat shim. `language-map.test.ts` already existed (plan said "new" — stale); appended rather than overwrote. |
| P14 | W3→W4 | H1 (Explorer F5, end of W3) merged with H2 into a single F5 hand-off after W4. | H1 checks "the context menu renders and the file lands where clicked" — but the menu rename (O5) and clicked-folder URI forwarding (O4) are W4 tasks, so at end-of-W3 the Explorer flow is only half-wired (old label; folder-picker fallback instead of clicked folder). Landing O4/O5 first lets the human verify the final flow once. Code stayed gated per wave; only the human verification was deferred one wave. |
| P11 | W3/T7 | `test/form-html.test.ts` gained a template suite (+3) — not in T7 Owns (which lists `artifact-type-config.test.ts`). | The meaningful TDD anchor for the extension field is a `buildFormHtml` render test; `artifact-type-config.test.ts`'s `getCreateFormTypes includes template` was already satisfied in W0 (P8). Form-html snapshots (forbidden) untouched — `buildExtensionField` returns `''` for non-templates. |
| P12 | W3/T6 | `preview.ts` is 424 lines — over the 400 soft limit, under the 500 split-line. | The create-file flow (`handleCreateFile`/`askFileName`/`writeWithCollisionHandling`) is cohesive with the controller. Flagged for a follow-up split; PR notes it per CLAUDE.md "propose the split in that PR". |
| P13 | W3/T6 | D1 enforced in **two** owned spots: `isMultiBlockNav` routes a 2+ block template to the single preview, and `validateTemplateBlocks` in `handleCreateFile` rejects it on Create File. Error surfaced via native `showErrorMessage`, not a webview message. | Without the nav change a 2+ block template drills into blocks and the handler check is dead. A native toast avoids editing the unowned `preview.clientJs.ts` / `webview-messages.types.ts` (P3 rationale). |
| P9 | W1/T1 | `test/artifact-serializer.test.ts` "canonical order" assertion updated to include `extension` (not in T1 Owns; not a forbidden file). | Adding `extension` to `FRONTMATTER_KEY_ORDER` breaks an exact-array assertion in an un-owned test. Same class as P8 — the orchestrator moves the pinned fact with the change. |
| P10 | W1/T1 | `ArtifactFormModel.extension?` added by **T1**, though the field sits in T7's file (`artifact-form.types.ts`). | T1 owns the serializer and its Done-when requires emitting `extension`; the serializer reads it off the model, so the field must exist in W1. T7 depends on T1 precisely so the key is already emitted — it wires the form UI to the field T1 introduced. No W1 collision (T2/T3 don't touch the file); sequential vs T7. |
| P8 | W0/O2 | 3 `artifact-type-config.test.ts` assertions updated **in W0** (`getFormConfig('template')` now returns a form; `getDefaultLanguage` non-create-form example → `variables`; `getCreateFormTypes` → `[command,snippet,template]`). File is in **T7's** Owns. | O2's `createForm: true` flip immediately changes `getCreateFormTypes()`/`getFormConfig()` output, so those T7-owned assertions go red at W0 close — violating the red-gate-stop rule. The orchestrator owns the fact change, so the tests reading it move with it now. T7 keeps the file for its form-UI work; its `getCreateFormTypes includes template` anchor is already satisfied. Sequential execution → no collision. |
