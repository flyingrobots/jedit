---
title: "WF-0105 - Vim Target Usability Tests"
legend: "WF"
lane: "design"
issue: "https://github.com/flyingrobots/jedit/issues/107"
status: "target"
owners:
  - "@flyingrobots"
created: "2026-06-08"
updated: "2026-06-08"
---

# WF-0105 - Vim Target Usability Tests

## Purpose

This document defines target usability tests for common Vim workflows in
Jedit. These are user-facing end-to-end contracts, not claims that every
workflow is already automated or passing.

The target is intentionally stricter than component tests. A workflow passes
only when a user can drive the real Jedit interaction surface and the repo can
prove the result through inspectable facts such as screen state, mode state,
Echo-hosted production text evidence, filesystem contents, or process exit
status.

The workflows extend the Vim command-line completion surface in
[`0102-vim-command-line-completion-surface.md`](0102-vim-command-line-completion-surface.md)
and should become part of the "powered by Echo" release-candidate bar when the
automation harness can drive the production TUI reliably.

## Test Authority

Target usability tests use this authority order:

1. User-visible Jedit behavior.
2. Echo-hosted production text session facts.
3. Filesystem facts observed outside Jedit.
4. Mode, command-line, completion, and error state facts.
5. Component or fixture specs.

Component specs can prove a renderer, parser, or provider in isolation. They
cannot by themselves prove a target usability workflow.

## Harness Contract

Every automated target test should:

- Start in a real temporary workspace directory.
- Invoke the production Jedit entrypoint from that directory.
- Drive the same keyboard interactions a user would use.
- Use the production Vim command-line surface for Vim command workflows.
- Use the production Echo-hosted text runtime, not a direct local text fallback.
- Verify saved file bytes from outside Jedit with ordinary filesystem reads.
- Record the active mode, command input, focused completion, opened file path,
  dirty state, save result, and any Echo obstruction posture.
- Fail closed when a workflow is unsupported instead of passing through a fake
  helper.

The harness may inspect structured model facts when available. Pixel or glyph
matching is acceptable only as supporting evidence for screen layout; it should
not be the only proof of text authority, save behavior, or command dispatch.

## Current Lower-Level Anchors

The target workflows are expected to compose existing proof surfaces rather
than replace them:

- `spec/workspace-command-line.spec.mjs`
- `spec/workspace-command-completion.spec.mjs`
- `spec/inline-completion-popup.spec.mjs`
- `spec/workspace-text-cutover.spec.mjs`
- `spec/production-text-session-witness.spec.mjs`
- `scripts/jedit-production-text-session.mjs`
- `scripts/jedit-echo-release-gate.mjs`

Those anchors prove important slices of the product. The missing bar is a
human-shaped, full-session witness that starts from `jedit`, performs a common
Vim workflow, exits, and verifies disk output.

## Workflow I - Open, Edit, Save, Quit

User:

A developer working on source code.

Setup:

```sh
workspace="$(mktemp -d)"
printf 'before\n' > "$workspace/example.txt"
cd "$workspace"
```

Task:

1. Run `jedit`.
2. Arrive at the Jedit title screen for the current working directory.
3. Press `:` and see the Vim command-line completion UX appear.
4. Type `edit`.
5. Press Enter or Tab to accept the highlighted `edit` command completion.
6. Observe that command mode remains active with `:edit` followed by a space in
   the command line and file completions visible.
7. Type `exam`.
8. Observe the file-completion list narrow to `example.txt`.
9. Press Tab to accept the highlighted `example.txt` completion, leaving
   `:edit example.txt` in the command line.
10. Press Enter to dispatch `:edit example.txt`.
11. Observe that Jedit opens the file and displays its contents.
12. Use Normal-mode Vim navigation commands such as `G`, `gg`, and `0`, ending
    with the cursor on the first byte of the file.
13. Press `i` to enter Insert mode at the first byte.
14. Type the payload below and see every character appear in the document:

    ```text
    abcdefghijklmnopqrwstuvwxyz12343567890!@#$%^&*()_+-=[]'/\.,
    ```

15. Press Escape to return to Normal mode.
16. Press `:` to open the Vim command-line surface again.
17. Type `wq` and press Enter.
18. Observe that Jedit saves the file and exits cleanly.
19. Run `cat example.txt`.

Expected result:

- The title screen accepts `:` even when no file is open.
- The completion popup stays anchored to the original command-line cursor
  position while the user types.
