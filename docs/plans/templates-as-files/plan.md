# Templates as whole files — plan

**This file is the authority.** Its companions derive from it and never contradict it:

- `progress.md` — the ledger. One row per task, written **only** by the orchestrator.
- `jira-tickets.md` — epic + story specs, one per phase / task cluster.

The **process** this plan is an instance of lives in [`CREATING_A_PLAN.md`](../../../CREATING_A_PLAN.md).
Read it once before starting; the role templates in its §2 are not re-copied here (a second copy
is a second authority to drift). This file supplies only the instance parameters that get
appended to them.

`docs/` never reaches `develop` or `main`. `git rm -r docs` is the last commit before the PR.

---

## 1. What is being built

A **Template** is a whole file, not a fragment. A Template artifact `.md` holds one code block;
invoking it from the Explorer writes that block to disk as a real file, with `<VK-xxx>` variables
resolved exactly as every other artifact resolves them.

Today `type: 'template'` already exists in `ARTIFACTS` and behaves as a snippet — it inserts text
at the cursor. **This feature retargets that type**; it does not add a new one.

### Decisions taken (locked — do not relitigate)

| # | Decision | Consequence |
|---|---|---|
| D1 | **Single-block only.** A Template `.md` with 2+ `##` blocks is a validation error surfaced in the preview. | Per-type restriction; the parser stays general, the *guard* is template-scoped. |
| D2 | **Destination:** clicked folder → inside it; clicked file → its parent; no URI (palette) → folder picker rooted at the workspace. | `insert.command.ts` must stop discarding its command arguments. |
| D3 | **Extension precedence: user-typed → frontmatter `extension:` → fence language.** | Same 3-tier shape as the existing var fallback. New `extension` frontmatter key. |
| D4 | **Scope: retarget + create-form.** Templates leave the editor menu, gain `createForm: true`. | Breaking change for anyone using "Insert Templates" in the editor. Note it in the PR body and CHANGELOG. |

### Explicitly out of scope

Multi-file scaffolding (one invocation → N files). D1 forecloses it deliberately. If it is wanted
later it is a **new** feature on top of this one, not a widening of it — say so rather than
smuggling it into a task.

---

## 2. What already exists — extend these, do not rewrite them

This is the DRY section. Every item below already owns its fact. A task that re-implements one is
rejected at review, not discussed.

| Need | Already exists | Where |
|---|---|---|
| fence string → canonical languageId | `normalizeLangId` | `artifactPicker/blockEditor.helpers.ts` |
| languageId validated against host | `resolveLangId` | same file (pure — `known[]` is injected) |
| languageId → file extension | `extForLang` + `LANG_EXT` | same file + `types/constants.ts` |
| filename validation / slug | `validateFileName`, `slugify`, `deriveFileName` | `services/filename.service.ts` |
| folder QuickPick with breadcrumb + "New folder here" | `pickDestFolder(rootUri)` | `ui/panels/destFolderPicker.panel.ts` — takes **any** root, already generic |
| path-escape guard | `isWithinRoot(rootUri, candidateUri)` | `destFolderPicker.panel.ts` |
| atomic write + collision result | `writeArtifact` / `WriteResult` | `services/artifact-writer.service.ts` — **vault-scoped**, see W2/T5 |
| var resolution | `resolveVars` | `services/parser.service.ts` |
| ARTIFACTS reads | `getEntry`, `getFormConfig`, … | `services/artifact-type-config.service.ts` |

**The three language helpers are pure and `vscode`-free already** (`resolveLangId` takes `known:
string[]`). Moving them is a mechanical relocation, not a decoupling exercise — budget it as such.

---

## 3. Instance parameters

Append these to the `CREATING_A_PLAN.md` §2 role templates at dispatch.

- **Repo:** `/Users/nick/D3v/Dexsys/Extensions_Plugins/ObsidianArtifacts/obsidian-artifacts-snippets_and_tools-vscode`
- **Branch:** `feature/templates` (already created, based on `origin/develop`)
- **Gate:**
  ```bash
  rm -rf dist && npm test && npx tsc --noEmit
  ```
  `rm -rf dist` is required, not hygiene: `tsc` leaves orphaned `dist/*.js`, so a renamed or
  deleted test keeps running from stale output and inflates the pass count.

  > **Correction to `CREATING_A_PLAN.md` §6.** That section claims `pnpm test` cannot run on this
  > checkout because the socket path exceeds the macOS 103-char limit, and prescribes a direct
  > `mocha` invocation. That is **stale** — `.vscode-test.mjs` now pins
  > `--user-data-dir=/tmp/oa-vsct`, which fixes it. `npm test` is the gate. Fixing §6 is task **D2**.

