---
title: "WF-0038 - Startup File Drawer Bijou Recovery"
legend: "WF"
lane: "design"
issue: "https://github.com/flyingrobots/jedit/issues/56"
status: "active"
owners:
  - "@flyingrobots"
created: "2026-06-04"
updated: "2026-06-05"
---

# WF-0038 - Startup File Drawer Bijou Recovery

## Linked Issue

- https://github.com/flyingrobots/jedit/issues/56

## Decision Summary

The startup file selector will keep Jedit-owned file identity, filtering, and
open effects, but it will render as a Bijou-backed left drawer whose selectable
file list uses Bijou's browsable list and viewport surface. The drawer opens
with a critically damped spring progress value, exposes real scrollbar
affordance on overflow, dismisses with the same spring toward zero progress,
and remains recoverable with Tab, Enter, or `o` after Escape dismissal.

## Sponsored Human

A person launching jedit without a file wants the startup file selector to look
and behave like the rest of the app so that opening a file is obvious and
recoverable, without getting stranded on an inert title screen after pressing
Escape.

## Sponsored Agent

An agent needs a deterministic drawer rendering contract so it can inspect theme
tokens, spring progress, overflow affordances, and key recovery from surfaces and
model state, without comparing screenshots or assuming private title-screen
state.

## Hill

By the end of this cycle, the title startup selector slides in as a Bijou left
drawer, renders overflowing file rows with a Bijou scrollbar using jedit theme
tokens, Escape can dismiss the selector without trapping the user, Tab, Enter,
or `o` reopens it from the title screen, and focused workspace specs prove the
behavior.

## Current Truth

The merge target for this cycle is `origin/main` at
`62b8ae43e729bec7602311477646c00c5fb817b6`.

Current anchors:

