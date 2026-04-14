---
title: dirty-buffer-honesty-for-graft-backed-drawers
lane: asap
owner: jedit editor
priority: high
keywords:
  - graft
  - dirty-buffers
  - honesty
  - drawer
  - editor
acceptance_criteria:
  - Any Graft-backed drawer content makes clear whether it reflects the current buffer or only the last saved file state.
  - Dirty editor buffers show an explicit stale or saved-state posture instead of silently reusing on-disk structure as if it were current.
  - Saving or manual refresh updates the drawer posture deterministically.
  - The user can still get value from last-saved structure while the buffer is dirty.
---

# dirty-buffer-honesty-for-graft-backed-drawers

Make every Graft-backed panel in `jedit` truthful about saved versus unsaved
state.

Context:

- Today the editor can be ahead of disk.
- Current Graft surfaces are largely file/workspace oriented.
- Until Graft supports buffer-aware outline/syntax surfaces, the editor must
  not blur those two truths together.

This is a product integrity task more than a visual task. The drawer should be
allowed to show useful structure from disk, but it must say when it is doing
that.

## Non-Goals

- Implementing buffer-aware parsing in Graft from the jedit side.
- Blocking all drawer use whenever a buffer is dirty.
