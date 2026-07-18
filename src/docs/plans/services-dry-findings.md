# Services DRY Refactor — Findings Log

Appended each phase (inner-loop step 6): **Discovered / Changed / Improved
(metrics) / Rule-learned**. This is the primary input to
[`claude-md-rewrite.md`](claude-md-rewrite.md).

---

## Phase 0 — Discovery

### Discovered

**Duplication**

- `escHtml` defined twice, identical semantics —
  `src/ui/panels/artifactPicker/preview.helpers.ts:17` and
  `src/ui/panels/artifactForm/form.helpers.ts:20`. Two more webview-side copies
  exist as strings inside generated client JS
  (`artifactPicker/codeBlock.ts:60`, `artifactPicker/preview.ts:484`).
- Slug function defined three times with the same algorithm —
  `services/filename.service.ts:118` (`slugify`),
  `artifactPicker/blockEditor.helpers.ts:109` (`slug`),
  `artifactPicker/varSetController.ts:237` (`slugify`, differs only in its
  empty-input fallback `'untitled-variable-set'`).
- `ARTIFACTS.find(a => a.type === …)` re-implemented at six sites —
  `artifactForm/panel.ts:107,200,210,249`, `commands/create.command.ts:68`,
  `services/artifact-writer.service.ts:108` — while
  `services/artifact-type-config.service.ts:20` already has `findEntry` and its
  JSDoc (lines 8-11) **falsely claims** "the rest of the codebase never
  traverses `ARTIFACTS` directly". `artifact-writer.service.ts:109` even throws
  the character-identical error string as `artifact-type-config.service.ts:23`.
- Vault-path read
  (`getConfiguration('obsidianArtifacts').get<string>('vaultPath','').trim()`)
  repeated six times — `extension.ts:34`, `settings.panel.ts:45`,
  `artifactPicker/navigator.ts:33`, `artifactPicker/varSetController.ts:192`,
  `artifactForm/panel.ts:241`, `commands/create.command.ts:114`. The bare
  `'obsidianArtifacts'` literal appears at ten sites in total (add
  `services/context.service.ts:103`, `extension.ts:45,47`,
  `settings.panel.ts:84,125`). **There is no config service.**
- `VK_TOKEN_RE` (`/<VK-([A-Za-z]\w*)>/g`) declared twice —
  `services/parser.service.ts:17` and `services/render.service.ts:4`, plus the
  escaped webview twin at `artifactPicker/codeBlock.ts:62`.
- `VK-` prefix strip + label formatting re-implemented five times beyond the
  canonical `labelForVar` (`artifactPicker/preview.helpers.ts:34`):
  `artifactPicker/preview.ts:480`, `artifactForm/form.clientJs.ts:418`,
  `artifactPicker/navigator.ts:197`, `artifactPicker/navigator.helpers.ts:70`,
  `artifactForm/form.blocks.ts:82`.
- **A second `.md` serializer.**
  `artifactPicker/varSetController.ts:212-225` hand-builds frontmatter + a
  `vks` fence line-by-line instead of using
  `services/artifact-serializer.service.ts:40`. The two emit *different* bytes:
  the serializer writes `\nvars:\n\`\`\`vks` and filters vars with empty
  defaults; the hand-rolled version writes a bare `\`\`\`vks` and keeps
  everything.
- `TextDecoder`/`TextEncoder` + `workspace.fs` read/write open-coded at nine
  sites — `navigator.ts:266`, `varSetController.ts:171`,
  `blockEditor.ts:108,162,169`, `preview.ts:256,262`,
  `artifact-writer.service.ts:85`, `varset.service.ts:89`.

**Drift**

- `VALID_TYPES` (`services/parser.service.ts:6`) hardcodes the five artifact
  types the parser accepts, while `ARTIFACTS` (`types/constants.ts:21-69`)
  independently declares the same five. Adding a sixth type to `ARTIFACTS`
  makes the parser silently fall back to `'snippet'` — a *silent* data bug, the
  sharpest finding in this inventory.
