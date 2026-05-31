---
title: why-is-this-character-here-debugger
lane: cool-ideas
owner: jedit ui
priority: medium-strategic
keywords:
  - jedit
  - debugger
  - causal-history
  - echo
  - sessions
  - ui
blocked_by:
  - echo cycle 0025 Phase 2 (Session / event attribution shipping)
  - jedit migration off the temporary session-port scaffold (leash fires)
acceptance_criteria:
  - A jedit motion (e.g. `g?`) on any glyph in the active buffer emits a structured causal-origin report.
  - The report names the glyph, buffer offset, worldline, tick, originating intent kind, session id, and principal.
  - The report's identifiers are queryable: clicking through to a session id opens its SessionEventLog projection, etc.
  - Works against the real Echo transport; the fake/in-process transport is allowed to return a synthetic "no causal history available" sentinel rather than a fake answer.
---

# `why are you here?` — point at a character, get its causal origin

## The proposal

A jedit UI gesture (motion `g?`, or the right-mouse equivalent) that
takes the glyph under the cursor and asks Echo to attribute it.

The answer:

```text
glyph:           "x"
buffer offset:   1842
worldline:       wl_2fac9d
tick:            4729
intent kind:     ReplaceRange { start: 1840, end: 1842, text: "ax" }
session:         sess_3ce17b
principal:       james@local        (or system/genesis for primordial bytes)
receipt:         rcpt_8be9...
causal parents:  [tick 4728, tick 4725]
```

That is not an editor feature. It is a category violation.

Most text editors can answer:

- "What file is this?" → trivially
- "What commit last touched this line?" → `git blame`

No editor in production can answer:

- "What causal event created this byte, in which session, by which
  principal, and what tick produced it?"

Echo / jedit can — once Phase 2 of cycle 0025 ships engine-side
Session attribution and SessionEventLog projections. This card
records the UI gesture that turns that capability into a thing a
normal human can use.

## Why this is the killer feature

The causal architecture is, today, invisible to the user. A typical
session looks like a normal editor with extra contracts under the
hood. The first feature that makes the architecture _visible_ —
that lets the user reach in and ask Echo to explain a single byte —
is the one that converts the engine investment into product
differentiation.

It also opens a follow-up surface (not in scope for this card):

- "show me every byte attributed to session X" (visual highlight
  over the buffer)
- "show me every byte authored after tick N" (time-travel scrub
  bar)
- "rewind the buffer to before this intent" (worldline-level undo)
- "fork from this tick" (split the worldline cleanly at a point in
  the past)

The first card surface is the gesture. The rest grow from it.

## Dependencies

- **Echo 0025 Phase 2** must land first. Without engine-side
  `Session` / `SessionEventLog` / `IntentAccepted` attribution,
  there is nothing to query. The query surface itself probably
  belongs in the engine and the optic client surfaces it through
  a new read-side observation.
- **Jedit migration off the temporary session-port scaffold** must
  complete. The current scaffold (leashed in
  `docs/method/backlog/leash/jedit-session-port.md`) does not carry
  engine-side session identity through; the query target would not
  exist until that migration lands.

This card stays in `cool-ideas/` until both dependencies clear. It
is recorded now so it does not get reinvented from scratch later.

## Why now (as a card, not as work)

- The 2026-05-30 brainstorm captured this as the jedit-side
  product differentiator. Carding it makes sure the idea survives
  the noise.
- Phase 2 RED authors should know this feature exists in the
  backlog. If the engine-side query surface needs a particular
  shape (e.g. a `byte_origin(worldline_id, offset, tick)` read
  observation), it is easier to build that shape during Phase 2
  GREEN than to retrofit it after.
- The blocked-by chain is honest: this is not next-cycle work.
  But the moment the chain clears, this is the first thing jedit
  should build.

## Out of scope here

- The UI rendering of the causal report. A popover, a separate
  pane, an MCP-mediated drawer — all reasonable; pick at
  implementation time.
- Performance work for large buffers. The query is per-glyph;
  buffer-wide attribution (highlight every byte by session) is a
  separate card.
- "Why is this _line_ here?" The first cut is glyph-precision
  because Echo's attribution is intent-precise; line-precision
  invents a synthesis layer that does not yet have a natural
  shape.

## Companion

- `docs/method/backlog/leash/jedit-session-port.md` — when this
  leash fires, this card becomes implementable.
- (Echo) `docs/design/0025-sessions-as-causal-contexts/phase-2-handoff.md`
  — the engine-side `SessionEventLog` invariants this UI gesture
  depends on.
- (Echo) `docs/design/0025-sessions-as-causal-contexts/phase-2-notes.md`
  — the pinned implementation decisions; in particular D4 (Session
  storage module) and D5 (SessionEventLog strategy) determine the
  read-side query shape this UI will call.
