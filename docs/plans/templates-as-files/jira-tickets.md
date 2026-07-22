# Templates as whole files — Jira ticket specs

Derived from [`plan.md`](plan.md), which is the authority. Written in creation order.

The Atlassian connector is **not authorized in this session**, so this file *is* the deliverable —
tickets get created in one pass afterwards. `<KEY>` placeholders are filled after creation and
are never fabricated.

Existing keys in this repo run `VSX-*` (latest seen: `VSX-121`). New keys continue that sequence.

---

## Epic — `<KEY>` · Templates as whole files

**Summary:** Retarget the `template` artifact type from cursor-insert to whole-file creation.

**Description:**
A Template is a whole file, not a fragment. Invoking one from the Explorer writes its single code
block to disk as a real file, with `<VK-xxx>` variables resolved as they are for every other
artifact. The file extension comes from the fence language, overridable by an `extension:`
frontmatter key, overridable again by whatever the user types at the prompt.

`type: 'template'` already exists and currently behaves as a snippet. This epic retargets it.

**Breaking change:** Templates leave the editor context menu. "Insert Templates" becomes
"New File from Template" and appears only in the Explorer.

**Acceptance criteria:**
- Right-clicking a folder in the Explorer offers *New File from Template*.
- Choosing a template, filling its variables, and confirming a filename writes a real file to that
  folder and opens it.
- The extension resolves per the D3 chain (typed → `extension:` → fence).
- A multi-block Template file is rejected with a message naming the block count.
- Templates no longer appear in the editor context menu.
- Templates can be authored through the in-extension create form.

**Estimate:** 5 waves · ~15 tasks.

---

## Story — `<KEY>` · Wave 0: shared-authority prep

**Parent:** Epic `<KEY>`

**Summary:** Move the language helpers into a service; retarget the `ARTIFACTS` template entry; add
the `extension` type field.

**Description:** Covers plan tasks **O1, O2, O3**. All three are orchestrator-owned edits to shared
authorities that later waves import — a worker touching them mid-wave collides with everything
downstream.

`normalizeLangId`, `resolveLangId`, and `extForLang` are already pure and `vscode`-free; this is a
mechanical relocation out of `artifactPicker/blockEditor.helpers.ts` into
`services/language-map.service.ts`, not a decoupling exercise.

**Acceptance criteria:**
- The three helpers are exported from `language-map.service.ts` and imported from there by
  `blockEditor.ts`.
- Test count does not drop — block-edit assertions move, they do not disappear.
- `ARTIFACTS.template` is `contexts: ['explorer']`, `createForm: true`, `form.multiBlock: false`.
- `ParsedFrontmatter.extension?: string` exists and `npx tsc --noEmit` is clean.

**Estimate:** 3 points.

---

## Story — `<KEY>` · Wave 1: extension precedence and validation (pure domain)

**Parent:** Epic `<KEY>`

**Summary:** Add the `extension` frontmatter key end to end; implement the precedence chain, the
single-block guard, and a workspace-filename validator.

**Description:** Covers plan tasks **T1, T2, T3**. No `vscode` dependency in any of them — all
three are unit-tested outright.

T1 must edit the parser and the serializer **in one task**: `test/frontmatter-keys.test.ts` binds
the two key lists in both directions, so adding the key to one side alone turns the gate red.

**Acceptance criteria:**
- `extension` appears in `STRING_FRONTMATTER_KEYS` and `FRONTMATTER_KEY_ORDER`; parse→serialize→parse
  preserves it.
- `resolveTemplateFileName` implements typed → `extension:` → fence.
- `validateTemplateBlocks` rejects `blocks.length > 1`, naming the count.
- `validateTargetFileName` permits interior dots and rejects separators, control chars, reserved
  names, and leading/trailing dots. `validateFileName` is unchanged.

**Security:** T2 and T3 are security-critical. `extension:` and the typed filename are both
path-injection vectors; hostile inputs (`../../etc/passwd`, `..\..\win.ini`, `a/b`, `x\0.js`)
**throw** rather than being sanitised, and each appears in the test table.

**Estimate:** 5 points.

---

## Story — `<KEY>` · Wave 2: destination resolution and the workspace writer

**Parent:** Epic `<KEY>`

**Summary:** Resolve the destination folder from the Explorer URI; write the file with a
containment guard.

