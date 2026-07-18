# Services DRY / Config-Driven Refactor — Orchestrated Refactor

## Plan Files — start here (run only this one)

| File | Role | Driven by this plan |
|---|---|---|
| **`services-dry.md`** (this) | Plan + phase queue. | You run this. |
| **`services-dry-progress.md`** | Resume ledger. | Ticked + committed every phase. |
| **`services-dry-findings.md`** | Knowledge log. | Appended every phase. |
| **`claude-md-rewrite.md`** | Slim + update CLAUDE.md. | Runs LAST, after merge. Separate PR. |

---

## Branch & Delivery Protocol (read before Phase 0)

- **Branch:** all work happens on `refactoring/services-dry`, cut from `main`.
  Created in Phase 0. Never commit to `main`.
- **Committing is automatic.** Every phase ends with a Conventional Commit
  (inner-loop step 6). No confirmation needed.
- **Pushing is automatic.** `git push -u origin refactoring/services-dry` after
  the first commit; plain `git push` after each subsequent phase commit. No
  confirmation needed. Remote is `origin`
  (`git@github.com:Nickinfinity/obsidian-artifacts-snippets_and_tools-vscode.git`).
- **The PR is NOT automatic.** Do **not** run `gh pr create` — not at Finalize,
  not "to be helpful". The Finalize phase prepares a PR body and stops. The PR
  is opened **only when the user explicitly asks for it**.
- If a push is rejected (non-fast-forward), stop and report — never
  `--force` onto a shared branch.

---

## Context

**Tree:** 52 TypeScript source files (~6.3k lines src, ~5.6k lines test), one
953-line stylesheet, 433 passing tests. VS Code extension bridging an Obsidian
vault into the editor.

**Goal in one sentence:** eliminate the duplicated helpers, hardcoded parallel
tables, and second serializer that have accumulated across `src/services/` and
`src/ui/panels/`, so each domain fact (artifact type, vault path, language
mapping, HTML escaping, `.md` emission) has exactly one home.

### Recon inventory (Phase 0 evidence — every phase cites these)

**Duplication**

| # | Smell | Evidence (file:line) |
|---|---|---|
| D1 | `escHtml` defined twice with identical semantics | `src/ui/panels/artifactPicker/preview.helpers.ts:17`, `src/ui/panels/artifactForm/form.helpers.ts:20` |
| D2 | Slug function defined three times, same algorithm | `src/services/filename.service.ts:118` (`slugify`), `src/ui/panels/artifactPicker/blockEditor.helpers.ts:109` (`slug`), `src/ui/panels/artifactPicker/varSetController.ts:237` (`slugify`) |
| D3 | `ARTIFACTS.find(a => a.type === …)` re-implemented 6× despite `findEntry` existing — whose JSDoc at `artifact-type-config.service.ts:8-11` falsely claims "the rest of the codebase never traverses `ARTIFACTS` directly" | `src/ui/panels/artifactForm/panel.ts:107,200,210,249`; `src/commands/create.command.ts:68`; `src/services/artifact-writer.service.ts:108` (identical `Unknown artifact type: ${type}` error string as `artifact-type-config.service.ts:23`) |
| D4 | Vault-path read (`getConfiguration('obsidianArtifacts').get<string>('vaultPath','').trim()`) repeated 6× ; the `'obsidianArtifacts'` literal appears at 10 sites | `src/extension.ts:34`, `src/ui/panels/settings.panel.ts:45`, `src/ui/panels/artifactPicker/navigator.ts:33`, `src/ui/panels/artifactPicker/varSetController.ts:192`, `src/ui/panels/artifactForm/panel.ts:241`, `src/commands/create.command.ts:114`; plus `src/services/context.service.ts:103`, `src/extension.ts:45,47`, `src/ui/panels/settings.panel.ts:84,125` |
| D5 | `VK_TOKEN_RE` — the same `/<VK-([A-Za-z]\w*)>/g` declared twice | `src/services/parser.service.ts:17`, `src/services/render.service.ts:4` (plus the escaped webview twin at `src/ui/panels/artifactPicker/codeBlock.ts:62`) |
| D6 | `VK-` prefix strip + label formatting re-implemented 5× | `src/ui/panels/artifactPicker/preview.helpers.ts:34` (canonical `labelForVar`), `src/ui/panels/artifactPicker/preview.ts:480` (webview `lbl`), `src/ui/panels/artifactForm/form.clientJs.ts:418`, `src/ui/panels/artifactPicker/navigator.ts:197`, `src/ui/panels/artifactPicker/navigator.helpers.ts:70`, `src/ui/panels/artifactForm/form.blocks.ts:82` |
| D7 | **A second `.md` serializer** — `buildVarSetFileContent` hand-rolls frontmatter + `vks` fence instead of using the authoritative serializer | `src/ui/panels/artifactPicker/varSetController.ts:212-225` vs `src/services/artifact-serializer.service.ts:40` |
| D8 | `new TextDecoder().decode(await fs.readFile(…))` / `fs.writeFile(…, new TextEncoder().encode(…))` open-coded at 9 sites | `navigator.ts:266`, `varSetController.ts:171`, `blockEditor.ts:108,162,169`, `preview.ts:256,262`, `artifact-writer.service.ts:85`, `varset.service.ts:89` |

**Drift** (the sharpest smell — two tables enumerating one domain set)

