<!-- SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0 -->
<!-- © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots> -->

# Title Intro And Startup File Drawer

Status: design-first slice for the title screen startup flow.

## Claim

jedit's no-editor startup screen should feel like a product entry flow, not only
an ambient title render. The title sequence introduces FLYINGROBOTS and jedit on
a deterministic timeline, allows immediate skip with Enter or Tab, and then
opens a focused startup file drawer where the user can type a target and inspect
files from the current working directory.

This is UI state in jedit. It does not create Echo work, mutate text authority,
or introduce new runtime modes. The file list is a jedit-facing projection of
the existing startup directory entries, not a recent-workspace database or a
raw Echo activity log.

## Intro Timeline

The sequence starts when no editor is open:

| Time    | State                                                        |
| ------- | ------------------------------------------------------------ |
| `0s`    | FLYINGROBOTS logo and `PRESENTS` are visible immediately.    |
| `2s`    | jedit logo appears.                                          |
| `2s-7s` | FLYINGROBOTS, `PRESENTS`, and jedit remain visible together. |
| `7s`    | Intro is complete and the startup file drawer opens.         |

The title renderer may keep the existing jedit logo sheen while the jedit logo
is visible. The old delayed 5s FLYINGROBOTS entrance and long 15s fade are
removed from the product startup path.

## Skip Semantics

Enter and Tab skip the intro only while the title startup flow is active and
no editor is open. Skipping marks the intro complete and opens the startup file
drawer immediately.

Skip must not:

- submit an edit intent;
- open a file;
- quit the process;
- activate scene-picker or settings behavior;
- leave an armed normal-mode motion behind.

Escape is not a startup skip key. When the drawer is closed, Escape opens the
standard quit confirmation. After the startup file drawer is open, Enter and
Escape are drawer keys, not title intro skip keys.

## Startup File Drawer

The post-intro selector is a Bijou-backed left drawer over the title scene. It
opens with a critically damped spring progress value and contains:

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

The first implementation renders the input as local UI state, filters visible
current-directory rows, and opens selected file rows through the existing
production file-open command path. Directory rows reuse the existing file-tree
directory transition path and keep the drawer open in the new directory.

## Live Title Backdrop

While the startup file drawer is open, the title scene keeps ray tracing and
camera motion live until the app has a file open. The drawer is an overlay over
the current title scene, not a modal that disables the renderer.

This is a render-performance posture only:

- time ticks may continue updating runtime timing fields;
- drawer input must stay responsive through normal Bijou message handling;
- opening a file stops the title scene because the editor becomes the active
  rendered surface;
- slow idle title-screen caching remains a separate non-browser posture.

## Small Screens

The startup drawer participates in the same Bijou breakpoint posture as drawers and
overlays:

- it must fit inside the supported workspace minimum;
- it should clamp width to the viewport and leave at least one column of title
  scene visible when possible;
- on short terminals it should reduce the visible file row count before
  shrinking the input;
- below the existing minimum terminal size, the small-terminal notice remains
  authoritative and the drawer is not rendered.

## State Model

Workspace state needs a startup-flow structure with:

- intro completion flag;
- drawer open flag;
- drawer progress;
- input text;
- selected file row index.

The intro completion flag is derived from either elapsed title time or explicit
skip. After the user closes the drawer, Enter or `o` should reopen it while no
editor or higher-priority overlay owns focus.

File rows should be value objects, not pre-rendered strings, so the renderer can
adapt to width and theme tokens.

## Controls

While intro is active:

- `enter`: skip intro and open startup file drawer.
- `tab`: skip intro and open startup file drawer.
- `esc`: open the standard quit confirmation.
- `m`, `M`: cycle the Dragon material preset and show a toast with its name.

While the startup file drawer is open:

- printable keys append to the input.
- `backspace` deletes from the input.
- `j`, `down`: move file selection down when the input is empty or the drawer is
  in list navigation posture.
- `k`, `up`: move file selection up when the input is empty or the drawer is in
  list navigation posture.
- `esc`: dismiss the drawer with the close spring animation.
- `enter`: opens the selected file through the existing production open path,
  or enters the selected directory while keeping the drawer open.

After the intro is complete and the drawer is closed:

- `tab`, `enter`, `o`: reopen the startup file drawer.
- `esc`: open the standard quit confirmation.
- `m`, `M`: cycle the Dragon material preset and show a toast with its name.

## Evidence

The first executable claim is:

```text
At title time 0 FLYINGROBOTS is visible, at title time 2 jedit is visible, at
title time 7 the workspace considers the intro complete, and Enter/Tab
complete it immediately by opening a startup drawer whose input filters current
directory file rows.
```

Focused witnesses:

- title presentation sequence spec for the new timing;
- workspace key spec for Enter/Tab skip before drawer;
- workspace render spec for drawer input and current-directory files;
- workspace key spec for input editing and animated Escape close;
- workspace key spec for selected file open and selected directory traversal;
- workspace render spec proving drawer input keeps the title renderer live;
- workspace key spec proving `m` and `M` cycle Dragon material presets;
- small-screen spec proving the drawer does not override the minimum-terminal
  notice.

## Fifteen-Slice Ledger

- [x] Slice 1: retime the pure title presentation sequence.
- [x] Slice 2: pin the new logo/sheens timeline with focused title specs.
- [x] Slice 3: add startup-flow state to the workspace model.
- [x] Slice 4: derive current-directory drawer rows from `WorkspaceModel.entries`.
- [x] Slice 5: render the startup drawer shell with input and file rows.
- [x] Slice 6: integrate the drawer as a workspace overlay above the title scene.
- [x] Slice 7: preserve the small-terminal notice as the highest-priority view.
- [x] Slice 8: skip the intro with Enter or Tab before other title keys.
- [x] Slice 9: auto-complete the intro and open the drawer at the timeline end.
- [x] Slice 10: edit drawer input with printable keys and Backspace.
- [x] Slice 11: filter file rows from the drawer input.
- [x] Slice 12: navigate drawer file rows with arrows and Vim-shaped keys.
- [x] Slice 13: open the selected file through the existing production open path.
- [x] Slice 14: handle directories, empty directories, and no-match states.
- [x] Slice 15: close quality gaps, document follow-on ideas/debt, and refresh the PR.

## Non-Goals

- No command palette implementation.
- No fuzzy project search.
- No Zed-compatible project switcher semantics.
- No recent workspace database.
- No Echo core changes.
- No app-controlled Echo lifecycle or tick authority.