- **Baseline test count:** see `progress.md` — recorded from the pre-flight gate run, not guessed.
- **Forbidden files** (no task may edit; orchestrator only, and only where a task says so):
  - `test/snapshots/**` — byte-exact goldens. A diff here means the change broke emission.
  - `test/fixtures/preview-render-golden/**` — same.
  - `package.json` — orchestrator integration hunk (W4/O5).
  - `src/types/constants.ts` — orchestrator integration hunk (W0/O2).
  - `CREATING_A_PLAN.md`, `CLAUDE.md` — docs wave only (W4).
- **Report cap:** 15 lines per worker report.

---

## 4. Orchestrator protocol

1. **Read order:** `CREATING_A_PLAN.md` (once, whole) → this file → `progress.md`. Nothing else is
   needed to start.
2. **Per wave:** land the orchestrator-tagged tasks and integration hunks **first**, gate, then
   dispatch every worker task in the wave in parallel.
3. **Review loop:** one Opus reviewer per wave, continued via `SendMessage` so it accumulates
   sibling-task context. Max 2 `CHANGES` rounds per task; a third failure is `ESCALATE` and the
   orchestrator resolves it — fix directly or revert-and-redispatch — recording which in
   `progress.md`.
4. **Commits:** orchestrator commits **once per wave**, after the integrated gate is green.
   Workers never commit.
5. **Red gate stops all dispatch.** No exceptions, no "it's unrelated".
6. **Human gates** — stop and ask, do not decide:
   - **H1** (end of W3): F5 manual pass on the Explorer flow. Only the human can confirm the
     context menu renders and the file lands where expected.
   - **H2** (end of W4): confirm the breaking change (D4 — Templates leaving the editor menu) is
     acceptable to ship, and that the CHANGELOG wording is right.
7. **`docs/` deletion** is the last commit before the PR, per `CREATING_A_PLAN.md` §1.

---

## 5. Threat model for this feature

Inherited from `CLAUDE.md` and restated because **this feature writes attacker-influenced bytes to
attacker-influenced paths in the user's workspace** — a strictly wider surface than any existing
artifact type, all of which write only inside the vault.

Untrusted input: the Template `.md` (frontmatter `extension:`, `title:`, fence language, code body)
and every `<VK-xxx>` value the user supplies.

Non-negotiable properties:

1. **Containment.** The resolved destination path is normalised and asserted inside the workspace
   folder before any write. `extension:` and the typed filename are both path-injection vectors —
   `extension: ../../../.ssh/authorized_keys` must be rejected, not sanitised into something
   plausible.
2. **No path separators** survive from `extension:` or the typed name into the final path segment.
3. **Collision is never silently resolved.** Existing file → explicit user choice.
4. **No shell.** Nothing in this feature builds a command string. There is no subprocess.

The IDE analyser performs **no taint analysis** (`CREATING_A_PLAN.md` §3.1), so on W2/T5 and W2/T6
the reviewer's manual trace is not a second opinion — it is the only check that exists.

---

## 6. Waves and tasks

Every task below has the six required fields. Disjointness is per-wave and counts test files.

### Wave 0 — orchestrator only (serial, no workers)

Shared-authority edits. Everything downstream depends on these, so they land and gate first.

#### O1 — Move the three language helpers into `language-map.service.ts`

- **Owns:** `src/services/language-map.service.ts`, `src/ui/panels/artifactPicker/blockEditor.helpers.ts`, `src/ui/panels/artifactPicker/blockEditor.ts`, `test/block-edit-helpers.test.ts`, `test/language-map.test.ts`
- **Reads:** `src/types/constants.ts`
- **Depends on:** none
- **Test first:** `test/language-map.test.ts` — `import { extForLang } from '../src/services/language-map.service.js'` fails to resolve before the move.
- **Done when:** `normalizeLangId`, `resolveLangId`, `extForLang` are exported from
  `language-map.service.ts`; `blockEditor.helpers.ts` no longer defines them; `blockEditor.ts`
  imports from the service; the existing block-edit assertions still pass unchanged.
- **Gate:** full gate. Test count must not drop — assertions move, they do not disappear.

> Orchestrator-owned because it is a pure move across a shared authority that four later tasks
> import. A worker doing this mid-wave would collide with all of them.

#### O2 — Retarget the `template` entry in `ARTIFACTS`