- Accepting the `edit` command completion inserts `edit`, appends one command
  separator space, and switches the provider phase to file completions without
  leaving command mode.
- Enter and Tab can accept the highlighted completion.
- `:edit example.txt` opens the file through the production text path.
- Insert mode accepts the full punctuation-heavy payload.
- Escape leaves Insert mode without losing the typed payload.
- `:wq` saves through the production save path and exits.
- `cat example.txt` exactly matches:

  ```text
  abcdefghijklmnopqrwstuvwxyz12343567890!@#$%^&*()_+-=[]'/\.,before
  ```

  The final byte is the newline from the original file.

Required proof:

- TUI session transcript or structured event witness for the command sequence.
- Mode transition evidence: title, command line, Normal, Insert, Normal,
  command line, exited.
- Echo-hosted production text evidence for open, insert, read, save, and
  checkpoint or explicit obstruction when checkpoint evidence is not yet
  available.
- Filesystem read after exit showing byte-for-byte equality with the expected
  final file.

Current status:

Target. Lower-level command-line, completion, and production text witnesses
exist, but this exact full-session workflow should become an automated
usability witness.

## Workflow II - Open By Path, Navigate, Quit Without Save

User:

A developer inspecting a file without intending to edit it.

Setup:

```sh
workspace="$(mktemp -d)"
mkdir -p "$workspace/src"
printf 'one\ntwo\nthree\n' > "$workspace/src/readme.txt"
cd "$workspace"
```

Task:

1. Run `jedit src/readme.txt`.
2. Observe that Jedit opens the file instead of stopping at a file picker.
3. Use Normal-mode movement commands such as `j`, `k`, `h`, `l`, `gg`, and
   `G`.
4. Press `:` and type `q`.
5. Press Enter.

Expected result:

- The file argument resolves relative to the launch directory.
- Jedit displays the file in Normal mode.
- Movement commands update cursor or viewport facts without mutating text.
- `:q` exits cleanly when the buffer is not dirty.
- The file bytes are unchanged after exit.

Required proof:

- Process invocation record with the file argument.
- Opened-file evidence for `src/readme.txt`.
- Cursor or viewport movement facts.
- Filesystem read after exit matching the original file exactly.

Current status:

Target. If direct path launch is not currently implemented, the test should
fail as unsupported and feed the path-open backlog.

## Workflow III - Save Without Quitting

User:

A developer incrementally saving while continuing to edit.

Setup:

```sh
workspace="$(mktemp -d)"
printf 'alpha\n' > "$workspace/notes.txt"
cd "$workspace"
```

Task:

1. Run `jedit`.
2. Use `:edit notes.txt` to open the file.
3. Enter Insert mode with `i`.
4. Type one leading space followed by `beta`.
5. Press Escape.
6. Press `:` and type `write`.
7. Press Enter.
8. Continue editing in the still-open Jedit session.
9. Inspect `notes.txt` from outside the process if the harness supports a
   concurrent filesystem read, or exit with `:q` and then read the file.

Expected result:

- `:write` and `:w` both save the active file.
- The command leaves Jedit open.
- Dirty state clears after a successful save.
- The active buffer remains focused in Normal mode.
- The saved file includes a leading space followed by `beta`.

Required proof:

- Command dispatch evidence for canonical `write` or alias `w`.
- Dirty-state transition from dirty to clean.
- Filesystem read showing the saved material.
- Evidence that Jedit remained running immediately after save.

Current status:

Partially covered by lower-level command dispatch and production save tests.
The full user workflow remains a target witness.

## Workflow IV - Insert, Delete, Change, Save

User:

A developer making ordinary line and word edits.

Setup:

```sh
workspace="$(mktemp -d)"
printf 'first line\nsecond word\nthird line\n' > "$workspace/edit.txt"
cd "$workspace"
```

Task:

1. Run `jedit`.
2. Open `edit.txt` with `:edit`.
3. Use Normal-mode navigation to reach `second word`.
4. Use a Vim-shaped edit command to change text, such as `cwreplacement`.
5. Press Escape to leave Insert mode after the replacement.
6. Navigate to a different line with Normal-mode movement.
7. Use a line edit command such as `dd`.
8. Save with `:w`.
9. Quit with `:q`.

Expected result:

- Vim-shaped text commands mutate production text through Jedit's command
  planner and Echo-hosted session.