- **Four** language tables, none derived from another:
  `types/constants.ts:88` (`LANG_ALIAS`, fence→id),
  `types/constants.ts:129` (`LANG_EXT`, id→ext),
  `services/language-map.service.ts:15` (`MAP`, id→fence),
  `artifactForm/form.helpers.ts:36` (`FREE_LANGUAGE_OPTIONS`, UI dropdown).
  `constants.ts:80-82` documents `LANG_ALIAS` and `MAP` as inverses that must
  stay consistent — **and they have already drifted**: `MAP` carries
  `'objective-cpp' → 'objcpp'` with no `LANG_ALIAS` or `LANG_EXT` counterpart,
  and the two disagree on whether `objc` or `objective-c` is the canonical id.
- Two frontmatter key lists that must agree with no test binding them —
  `services/parser.service.ts:9` (`STRING_FRONTMATTER_KEYS`) vs
  `services/artifact-serializer.service.ts:18` (`FRONTMATTER_KEY_ORDER`).

**God-files** (CLAUDE.md limits: soft ~400, plan a split at ~500, hard past 700)

- `artifactPicker/preview.ts` — 595 lines; three concerns (controller 1-306,
  HTML renderers 331-595, a ~145-line inline webview script 403-546).
- `artifactForm/form.clientJs.ts` — 543 lines (skipped; see the plan's §Skips).
- `ui/styles.css` — 953 lines across 8 banner-marked sections.
- `test/artifact-patcher.test.ts` — 738 lines (skipped; test data table).

**Dead code (claims to verify, not labels to trust)**

- `escForJsTemplate` (`artifactPicker/codeBlock.helpers.ts:12`) — exported,
  zero callers in `src/` or `test/`.
- `BLOCK_EDIT_DEBOUNCE_MS` (`artifactPicker/blockEditor.helpers.ts:15`) —
  exported, zero callers; its own comment admits "reserved for future
  operations; unused".
- `artifactPicker/varSetController.ts:196` —
  `ARTIFACTS.find(a => a.dir === 'Variables')?.dir ?? 'Variables'`, a lookup
  that returns its own input.

**Missing JSDoc**

- `getNonce()` (`utils/helpers.ts:1`) has no JSDoc block at all, against
  CLAUDE.md's blanket requirement.

**Toolchain**

- `pnpm test` **fails on this machine** for an environmental reason: macOS caps
  unix socket paths at 103 characters and the default
  `.vscode-test/user-data/…-main.sock` path under this repo overflows it
  (`Error: listen EINVAL`). Adding
  `launchArgs: ['--user-data-dir=/tmp/oa-vsct']` to `.vscode-test.mjs` fixes it
  and makes the full suite runnable — **verified during recon: 433 passing,
  exit 0.**
- The `vscode`-free fallback gate (mocha straight off `dist/`) is **not** usable
  here: six test files import `vscode` transitively
  (`artifact-writer`, `extension`, `temp-document`, `destFolderPicker.helpers`,
  `varset-scanner`, `selection-entry.helpers`), and the ignore list would drift
  as tests are added. The `launchArgs` fix is strictly better — full coverage,
  one line.

**Documentation drift**

- `CLAUDE.md`'s folder structure and architecture sections predate a large
  amount of shipped code. Undocumented: the entire `src/ui/panels/artifactForm/`
  tree (7 files), `commands/create.command.ts`,
  `services/artifact-serializer.service.ts`,
  `services/artifact-writer.service.ts`, `services/filename.service.ts`,
  `services/language-map.service.ts`,
  `services/artifact-type-config.service.ts`,
  `ui/panels/destFolderPicker.panel.ts`,
  `artifactPicker/blockEditor.ts` + `.helpers.ts`,
  `ui/panels/varsetPicker.panel.ts`, `types/artifact-form.types.ts`. The
  documented picker "four parts" is now six. Fed to
  [`claude-md-rewrite.md`](claude-md-rewrite.md).

### Rule learned (CLAUDE.md candidates)

- **A comment asserting an invariant is not an invariant.**
  `artifact-type-config.service.ts:8-11` claims exclusive access to `ARTIFACTS`;
  six call sites disagree. Invariants that matter get a **test**, not a
  sentence. (Same shape as `constants.ts:80-82`'s "keep the two directions
  consistent" — which also drifted.)
- **Any list that enumerates a domain set must be derived from the registry or
  guarded by a drift test.** `VALID_TYPES` vs `ARTIFACTS` is the live example,
  and its failure mode is silent (falls back to `'snippet'`), not loud.
- **A helper that cannot be imported still must not be copy-pasted.** Webview
  client JS cannot import TS helpers — the answer is one shared exported
  snippet string (as `CODE_BLOCK_CLIENT_JS` already demonstrates), not a fourth
  hand-written `esc`.
- **One writer per on-disk format.** A second hand-rolled emitter is how a
  format spec and its implementation silently diverge.
- **`pnpm test` needs a short `--user-data-dir` on macOS** when the repo path is
  deep. Worth stating in CLAUDE.md's Commands section so the next agent does
  not conclude the suite is broken and fall back to a partial gate.

### Baseline metrics

| Metric | Value |
|---|---|
| Gate | `pnpm test` (after the T1 `launchArgs` fix) |
| Tests passing | **433** |
| Source files (`src/**/*.ts`) | 52 |
| Test files (`test/**/*.ts`) | 20 |
| Source lines (TS, `src/`) | ~6,300 |
| Test lines (TS) | ~5,600 |
| CSS lines | 953 (single file) |
| Files over CLAUDE.md's ~400-line soft limit | 4 — `preview.ts` (595), `form.clientJs.ts` (543), `styles.css` (953), `test/artifact-patcher.test.ts` (738) |
| Distinct duplicate helper definitions | 8 (D1-D8) |
| Distinct drifting table pairs | 3 (R1-R3) |
| `ARTIFACTS.find` sites outside its accessor service | 6 |
| `getConfiguration('obsidianArtifacts')` sites | 10 |
| Confirmed-dead exports | 2 (+1 no-op expression) |

---

## Phase 1 — Shared pure helpers (escHtml · slug · VK_TOKEN_RE)

### Discovered

- **The plan undercounted `escHtml`: there were three TS copies, not two.** A
  private third lived at `services/render.service.ts:15` and escaped only
  **four** characters — it omitted `'`. Unifying on the 5-character version is
  strictly safer (output is now also safe inside single-quoted attributes) and
  changed no test, because the only path using it is the non-highlighted
  fallback (hljs escapes its own output).
- **`Math.random()` was generating CSP nonces** (`utils/helpers.ts`, flagged
  S2245 while adding the missing JSDoc). A nonce is the only thing between an
  injected `<script>` and execution; a predictable sequence defeats the policy.
  Switched to `node:crypto`'s `randomInt` — same alphabet, same length, so no
  caller or test shifted. **This was not in the plan** — it surfaced only
  because the phase touched the file.
- **`render.service.ts` has a misplaced JSDoc block** (lines ~73-98): the block
  documenting `renderCodeHtml` sits above `renderCodeRowsHtml`'s own block, and
  `renderCodeHtml` itself (line 123) has **no** JSDoc. Not fixed here — it is
  not a P1 concern and the phase was already touching enough. **Assigned to
  Phase 6**, which owns render-path cleanup.
- The two slug copies were not quite identical: `varSetController`'s returned
  `'untitled-variable-set'` for empty input while `filename.service.slugify`
  returns `''`. The fallback moved to the **call site**, where it belongs — a
  shared function should not carry one caller's default.

### Changed

- New `src/utils/html.ts` — the single `escHtml`. Deleted the copies in
  `artifactPicker/preview.helpers.ts`, `artifactForm/form.helpers.ts`, and
  `services/render.service.ts`; re-pointed all five importers.
- Deleted `blockEditor.helpers.slug` and `varSetController`'s private
  `slugify`; both callers now use `services/filename.service.slugify`.
- `VK_TOKEN_RE` exported once from `parser.service.ts`; `render.service.ts`
  imports it. Documented the `/g` `lastIndex` hazard on the export.
- `getNonce` — added JSDoc and moved to a CSPRNG.
- Fixed an S7781 warning (`split().join()` → `replaceAll`) in
  `preview.helpers.labelForVar` while in the file.

### Improved (metrics)

| Metric | Before | After |
|---|---|---|
| Tests passing | 433 | **447** |
| `escHtml` definitions in TS | 3 | 1 |
| Slug function definitions | 3 | 1 |
| `VK_TOKEN_RE` declarations | 2 | 1 |
| `Math.random()` in security paths | 1 | 0 |

Test delta: −4 (the `slug` suite, deleted with the code it covered), +6
(relocated to `filename.service.test.ts`, covering the surviving function,
including the two empty-input contracts), +12 (new `test/utils-html.test.ts`).
**No coverage was lost** — the four deleted cases are reproduced verbatim
against `slugify`.

### Rule learned

- **Grep for the *body*, not just the exported name.** The third `escHtml` was
  private, differently named internally, and had a different character set —
  a name-based inventory missed it. Recon greps should match the implementation
  shape (`replaceAll('&'`, `&amp;`) as well as the identifier.
- **Merging near-duplicate helpers surfaces behaviour differences that must be
  decided, not averaged.** Two of the three merges here differed (4-char vs
  5-char escaping; empty-slug fallback). Each needed an explicit call, and the
  differing default belonged at the call site, not in the shared function.
- **Touching a file invites its own audit.** The nonce weakness had nothing to
  do with DRY; it was found because the phase opened the file for a JSDoc fix.
  Worth keeping the reviewer step (inner loop #3) pointed at the *whole*
  changed file, not just the changed lines.

---

## Phase 2 — One artifact-type accessor

### Discovered

- **The six call sites were not equivalent, and collapsing them blindly would
  have changed behaviour.** Three fell into two distinct trust classes:
  - `panel.ts:107,200,210` and `create.command.ts:68` take `opts.type` /
    `getCreateFormTypes()` output — **always** valid by construction. Their
    `?? 'block'` / `?? 'artifact'` / `if (!entry) return []` fallbacks were
    unreachable defensive code, now removed.
  - `panel.ts:249` takes `model.type` **from a webview message** — a genuine
    trust boundary — and converts a miss into a user-facing
    `'Unknown artifact type.'` save error. Replacing that with a bare throwing
    `getEntry` would have turned a handled error into an unhandled rejection in
    an async message handler, with nothing shown to the user. It keeps a
    `try/catch` that preserves the exact prior behaviour.
- `varSetController`'s no-op (`ARTIFACTS.find(a => a.dir === 'Variables')?.dir
  ?? 'Variables'`) confirmed dead as described and deleted.
- Added `getAllTypes()` rather than importing `ARTIFACTS` into
  `parser.service.ts` directly — keeps constants access inside the one accessor
  module and gives the drift test something to assert against.

### Changed

- `findEntry` → exported `getEntry`; it is now the only by-type traversal of
  `ARTIFACTS` in `src/` (verified by grep, and its JSDoc no longer claims an
  exclusivity it does not have — the claim is now enforced by tests).
- Deleted `artifact-writer.findBaseDir` (a character-identical duplicate,
  including its error string).
- `panel.ts:200,210` now use `getTypeSingular`.
- `VALID_TYPES` derived via `getAllTypes()`.

### Improved (metrics)

| Metric | Before | After |
|---|---|---|
| Tests passing | 447 | **456** |
| `ARTIFACTS.find` sites outside the accessor | 6 | **0** |
| Modules importing `ARTIFACTS` | 9 | 5 (all whole-array iteration, no by-type lookup) |
| Hardcoded artifact-type lists | 2 | 1 (`ARTIFACTS` itself) |

### Verification beyond the gate

**The drift guard was proven to fail.** A guard test that cannot fail is
worthless, so `VALID_TYPES` was temporarily reverted to a hardcoded list
omitting `variables`, and the new suite was run: it failed with
`parser rejected declared type 'variables' and fell back to 'snippet'` — the
exact silent bug R1 described. The derived version was then restored and the
full gate re-run green. **Later phases should do the same for any guard test
they add.**

### Rule learned

- **A duplicated call site is not automatically a duplicate.** Six textually
  identical `ARTIFACTS.find` calls sat in three different correctness contexts
  (guaranteed-valid, untrusted-input, and dead). DRY collapses the *lookup*, not
  the *error handling around it* — the trust boundary keeps its own guard.
- **Prove the guard fails.** Reintroduce the exact bug, watch the new test go
  red, then restore. Cheap, and the only thing that distinguishes a real drift
  guard from a decorative one.

<!-- one entry appended per phase as the run proceeds -->