| # | Smell | Evidence (file:line) |
|---|---|---|
| R1 | `VALID_TYPES` hardcodes the five artifact types the parser will accept; `ARTIFACTS` independently declares the same five. Adding a sixth type to `ARTIFACTS` makes the parser silently fall back to `'snippet'`. | `src/services/parser.service.ts:6` vs `src/types/constants.ts:21-69` |
| R2 | **Four** language tables, none derived from another, and `LANG_ALIAS`/`MAP` are documented inverses (`constants.ts:80-82` says "keep the two directions consistent") that have **already drifted**: `MAP` maps `'objective-c' → 'objc'` and `'objective-cpp' → 'objcpp'`, while `LANG_ALIAS` has `'objective-c' → 'objc'` (treating `objc` as the canonical id, not the fence string) and no `objcpp` entry at all; `LANG_EXT` keys on `objc` with no `objcpp`. | `src/types/constants.ts:88` (`LANG_ALIAS`), `src/types/constants.ts:129` (`LANG_EXT`), `src/services/language-map.service.ts:15` (`MAP`), `src/ui/panels/artifactForm/form.helpers.ts:36` (`FREE_LANGUAGE_OPTIONS`) |
| R3 | Two frontmatter key lists that must agree, with no test binding them | `src/services/parser.service.ts:9` (`STRING_FRONTMATTER_KEYS`) vs `src/services/artifact-serializer.service.ts:18` (`FRONTMATTER_KEY_ORDER`) |

**God-files** (CLAUDE.md: soft ~400 lines, plan a split at ~500, hard split past 700)

| # | File | Lines | Natural seam |
|---|---|---|---|
| G1 | `src/ui/panels/artifactPicker/preview.ts` | 595 | controller (1-306) · HTML renderers (331-595) · a ~145-line inline webview script (403-546) |
| G2 | `src/ui/panels/artifactForm/form.clientJs.ts` | 543 | single client-JS string constant — **skip**, see §Skips |
| G3 | `src/ui/styles.css` | 953 | 8 `/* ── … ── */` section banners at lines 1, 179, 329, 416, 513, 570, 623, 635 |
| G4 | `test/artifact-patcher.test.ts` | 738 | test file — **skip**, see §Skips |

**Dead code** (each is a *claim* — the executing phase re-verifies before cutting)

| # | Symbol | Evidence |
|---|---|---|
| X1 | `escForJsTemplate` — exported, zero callers anywhere in `src/` or `test/` | `src/ui/panels/artifactPicker/codeBlock.helpers.ts:12` |
| X2 | `BLOCK_EDIT_DEBOUNCE_MS` — exported, zero callers; comment admits "reserved for future operations; unused" | `src/ui/panels/artifactPicker/blockEditor.helpers.ts:15` |
| X3 | `ARTIFACTS.find(a => a.dir === 'Variables')?.dir ?? 'Variables'` — a lookup that returns its own input | `src/ui/panels/artifactPicker/varSetController.ts:196` |

**Toolchain**

| # | Finding | Evidence |
|---|---|---|
| T1 | `pnpm test` fails on this machine — macOS caps unix socket paths at 103 chars and the default `.vscode-test/user-data` dir under this repo path overflows it (`Error: listen EINVAL … 1.12-main.sock`). A one-line `launchArgs` addition fixes it and makes the **full** 433-test suite runnable. | `.vscode-test.mjs` (verified during recon) |

**Missing JSDoc** (CLAUDE.md requires description + `@param` + `@returns` + `@example` on every function)

| # | Symbol | Evidence |
|---|---|---|
| J1 | `getNonce()` has no JSDoc block at all | `src/utils/helpers.ts:1` |

### Decisions locked

1. **One artifact-type accessor.** `artifact-type-config.service.ts` becomes the
   sole reader of `ARTIFACTS`; it exports `getEntry(type)`. Every
   `ARTIFACTS.find` site outside it is replaced. `parser.service.ts`'s
   `VALID_TYPES` is **derived** from `ARTIFACTS`, not re-listed.
2. **One config reader.** A new `src/services/config.service.ts` owns the
   `'obsidianArtifacts'` section name and vault-path access. No panel, command,
   or controller calls `vscode.workspace.getConfiguration('obsidianArtifacts')`
   directly.
3. **One `.md` writer.** `serializeArtifact` is the only code path that emits
   vault `.md` text. `buildVarSetFileContent` is deleted and its callers routed
   through the serializer — behind a byte-identical golden lock.
4. **One escaper, one slug, one VK regex.** `escHtml` moves to
   `src/utils/html.ts`; `slugify` in `filename.service.ts` is the single slug;
   `VK_TOKEN_RE` is exported once from `parser.service.ts`.
5. **Two correctly-keyed language tables, not one merged registry.** The four
   language tables serve genuinely different concerns (fence→id, id→ext,
   id→fence, UI dropdown). They are **not** merged. `MAP` is derived from
   `LANG_ALIAS` as its inverse, and a consistency test guards the rest. See §7
   of the meta-plan: *one registry ≠ always right*.

### Invariant (non-negotiable)

- Every pre-existing test keeps passing **unmodified**. Baseline **433**.
- The gate's pass count **never drops** below the previous phase's. The only
  sanctioned exception is deleting a test that covers **deleted code** — allowed
  only when done loudly (named in the commit body *and* the findings log) with
  any still-live coverage relocated first. A silent drop is a defect.
