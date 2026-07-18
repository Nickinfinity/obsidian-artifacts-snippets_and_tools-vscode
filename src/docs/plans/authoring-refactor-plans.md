# Meta-Plan — Authoring an Orchestrated Refactor Plan Set (VS Code extension)

**You are an agent. This document is not a plan to execute — it is instructions for
*writing* a plan set** for the VS Code extension you are currently working in. Follow it
to produce four tailored `docs/plans/*.md` files that another agent (or you, later) can
then execute phase-by-phase. Everything in ANGLE-BRACKETS or marked `[FILL]` is a slot
you replace with facts discovered from the target repo — never leave a placeholder in
the output.

The output models a real, proven set: a DRY / config-driven refactor of a `src/services`
tree. Your target's *goal* may differ (dead-code purge, layering fix, test-coverage lift,
dependency removal) — the **structure and control loop stay the same**; you re-derive the
context, phases, and gate.

---

## 0. What you will produce

| File | Role |
|---|---|
| `<slug>.md` | The plan: context, locked decisions, guiding principles, orchestration workflow, phases (task queue), verification. The single entry point. |
| `<slug>-progress.md` | Resume ledger: baseline, a `RESUME HERE` pointer, one checkbox per phase, a gate-log table (pass count + commit sha per phase). Committed and updated every phase. |
| `<slug>-findings.md` | Knowledge log: per-phase **Discovered / Changed / Improved / Rule-learned**. Captures what was *learned* (vs the ledger's *status*). |
| `claude-md-rewrite.md` | Separate follow-up plan: slim + update `CLAUDE.md` from the findings log, **after the refactor merges**. Its own PR. |

Pick `<slug>` from the refactor's domain, e.g. `services-refactor`, `ui-layering`,
`dead-code-purge`. Use it consistently across all four filenames.

**Skill stack — used twice.** Four skills matter here, and they appear at two levels:

1. **While you author the plan set (now):** invoke `Skill caveman` + `Skill ponytail` first —
   plans come out terse, and the ponytail ladder kills speculative phases before they are
   written. Use `Skill mastering-typescript` when judging TypeScript smells during recon, and
   `sonarqube:sonar-analyze` (if available) on suspect files to seed the inventory in §1.3.
2. **Inside the plans you write:** the generated `<slug>.md` must itself mandate the same
   stack for every executing agent — caveman + ponytail on every prompt,
   `mastering-typescript` on every TS edit, SonarQube in the review/remediate steps (§3) with
   the lint fallback (§4). The skeletons in §5 and the preamble in §6 carry the exact wording.

---

## 1. Recon FIRST — you cannot write the plan without these facts

Do this before writing a single plan line. The plan's quality is capped by this recon.

### Known layout — these sibling extensions share it; only the *files inside* differ

The folder structure and toolchain are the **same** across this family of VS Code
extensions. Do **not** re-discover it — treat the paths below as given and spend your recon
budget reading the *contents* of the files, which are what differ per project.

| Relative path | What lives there |
|---|---|
| `src/extension.ts` | Entry point — `activate()`/`deactivate()`, command + view registration. |
| `src/commands/` | VS Code command handlers + run/orchestration wiring (thin — wire to services). |
| `src/services/` | All domain logic. Stateful concern → `*.service.ts`; its pure functions → a `*.helpers.ts` sibling. Sub-trees group a feature (e.g. `services/<feature>/`). |
| `src/ui/panels/` · `src/ui/views/` | Webview HTML renderers + message handling / Activity-Bar view providers. |
| `src/ui/*.css` | Shared stylesheet(s); feature CSS split into its own file. |
| `src/types/constants.ts` | **The constants + config tables** (literals, option/registry data, lookup maps). |
| `src/types/*.types.ts` | Domain interfaces/types. Kept **free of `vscode` types** (adapter at the edges). |
| `src/utils/` | Pure, dependency-free cross-cutting helpers (nonce, json, html-escape, regex, time). |
| `test/` | One `*.test.ts` per source concern, `node:assert` + Mocha TDD, fixtures inline. |

Toolchain (also shared): **pnpm**; `tsconfig.json` has `rootDir: "."`, `outDir: "dist"`,
Node16 resolution (imports use explicit `.js` extensions even in `.ts`); `package.json`
`main` is `./dist/src/extension.js`; `eslint.config.mjs` enforces SonarSource `S`-rules;
`.vscode-test.mjs` looks for compiled tests at `dist/test/**/*.test.js`; **F5** launches the
Extension Development Host. So: `services`, `types`, `constants` sit exactly where they do
here — the plan you write differs only in *which files* in those folders it targets.

### Files to analyze (read these, in order, to derive the plan)

1. **`CLAUDE.md`** — the repo's stated architecture, complexity limits (e.g. "split at
   ~400 lines"), code-style + methodology, and any on-disk-format spec pointer. This is
   your richest single source.
2. **`package.json`** (`scripts`, `main`, `activationEvents`, `contributes`),
   **`tsconfig.json`**, **`eslint.config.mjs`**, **`.vscode-test.mjs`** — confirm the gate
   and out-dir shape (should match the toolchain above; note any deviation).
3. **`src/types/constants.ts` + `src/types/*.types.ts`** — the config tables and domain
   model. Drift and hardcoded-list smells surface here first.
4. **`src/services/**`** — the bulk of the domain logic; where duplication, cascades,
   god-files, and parallel/drifted subsystems concentrate. Note line counts.
5. **`src/ui/**` + `src/utils/**`** — webview renderers/providers (security surface) and
   the existing pure helpers to *reuse* rather than recreate.
6. **`test/**`** — the current suite (establishes the baseline count and what's covered);
   any on-disk-format/spec `.md` the repo names as authoritative (must stay untouched, or
   change deliberately).

### Then

1. **Establish the exact gate command and run it.** For this family:
   ```bash
   pnpm compile && pnpm lint && node node_modules/.pnpm/mocha@*/node_modules/mocha/bin/mocha.js --ui tdd "dist/test/**/*.test.js"
   ```
   If the standard `pnpm test` fails for an environmental reason (it launches a real VS
   Code instance), use the `vscode`-free path above (compiled tests straight from `dist/`).
   Record the **baseline pass count** — the whole contract rests on a gate that runs.
2. **Note the repo's file-size / complexity rules** from `CLAUDE.md` (they set the
   split thresholds your phases target).
3. **Name the refactor goal in one sentence**, then run the smell hunt below. Record every
   hit as `smell → file:line → evidence` — this inventory is the plan's raw material: each
   phase you write must cite it, and the executing agent re-greps it before cutting.
   - **God-files / god-functions** — *find:* `find src -name '*.ts' -exec wc -l {} + | sort -rn | head -20`
     against the repo's stated limits; the lint cognitive-complexity rule's hits. *Confirm:*
     a `// ── section ──` banner inside one file/function marks the natural split seam.
   - **Duplication** — *find:* grep tell-tale helper names (`escape*`, `format*`, `slugify`,
     `parse*`) and guard shapes (`JSON.parse` inside `try`) across files; grep distinctive
     literals. *Confirm:* same body in ≥2 files, or a comment admitting it "mirrors" another
     file. Name the canonical copy to keep.
   - **Drift** (the sharpest smell) — *find:* every table/union/list enumerating the same
     domain set (languages, option ids, types): grep one known member's literal, list every
     file that enumerates the set, diff memberships. *Confirm:* one table knows a member
     another lacks — record both file:line; that pair justifies a central registry. First
     check the lists truly serve one concern (§7 "one registry ≠ always right").
   - **Cross-cutting conditionals** — *find:* `grep -rn "=== '" src/services` filtered to a
     domain discriminator; `switch` on the same id in several files. *Confirm:* ≥3-way
     cascade on the same discriminator at ≥2 sites → dispatch-table candidate. A 2-way
     special-vs-default with a graceful fallback is **not** one — leave it.
   - **Buried purity** — *find:* `grep -rln "from 'vscode'" src/services`, then scan each hit
     for functions that never touch that import. *Confirm:* the function compiles with the
     import gone → extract to a `*.helpers.ts` sibling + unit test.
   - **Dead code** — *find:* grep every identifier/class name for references (TS, HTML emit,
     tests). *Confirm:* zero refs AND nothing reachable via descendant/type selectors or
     dynamic construction against what live code actually emits. A "dead"/"unused" comment is
     a claim, not proof.
   - **Re-hardcoded constants** — *find:* for each exported constant, grep its literal
     *value*; hits outside its home file are re-hardcodings. Fix = import the constant.
4. **Decide the behavior-preservation contract.** Usually: every pre-existing test keeps
   passing unmodified; pass count only grows (TDD adds tests); if the change transforms
   generated output / serialized text, that output stays **byte-identical**. Write this
   down — it governs every phase.

Record all of the above; it becomes the plan's *Context* + *Critical Files* sections **and**
the findings log's `Phase 0 — Discovery` entry (§5c) — same inventory, written once.

---

## 2. Derive the phases

A phase is **one concern, one dependency level**. Rules:

- **Phase 0 = baseline** (orchestrator, no edits): branch off the default branch, run the
  gate, record the pass count, create the ledger + findings files.
- **Middle phases**, dependency-ordered. Each phase names:
  - **Touches** — the exact files it may edit (plus their direct importers when a move
    requires it). Keep the blast radius explicit.
  - **Evidence** — the recon file:line facts (§1.3) this phase acts on. The executor
    re-greps them before cutting — the plan may be stale or simply wrong (§7).
  - **Do** — the concrete transformation.
  - **TDD** — the pure, framework-free unit(s) to cover *before* refactoring.
  - **Done-when** — the observable exit condition (e.g. "zero duplicate `X` literals;
    gate green").
  - **Depends** — prior phase(s), and whether it is **parallel-safe** (touches no file a
    concurrent phase touches — call out shared files as serialization points).
- **Final phase = finalize** (orchestrator): full gate, security/quality sweep, confirm
  the on-disk format/spec + manifest are untouched (or updated deliberately), open PR.
- Order by risk and dependency: shared foundations first (constants/registry), the
  highest-risk behavior-critical transform in the middle (with a golden lock), narrow
  extractions and cosmetic/CSS splits last.
- **Coverage check:** every recon finding lands in exactly one phase or is written into the
  plan as an explicit skip-with-reason. Nothing from the inventory is silently dropped.
- **Don't polish what a later phase deletes.** If phase N deletes a file, no earlier phase
  restyles it; a transient duplicate that deletion will remove is cheaper than churn.

Typical phase archetypes (adapt to what recon found — you will not have all of these):
shared utils/constants moves · a central config **registry** other tables *derive* from ·
collapsing conditional cascades into **dispatch tables** · unifying two parallel
subsystems into one · a **factory** for near-identical siblings · splitting a god-file ·
extracting buried pure helpers + relocating cross-boundary types · deleting dead assets +
splitting a feature's CSS into its own file.

---

## 3. The per-phase inner loop — the control mechanism

Every phase runs this loop, not just "edit → gate". Put it verbatim in the plan:

1. **Task (TDD-first).** Re-verify the phase's **Evidence** first (grep that the smell still
   exists as described — tree beats plan). Then, for any pure, framework-free unit: ensure a
   covering/failing test exists *before* refactoring (add one if missing); green it; then
   refactor. TS edits apply `Skill mastering-typescript` patterns.
2. **Gate #1.** Run the gate. Red → fix in place; repeat until green.
3. **Review.** Quality + security pass on the changed files: `sonarqube:sonar-analyze` per
   changed file (or the `sonarqube-reviewer` agent on the phase diff) when available — the
   repo's lint S-rules are the fallback — plus `ponytail:ponytail-review` for
   over-engineering. Hunt: a fresh duplicate, a leftover cascade, a function over the
   size/complexity limit, missing/stale JSDoc, a dead branch, a needless scan.
4. **Remediate.** Apply the findings (`sonarqube:sonar-fix-issue <rule> <file>:<line>` for a
   specific Sonar hit). Update tests + docs as needed.
5. **Gate #2 + re-review.** Loop 3–5 until clean **and** green.
6. **Record.** Append a findings entry; tick the ledger (pass count + commit sha);
   **commit** (Conventional Commits); advance.

---

## 4. Guardrails to bake into the plan (state them as acceptance criteria)

- **DRY / KISS / DOTW** — one source of truth; simplest thing that works; one file/one
  concern, one function/one job. No abstraction without a second concrete caller *today*.
- **Behavior invariant** — the contract from §1.4. The gate's pass count **never drops**
  below the previous phase's, with **one** sanctioned exception: deleting tests that cover
  **deleted code** — allowed only when done *loudly* (commit + findings) and any live
  coverage is relocated. A silent drop is a defect.
- **Security (if the extension shells out / renders webviews / touches the filesystem)** —
  do not widen the attack surface: keep `child_process` on **argument arrays** (never
  interpolate a user path into a shell string); no path traversal (route names through
  the existing slug/join helpers); keep webview output escaped under the existing CSP +
  nonce, and `localResourceRoots` unchanged; parse untrusted input (config, JSON,
  buffers) through a guarded parser (no unchecked casts); no secrets in output.
- **Tooling (the skill stack — name it verbatim in the plan)** — every executing agent runs
  under `Skill caveman` (terse output) + `Skill ponytail` (reuse before writing, shortest
  working diff, delete over add, no speculative abstraction); every TypeScript edit also
  invokes `Skill mastering-typescript`; every phase's changed files get a **SonarQube** pass
  (`sonarqube:sonar-analyze`, Blocker/Critical cleared before the phase closes). State the
  one-time Sonar prerequisite (`/sonarqube:sonar-integrate`, `sonar auth login`, a container
  runtime) **and** the fallback: if Sonar is unavailable, the gate's lint already enforces
  the SonarSource S-rules — proceed and note the skip in the findings log.
- **JSDoc / comments** — every function/interface added or changed keeps a full JSDoc
  block (description, `@param`, `@returns`, `@example`); comments explain *why*.

---

## 5. File skeletons — copy, then fill every `[FILL]`

### 5a. `<slug>.md` (the plan)

```markdown
# <Title> — Orchestrated Refactor

## Plan Files — start here (run only this one)
| File | Role | Driven by this plan |
|---|---|---|
| **`<slug>.md`** (this) | Plan + phase queue. | You run this. |
| **`<slug>-progress.md`** | Resume ledger. | Ticked + committed every phase. |
| **`<slug>-findings.md`** | Knowledge log. | Appended every phase. |
| **`claude-md-rewrite.md`** | Slim CLAUDE.md. | Runs LAST, after merge. Separate PR. |

## Context
[FILL: the tree's size, the goal in one sentence, and the recon §1.3 smell inventory —
every duplication/drift/god-file/cascade named with file:line. This is the evidence the
phases cite; a smell without a file:line is a guess, not a finding.]

**Decisions locked:** [FILL: the 2–5 structural choices, e.g. "central REGISTRY other
tables derive from", "dispatch tables replace cascades", "delete parallel subsystem X".]

**Invariant (non-negotiable):** [FILL: the behavior-preservation contract from §1.4.]

## Guiding Principles
[FILL: paste §4, tuned to this repo — DRY/KISS/DOTW, behavior invariant, security (only if
it applies), the skill stack (caveman + ponytail + mastering-typescript + SonarQube with the
lint fallback), JSDoc.]

## Orchestration Workflow
[FILL: choose execution model — a single agent working inline, OR an orchestrator that
dispatches per-phase subagents. Either way, paste the per-phase inner loop from §3 and the
skill-stack mandate from §4 — every agent prompt names the skills to invoke.]

## Reuse Before Writing (existing assets — do not re-implement)
| Asset | Path | Use as |
|---|---|---|
[FILL: every helper/const/type/pattern the refactor should reuse instead of recreating.
Include "model" patterns to imitate, not just literal reuses.]

## The Gate
```
[FILL: exact compile + lint + test command, verified to run. Note the clean-rebuild caveat
from §7 if the out dir is not auto-cleaned.]
```
Green = zero failures and pass count ≥ the previous gate's. Baseline: [FILL: N].

## Phases
### Phase 0 — Baseline (orchestrator, no edits)
[FILL]
### Phase 1..N — <concern>
- **Touches:** [FILL]  **Depends:** [FILL] (parallel-safe? [FILL])
- **Evidence:** [FILL: recon file:line facts — executor re-greps these before cutting]
- **Do:** [FILL]
- **TDD:** [FILL]
- **Done-when:** [FILL]
### Phase N+1 — Finalize (orchestrator)
Full gate; quality/security sweep; confirm on-disk format/manifest untouched; open PR.

## Critical Files
[FILL: table of concern → files, from the §1 Known layout + the files you analyzed.]

## Verification
[FILL: gate after every phase; golden/byte-identical checks where output is generated;
end-to-end manual pass (how to launch the extension — e.g. F5); a "new-<thing> smoke test"
proving the goal (adding a <thing> is now N files, not M).]

## Progress Tracking & Resume
Ledger `<slug>-progress.md` is the committed source of truth; findings log
`<slug>-findings.md` is the knowledge; `memory/` mirror (if the harness has one) is the
one-line status. To resume: read the ledger's `RESUME HERE`, verify branch + git log,
re-run the gate to confirm the count, dispatch the next unchecked phase.
```

### 5b. `<slug>-progress.md` (ledger)

```markdown
# <Title> — Progress Ledger

**Baseline: [FILL N] passing, compile + lint clean.** Every gate: zero failures, count
never below baseline (deleted-code test removals excepted — see the plan). [FILL: byte-
identical clause if relevant.] **Always clean-rebuild the out dir before gating after any
file delete/rename** (see plan §7).

> **RESUME HERE:** [FILL: next unchecked phase + how to resume.]

- [ ] **P0 Baseline** — [FILL]
- [ ] **P1** <concern> — [FILL depends]
- [ ] ...
- [ ] **Finalize** — sweep + PR

Gate log:
| Phase | Result | Pass count | Commit |
|---|---|---|---|
| P0 | baseline | [FILL] | — |

**Gotcha:** [FILL: shared-file pairs derived from the phases' Touches lists — phases that
touch the same file run serially, never concurrent.]
```

### 5c. `<slug>-findings.md` (knowledge log)

```markdown
# <Title> — Findings Log

Appended each phase (inner-loop step 6): **Discovered / Changed / Improved (metrics) /
Rule-learned**. Primary input to `claude-md-rewrite.md`.

## Phase 0 — Discovery
**Discovered:** [FILL: the duplication/drift/god-files inventory with file:line.]
**Rule learned:** [FILL: CLAUDE.md-candidate rules surfaced during recon.]
**Baseline metrics:** [FILL: line counts, file counts, test count.]

<!-- one entry appended per phase as the run proceeds -->
```

### 5d. `claude-md-rewrite.md` (follow-up)

```markdown
# CLAUDE.md Rewrite — post-<slug> follow-up

Runs AFTER `<slug>` merges. Consumes `<slug>-findings.md`. Separate PR.
Goal: fold the new structure + the Rule-learned entries into CLAUDE.md; delete guidance
the refactor made obsolete; keep it under the repo's size norm. [FILL: sections of
CLAUDE.md to touch.]
```

---

## 6. If the plan uses subagents (optional execution model)

If the target work is large enough to dispatch per-phase subagents, add a **Subagent Task
Queue** to `<slug>.md`: one dispatch spec per phase (agent type, touches, evidence, do,
done-when) plus a **standard preamble** prepended to every spec that states: the skill stack
("First invoke `Skill ponytail` and `Skill caveman`; for any TypeScript edit also invoke
`Skill mastering-typescript`; expect a SonarQube pass on your changed files — clear
Blocker/Critical findings"), the guardrails (§4), the behavior invariant, TDD/JSDoc
requirements, "only touch the named files", and the exact gate command. Dispatch serially by default; run parallel-safe phases concurrently only when
they share no file. **Note in the plan:** subagents start cold and re-derive context — for a
small/medium refactor, inline execution by one agent is cheaper and tighter. Only reach for
subagents when a phase is genuinely wide and self-contained.

---

## 7. Lessons to embed (hard-won from executing the exemplar — keep these)

These are the traps that actually bit during a real run. Bake the relevant ones into the
plan's principles or the phase notes:

- **Trust the tree over the ledger — and over the plan.** A resume ledger can be stale (the
  exemplar found a whole phase already landed that its ledger called "not started"), and the
  plan itself can be wrong (it marked live CSS dead; a descendant selector kept it working).
  Before dispatching a phase, re-run the gate and re-grep the phase's Evidence.
- **Clean-rebuild before gating after any delete/rename.** `tsc` (and similar) do **not**
  remove orphaned output files — a deleted test's stale compiled artifact keeps running and
  **inflates the pass count** (a phantom green). `rm -rf <outdir>` before the gate whenever
  a file was deleted or renamed.
- **Golden-lock before transforming generated output.** If a phase rewrites code that emits
  source / serialized text, first capture the *current* output as byte-exact snapshot tests,
  gate them green, and **never edit the snapshots during the refactor** — them passing
  unchanged *is* the byte-identical proof.
- **One registry ≠ always right.** "Derive everything from one config map" over-reaches when
  concerns genuinely differ (e.g. a value is *mappable* but not *runnable*; a broad cosmetic
  table vs a narrow capability set). Prefer two correctly-keyed tables over one lossy merge;
  guard against drift with a consistency test instead of forcing a merge.
- **"Dead" is a claim to verify, not a label to trust.** A block commented as dead can be
  live via a descendant/type selector or a shared base class. Verify by (a) grepping every
  identifier for references AND (b) checking against what the live code actually emits; prove
  a split loss-free with a before/after diff of the exposed surface (e.g. CSS selectors).
- **Skip speculative splits.** Extracting a one-liner into its own module + test is
  over-engineering when no second caller needs it and every current caller wants the
  combined behavior. Note the skip and why.
- **Size targets yield to cohesion.** A split that lands slightly over the plan's line
  target is fine when it is one cohesive concern under the repo's hard limits; fragmenting
  one concern across two files just to hit a number reads worse. Record the deviation loudly.
- **A new test that contradicts a green suite is usually wrong.** When a fresh
  characterization test fails against behavior the existing suite locks (e.g. exact vs
  trimmed bounds), suspect the new test's assumption before the code — the unchanged
  existing suite is the authority on current behavior.
- **Deleting tests for deleted code is legitimate** — loudly (commit + findings), with live
  coverage relocated. Never silently.
- **Prove behavior preservation; don't assume it.** Golden tests, surface diffs, and the
  *unchanged* existing suite passing are the proof. State the proof in each phase's record.
- **Record the count honestly**, including justified drops, so `RESUME HERE` never lies.

---

## 8. Before you finish

- Every `[FILL]` / angle-bracket is replaced with a real fact from the target repo.
- The gate command is copy-pasteable and you have *run it* (baseline recorded).
- Phases are dependency-ordered; parallel-safe ones are flagged; shared files are called out.
- Every recon finding is assigned to exactly one phase or recorded as a skip-with-reason.
- Every phase carries **Evidence** (file:line) the executor can re-verify by grep.
- The plan mandates the skill stack (caveman + ponytail + mastering-typescript + SonarQube
  with the lint fallback) in its principles and in every agent prompt/preamble.
- The behavior-preservation contract is explicit and testable.
- All four files exist and cross-reference each other by name.
- Security guardrails are present **only** if the extension's surface warrants them (don't
  bolt on irrelevant boilerplate).
