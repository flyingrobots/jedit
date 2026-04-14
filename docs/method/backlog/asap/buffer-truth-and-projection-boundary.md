---
title: buffer-truth-and-projection-boundary
lane: asap
owner: jedit runtime
priority: high
keywords:
  - buffer
  - projections
  - architecture
  - truth
  - editor
acceptance_criteria:
  - The codebase makes a hard distinction between buffer truth and derived projections such as preview, outline, footer context, and future AST views.
  - Source rendering, markdown preview, and Graft-backed views all consume projections rather than mutating buffer truth directly.
  - Dirty-buffer posture becomes easier to state because saved-file and in-memory projections are not conflated.
  - The seam is explicit enough to support future Echo/Graft adapters cleanly.
---

# buffer-truth-and-projection-boundary

Make it explicit that the editable buffer is the canonical runtime object and
everything else is a projection.

Context:

- This has already shown up in conversation around causal editing, Markdown
  preview, and Graft-backed structure.
- If we let preview, outline, source paint, and save semantics blur together,
  the editor will become harder to evolve before the real causal substrate
  even exists.

This note is the architectural version of "don’t lie to yourself."

## Non-Goals

- Implementing Echo now.
- Replacing plain files as the visible artifact.