- **Byte-identical output.** Phase 5 changes code that emits serialized `.md`
  text. The `.md` bytes produced for any given input must not change. Proof is a
  golden snapshot captured *before* the transform and never edited during it.
- `ARTIFACT_FILE_FORMAT.md` and `package.json`'s `contributes` block are
  **untouched** unless a phase says otherwise and the findings log records why.

---

## Guiding Principles

**DRY / KISS / DOTW.** One source of truth per fact. Simplest thing that works.
One file / one concern, one function / one job. **No abstraction without a
second concrete caller today** — a helper extracted for one caller is
over-engineering, note the skip instead.

**Behavior invariant.** As stated above. Prove preservation; never assume it.

**Security.** This extension renders webviews and touches the filesystem, so:
keep every webview under its existing CSP + nonce with `localResourceRoots`
unchanged (`extensionUri/src/ui`); every value interpolated into webview HTML
stays escaped (the `escHtml` move in Phase 1 must not drop a single call site);
keep the vault path-escape guard at `artifact-writer.service.ts:127`
(`isWithinRoot`) intact and route new path joins through it; user-typed names
keep going through `filename.service.ts` validators — no raw user string
becomes a path segment. No `child_process` exists in this repo; do not add one.

**Tooling — the skill stack, mandatory for every executing agent:**
- `Skill caveman` — terse output, on every prompt.
- `Skill ponytail` — reuse before writing, shortest working diff, delete over
  add, no speculative abstraction. On every prompt.
- `Skill mastering-typescript` — on **every** TypeScript edit.
- **SonarQube** — every phase's changed files get `sonarqube:sonar-analyze`;
  Blocker/Critical findings are cleared before the phase closes. One-time
  prerequisite: `/sonarqube:sonar-integrate`, then `sonar auth login`, plus a
  container runtime. **Fallback:** if Sonar is unavailable, the gate's
  `eslint src` already enforces the SonarSource `S`-rules — proceed and record
  the skip in the findings log.
- `ponytail:ponytail-review` on each phase diff, hunting over-engineering.

**JSDoc.** Every function/interface added or changed carries a full block:
description, `@param`, `@returns`, `@example`. Comments explain *why*.