- `src/ui/startup-file-modal.ts` imports Bijou's `modal` shell:
  [src/ui/startup-file-modal.ts#L2:62b8ae43e729bec7602311477646c00c5fb817b6](https://github.com/flyingrobots/jedit/blob/62b8ae43e729bec7602311477646c00c5fb817b6/src/ui/startup-file-modal.ts#L2).
- The same file still hand-paints the modal body and rows:
  [src/ui/startup-file-modal.ts#L68:62b8ae43e729bec7602311477646c00c5fb817b6](https://github.com/flyingrobots/jedit/blob/62b8ae43e729bec7602311477646c00c5fb817b6/src/ui/startup-file-modal.ts#L68).
- The current scroll window is bespoke row slicing with no rendered scrollbar:
  [src/ui/startup-file-modal.ts#L98:62b8ae43e729bec7602311477646c00c5fb817b6](https://github.com/flyingrobots/jedit/blob/62b8ae43e729bec7602311477646c00c5fb817b6/src/ui/startup-file-modal.ts#L98).
- Escape closes the open startup browser:
  [src/app/workspace/startup-file-modal-key-bindings.ts#L44:62b8ae43e729bec7602311477646c00c5fb817b6](https://github.com/flyingrobots/jedit/blob/62b8ae43e729bec7602311477646c00c5fb817b6/src/app/workspace/startup-file-modal-key-bindings.ts#L44).
- Existing workspace specs cover rendering, filtering, opening files, bounded
  navigation, directory entry, empty states, and small-terminal behavior:
  [spec/workspace-title-screen.spec.mjs#L258:62b8ae43e729bec7602311477646c00c5fb817b6](https://github.com/flyingrobots/jedit/blob/62b8ae43e729bec7602311477646c00c5fb817b6/spec/workspace-title-screen.spec.mjs#L258).
- Bijou TUI exposes `browsableListSurface` and `viewportSurface` with a
  `showScrollbar` option through `@flyingrobots/bijou-tui` 7.0.0.
- The linked issue records the user-facing failure report:
  https://github.com/flyingrobots/jedit/issues/56.

## Problem

The startup file selector is only partially Bijou-backed. It uses Bijou for the
modal frame but owns row clipping and list rendering itself, so long current
directories do not expose a scrollbar affordance. Escape dismisses the modal
and leaves no tested key path to reopen it from the title screen.

## Scope

This cycle includes:

- Rendering the selectable file row viewport with Bijou's browsable list
  surface.
- Painting list, selected row, and scrollbar cells with existing jedit theme
  tokens.
- Preserving current filtering, directory navigation, selected index, and file
  open behavior.
- Replacing the centered startup selector shell with a Bijou left drawer.
- Animating the drawer width through a runtime-owned, critically damped spring
  progress value.
- Adding a recoverable closed-drawer title path: Tab, Enter, or `o` reopens the
  startup selector when no editor is open and the intro is complete.
- Adding regression specs for overflow scrollbar rendering, theme-token use,
  and Esc recovery.

## Non-Goals

This cycle does not include:

- Moving Jedit file identity or open effects into Bijou's `filePicker` state.
- Adding mouse support to the startup selector.
- Replacing the startup drawer with a full app-frame project picker.
- Changing localization copy.
- Changing the title intro timing.

## User Experience / Product Shape

The user starts jedit without a file. After the intro, the file selector slides
in from the left over the live title scene. The selector shows the current
directory, an input line, a current-directory label, and a scrollable list of
matching files. When the matching file list overflows, a scrollbar appears at
the list edge. Escape dismisses the selector with the drawer-close spring. From
the title screen, Tab, Enter, or `o` opens the selector again.

Success is communicated by the visible scrollbar on overflow, selected row
highlighting, and the drawer returning when the user presses Tab, Enter, or `o`
after Escape. Failure is a long file list with no scroll affordance or a
drawer-close state where common open keys do nothing.

### User Journey

```mermaid
flowchart TD
  Start[Intro completes] --> Drawer[Startup selector drawer opens]
  Drawer --> Filter[User types filter]
  Drawer --> Scroll[Long list shows scrollbar]
  Drawer --> Escape[User presses Escape]
  Escape --> Title[Title screen remains active]
  Title --> Reopen[User presses Tab, Enter, or o]
  Reopen --> Drawer
  Drawer --> Open[Enter opens selected file]
```

### Wide UI Mockup

```text
+----------------------------------------------+  title scene backdrop
| Open file                                    |  remains visible
| /repo                                        |
| Filter: read                                 |
|                                              |
| Current directory                            |
| > src/                                    █  |
|   README.md                              │  |
|   package.json                           │  |
|   docs/                                  │  |
+----------------------------------------------+
```

The wide view anchors the selector to the left edge. The drawer width is bounded
by the existing maximum selector width and the spring progress; the title scene
remains visible to the right while the drawer is open.

### Narrow UI Mockup

```text
+------------------------------------+
| Open file                          |
| /repo                              |
| Filter: r                          |
| Current directory                  |
| > README.md                     █  |
|   ROADMAP.md                   │  |
+------------------------------------+
```

The narrow view keeps the existing small-terminal guard. When the terminal is
below the existing minimum geometry, the selector remains hidden and the
minimum-terminal notice wins.

### Accessibility Considerations

The startup selector is keyboard-only and remains keyboard-recoverable after
Escape. The scrollbar is an additional visual affordance; it is not the only
way to move through the list. Agents can inspect model state and rendered
surface cells to determine focus and overflow.

## Runtime / API Contract

Contract: startup file drawer rendering and key bindings.

Relevant behavior:

- `renderStartupFileDrawer` returns a `Surface` rendered by Bijou's `drawer`
  primitive.
- `WorkspaceModel.startupFileDrawerProgress` clamps to `[0, 1]` and controls the
  drawer width.
- Runtime time-tick completion and startup selector reopen keys emit a Bijou
  spring animation command from the current progress to `1`.
- File rows are rendered through Bijou's browsable list surface.
- Overflowing rows render a scrollbar in the list viewport.
- The scrollbar track and thumb are painted from jedit theme tokens.
- Selected rows continue to use the current selected-index model.
- Escape marks an open startup drawer closed and emits a spring animation from
  current progress to `0`.
- A closing drawer remains rendered while `startupFileDrawerProgress > 0`.
- Tab, Enter, and `o` reopen the startup drawer when no editor is open, the
  intro is complete, and no higher-priority overlay owns focus.

## Lower Modes

The rendered surface remains deterministic for tests and non-interactive
inspection. The small-terminal lower mode is unchanged: the minimum-terminal
notice suppresses the startup selector below the existing geometry threshold.

## Data / State Model

| Category                  | Description                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Source of truth           | `WorkspaceModel.entries`, `startupFileModalInput`, `startupFileModalSelectedIndex`, and drawer progress.               |
| Derived state             | Filtered rows, Bijou list state, first visible row, scrollbar position, and rendered drawer width.                     |
| Invalid states            | Drawer closed after Escape with no key path to reopen while no editor is open.                                         |
| Reset behavior            | Reopened drawer resets selection to the first row; Escape animates progress to `0`; file open resets progress to `0`.  |
| Serialization             | No serialized state changes.                                                                                           |
| Deterministic assumptions | Render tests use fixed model entries, theme tokens, and explicit drawer progress values.                               |

```mermaid
stateDiagram-v2
  [*] --> Open
  Open --> Closing: Escape / spring to 0
  Closing --> ClosedRecoverable: progress 0
  ClosedRecoverable --> Open: Tab, Enter, or o
  Open --> FilePending: Enter on file
  Open --> Open: Enter on directory
```

## Accessibility Posture

| Concern                           | Posture                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| Semantic labels or facts          | Existing title, hint, input label, and current-directory copy remain.              |
| Focus order or ownership          | Drawer owns focus while open; title screen owns focus after Escape.                |
| Hidden or visual-only information | Scrollbar is redundant to keyboard navigation and model-selected index.            |
| Keyboard behavior                 | Escape closes; Tab, Enter, and `o` reopen; arrows and Vim keys keep existing navigation. |
| Secret or redaction behavior      | Not applicable.                                                                    |

## Localization / Directionality Posture

No user-visible strings change. The existing localized selector copy remains
authoritative. Directionality does not change in this cycle.

## Agent Inspectability / Explainability Posture

Agents can inspect:

- `WorkspaceModel.startupFileModalOpen` and `startupFileDrawerProgress` after
  Escape and reopen keys;
- rendered drawer `Surface` cells for scrollbar characters;
- rendered cells for theme-token foreground/background values;
- focused row text and model-selected index;
- PR and issue links for this cycle.

## Linked Invariants

- Tests are executable spec.
- Runtime truth beats type theater.
- Design should become repo truth.
- Buffers, panes, panels, and lenses are different things.
- Files and previews are projections.
- Echo authority remains outside jedit product nouns.

## Design Alternatives Considered

### Option A: Adopt Bijou Browsable List Surface

Pros:

- Reuses Bijou's viewport and scrollbar behavior.
- Keeps Jedit's file identity, filtering, and open effects unchanged.
- Gives this cycle a focused, testable surface contract.

Cons:

- Jedit still maps its theme tokens onto the resulting surface.

### Option B: Adopt Bijou File Picker State

Pros:

- Would reuse more of Bijou's file picker surface and state transforms.

Cons:

- Duplicates or bypasses Jedit's existing file entry port and directory-open
  behavior.
- Risks changing file identity while fixing a UI affordance bug.

### Option C: Keep Bespoke Rows and Paint a Custom Scrollbar

Pros:

- Smallest code change.

Cons:

- Continues the exact bespoke-list drift the issue calls out.
- Makes future list behavior diverge from Bijou primitives.

## Decision

Choose Option A plus a Bijou drawer shell. Jedit remains responsible for product
file semantics and startup flow state, while Bijou owns the drawer, list
viewport, scrollbar primitive, and spring animation primitive used by the
selector.

## Implementation Slices

- [x] Slice 1: Commit this design packet. Commit message:
      `docs: design startup file modal Bijou recovery`.
- [x] Slice 2: Add failing specs for overflow scrollbar, scrollbar token use,
      and Escape-to-reopen recovery.
- [x] Slice 3: Render file rows through Bijou `browsableListSurface` with
      jedit theme-token styling.
- [x] Slice 4: Add title-screen reopen key handling after Escape.
- [x] Slice 5: Verify focused tests, quality, and docs formatting.
- [x] Slice 6: Fill retrospective, push, mark PR ready, and merge when eligible.
- [x] Slice 7: Convert the startup selector shell to a Bijou left drawer with
      critical spring progress. Commit message:
      `UX: animate startup file drawer`.

## Tests To Write First

Behavior tests required:

- [x] `spec/workspace-title-screen.spec.mjs` proves overflowing startup drawer
      rows render a scrollbar.
- [x] `spec/workspace-title-screen.spec.mjs` proves scrollbar cells use jedit
      theme token colors.
- [x] `spec/workspace-title-screen.spec.mjs` proves Escape followed by Tab,
      Enter, or `o` reopens the startup selector from the title screen.
- [x] `spec/workspace-title-screen.spec.mjs` proves drawer width follows spring
      progress.
- [x] `spec/workspace-runtime.spec.mjs` proves intro completion emits the startup
      drawer animation command and that the spring is critically damped.
- [x] Existing workspace startup specs continue to prove filtering, opening,
      directory navigation, and small-terminal behavior.

Documentation and process tests:

- [x] Prettier validates this design doc.

Rule: documentation tests cannot be the only proof for implementation work.

## Acceptance Criteria

The work is done when:

- [x] Overflowing startup selector rows visibly expose a scrollbar.
- [x] The startup selector is painted as a left drawer instead of a centered
      modal.
- [x] Drawer open is driven by a critically damped spring progress command.
- [x] The scrollbar and selected row use theme-token-derived cell styles.
- [x] Escape dismissal is recoverable with Tab, Enter, or `o`.
- [x] Existing startup selector filtering and open behavior still pass.
- [x] New strings have supported translations, if relevant.
- [x] Issue and PR are linked correctly.
- [ ] CI and local validation are green.

## Validation Plan

Commands expected before PR:

```bash
npm run build
JEDIT_DIST_PREBUILT=1 node --test --test-concurrency=1 spec/workspace-title-screen.spec.mjs
JEDIT_DIST_PREBUILT=1 node --test --test-concurrency=1 spec/workspace-runtime.spec.mjs
npm run quality
npx --no-install prettier --check docs/design/0038-startup-file-modal-bijou-recovery.md
```

## Playback / Witness

Reviewers can run:

```bash
npm run build
JEDIT_DIST_PREBUILT=1 node --test --test-concurrency=1 spec/workspace-title-screen.spec.mjs
JEDIT_DIST_PREBUILT=1 node --test --test-concurrency=1 spec/workspace-runtime.spec.mjs
```

Manual playback:

- Launch jedit without a file from a directory with more files than the selector
  can show.
- Wait for the startup selector.
- Confirm it opens from the left as a drawer and the list shows a scrollbar.
- Press Escape, then Tab, Enter, or `o`, and confirm the selector returns.

## Risks

Known risks:

- Bijou list rows may not preserve jedit's selected-row colors unless Jedit
  explicitly maps theme tokens after rendering.
- Reopen keys could steal input from another overlay if the candidate predicate
  is too broad.
- The drawer could visually pop in if the runtime forgets to emit the spring
  animation command at intro completion or reopen.

Mitigations:

- Add token-level surface assertions for the scrollbar and selected row.
- Reuse the existing startup intro candidate constraints and require no editor,
  no drawer, and editor focus before reopening.
- Add runtime coverage for intro completion animation and key-binding coverage for
  reopen animation.

## Follow-On Debt

No follow-on debt is introduced by this cycle. Broader title-screen component
tooling remains tracked by separate issues.

## Retrospective

What changed from the design:

- Implemented the planned Bijou `browsableListSurface` row viewport while
  preserving Jedit-owned file rows and open behavior.
- Painted selected row and scrollbar cells with jedit theme tokens after Bijou
  renders the viewport.
- Added title-screen reopen handling for Tab, Enter, and `o` after Escape
  dismissal.
- Converted the centered selector shell to a Bijou left drawer painted above the
  live title scene.
- Added `startupFileDrawerProgress` and Bijou spring animation commands for intro
  completion and reopen.

What the tests proved:

- RED: the new overflow test failed because no startup selector scrollbar thumb
  existed, and the new recovery test failed because Enter after Escape left the
  selector closed.
- GREEN:
  `JEDIT_DIST_PREBUILT=1 node --test --test-concurrency=1 spec/workspace-title-screen.spec.mjs`
  passed after the renderer and key-binding changes.
- GREEN:
  `JEDIT_DIST_PREBUILT=1 node --test --test-concurrency=1 spec/workspace-runtime.spec.mjs`
  passed after the runtime animation contract was added.
- `npm run quality` and Prettier checks passed locally.

What remains open:

- GitHub CI has not run yet at the time of this implementation commit.
- Other title-screen issues remain tracked as separate cycles.

PR:

- https://github.com/flyingrobots/jedit/pull/89
