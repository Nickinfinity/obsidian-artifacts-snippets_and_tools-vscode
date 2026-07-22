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
| Baseline test count | _pending — fill from the pre-flight gate run, do not guess_ |
| Baseline gate | _pending_ |

---

## Tasks

| Task | Wave | Owner | Status | Test count | Gate | Review rounds | Notes |
|------|------|-------|--------|-----------|------|---------------|-------|
| O1 | 0 | orchestrator | todo | — | — | n/a | Move lang helpers → `language-map.service.ts`. Count must not drop. |
| O2 | 0 | orchestrator | todo | — | — | n/a | `ARTIFACTS.template` → explorer-only, `createForm`, `multiBlock: false` |
| O3 | 0 | orchestrator | todo | — | — | n/a | `ParsedFrontmatter.extension?` — type only, `tsc` is the check |
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
| _pre-flight_ | — | _pending_ | _pending_ | Baseline before any task lands |

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
| — | — | — | — |
