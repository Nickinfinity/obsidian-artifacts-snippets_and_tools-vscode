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

<!-- one entry appended per phase as the run proceeds -->