- **Owns:** `src/types/constants.ts`, `test/constants.test.ts`
- **Reads:** `src/types/artifact.types.ts`
- **Depends on:** none
- **Test first:** `test/constants.test.ts` — assert the `template` entry has
  `contexts: ['explorer']` and `createForm === true`; fails today (`['editor','explorer']`, no flag).
- **Done when:** `template` reads
  `{ contexts: ['explorer'], createForm: true, form: { language: { mode: 'free', default: '' }, label: { singular: 'template' }, multiBlock: false } }`.
  `multiBlock: false` is D1 expressed in the table rather than in a branch.
- **Gate:** full gate.

#### O3 — Add `extension` to `ParsedFrontmatter`

- **Owns:** `src/types/parsed-artifact.types.ts`
- **Reads:** —
- **Depends on:** none
- **Test first:** none (type-only). `npx tsc --noEmit` is the check.
- **Done when:** `extension?: string` exists with a JSDoc line stating it overrides the fence
  language and is template-only.
- **Gate:** `npx tsc --noEmit`.

---

### Wave 1 — pure domain, no `vscode` (3 workers in parallel)

#### T1 — Frontmatter `extension` key: parser **and** serializer, atomically

- **Owns:** `src/services/parser.service.ts`, `src/services/artifact-serializer.service.ts`, `test/template-extension-frontmatter.test.ts`
- **Reads:** `src/types/parsed-artifact.types.ts`, `test/frontmatter-keys.test.ts`
- **Depends on:** O3
- **Test first:** `test/template-extension-frontmatter.test.ts` — parsing a file with
  `extension: .mjs` yields `frontmatter.extension === '.mjs'`; fails today (key dropped).
- **Done when:** `'extension'` is in **both** `STRING_FRONTMATTER_KEYS` (parser) and
  `FRONTMATTER_KEY_ORDER` (serializer), and a parse→serialize→parse round-trip preserves it.
- **Gate:** full gate — `test/frontmatter-keys.test.ts` must stay green.

> **Both lists in one task on purpose.** `frontmatter-keys.test.ts` binds them in both directions:
> add the key to only one side and the gate goes red. Splitting this across two tasks guarantees a
> red tree between them — the stub-widening trap from `CREATING_A_PLAN.md` §2.

#### T2 — `template.service.ts`: extension precedence + single-block guard