- The mode sequence is Normal, pending/change command, Insert, Normal, line
  delete, command line.
- Cursor, selection, and pending command state remain Jedit-owned UI policy.
- Save materializes the edited state to disk.
- Deleted or changed text is absent from the final file.

Required proof:

- Normal-mode command transcript.
- Echo-hosted production text receipts or equivalent app-safe evidence for the
  mutations.
- Final filesystem contents matching the expected edited text.

Current status:

Target. This workflow should stay blocked until the relevant Normal-mode Vim
operators are production-grade; it must not pass through direct fixture edits.

## Workflow V - Command Completion File Search

User:

A developer opening files by fuzzy searching from the Vim command surface.

Setup:

```sh
workspace="$(mktemp -d)"
mkdir -p "$workspace/src/app" "$workspace/docs"
printf 'component\n' > "$workspace/src/app/component.ts"
printf 'guide\n' > "$workspace/docs/guide.md"
cd "$workspace"
```

Task:

1. Run `jedit`.
2. Press `:`.
3. Type `edit`.
4. Accept the command completion.
5. Type the path prefix `src/app/comp`.
6. Observe the file-completion list narrow to `src/app/component.ts`.
7. Press Tab to accept the highlighted `src/app/component.ts` completion.
8. Observe that the command line contains `:edit src/app/component.ts`.
9. Press Enter to dispatch `:edit src/app/component.ts`.
10. Observe that Jedit opens `src/app/component.ts`.

Expected result:

- The same popup handles command completions and file completions.
- Accepting `edit` leaves command mode active and inserts `edit` followed by
  one space.
- File completions repopulate after the command is accepted.
- Enter and Tab both accept the highlighted completion.
- Accepting a file completion completes command input; the following Enter
  dispatches `:edit src/app/component.ts`.
- The suggestion list remains pinned to the original command-line anchor while
  the user types.
- The startup file picker or drawer does not consume Tab or Enter while command
  mode is active.

Required proof:

- Completion provider facts for command and file provider phases.
- Anchor coordinate evidence before and after typing.
- Accepted completion evidence for command and file items.
- Command-dispatch evidence after file-completion acceptance.
- Opened-file evidence for `src/app/component.ts`.

Current status:

Partially covered by command-completion specs. Full end-to-end title-screen
file search remains a target witness.

## Workflow VI - Invalid Command Feedback And Recovery

User:

A developer who mistypes a command and needs actionable feedback.

Setup:

```sh
workspace="$(mktemp -d)"
printf 'content\n' > "$workspace/file.txt"
cd "$workspace"
```

Task:

1. Run `jedit`.
2. Press `:`.
3. Type `exi`.
4. Observe inline invalid-command feedback.
5. Correct the command to `edit file.txt`, or press Escape and start over.
6. Open the file successfully.

Expected result:

- Unknown command fragments use the theme error or warning token.
- The command surface shows a readable hint such as
  `Command not recognized; type :help for help`.
- Invalid feedback is visible on the title screen and in an open editor.
- The invalid state does not trap the user.
- Correcting or cancelling the command restores normal completion behavior.

Required proof:

- Command parse state with invalid-command posture.
- Render or model evidence for error styling and help text.
- Follow-up successful `:edit` evidence in the same session.

Current status:

Partially covered by lower-level invalid-command specs. The title-screen
visibility regression should be covered by an end-to-end target witness.

## Workflow VII - Dirty Quit Obstruction

User:

A developer who tries to quit after making unsaved changes.

Setup:

```sh
workspace="$(mktemp -d)"
printf 'draft\n' > "$workspace/draft.txt"
cd "$workspace"
```

Task:

1. Run `jedit`.
2. Open `draft.txt` with `:edit`.
3. Enter Insert mode and type one leading space followed by `unsaved`.
4. Press Escape.
5. Run `:q`.
6. Observe a clear dirty-buffer obstruction.
7. Run `:wq`.

Expected result:

- `:q` refuses to exit when the active file is dirty.
- The obstruction names the dirty file or active buffer.
- The user can recover by saving, cancelling, or using an explicit future
  force-quit command if one is intentionally supported.
- `:wq` saves and exits.
- Final disk contents include a leading space followed by `unsaved`.

Required proof:

- Dirty-state evidence before `:q`.
- Obstruction evidence for failed quit.
- Successful save and exit evidence for `:wq`.
- Filesystem read after exit.

Current status:

Target.

