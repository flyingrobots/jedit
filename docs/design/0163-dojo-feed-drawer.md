---
title: "DX-0163 - Disconnected Dojo Feed drawer"
legend: "DX"
lane: "design"
issue: "https://github.com/flyingrobots/jedit/issues/345"
status: "active"
owners: ["@flyingrobots"]
created: "2026-10-15"
updated: "2026-10-15"
---

# DX-0163 - Disconnected Dojo Feed drawer

## Linked Issue

https://github.com/flyingrobots/jedit/issues/345

## Decision Summary

Add a focused right overlay drawer for Dojo Feed, opened and dismissed with F4.
It shows an honest waiting state while upstream public content screening is
unfinished. No connection, frame consumption, feed cache, or simulated updates.

## Sponsored Human

A Jim user wants a visible destination for work updates without leaving the
editor or consuming the currently unscreened board feed.

## Sponsored Agent

An agent needs an inspectable open/closed state and deterministic rendering so
it can verify focus and return behavior without inferring a transport state.

## Hill

The user can open Dojo Feed, understand why it is waiting, scroll its explanation,
and return to precisely the same editor position using keyboard or pointer.

## Current Truth

This change stays local until the user authorizes publication.

The parent footer work is af1fad8a. Workspace overlays live in
`src/app/workspace/viewer-overlays.ts`; key routing in `key-bindings.ts`;
footer composition in `src/ui/workspace-footer-presentation.ts`.
The board's upstream content screen is unfinished. No Dojo Feed client exists in Jim.

## Problem

The integration cannot safely consume content yet, but its entry, state
communication, focus ownership and return interaction can be built now.

## Scope

F4 entry, right drawer, close action, scrolling, footer identity, theme tokens,
localized copy, pointer input, and runtime witnesses.

## Non-Goals

Network adapters, reconnect, retry, read/unread state, content lists, persistence,
and public feed discovery. Real content and transport remain a separate issue.

## User Experience / Product Shape

The drawer identifies Dojo Feed and its waiting state before the local source address.
The explanation says that public screening is pending and Jim is disconnected.
There is no live badge, spinner, Connect button, sample message, or misleading
retry. A pinned F4/Esc close hint doubles as a pointer target. Body content wraps
and scrolls with j/k, arrows, Page Up/Down, Home/End and the mouse wheel.
The header, status and close action remain pinned. Opening is immediate, with no
animation or layout reflow; it covers the right side of the current viewer.

### User Journey

F4 in the title screen or workspace opens the drawer and takes input ownership.
F4 or Esc closes it and restores the underlying focus. The editor's cursor,
scroll, dirty state, buffer authority and drawer selection survive unchanged.
Opening from Files filter mode ends editing and retains the query.
Existing Settings, command input, startup picker and quit confirmation retain
priority: F4 does not interrupt those modal operations. Ctrl+C remains available.
Typing, paste, Tab and ordinary editor commands are consumed while Dojo Feed owns focus.

### Wide UI Mockup

100x32, current dark theme; right drawer approximately 42 columns:

```text
 editor remains visible     | Dojo Feed                 F4/Esc close |
                            | Waiting for public feed          |
                            |                                  |
                            | Public content screening is      |
                            | pending. Jim is disconnected.    |
                            |                                  |
                            | Source                           |
                            | 127.0.0.1:4747                    |
```

### Narrow UI Mockup

60x12, right drawer 32 columns; status and close hint stay visible, explanatory
content scrolls inside the body. Below Jim's minimum terminal size, the existing
resize notice owns the screen; Esc/F4 can still dismiss Dojo Feed.

### Accessibility Considerations

Text names the state without color. Keyboard entry and exit need one key each.
The source address stays literal in RTL locales. Layout follows the existing
right-drawer convention, and translated prose aligns to its locale direction.

## Runtime / API Contract

`WorkspaceModel.dojoFeedDrawer` is absent when closed, otherwise has a scroll row.
The state is session UI only. No dependency, transport port or persisted content
is introduced. Input routing runs before Files editing and ordinary workspace
keys; pointer routing runs before underlying drawers and editor scrolling.
UI owns geometry, wrapping, tokens and pointer hit testing. Echo remains untouched.

## Lower Modes

At supported narrow widths, prose wraps and can scroll. Status is textual with
no color dependency. If optional Graft/Echo adapters are unavailable, opening
Dojo Feed needs neither. No JSON feed or network mode exists in this slice.

## Data / State Model

Source of truth: optional drawer scroll state. Derived: waiting copy, dimensions,
visible wrapped lines, scroll limit and footer facts. Close resets the drawer;
no serialization. The only connection posture is disconnected and gated.

## Accessibility Posture

State and actions are text. Dojo Feed owns keyboard/pointer while open. No private
content enters the model, screenshots, caches, logs or test fixtures.

## Localization / Directionality Posture

Add a `dojoFeed` catalog group to all 20 authored locales and regenerate the mirror.
Align translated prose logically; preserve literal Dojo Feed, F4/Esc and source text.
Check English, Arabic and every locale's non-fallback copy in runtime tests.

## Agent Inspectability / Explainability Posture

The optional model field, pure drawer geometry and rendered cell output expose
open state, scroll and source identity without requiring any service connection.

## Linked Invariants

Modal input has one owner. UI state is separate from Echo authority. Preview
and selection do not open a buffer. Theme tokens own colors. Tests are spec.

## Design Alternatives Considered

A third persistent pane would require new focus cycling and viewport geometry
before any content is available. A right overlay reuses Settings' modal grammar
and leaves editor geometry intact. A fake feed would misrepresent readiness.

## Decision

Build only the truthful disconnected overlay now. Revisit persistent pane
behavior when the screened public feed contract and actual content are available.

## Implementation Slices

- [ ] Slice 1: Implement disconnected drawer entry, focus, rendering and localization.
- [ ] Slice 2: Verify native interaction and record evidence; publish for review.

## Tests To Write First

- [ ] F4 opens, Esc/F4 closes; modal priority and editor state survive.
- [ ] All layouts show Dojo Feed; hidden footer stays hidden; waiting state has no effects.
- [ ] Mouse close and scrolling cannot change underlying editor or Files selection.
- [ ] Narrow and RTL rendering remains bounded; all locale strings resolve.

## Acceptance Criteria

Runtime tests and native witnesses prove entry, exit, isolation, scrolling,
truthful copy, narrow composition and theme coverage. Full checks pass. The PR
identifies that transport remains gated and never connected during validation.

## Validation Plan

TypeScript build, focused runtime tests, quality gate, full npm run check and
native terminal interaction at 100x32 and 60x12 in dark/light and Arabic.

## Playback / Witness

Run Jim, press F4, scroll with j/k or mouse, close using Esc or the pinned hint.
Return to Files or an unsaved editor and confirm its position/content survive.

## Risks

The waiting drawer could be mistaken for a connected empty feed; explicit
waiting and disconnected copy must remain visible. Wrapping can exceed short
terminals; keep controls pinned and scroll only prose.

## Follow-On Debt

A separate issue owns transport after the screened public contract is ready.

## Retrospective

Pending implementation and runtime validation.