- **Owns:** `src/services/template.service.ts`, `test/template.service.test.ts`
- **Reads:** `src/services/language-map.service.ts`, `src/types/parsed-artifact.types.ts`
- **Depends on:** O1, O3
- **Test first:** `test/template.service.test.ts` — `resolveTemplateFileName({ typed: 'Button', frontmatterExt: undefined, fenceLang: 'tsx' })` → `'Button.tsx'`. Fails (module absent).
- **Done when:** two pure exports:
  - `resolveTemplateFileName({ typed, frontmatterExt, fenceLang, fallbackBase })` implementing D3.
    A `typed` value that already carries any extension wins whole. `frontmatterExt` is accepted
    with or without the leading dot. Neither may contribute `/`, `\`, `..`, or a NUL — those
    inputs **throw**, they are not sanitised (§5.2).
  - `validateTemplateBlocks(parsed)` → `{ ok: true } | { ok: false; reason: string }`, rejecting
    `blocks.length > 1` with a message naming the count (D1).
- **Gate:** full gate. **Security-critical** — test table includes `../../etc/passwd`,
  `..\\..\\win.ini`, `a/b`, `x\0.js` as `frontmatterExt` and as `typed`.

#### T3 — Allow extensions in typed filenames

- **Owns:** `src/services/filename.service.ts`, `test/filename.service.test.ts`
- **Reads:** —
- **Depends on:** none
- **Test first:** `test/filename.service.test.ts` — `validateTargetFileName('Button.tsx')` → `{ ok: true }`; today's `validateFileName` rejects it (it is `.md`-oriented and dot-hostile).
- **Done when:** a **new** export `validateTargetFileName(name)` exists for
  workspace-destined files: shares `runCommonChecks`, permits interior dots, still rejects
  leading/trailing dot, path separators, control chars, and reserved names. `validateFileName`
  (vault `.md` names) is **unchanged** — its `.md` rejection is still correct for its own callers.
- **Gate:** full gate. **Security-critical** — separator and control-char cases required.

> Adding a sibling validator rather than widening the existing one: the two have genuinely
> different rules (`.md` appended vs. extension carried). Widening would silently permit `foo.md`
> as a vault artifact name.

---

### Wave 2 — `vscode`-coupled services (2 workers in parallel)

#### T4 — Destination resolution from the Explorer URI

- **Owns:** `src/services/template-destination.service.ts`, `test/template-destination.test.ts`
- **Reads:** `src/ui/panels/destFolderPicker.panel.ts`
- **Depends on:** none
- **Test first:** `test/template-destination.test.ts` — `classifyDestination` given a stat of
  `FileType.File` returns its parent dir; given `FileType.Directory` returns it unchanged.
- **Done when:** the `vscode`-free decision (`classifyDestination(uri, fileType)`) is exported and
  unit-tested; the thin `vscode` wrapper (`resolveDestination(uri | undefined)`) stats the URI and
  falls back to `pickDestFolder(workspaceRoot)` when `uri` is `undefined` (D2). Multi-select
  (`uris[]`) uses the first entry.
- **Gate:** full gate + F5 note in the ledger. The pure half carries the assertions; the wrapper is
  covered by H1.

#### T5 — `template-writer.service.ts`: write into the workspace

- **Owns:** `src/services/template-writer.service.ts`, `test/template-writer.test.ts`
- **Reads:** `src/services/artifact-writer.service.ts`, `src/ui/panels/destFolderPicker.panel.ts`
- **Depends on:** T2, T3
- **Test first:** `test/template-writer.test.ts` — a destination resolving outside the workspace
  root returns `{ kind: 'error' }` and performs **no** write.
- **Done when:** `writeTemplateFile({ workspaceRoot, destDir, fileName, content, force })` returns
  the same `WriteResult` union as `artifact-writer`, asserts containment via `isWithinRoot` before
  any I/O, and never creates the artifact-type base directory (that is vault behaviour and must
  not leak into the workspace).
- **Gate:** full gate. **Security-critical** — reviewer's manual §5 trace is mandatory; hostile
  `destDir` and `fileName` cases required in the test table.

> **Why not reuse `writeArtifact`.** It is vault-scoped by contract: it derives a base directory
> from the artifact type and auto-creates it. Pointed at a workspace it would create a `Templates/`
> folder in the user's project. The containment helper is shared; the writer is not.

---

### Wave 3 — UI (2 workers in parallel)

#### T6 — Preview panel: template mode

- **Owns:** `src/ui/panels/artifactPicker/preview.ts`, `src/ui/panels/artifactPicker/preview.render.ts`, `test/preview-render.test.ts`
- **Reads:** `src/services/template.service.ts`, `src/services/template-writer.service.ts`, `src/types/webview-messages.types.ts`
- **Depends on:** T2, T5
- **Test first:** `test/preview-render.test.ts` — rendering a `type: 'template'` artifact emits a
  button labelled `Create File`, not `Insert`.
- **Done when:** for `type: 'template'` the panel (a) labels the primary button `Create File`,
  (b) posts `createFile` instead of `insert`, (c) renders the D1 validation error in place of the
  button when `validateTemplateBlocks` fails. The handler prompts for the filename via
  `vscode.window.showInputBox` prefilled from `deriveFileName(title)` + resolved extension,
  validates with `validateTargetFileName`, then calls `writeTemplateFile`. On `collision`, prompt
  Overwrite / Rename / Cancel. On success, open the new file.
- **Gate:** full gate. **F5 click-path:** Explorer → right-click `src/` → *New File from Template*
  → pick a template → fill a var → *Create File* → accept the prefilled name → file appears under
  `src/` and opens.
- **Security-critical** — every interpolated value into the webview goes through `escHtml`; the
  `.md` `title` reaching the input box is untrusted.

#### T7 — Create form accepts Templates

- **Owns:** `src/ui/panels/artifactForm/panel.ts`, `src/ui/panels/artifactForm/form.html.ts`, `test/artifact-type-config.test.ts`
- **Reads:** `src/services/artifact-type-config.service.ts`, `src/types/constants.ts`
- **Depends on:** O2
- **Test first:** `test/artifact-type-config.test.ts` — `getCreateFormTypes()` includes
  `'template'`; fails today.
- **Done when:** Templates appear in the create-flow type picker, the form honours
  `multiBlock: false` (no `+ Add additional template` button), and an optional `extension` input is
  written to frontmatter when non-empty.
- **Gate:** full gate. **F5 click-path:** Command Palette → *Create Artifact* → Template → fill →
  Save → the `.md` lands in `Templates/` with the `extension` key when supplied.

---

### Wave 4 — wiring and docs

#### O4 — `insert.command.ts` stops discarding command arguments *(orchestrator)*

- **Owns:** `src/commands/insert.command.ts`
- **Reads:** `src/services/template-destination.service.ts`, `src/ui/panels/artifactPicker.panel.ts`
- **Depends on:** T4
- **Test first:** none (thin `vscode` wiring). Covered by H1.
- **Done when:** the registered handler accepts `(uri?: vscode.Uri, uris?: vscode.Uri[])` and
  forwards them to `openArtifactPicker`. Non-template artifacts ignore the extra arguments —
  **their behaviour must not change**.
- **Gate:** full gate.

#### O5 — `package.json` menu retarget *(orchestrator)*

- **Owns:** `package.json`
- **Reads:** `src/types/constants.ts`
- **Depends on:** O2
- **Test first:** none (manifest). Covered by H1.
- **Done when:** `insert.templates` is removed from `editor/context` and
  `obsidian-artifacts.submenu.editor`; its `contributes.commands` title becomes
  **"New File from Template"**; the Explorer entries are unchanged.
- **Gate:** full gate + H1.

#### D1 — Document the Template format

- **Owns:** `ARTIFACT_FILE_FORMAT.md`
- **Reads:** `src/services/parser.service.ts`, `src/services/artifact-serializer.service.ts`
- **Depends on:** T1
- **Test first:** none (doc). The parser wins on disagreement — this doc must describe what T1
  actually shipped, verified by reading it.
- **Done when:** a Templates section documents the single-block rule, the `extension` key, and the
  D3 precedence chain, consistent with the code.
- **Gate:** read-back against the parser.

#### D2 — Fix the stale gate in `CREATING_A_PLAN.md` §6

- **Owns:** `CREATING_A_PLAN.md`
- **Reads:** `.vscode-test.mjs`, `CLAUDE.md`
- **Depends on:** none
- **Test first:** none (doc).
- **Done when:** §6 states the gate as `rm -rf dist && npm test && npx tsc --noEmit` and the claim
  that `pnpm test` cannot run is removed — `.vscode-test.mjs` pins `--user-data-dir=/tmp/oa-vsct`,
  which fixed it. Keep the `rm -rf dist` rationale; it is still true.
- **Gate:** read-back.

#### D3 — CHANGELOG + breaking-change note

- **Owns:** `CHANGELOG.md`
- **Reads:** this file
- **Depends on:** O5
- **Test first:** none.
- **Done when:** the entry names the breaking change (Templates no longer in the editor menu) in
  the user's own terms, not the implementation's.
- **Gate:** H2.

---

## 7. Wave summary

| Wave | Tasks | Parallel | Blocking gate |
|---|---|---|---|
| 0 | O1, O2, O3 | no — orchestrator serial | full gate before W1 dispatch |
| 1 | T1, T2, T3 | 3 workers | full gate |
| 2 | T4, T5 | 2 workers | full gate |
| 3 | T6, T7 | 2 workers | full gate + **H1** |
| 4 | O4, O5, D1, D2, D3 | O4/O5 orchestrator; D1–D3 1 worker | full gate + **H2** |

Disjointness holds: no file appears in two tasks of the same wave, test files included. No task
depends on a task in its own wave.

---

## 8. Definition of done

- [ ] Every phase extends an existing authority (§2) rather than adding a parallel one.
- [ ] Every task has all six fields.
- [ ] Every wave's tasks own disjoint file sets, tests included.
- [ ] No task depends on a task in its own wave.
- [ ] Companion files named, authority declared, orchestrator protocol + instance parameters
      present, role templates **not** re-copied.
- [ ] Shared-file wire-ups (`constants.ts`, `package.json`, `insert.command.ts`) are orchestrator
      tasks, not worker tasks.
- [ ] Security-critical tasks (T2, T3, T5, T6) are marked, carry hostile-input tests, and name the
      reviewer's manual trace — not `sonar-analyze`, which this repo cannot run.
- [ ] Every `vscode`-free task names a test file and a first failing assertion.
- [ ] Every `vscode`-coupled task names its F5 click-path (T6, T7; H1 covers O4/O5).
- [ ] Deliberate simplifications carry a `ponytail:` comment naming the ceiling and upgrade path.
- [ ] `ARTIFACT_FILE_FORMAT.md` updated in the same change as the format change (D1).
- [ ] `progress.md` exists with every task at `todo`.
- [ ] PR checklist ends with `git rm -r docs`.

---

## 9. PR checklist

1. All waves green, `progress.md` complete with per-wave test counts.
2. H1 and H2 signed off by the human.
3. Anything worth keeping is promoted into `CLAUDE.md` / `ARTIFACT_FILE_FORMAT.md` **before** step 5.
4. CHANGELOG names the breaking change.
5. `git rm -r docs` — **the last commit**. The PR diff must contain no `docs/` path.
