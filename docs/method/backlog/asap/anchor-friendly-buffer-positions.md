---
title: anchor-friendly-buffer-positions
lane: asap
owner: jedit runtime
priority: medium
keywords:
  - anchors
  - positions
  - cursor
  - selections
  - runtime
acceptance_criteria:
  - Internal cursor/selection/bookmark positions move toward anchor-friendly semantics rather than brittle ad hoc offsets.
  - The implementation leaves room for future point and interval anchor integration instead of hard-wiring UI-specific position logic everywhere.
  - Editor-facing positions remain fast enough for current TUI use.
  - The work does not require Echo or persistence to be useful.
---

# anchor-friendly-buffer-positions

Start paying down the gap between the current editor cursor model and the
future anchor-based runtime model.

Context:

- The backlog already contains point and interval anchor law work.
- `jedit` will eventually want comments, diagnostics, AI targets, and stable
  selections that survive edits better than raw offsets do.
- The editor does not need the full anchor system yet, but it should stop
  making that future harder.

## Non-Goals

- Persisted anchor serialization.
- Full anchor UI.
- Echo adapter wiring.
