<!-- SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0 -->
<!-- © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots> -->

# Title Intro And Startup Activity Modal

Status: design-first slice for the title screen startup flow.

## Claim

jedit's no-editor startup screen should feel like a product entry flow, not only
an ambient title render. The title sequence introduces FLYINGROBOTS and jedit on
a deterministic timeline, allows immediate skip with Enter or Escape, and then
opens a focused startup modal where the user can type a target and inspect
recent workspace activity.

This is UI state in jedit. It does not create Echo work, mutate text authority,
or introduce new runtime modes. Recent Activity is a jedit-facing summary over
workspace evidence already visible to the app, not a raw Echo activity log.

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
- a Recent Activity list;
- stable keyboard focus on the input by default.

Initial Recent Activity should be useful with current state and cheap to
compute:

- the active workspace root;
- recently visible file entries from the current directory listing;
- recent Echo history entries when available;
- current WSC startup recovery posture when it has user-facing evidence.

The first implementation may render the input as local UI state without
executing open/search behavior. Typing into the input changes only modal state.
Open/search command execution should be a later slice with its own evidence
contract.

## Small Screens

The modal participates in the same Bijou breakpoint posture as drawers and
overlays:

- it must fit inside the supported workspace minimum;
- it should clamp width to the viewport and leave at least one column of title
  scene visible when possible;
- on short terminals it should reduce the Recent Activity row count before
  shrinking the input;
- below the existing minimum terminal size, the small-terminal notice remains
  authoritative and the modal is not rendered.

## State Model

Workspace state needs a startup-flow structure with:

- intro completion flag;
- modal open flag;
- input text;
- selected recent activity index.

The intro completion flag is derived from either elapsed title time or explicit
skip. The modal should not reopen after the user closes it in the same process.

Recent Activity rows should be value objects, not pre-rendered strings, so the
renderer can adapt to width and theme tokens.

## Controls

While intro is active:

- `enter`: skip intro and open startup modal.
- `esc`: skip intro and open startup modal.

While startup modal is open:

- printable keys append to the input.
- `backspace` deletes from the input.
- `j`, `down`: move Recent Activity selection down when the input is empty or
  the modal is in list navigation posture.
- `k`, `up`: move Recent Activity selection up when the input is empty or the
  modal is in list navigation posture.
- `esc`: close the modal.
- `enter`: accepts the input or selected activity only after a later slice adds
  command execution; until then it is intentionally inert.

## Evidence

The first executable claim is:

```text
At title time 0 FLYINGROBOTS is visible, at title time 2 jedit is visible, at
title time 7 the workspace considers the intro complete, and Enter/Escape
complete it immediately by opening a startup modal whose input accepts text.
```

Focused witnesses:

- title presentation sequence spec for the new timing;
- workspace key spec for Enter/Escape skip before modal;
- workspace render spec for modal input and Recent Activity;
- workspace key spec for input editing and Escape close;
- small-screen spec proving the modal does not override the minimum-terminal
  notice.

## Non-Goals

- No command palette implementation.
- No fuzzy project search.
- No Zed-compatible project switcher semantics.
- No persistence of activity beyond already available workspace/Echo/WSC
  evidence.
- No Echo core changes.
- No app-controlled Echo lifecycle or tick authority.
