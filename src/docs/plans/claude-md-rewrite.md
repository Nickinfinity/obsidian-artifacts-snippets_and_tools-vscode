# CLAUDE.md Rewrite — post-`services-dry` follow-up

**Runs AFTER `refactoring/services-dry` merges into `main`.** Consumes
[`services-dry-findings.md`](services-dry-findings.md). **Its own branch
(`docs/claude-md-rewrite`) and its own PR** — never folded into the refactor PR,
because a refactor diff and a doc rewrite reviewed together get one skimmed
review instead of two real ones.

Same delivery protocol as the refactor: commit and push automatically; **do not
open the PR** until the user asks.

## Goal

Fold the post-refactor structure and the findings log's *Rule learned* entries
into `CLAUDE.md`; delete guidance the refactor made obsolete; keep the file at
or below its current size. It is currently the single richest source of truth
for this repo — the risk is it growing into an unreadable changelog, so every
addition must be paid for by a deletion or a merge.

## Preconditions

1. `services-dry` is merged into `main`; you are on a fresh branch off `main`.
2. `rm -rf dist && pnpm test` is green — the doc describes a working tree.
3. `services-dry-findings.md` has an entry for **every** phase, P0 through
   Finalize. If a phase is missing its entry, the knowledge was never captured;
   reconstruct it from `git log` before writing.

## Sections of CLAUDE.md to touch

| Section | Change |
|---|---|
| **Commands** | Add the `pnpm test` macOS caveat (short `--user-data-dir`; the default socket path exceeds the 103-char cap under deep repo paths) so the next agent does not conclude the suite is broken and silently fall back to a partial gate. State the clean-rebuild rule (`rm -rf dist` after any delete/rename) as a first-class command, not a footnote. |
| **Folder Structure** | Regenerate from the merged tree. The current listing predates a large amount of shipped code — missing entirely: the whole `src/ui/panels/artifactForm/` tree, `commands/create.command.ts`, `services/{artifact-serializer,artifact-writer,filename,language-map,artifact-type-config}.service.ts`, `ui/panels/destFolderPicker.panel.ts`, `artifactPicker/blockEditor.ts` + `.helpers.ts`, `ui/panels/varsetPicker.panel.ts`, `types/artifact-form.types.ts` — plus whatever P1/P3/P6/P8 added (`utils/html.ts`, `services/config.service.ts`, `artifactPicker/preview.render.ts`, `preview.clientJs.ts`, the split CSS files). |
| **Architecture → Artifact picker** | The documented "four parts" is now six (`blockEditor` and `varSetController` joined; P6 adds `preview.render` + `preview.clientJs`). Update the parts table and the controller-composition description. |
| **Architecture (new subsection)** | Document the single-source-of-truth accessors the refactor established: `artifact-type-config.service.ts` as the **only** reader of `ARTIFACTS`; `config.service.ts` as the **only** reader of the `obsidianArtifacts` config section; `serializeArtifact` as the **only** `.md` emitter; `utils/html.ts` as the only `escHtml`; `filename.service.ts` as the only slug. State each as a rule with its guard test named. |
| **Code Style → file complexity limits** | The worked example still cites the original 1182-line picker split. Add the `preview.ts` split as a second, smaller worked example — it shows the renderer / client-JS / controller seam, which is the shape most likely to recur in this repo. |
| **Code Style (new rule)** | *An invariant stated in a comment is not an invariant.* Cite the two live failures the refactor found (`artifact-type-config.service.ts`'s false exclusivity claim; `constants.ts`'s "keep the two directions consistent" note that had already drifted). Rule: any cross-file invariant gets a test, and the comment names the test. |
| **Code Style (new rule)** | *Any list enumerating a domain set is derived from the registry or guarded by a drift test.* Cite `VALID_TYPES` vs `ARTIFACTS` — failure mode was silent, not loud. |
| **Code Style (new rule)** | *Webview client JS cannot import — so it gets one shared exported snippet string, never a copy-paste.* Cite `CODE_BLOCK_CLIENT_JS` as the pattern and the P6 shared `esc`/`lbl` snippet as its second instance. |
| **Vault File Format** | Verify the pointer to `ARTIFACT_FILE_FORMAT.md` still reads correctly after P5. If P5 took the sanctioned exception and changed emitted bytes, confirm `ARTIFACT_FILE_FORMAT.md` §6 was updated in that same commit and that CLAUDE.md's summary does not contradict it. |
| **Variable Sets** | Update the save-as-flow description — it currently implies a bespoke file builder; after P5 it routes through `serializeArtifact`. |
| **Delete** | Any guidance describing a structure the refactor removed (the hand-rolled var-set writer, the duplicate-helper locations, the single monolithic `styles.css`). Do not leave both the old and new description standing. |

## Method

1. Read `services-dry-findings.md` end to end first. Every *Rule learned* entry
   either lands in CLAUDE.md as a rule, or is dropped with a one-line reason
   recorded in this plan's completion note. Nothing is silently skipped.
2. Regenerate the folder structure from the actual tree
   (`find src test -type f | sort`), not from memory or from the old listing.
3. **Every addition is paid for.** Before adding a paragraph, find one to delete
   or merge. If the file grows net-positive by more than ~10%, you are logging
   history instead of writing guidance — cut back.
4. Prefer a rule with a `file:line` citation over a prose explanation. The
   existing file's best sections are the terse ones.
5. Verify each claim you write. A doc that describes code that no longer exists
   is worse than no doc — that is exactly the debt this plan is paying off.

## Done-when

- CLAUDE.md's folder structure matches `find src test -type f` exactly.
- Every *Rule learned* entry is either in CLAUDE.md or explicitly dropped with a
  reason.
- No section describes a structure the refactor removed.
- File size is within ~10% of its pre-rewrite length.
- `rm -rf dist && pnpm test` still green (the rewrite touches no code — if the
  count moved, something else is wrong; stop and investigate).
- Branch pushed. **PR drafted but not opened** — wait for the user.