**Description:** Covers plan tasks **T4, T5**.

Destination rule: clicked folder → inside it; clicked file → its parent; no URI (Command Palette)
→ `pickDestFolder` rooted at the workspace.

`writeArtifact` is deliberately **not** reused: it is vault-scoped by contract and auto-creates an
artifact-type base directory, which pointed at a workspace would create a stray `Templates/` folder
in the user's project. The containment helper `isWithinRoot` is shared; the writer is not.

**Acceptance criteria:**
- `classifyDestination(uri, fileType)` is pure and unit-tested.
- A destination outside the workspace root returns `{ kind: 'error' }` and performs no write.
- Collision returns `{ kind: 'collision' }` and is never silently resolved.

**Security:** T5 is security-critical and is the widest new surface in this epic — it writes
attacker-influenced bytes to attacker-influenced paths **in the user's workspace**, where every
existing artifact type writes only inside the vault. The IDE analyser performs no taint analysis,
so the reviewer's manual trace is the only check that exists here.

**Estimate:** 5 points.

---

## Story — `<KEY>` · Wave 3: preview panel and create form

**Parent:** Epic `<KEY>`

**Summary:** Template mode in the preview panel; Templates in the create form.

**Description:** Covers plan tasks **T6, T7**. Both are `vscode`-coupled and end in an F5 manual
pass — the plan names the exact click-path for each; "F5 and check it works" is not a test.

**Acceptance criteria:**
- For `type: 'template'` the primary button reads *Create File* and posts `createFile`.
- A multi-block template renders the validation error in place of the button.
- The filename prompt is prefilled from the title plus the resolved extension and validated with
  `validateTargetFileName`.
- Collision prompts Overwrite / Rename / Cancel; success opens the new file.
- Templates appear in the create-flow type picker with no multi-block button, and an optional
  `extension` input reaches frontmatter.

**Security:** T6 is security-critical — the `.md` `title` reaching the input box is untrusted, and
every value interpolated into the webview goes through `escHtml`.

**Human gate H1:** F5 Explorer flow signed off before Wave 4 opens.

**Estimate:** 8 points.

---

## Story — `<KEY>` · Wave 4: wiring, menus, and documentation

**Parent:** Epic `<KEY>`

**Summary:** Pass Explorer command arguments through; retarget the menus; update the docs.

**Description:** Covers plan tasks **O4, O5, D1, D2, D3**.

`insert.command.ts` currently discards its handler arguments, so the clicked Explorer URI never
reaches the picker. Non-template artifacts must ignore the new arguments — their behaviour does not
change.

D2 corrects a stale instruction in `CREATING_A_PLAN.md` §6, which claims the test suite cannot run
on this checkout because of the macOS 103-char socket-path limit and prescribes a direct `mocha`
invocation. `.vscode-test.mjs` now pins `--user-data-dir=/tmp/oa-vsct`, which fixed it; `npm test`
is the gate.

**Acceptance criteria:**
- The insert handler accepts `(uri?, uris?)` and forwards both; other artifact types are unaffected.
- `insert.templates` is removed from `editor/context` and the editor submenu; its title is
  *New File from Template*.
- `ARTIFACT_FILE_FORMAT.md` documents the single-block rule, the `extension` key, and the
  precedence chain, matching what shipped.
- `CREATING_A_PLAN.md` §6 states the real gate.
- CHANGELOG names the breaking change in user terms.

**Human gate H2:** breaking change and CHANGELOG wording confirmed.

**Estimate:** 3 points.

---

## Pre-PR chore — `<KEY>` · Remove `docs/` before opening the PR

**Parent:** Epic `<KEY>`

**Summary:** `git rm -r docs` as the final commit on `feature/templates`.

**Description:** `docs/` is a working artifact of this branch and does not belong on `develop` or
`main`. Anything worth keeping is promoted into `CLAUDE.md` or `ARTIFACT_FILE_FORMAT.md` **before**
the delete commit; a fact that exists only in `docs/` is lost by design.

`.gitignore` is not the mechanism — it does not stop already-tracked files from merging. The delete
commit is the mechanism.

**Acceptance criteria:**
- The PR diff contains no `docs/` path.
- Every promoted fact is in its permanent home before the delete lands.

**Estimate:** 1 point.
