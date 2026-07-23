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
| T1 | 1 | worker | todo | — | — | 0 | `extension` key — parser **and** serializer atomically |
| T2 | 1 | worker | todo | — | — | 0 | 🔒 `template.service.ts` — D3 precedence + D1 guard |
| T3 | 1 | worker | todo | — | — | 0 | 🔒 `validateTargetFileName` sibling validator |
| T4 | 2 | worker | todo | — | — | 0 | Destination resolution from Explorer URI |
| T5 | 2 | worker | todo | — | — | 0 | 🔒 `template-writer.service.ts` — workspace write |
| T6 | 3 | worker | todo | — | — | 0 | 🔒 Preview panel template mode + F5 path |
| T7 | 3 | worker | todo | — | — | 0 | Create form accepts Templates + F5 path |
| O4 | 4 | orchestrator | todo | — | — | n/a | `insert.command.ts` arg passthrough |
| O5 | 4 | orchestrator | todo | — | — | n/a | `package.json` menu retarget |
| D1 | 4 | worker | todo | — | — | 0 | `ARTIFACT_FILE_FORMAT.md` Templates section |
| D2 | 4 | worker | todo | — | — | 0 | Fix stale gate in `CREATING_A_PLAN.md` §6 |
| D3 | 4 | worker | todo | — | — | 0 | CHANGELOG breaking-change entry |

🔒 = security-critical. Reviewer's manual §5 trace is mandatory; a `SEC:` finding never expires on
a round cap.

---

## Gate log

One row per gate run. `rm -rf dist` before each — stale `dist/` inflates counts.

| When | Wave | Result | Tests | Notes |
|------|------|--------|-------|-------|
| pre-flight | — | pass | 512 | Baseline before any task lands; tsc clean |
| W0 close | 0 | pass | 515 | O1 net 0 (19 assertions relocated), O2 net +3, O3 type-only; tsc clean |

---

## Human gates

| Gate | When | Asks | Status |
|---|---|---|---|
| H1 | end of W3 | F5 Explorer flow: menu renders, file lands in the right folder, opens | todo |
| H2 | end of W4 | Breaking change (Templates leave the editor menu) acceptable; CHANGELOG wording | todo |

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
| P8 | W0/O2 | 3 `artifact-type-config.test.ts` assertions updated **in W0** (`getFormConfig('template')` now returns a form; `getDefaultLanguage` non-create-form example → `variables`; `getCreateFormTypes` → `[command,snippet,template]`). File is in **T7's** Owns. | O2's `createForm: true` flip immediately changes `getCreateFormTypes()`/`getFormConfig()` output, so those T7-owned assertions go red at W0 close — violating the red-gate-stop rule. The orchestrator owns the fact change, so the tests reading it move with it now. T7 keeps the file for its form-UI work; its `getCreateFormTypes includes template` anchor is already satisfied. Sequential execution → no collision. |
