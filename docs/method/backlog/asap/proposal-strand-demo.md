---
title: proposal-strand-demo
lane: asap
owner: jedit editor
priority: high
keywords:
  - proposal
  - strand
  - suggestion
  - ux
  - causal
acceptance_criteria:
  - A larger suggestion appears as a proposal with basis coordinate, affected range, summary, preview action, accept action, and reject action.
  - Creating and accepting the proposal route through Intent-shaped fake Echo transport calls.
  - Preview uses a reading and does not silently mutate the current file projection.
  - Rejecting the proposal dismisses it without admitting changes.
  - Tests or scripted fixtures cover accept, reject, and stale proposal obstruction.
---

# proposal-strand-demo

Prototype the first proposal-as-strand user experience.

Context:

- Larger suggestions should be governed proposals, not invisible edits.
- The user needs to understand scope and consequence without reading a chat
  transcript.
- The demo should help tune the amount of visible basis, summary, and preview
  state.

Good first proposal sources:

- deterministic text transform over a selection
- local repeated-token rename fixture
- small formatting-like rewrite
- inserted block with a known affected range

The point is the UX contract, not AI quality.

## Non-Goals

- Full AI chat.
- Multi-file proposal admission.
- Full partial-accept UI.
- Complete merge policy for competing proposal strands.
