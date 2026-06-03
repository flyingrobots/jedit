---
title: source-render-pipeline-that-can-swap-local-and-graft-highlighting
lane: asap
owner: jedit editor
priority: high
keywords:
  - source
  - renderer
  - syntax-highlighting
  - graft
  - tui
acceptance_criteria:
  - The source pane uses a dedicated render/classification boundary rather than mixing syntax decisions into buffer editing logic.
  - Local syntax paint and future Graft syntax spans can flow through the same renderer contract.
  - Styling remains a paint-time concern; buffer text stays free of ANSI or style escapes.
  - Unsupported languages degrade cleanly to plain source rendering.
---

# source-render-pipeline-that-can-swap-local-and-graft-highlighting

Put the source pane on the same architectural footing as the new markdown
preview renderer: classification on one side, paint on the other.

Context:

- `jedit` can already paint per-cell color in the terminal.
- Current Graft direct API surfaces are still structural, not token/span oriented.
- We want visible editor improvement now without painting ourselves into a
  corner before Graft grows buffer-aware syntax span APIs.

This note is the seam that makes that possible. The source renderer should have
one contract for "here are spans/classes to paint" regardless of whether those
classes come from local heuristics today or Graft AST spans later.

## Non-Goals

- Shipping full syntax highlighting by itself.
- Designing the future Graft API inside jedit.
- Entangling rendering with the editor’s buffer mutation logic.
