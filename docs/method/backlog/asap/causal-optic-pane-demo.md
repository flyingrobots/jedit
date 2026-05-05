---
title: causal-optic-pane-demo
lane: asap
owner: jedit editor
priority: medium
keywords:
  - pane
  - optic
  - preview
  - focus
  - ux
acceptance_criteria:
  - A temporary pane can show a proposal preview, checkpoint comparison, or second viewport as an Optic reading.
  - The pane has a clear subject, basis posture, and dismiss path.
  - Focus ownership is visible and footer hints change while the pane owns input.
  - Inactive panes do not advertise active controls.
  - Tests or scripted fixtures cover opening, focusing, and dismissing the pane.
---

# causal-optic-pane-demo

Prototype causal panes as focused Optic views instead of generic splits.

Context:

- The v1 direction says panes should be semantic views, not layout clutter.
- The fake Echo demo needs a preview surface for proposal and checkpoint
  comparisons.
- This is the first chance to judge whether causal panes preserve the zen
  editor feeling.

First pane subjects:

- current vs proposal
- current vs last checkpoint
- same file, different bounded window

The pane should appear because the user is deciding something or inspecting a
specific subject. It should be cheap to dismiss.

## Non-Goals

- Persistent multi-pane workspace management.
- Complete split layout controls.
- Rich graphical history visualization.
