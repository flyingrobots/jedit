<!-- SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0 -->
<!-- © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots> -->

# Title Intro And Startup File Modal

Status: design-first slice for the title screen startup flow.

## Claim

jedit's no-editor startup screen should feel like a product entry flow, not only
an ambient title render. The title sequence introduces FLYINGROBOTS and jedit on
a deterministic timeline, allows immediate skip with Enter or Escape, and then
opens a focused startup modal where the user can type a target and inspect
files from the current working directory.

This is UI state in jedit. It does not create Echo work, mutate text authority,
or introduce new runtime modes. The file list is a jedit-facing projection of
the existing startup directory entries, not a recent-workspace database or a
raw Echo activity log.

## Intro Timeline

The sequence starts when no editor is open:

| Time | State |
| --- | --- |
| `0s` | FLYINGROBOTS logo and `PRESENTS` are visible immediately. |
| `2s` | jedit logo appears. |
| `2s-7s` | FLYINGROBOTS, `PRESENTS`, and jedit remain visible together. |
| `7s` | Intro is complete and the startup modal opens. |

The title renderer may keep the existing jedit logo sheen while the jedit logo
is visible. The old delayed 5s FLYINGROBOTS entrance and long 15s fade are
removed from the product startup path.

## Skip Semantics

Enter and Escape skip the intro only while the title startup flow is active and
no editor is open. Skipping marks the intro complete and opens the startup
modal immediately.

Skip must not:

- submit an edit intent;
- open a file;
- quit the process;
- activate scene-picker or settings behavior;
- leave an armed normal-mode motion behind.

After the startup modal is open, Enter and Escape are modal keys, not title
intro skip keys.

## Startup Modal

The post-intro modal is centered over the title scene. It contains:

- a single-line input area;
- a current-directory file list;
- stable keyboard focus on the input by default.

Initial file rows should be useful with current state and cheap to compute:

- the active workspace root as context, not as a selectable recent workspace;
- file and directory entries from `WorkspaceModel.entries`;
- deterministic ordering that matches the file drawer unless filtering is
  active;
- row labels that distinguish directories from files without exposing host
  adapter internals.

The first implementation may render the input as local UI state without
executing open/search behavior. Typing into the input filters the visible
current-directory rows and changes only modal state. Opening a selected file can
land in a later slice if it needs to share the production file-open command
path.

## Small Screens

The modal participates in the same Bijou breakpoint posture as drawers and
overlays:

- it must fit inside the supported workspace minimum;
- it should clamp width to the viewport and leave at least one column of title
  scene visible when possible;
- on short terminals it should reduce the visible file row count before
  shrinking the input;
- below the existing minimum terminal size, the small-terminal notice remains
  authoritative and the modal is not rendered.

## State Model

Workspace state needs a startup-flow structure with:

- intro completion flag;
- modal open flag;
- input text;
- selected file row index.

The intro completion flag is derived from either elapsed title time or explicit
skip. The modal should not reopen after the user closes it in the same process.

File rows should be value objects, not pre-rendered strings, so the renderer can
adapt to width and theme tokens.

## Controls

While intro is active:

- `enter`: skip intro and open startup modal.
- `esc`: skip intro and open startup modal.

While startup modal is open:

- printable keys append to the input.
- `backspace` deletes from the input.
- `j`, `down`: move file selection down when the input is empty or
  the modal is in list navigation posture.
- `k`, `up`: move file selection up when the input is empty or the
  modal is in list navigation posture.
- `esc`: close the modal.
- `enter`: accepts the input or selected file only after a later slice adds
  command execution; until then it is intentionally inert.

## Evidence

The first executable claim is:

```text
At title time 0 FLYINGROBOTS is visible, at title time 2 jedit is visible, at
title time 7 the workspace considers the intro complete, and Enter/Escape
complete it immediately by opening a startup modal whose input filters current
directory file rows.
```

Focused witnesses:

- title presentation sequence spec for the new timing;
- workspace key spec for Enter/Escape skip before modal;
- workspace render spec for modal input and current-directory files;
- workspace key spec for input editing and Escape close;
- small-screen spec proving the modal does not override the minimum-terminal
  notice.

## Fifteen-Slice Ledger

- [x] Slice 1: retime the pure title presentation sequence.
- [x] Slice 2: pin the new logo/sheens timeline with focused title specs.
- [ ] Slice 3: add startup-flow state to the workspace model.
- [ ] Slice 4: derive current-directory modal rows from `WorkspaceModel.entries`.
- [ ] Slice 5: render the startup modal shell with input and file rows.
- [ ] Slice 6: integrate the modal as a workspace overlay above the title scene.
- [ ] Slice 7: preserve the small-terminal notice as the highest-priority view.
- [ ] Slice 8: skip the intro with Enter or Escape before other title keys.
- [ ] Slice 9: auto-complete the intro and open the modal at the timeline end.
- [ ] Slice 10: edit modal input with printable keys and Backspace.
- [ ] Slice 11: filter file rows from the modal input.
- [ ] Slice 12: navigate modal file rows with arrows and Vim-shaped keys.
- [ ] Slice 13: open the selected file through the existing production open path.
- [ ] Slice 14: handle directories, empty directories, and no-match states.
- [ ] Slice 15: close quality gaps, document follow-on ideas/debt, and refresh the PR.

## Non-Goals

- No command palette implementation.
- No fuzzy project search.
- No Zed-compatible project switcher semantics.
- No recent workspace database.
- No Echo core changes.
- No app-controlled Echo lifecycle or tick authority.
