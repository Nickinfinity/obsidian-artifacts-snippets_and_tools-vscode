# Services DRY Refactor — Progress Ledger

**Baseline: 433 passing, compile + lint clean.** Every gate: zero failures,
count never below baseline. The one sanctioned exception is deleting tests that
cover **deleted code** — allowed only loudly (commit body + findings log), with
live coverage relocated first. A silent drop is a defect.

**Byte-identical clause:** Phase 5 rewrites code that emits serialized `.md`
text. Its golden snapshots must pass **unchanged** — that is the proof. Phase 6
carries a render-level golden; Phase 8 carries a CSS selector diff.

**Always clean-rebuild before gating after any file delete or rename:**
`rm -rf dist && pnpm test`. `tsc` does not remove orphaned output, and a stale
compiled test keeps running and *inflates* the pass count (phantom green).

**Branch:** `refactoring/services-dry` (off `main`). Commit **and push**
automatically every phase. **Never open the PR** — Finalize prepares the body
and stops; the PR is opened only on the user's explicit request.

> **RESUME HERE:** Phase 0 — Baseline. Nothing started. Begin by cutting
> `refactoring/services-dry` from `main`, applying the `.vscode-test.mjs`
> `launchArgs` fix (T1), then `rm -rf dist && pnpm test` and confirm **433**.

- [ ] **P0 Baseline** — branch + `.vscode-test.mjs` T1 fix + gate + commit these three plan files + push
- [ ] **P1** Shared pure helpers (`escHtml` · slug · `VK_TOKEN_RE` · `getNonce` JSDoc) — depends P0
- [ ] **P2** One artifact-type accessor (`getEntry`; `VALID_TYPES` derived) — depends P1
- [ ] **P3** One config reader (`config.service.ts`) — depends P2
- [ ] **P4** Language tables: derive `MAP`, add consistency test, resolve objc drift — depends P1 (parallel-safe vs P3)
- [ ] **P5** One `.md` writer — golden-lock first — depends P1, P2, P3
- [ ] **P6** Split `preview.ts` + collapse webview `esc`/`lbl` copies — depends P1
- [ ] **P7** Dead-code purge (`escForJsTemplate`, `BLOCK_EDIT_DEBOUNCE_MS`) — depends P6
- [ ] **P8** Split `styles.css` — depends P6
- [ ] **Finalize** — full gate, sweep, manual F5 pass, draft PR body, **stop**

Gate log:

| Phase | Result | Pass count | Commit |
|---|---|---|---|
| P0 | baseline | 433 | — |

**Gotcha — shared files force serial execution.** Derived from the phases'
`Touches` lists:

| File | Phases that touch it | Consequence |
|---|---|---|
| `artifactPicker/varSetController.ts` | P1, P2, P3, P5 | Never concurrent. P5 must be last of the four. |
| `artifactForm/panel.ts` | P2, P3 | Serial. |
| `commands/create.command.ts` | P2, P3 | Serial. |
| `artifactPicker/preview.helpers.ts` | P1, P6 | Serial. |
| `artifactForm/form.helpers.ts` | P1, P4 | Serial — P4 after P1. |
| `artifactPicker/blockEditor.helpers.ts` | P1, P4, P7 | Serial. |
| `services/parser.service.ts` | P1, P2 | Serial. |
| `artifactPicker/preview.ts` | P6, and P8 via its `<link>` tags | Serial. |

Only **P3 and P4** are genuinely parallel-safe with respect to each other
(disjoint file sets), and only once P1 and P2 are both committed. Everything
else runs serially in the order listed.