**ESLint gotchas** (this repo's config): `RegExp.exec(str)` not `str.match(re)`
(S6594) · `str.startsWith(x)` not `/^x/.test(str)` (S6557) · no nested template
literals (S4624) · cognitive complexity ≤ 15 (S3776).

**Imports** use explicit `.js` extensions even in `.ts` — Node16 resolution.

---

## Orchestration Workflow

**Execution model: a single agent working inline.** This refactor is
medium-sized and its phases share files (`constants.ts`, `varSetController.ts`,
`preview.ts` each appear in 2-4 phases). Subagents would start cold, re-derive
the same context, and collide on shared files. Inline execution is cheaper and
tighter here. Do **not** dispatch per-phase subagents.

### The per-phase inner loop — run this verbatim, every phase

1. **Task (TDD-first).** Re-verify the phase's **Evidence** first — grep that
   each cited `file:line` smell still exists as described. *The tree beats the
   plan.* Then, for any pure framework-free unit: ensure a covering (initially
   failing) test exists **before** refactoring; green it; then refactor. Every
   TS edit applies `Skill mastering-typescript` patterns.
2. **Gate #1.** Run the gate. Red → fix in place; repeat until green.
3. **Review.** Quality + security pass on the changed files:
   `sonarqube:sonar-analyze` per changed file (lint S-rules as fallback), plus
   `ponytail:ponytail-review` for over-engineering. Hunt: a fresh duplicate, a
   leftover cascade, a function over the size/complexity limit, missing or
   stale JSDoc, a dead branch, a needless scan.
4. **Remediate.** Apply the findings
   (`sonarqube:sonar-fix-issue <rule> <file>:<line>` for a specific hit).
   Update tests + docs as needed.
5. **Gate #2 + re-review.** Loop 3-5 until clean **and** green.
6. **Record.** Append a findings entry; tick the ledger (pass count + commit
   sha); **commit** (Conventional Commits); **push**; advance.

---

## Reuse Before Writing (existing assets — do not re-implement)

| Asset | Path | Use as |
|---|---|---|
| `slugify`, `deriveFileName` | `src/services/filename.service.ts:118,139` | **The** slug implementation. Delete the two copies; import this. |
| `validateArtifactFilename`, `validateFolderName` | `src/services/filename.service.ts:71,96` | All user-typed name validation. |
| `findEntry` (make it `getEntry`, export it) | `src/services/artifact-type-config.service.ts:20` | **The** `ARTIFACTS` lookup. |
| `getFormConfig` / `getLanguageMode` / `getDefaultLanguage` / `getTypeSingular` / `canMultiBlock` / `getCreateFormTypes` | `src/services/artifact-type-config.service.ts:43-137` | Per-type behaviour. Never re-derive from `ARTIFACTS`. |
| `serializeArtifact` | `src/services/artifact-serializer.service.ts:40` | **The** `.md` emitter. |
| `parseFromContent`, `parseArtifactFile`, `parseBlocks`, `extractVars`, `resolveVars` | `src/services/parser.service.ts` | **The** `.md` reader. |
| `patchFrontmatterField`, `patchVarDefaults` | `src/services/artifact-patcher.service.ts` | Surgical in-place `.md` edits. |
| `escHtml` | `src/ui/panels/artifactPicker/preview.helpers.ts:17` | Canonical body → moves to `src/utils/html.ts` in P1. |
| `labelForVar` | `src/ui/panels/artifactPicker/preview.helpers.ts:34` | Canonical `VK-` label formatter. |
| `popupShell` | `src/ui/panels/artifactPicker/preview.helpers.ts:52` | Script-free webview HTML shell. |
| `renderCodeHtml` / `renderCodeRowsHtml` | `src/services/render.service.ts` | Code rendering — `renderCodeRowsHtml` when the caller supplies its own wrapper. |
| `buildCodeBlockHtml` + `CODE_BLOCK_CLIENT_JS` | `src/ui/panels/artifactPicker/codeBlock.ts` | The editable-code-area plug-in pair. |
| `getNonce` | `src/utils/helpers.ts:1` | CSP nonces. (Needs JSDoc — see J1.) |
| `isWithinRoot` | `src/services/artifact-writer.service.ts:127` | Path-escape guard pattern to imitate for any new path join. |
| **Pattern to imitate:** `form.html.ts` + `form.clientJs.ts` + `form.blocks.ts` split | `src/ui/panels/artifactForm/` | The model for the P6 `preview.ts` split — renderer, client JS, and sub-renderers in separate files. |
| **Pattern to imitate:** callback-bag controller composition | `preview.ts:63-89` | How a controller owns sub-controllers without reaching into their internals. |

---

## The Gate

Phase 0 first applies the `.vscode-test.mjs` fix (T1). After that, the gate is
the repo's own test script and covers the **full** suite:

```bash
pnpm test
```

Equivalent to `tsc -p ./` + `eslint src` + all 433 tests in a real Extension
Development Host.

**Clean-rebuild rule:** `tsc` does **not** remove orphaned output. After any
file delete or rename, run `rm -rf dist` before gating — a deleted test's stale
compiled artifact keeps running and *inflates* the pass count (a phantom green):

```bash
rm -rf dist && pnpm test
```

Green = zero failures **and** pass count ≥ the previous gate's.
**Baseline: 433 passing** (verified during recon, with the T1 fix applied).

---

## Phases

### Phase 0 — Baseline (orchestrator, no source edits)

- **Do:**
  1. `git checkout -b refactoring/services-dry` from `main`.
  2. Apply the T1 fix to `.vscode-test.mjs` — add
     `launchArgs: ['--user-data-dir=/tmp/oa-vsct']` with a comment naming the
     103-char socket-path cap. This is the only source-adjacent edit in P0.
  3. Run `rm -rf dist && pnpm test`. Record the pass count. It must be **433**;
     if it is not, stop and reconcile before any phase runs.
  4. Commit the three plan companion files + the `.vscode-test.mjs` fix;
     `git push -u origin refactoring/services-dry`.
- **Done-when:** branch exists and is pushed; gate green at 433; ledger and
  findings files committed with the Phase 0 discovery inventory.

### Phase 1 — Shared pure helpers (escHtml · slug · VK regex)

- **Touches:** `src/utils/html.ts` (new), `src/utils/helpers.ts`,
  `src/ui/panels/artifactPicker/preview.helpers.ts`,
  `src/ui/panels/artifactForm/form.helpers.ts`,
  `src/ui/panels/artifactPicker/blockEditor.helpers.ts`,
  `src/ui/panels/artifactPicker/varSetController.ts`,
  `src/services/render.service.ts`, `src/services/parser.service.ts`,
  and the direct importers of each moved symbol.
  **Depends:** P0. **Parallel-safe:** no — it touches files every later phase
  also touches. Run first, alone.
- **Evidence:** D1 (`preview.helpers.ts:17`, `form.helpers.ts:20`) · D2
  (`filename.service.ts:118`, `blockEditor.helpers.ts:109`,
  `varSetController.ts:237`) · D5 (`parser.service.ts:17`,
  `render.service.ts:4`) · J1 (`utils/helpers.ts:1`).
- **Do:**
  - Create `src/utils/html.ts` exporting one `escHtml` (keep the
    `HTML_ESCAPE_MAP` constant form from `form.helpers.ts:7-21` — it avoids
    rebuilding the object literal per character). Re-point both former
    definitions' importers at it; delete both copies.
  - Delete `slug` (`blockEditor.helpers.ts:109`) and the private `slugify`
    (`varSetController.ts:237`); import `slugify` from `filename.service.ts`.
    **Watch the fallback difference:** the varSetController copy returns
    `'untitled-variable-set'` for an empty slug while `slugify` returns `''` —
    preserve that behaviour at the *call site* (`varSetController.ts:167`), not
    by re-introducing a second slug function.
  - Export `VK_TOKEN_RE` from `parser.service.ts`; `render.service.ts` imports
    it and deletes its own. **Note the `/g` flag:** a shared global regex
    carries `lastIndex` state across calls — every use must be
    `matchAll`/`replace` (which reset it) or explicitly reset `lastIndex`.
    A test must cover two consecutive calls on the same regex instance.
  - Add the missing JSDoc block to `getNonce` (J1).
- **TDD:** new `test/utils-html.test.ts` covering all five escaped characters
  and idempotence concerns; extend `test/filename.service.test.ts` with the
  cases the deleted copies covered (`'My Snippet Title'`, `'Hello, World!'`,
  empty input); add the shared-`VK_TOKEN_RE` reuse test.
- **Done-when:** exactly one `escHtml` definition, one slug function, one
  `VK_TOKEN_RE` in `src/`; `grep -rn "function escHtml\|function slug\b" src`
  returns one hit each; gate green, count ≥ 433.

### Phase 2 — One artifact-type accessor (kill the `ARTIFACTS.find` cascade)

- **Touches:** `src/services/artifact-type-config.service.ts`,
  `src/ui/panels/artifactForm/panel.ts`, `src/commands/create.command.ts`,
  `src/services/artifact-writer.service.ts`, `src/services/parser.service.ts`,
  `src/ui/panels/artifactPicker/varSetController.ts`.
  **Depends:** P1 (shares `varSetController.ts`). **Parallel-safe:** no.
- **Evidence:** D3 (`panel.ts:107,200,210,249`, `create.command.ts:68`,
  `artifact-writer.service.ts:108`, vs `artifact-type-config.service.ts:20`) ·
  R1 (`parser.service.ts:6` vs `constants.ts:21`) · X3
  (`varSetController.ts:196`).
- **Do:**
  - Rename `findEntry` → `getEntry` and export it. Replace all six
    `ARTIFACTS.find` sites. Delete `findBaseDir`
    (`artifact-writer.service.ts:107-111`) — it is `getEntry(type).dir` with a
    character-identical error message.
  - `panel.ts:200,210` currently re-derive the singular label with
    `?.form?.label.singular ?? 'block'` / `?? 'artifact'` — route them through
    the existing `getTypeSingular`, and reuse `labelForDeleteEntire`
    (`form.helpers.ts:117`) for the delete-confirmation string rather than
    re-composing it. Preserve the two *different* fallback nouns only if a test
    proves a caller depends on them; otherwise let `getTypeSingular` throw as
    designed and record the behaviour change loudly.
  - Derive `VALID_TYPES` (`parser.service.ts:6`) from `ARTIFACTS`:
    `new Set(ARTIFACTS.map(a => a.type))`. Verify `parser.service.ts` stays
    `vscode`-free — `constants.ts` imports only `artifact.types.js`, so this is
    safe.
  - Delete the X3 no-op at `varSetController.ts:196`; use the `Variables`
    entry's `dir` via `getEntry('variables').dir`.
- **TDD:** extend `test/artifact-type-config.test.ts` with `getEntry` hit/miss;
  add a **drift-guard** test in `test/constants.test.ts` asserting the parser
  accepts every `type` declared in `ARTIFACTS` (this is the test that would have
  caught R1).
- **Done-when:** `grep -rn "ARTIFACTS.find" src` returns hits **only** inside
  `artifact-type-config.service.ts`; `VALID_TYPES` contains no literals; gate
  green, count ≥ previous.

### Phase 3 — One config reader

- **Touches:** `src/services/config.service.ts` (new), `src/extension.ts`,
  `src/ui/panels/settings.panel.ts`,
  `src/ui/panels/artifactPicker/navigator.ts`,
  `src/ui/panels/artifactPicker/varSetController.ts`,
  `src/ui/panels/artifactForm/panel.ts`, `src/commands/create.command.ts`,
  `src/services/context.service.ts`.
  **Depends:** P2 (shares `panel.ts`, `create.command.ts`,
  `varSetController.ts`). **Parallel-safe:** no.
- **Evidence:** D4 — six vault-path reads at `extension.ts:34`,
  `settings.panel.ts:45`, `navigator.ts:33`, `varSetController.ts:192`,
  `panel.ts:241`, `create.command.ts:114`; `'obsidianArtifacts'` at ten sites
  including `context.service.ts:103`, `extension.ts:45,47`,
  `settings.panel.ts:84,125`.
- **Do:** create `src/services/config.service.ts` exporting
  `CONFIG_SECTION = 'obsidianArtifacts'`, `getVaultPath(): string` (trimmed),
  `getVaultRootUri(): vscode.Uri | undefined`, and
  `isOurConfigChange(e: vscode.ConfigurationChangeEvent): boolean` wrapping the
  `affectsConfiguration` call at `extension.ts:45`. Replace every site.
  **Do not** invent setters or a generic get/set wrapper — `settings.panel.ts`
  is the only writer and has two `update` calls; leave them, just source the
  section name from `CONFIG_SECTION`.
- **TDD:** the module is `vscode`-dependent, so behaviour is covered by the
  existing suite. Add no fake-vscode harness — that is scaffolding this repo
  does not have. Confirm the existing settings/context tests still pass and note
  the deliberate absence of a new unit test in the findings log.
- **Done-when:** `grep -rn "getConfiguration('obsidianArtifacts')" src` returns
  hits only in `config.service.ts`; gate green, count ≥ previous.

### Phase 4 — Language tables: derive the inverse, guard the rest

- **Touches:** `src/types/constants.ts`, `src/services/language-map.service.ts`,
  `src/ui/panels/artifactForm/form.helpers.ts`,
  `src/ui/panels/artifactPicker/blockEditor.helpers.ts`.
  **Depends:** P1 (shares `form.helpers.ts`, `blockEditor.helpers.ts`).
  **Parallel-safe:** yes, with respect to P3 — disjoint file sets. May run
  concurrently with P3 **only** if P1 and P2 are both committed.
- **Evidence:** R2 — `constants.ts:88` (`LANG_ALIAS`), `constants.ts:129`
  (`LANG_EXT`), `language-map.service.ts:15` (`MAP`), `form.helpers.ts:36`
  (`FREE_LANGUAGE_OPTIONS`); the documented-inverse contract at
  `constants.ts:80-82`; the live objc/objcpp drift.
- **Do:**
  - **Do not merge the four tables.** They key differently and serve different
    concerns (fence→id, id→ext, id→fence, UI dropdown list). Merging would be
    lossy — see meta-plan §7.
  - Derive `MAP` in `language-map.service.ts` as the computed inverse of
    `LANG_ALIAS`, with an explicit override map for the cases where several
    fence strings alias one id and the preferred reverse is not the last-wins
    entry (e.g. `shellscript` must reverse to `bash`, not `zsh`/`sh`/`shell`).
    Keep the override map tiny and comment *why* each entry exists.
  - Resolve the objc/objcpp drift **deliberately**: pick one canonical id, make
    all three tables agree, and record the decision + the user-visible effect in
    the findings log. Do not "fix" it silently.
- **TDD:** add `test/language-consistency.test.ts` (the drift guard):
  every `LANG_ALIAS` value round-trips through `mapLanguageId` back to a fence
  string that `normalizeLangId` maps to the same id; every
  `FREE_LANGUAGE_OPTIONS` entry (except `''`) resolves through
  `normalizeLangId` to an id that `extForLang` maps to a non-`txt` extension.
  Extend `test/language-map.test.ts` for the new derivation.
- **Done-when:** `MAP` contains no entry that duplicates a derivable
  `LANG_ALIAS` inverse; the consistency test passes; gate green, count ≥
  previous.

### Phase 5 — One `.md` writer (**highest risk — golden lock first**)

- **Touches:** `src/ui/panels/artifactPicker/varSetController.ts`,
  `src/services/artifact-serializer.service.ts` (only if the round-trip proves a
  gap), `test/snapshots/` (new golden files).
  **Depends:** P1, P2, P3 (all touch `varSetController.ts`).
  **Parallel-safe:** no.
- **Evidence:** D7 — `varSetController.ts:212-225` vs
  `artifact-serializer.service.ts:40`.
- **Do:**
  1. **Golden-lock first.** Before changing a line of emission code, capture the
     *current* `buildVarSetFileContent` output as byte-exact snapshot tests
     covering: no description + no tags; description only; tags only; both;
     multiple vars; a value containing `=` and one containing quotes. Gate them
     green. **Never edit these snapshots during the refactor** — them passing
     unchanged *is* the byte-identical proof.
  2. Then route the save through `serializeArtifact` by building an
     `ArtifactFormModel` (`type: 'variables'`, title, description, tags, one
     block whose `vars` carry the values). Delete `buildVarSetFileContent`.
  3. **Expect a mismatch and handle it honestly.** The serializer emits
     `\nvars:\n\`\`\`vks\n…` (`artifact-serializer.service.ts:161-166`) while the
     hand-rolled version emits a bare `\`\`\`vks` fence with no `vars:` label
     (`varSetController.ts:221`), and it filters vars with empty defaults. If the
     bytes differ, **do not edit the golden**. Either (a) teach the serializer the
     `type: 'variables'` shape so it reproduces the current bytes, or (b) if the
     new bytes are genuinely better and still parse identically, prove it with a
     `parseFromContent(old) deep-equals parseFromContent(new)` test, change the
     golden in **its own commit** with the diff quoted in the findings log, and
     verify `ARTIFACT_FILE_FORMAT.md` §6 still describes what is emitted.
- **TDD:** the golden snapshots above, plus a parse round-trip
  (`parseFromContent(serialized)` yields the same vars in the same order).
- **Done-when:** exactly one function in `src/` emits frontmatter `---` fences;
  goldens pass unchanged (or the sanctioned exception above is documented); gate
  green, count ≥ previous.

### Phase 6 — Split `preview.ts` (595 lines) + collapse the webview helper copies

- **Touches:** `src/ui/panels/artifactPicker/preview.ts`,
  `src/ui/panels/artifactPicker/preview.render.ts` (new),
  `src/ui/panels/artifactPicker/preview.clientJs.ts` (new),
  `src/ui/panels/artifactPicker/preview.helpers.ts`,
  `src/ui/panels/artifactForm/form.clientJs.ts`,
  `src/ui/panels/artifactPicker/codeBlock.ts`.
  **Depends:** P1 (shares `preview.helpers.ts`). **Parallel-safe:** no.
- **Evidence:** G1 (`preview.ts` 595 lines: controller 1-306, renderers
  331-595, inline script 403-546) · D6 (`preview.ts:480` `lbl`,
  `preview.ts:484` `esc`, `form.clientJs.ts:418`, `codeBlock.ts:60` — webview
  copies of `labelForVar`/`escHtml`).
- **Do:**
  - Move `renderPreviewHtml`, `renderMultiBlockPreviewHtml`,
    `renderPopupEmptyHtml`, and `mergeVarsWithDefaults` into
    `preview.render.ts`; move the ~145-line inline script into
    `preview.clientJs.ts` as an exported constant. Mirror the existing
    `form.html.ts` / `form.clientJs.ts` split exactly — that pattern already
    works in this repo.
  - Extract the duplicated webview-side `esc` + `lbl` into **one** exported
    client-JS snippet constant that `preview.clientJs.ts`, `form.clientJs.ts`,
    and `codeBlock.ts` all concatenate. These *cannot* import the TS helpers —
    they run inside the webview — so a shared source string is the correct fix,
    not a fourth copy.
  - **Guard the `acquireVsCodeApi()` constraint:** it may be called only once
    per webview. The shared snippet must not call it; it stays in the outer
    IIFE, exactly as `CODE_BLOCK_CLIENT_JS` does today.
  - **Size targets yield to cohesion** (meta-plan §7): if the controller lands
    slightly over 300 lines as one cohesive concern, that is fine. Do not
    fragment one concern to hit a number — record any deviation loudly.
- **TDD:** `test/preview-render.test.ts` already covers rendered HTML — extend
  it to assert the shared snippet's `esc`/`lbl` appear exactly once in each
  generated document, and that the rendered output is unchanged for a fixture
  artifact (a render-level golden).
- **Done-when:** no file in `artifactPicker/` exceeds ~400 lines; the webview
  `esc`/`lbl` bodies appear once in source; gate green, count ≥ previous.

### Phase 7 — Dead-code purge (verify each claim before cutting)

- **Touches:** `src/ui/panels/artifactPicker/codeBlock.helpers.ts`,
  `src/ui/panels/artifactPicker/blockEditor.helpers.ts`.
  **Depends:** P6 (P6 rewrites the client-JS files where `escForJsTemplate`
  would plausibly have been used — cut only after that settles).
  **Parallel-safe:** no.
- **Evidence:** X1 (`codeBlock.helpers.ts:12`) · X2
  (`blockEditor.helpers.ts:15`).
- **Do:** for each symbol, re-verify with a fresh grep across `src/`, `test/`,
  **and** the generated webview HTML strings (a symbol can be live via a
  template literal, not an import). "Dead" is a claim, not a label — a comment
  saying "unused" is not proof. Delete only what survives verification; for
  anything that turns out live, record why in the findings log and keep it.
  If `codeBlock.helpers.ts` empties out, delete the file and its import.
- **TDD:** none added — deletion is proven by the unchanged suite. If a test
  exists solely for a deleted symbol, delete it **loudly** (named in the commit
  body and the findings log) and confirm no live coverage is lost.
- **Done-when:** every X-item is deleted or documented as live; `rm -rf dist &&
  pnpm test` green (clean rebuild is **mandatory** here — files were deleted);
  count ≥ previous minus any loudly-recorded deleted-code test.

### Phase 8 — Split `styles.css` (953 lines)

- **Touches:** `src/ui/styles.css` → per-feature files under `src/ui/`;
  every panel that builds a `<link>` tag (`preview.helpers.ts:52`,
  `preview.render.ts`, `form.html.ts:118`, `settings.panel.ts`).
  **Depends:** P6 (P6 moves the renderers that emit the `<link>` tags).
  **Parallel-safe:** no.
- **Evidence:** G3 — section banners at `styles.css:1` (Settings panel), `:179`
  (Artifact picker popup), `:329` (Edit mode inputs), `:416` (hljs syntax),
  `:513` (Code block line numbers), `:570` (Var-set diff), `:623` (Var-set
  badge), `:635` (Artifact Form panel).
- **Do:** split along the existing banners into files whose names match the
  feature (`settings.css`, `picker.css`, `code-block.css`, `hljs.css`,
  `varset.css`, `form.css`). Each webview links only what it uses.
  **Prove the split is loss-free:** diff the sorted list of CSS selectors before
  and after — it must be identical. A rule that looks orphaned may be live via a
  descendant or type selector; do not drop rules during the split (deleting
  genuinely-unused CSS is a *separate* change, not this phase's job).
  `localResourceRoots` stays `extensionUri/src/ui` — every new file must live
  there or the webview cannot load it.
- **TDD:** none — CSS is not unit-tested here. The proof is the selector diff
  (paste it into the findings log) plus the manual F5 pass in Verification.
- **Done-when:** no CSS file exceeds ~300 lines; selector diff empty; every
  webview still renders correctly under F5; gate green, count ≥ previous.

### Phase 9 — Finalize (orchestrator)

- Full `rm -rf dist && pnpm test`. Confirm count ≥ 433.
- Quality/security sweep across the whole branch diff:
  `sonarqube:sonar-analyze` (or the `sonarqube-reviewer` agent) +
  `ponytail:ponytail-review` on `git diff main...HEAD`.
- Confirm `ARTIFACT_FILE_FORMAT.md` is untouched and `package.json`'s
  `contributes` block is unchanged (`git diff main...HEAD -- package.json
  ARTIFACT_FILE_FORMAT.md` — expect empty).
- Manual end-to-end pass (see Verification).
- Push the final commit. **Draft the PR body into the findings log and STOP.**
  Do **not** run `gh pr create`. Report to the user that the branch is ready and
  await an explicit request to open the PR.

### Skips (recorded deliberately — every recon finding is assigned or skipped)

- **G2 `form.clientJs.ts` (543 lines)** — skipped. It is a single exported
  client-JS string constant, not composable logic; splitting it would mean
  concatenating fragments across files for no reader benefit. Revisit only if a
  second webview needs a subset of it. (P6 *does* extract the shared `esc`/`lbl`
  snippet from it — that is the part with a second caller today.)
- **G4 `test/artifact-patcher.test.ts` (738 lines)** — skipped. CLAUDE.md's
  size limits target source complexity; a long flat table of parser cases is
  the clearest form for that content, and churning it risks the behaviour lock
  the whole refactor rests on.
- **D8 (9 open-coded encode/decode sites)** — skipped as its own phase. Each
  site is a two-line idiom inside a function that already owns its error
  handling; a `readText`/`writeText` wrapper would save ~9 lines while adding a
  module and an import to nine files. Revisit if a tenth site appears **or** if
  a phase needs shared error handling around it. Marked so P1's reviewer does
  not "discover" it again.
- **R3 (frontmatter key lists)** — skipped as a merge; the two lists serve
  different directions (parser accepts, serializer orders) and merging is lossy.
  A drift-guard test is the right fix, but it is subsumed by the round-trip
  coverage added in P5 — if P5's round-trip does **not** cover it, add the guard
  test there and note it.
- **`varset.service.ts` purity split** — skipped. Its pure scoring functions are
  already unit-tested (`test/varset-scorer.test.ts`,
  `varset-apply.test.ts`, `varset-subsets.test.ts`) and the gate now runs the
  full `vscode`-enabled suite, so the usual motive for extracting them
  (untestability) does not apply.

---

## Critical Files

| Concern | Files |
|---|---|
| Entry / activation | `src/extension.ts` |
| Commands | `src/commands/insert.command.ts`, `create.command.ts`, `openSettings.command.ts` |
| Config source of truth | `src/types/constants.ts` (`ARTIFACTS`, `LANG_ALIAS`, `LANG_EXT`) |
| Type accessors | `src/services/artifact-type-config.service.ts` |
| `.md` read | `src/services/parser.service.ts` |
| `.md` write | `src/services/artifact-serializer.service.ts`, `artifact-writer.service.ts`, `artifact-patcher.service.ts` |
| Vault / context / config | `src/services/vault.service.ts`, `context.service.ts`, **`config.service.ts` (new, P3)** |
| Rendering | `src/services/render.service.ts`, `src/services/language-map.service.ts` |
| Var sets | `src/services/varset.service.ts`, `src/ui/panels/varsetPicker.panel.ts`, `src/ui/panels/artifactPicker/varSetController.ts`, `varSetDiff.ts` |
| Picker (4 parts) | `src/ui/panels/artifactPicker/{navigator,codeBlock,preview,fullEditor,blockEditor}.ts` + `*.helpers.ts` + `shared.ts` |
| Create form | `src/ui/panels/artifactForm/{panel,form.html,form.blocks,form.clientJs}.ts` + `*.helpers.ts` |
| Other panels | `src/ui/panels/settings.panel.ts`, `destFolderPicker.panel.ts` |
| Styles | `src/ui/styles.css` |
| Format spec (**do not edit**) | `ARTIFACT_FILE_FORMAT.md` |

---

## Verification

- **Every phase:** `pnpm test` green, pass count ≥ previous
  (`rm -rf dist &&` first whenever a file was deleted or renamed).
- **Golden/byte-identical:** P5's variable-set snapshots pass **unchanged**;
  P6's render-level golden for a fixture artifact is unchanged; P8's CSS
  selector diff is empty.
- **End-to-end manual pass** (after P6, P8, and again at Finalize) — press
  **F5** to launch the Extension Development Host, then:
  1. Open Settings, confirm the vault path and directory toggles still render.
  2. Trigger *Insert Snippets*, navigate a folder, hover a file → preview panel
     renders with line numbers, highlighting, and orange `<VK-xxx>` spans.
  3. Fill a variable, press **Insert** → resolved text lands at the cursor.
  4. On a `type: command` artifact → text goes to the terminal, not the editor.
  5. **Edit Block** and **Edit .md** each open their editor and round-trip a
     save back into the preview.
  6. **Apply Variable Set** → diff preview → Apply → `from: <set>` badge shows.
  7. **Save as Variable Set** → writes `Variables/<slug>.md`; reopen it in the
     picker and confirm it parses (this is the P5 proof in the real app).
  8. *Create Artifact* → fill the form, save → file lands in the right vault
     directory and re-opens correctly.
- **Goal smoke test** — *"adding a new artifact type is a `constants.ts` change
  only."* After P2, add a throwaway sixth entry to `ARTIFACTS`, run the gate,
  and confirm the parser accepts its `type` and the type-config accessors work
  with **zero** other source edits. Revert the throwaway entry before
  committing; record the result in the findings log.

---

## Progress Tracking & Resume

`services-dry-progress.md` is the committed source of truth for *status*;
`services-dry-findings.md` is the *knowledge*. To resume:

1. Read the ledger's `RESUME HERE` pointer.
2. Verify reality: `git branch --show-current` is `refactoring/services-dry`,
   and `git log --oneline main..HEAD` matches the ledger's gate log.
3. Re-run `rm -rf dist && pnpm test` to confirm the recorded pass count.
4. **Re-grep the next phase's Evidence** before cutting — the ledger can be
   stale and this plan can simply be wrong. The tree wins.
5. Dispatch the next unchecked phase.