## Workflow VIII - Unsupported File Is Honest

User:

A developer accidentally opening a binary or unsupported file.

Setup:

```sh
workspace="$(mktemp -d)"
printf '\000\001\002' > "$workspace/blob.bin"
cd "$workspace"
```

Task:

1. Run `jedit`.
2. Use `:edit blob.bin`.
3. Observe an honest unsupported or read-only posture.
4. Press `i` to attempt Insert mode.
5. Type `abc`.
6. Observe that Jedit refuses mutation through a read-only or unsupported-file
   obstruction.
7. Press Escape if the command surface requires an explicit return to Normal
   mode.
8. Quit.
9. Read `blob.bin` from disk.

Expected result:

- Jedit does not pretend binary bytes are safely editable text.
- Unsupported text materialization is surfaced as an obstruction.
- The explicit Insert-mode typing attempt cannot corrupt the file.
- The original bytes remain unchanged after quit.

Required proof:

- File-open obstruction or read-only posture.
- Input transcript for the `iabc` typing attempt and the resulting obstruction.
- No production text mutation receipts for the unsupported file.
- Byte-for-byte filesystem comparison after exit.

Current status:

Target.

## Workflow IX - Restart Recovery

User:

A developer expecting recent Echo-backed editing history to survive process
restart.

Setup:

```sh
workspace="$(mktemp -d)"
printf 'seed\n' > "$workspace/recover.txt"
cd "$workspace"
```

Task:

1. Run `jedit`.
2. Open `recover.txt`.
3. Insert one leading space followed by `durable`.
4. Save or checkpoint according to the current product rule.
5. Exit or terminate the process at a documented recovery point.
6. Run `jedit` again in the same workspace.
7. Observe recovered Echo-backed history or a typed obstruction that explains
   why recovery is unavailable.

Expected result:

- Recovered state comes from Echo/WSC history posture, not stale process memory.
- Jedit does not silently invent a recovered buffer.
- The user can materialize and save/export the recovered state when recovery
  evidence is complete.
- Missing or incomplete Echo evidence is visible and auditable.

Required proof:

- WSC or Echo-history evidence for the original edit.
- Restart witness from a fresh process.
- Recovery posture facts.
- Final export or obstruction evidence.

Current status:

Target. This workflow should compose the powered-by-Echo WSC durability and
replay slices.

## Workflow X - Multi-File Edit Session

User:

A developer editing related files without restarting Jedit.

Setup:

```sh
workspace="$(mktemp -d)"
printf 'left\n' > "$workspace/a.txt"
printf 'right\n' > "$workspace/b.txt"
cd "$workspace"
```

Task:

1. Run `jedit`.
2. Open `a.txt` with `:edit`.
3. Insert one leading space followed by `A` and save.
4. Open `b.txt` with `:edit`.
5. Insert one leading space followed by `B` and save.
6. Return to `a.txt` through the intended buffer or file workflow.
7. Quit.
8. Read both files from disk.

Expected result:

- Each open file has distinct production text authority.
- Saving one file does not materialize the other file accidentally.
- Dirty state is tracked per active buffer or explicitly documented as a
  single-buffer limitation.
- Final filesystem contents show the correct edit in each file.

Required proof:

- Multi-buffer authority map or explicit single-buffer obstruction.
- Distinct file-path save evidence for each file.
- Filesystem reads for both files.

Current status:

Target. If Jedit is still intentionally single-buffer, this workflow should
fail with an honest obstruction rather than pretending multi-file authority
exists.

## Release-Candidate Interpretation

These target usability tests are not all required for the next small PR, but
they define the shape of "Jedit feels like a real Vim-shaped editor powered by
Echo." The release-candidate gate should include at least:

- Workflow I for the happy path.
- Workflow VI for invalid command recovery.
- Workflow VII for dirty quit behavior.
- One Echo/WSC restart or export workflow when durability is in scope.

The remaining workflows can graduate into the release gate as their underlying
features become product commitments.

## Non-Negotiables

- Do not satisfy these workflows with direct model mutation helpers.
- Do not bypass the production Vim command-line surface for command workflows.
- Do not bypass the production Echo-hosted text session for text authority.
- Do not claim save success without a filesystem read outside Jedit.
- Do not treat screenshots as the only proof of command dispatch, save, or
  recovery.
- Do not hide unsupported behavior behind a passing fixture. A typed
  obstruction is better than fake success.
