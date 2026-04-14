---
title: grouped-editor-transactions-and-undo-bursts
lane: asap
owner: jedit runtime
priority: high
keywords:
  - undo
  - transactions
  - editing
  - runtime
  - causal
acceptance_criteria:
  - The editor can group primitive text mutations into human-meaningful undo/redo bursts.
  - Typing bursts, paste actions, deletes, and explicit commands do not all collapse into the same transaction policy.
  - The grouping law is explicit enough to carry forward into future causal receipts.
  - The implementation does not require Echo integration to be useful now.
---

# grouped-editor-transactions-and-undo-bursts

Move the editor from "one stack entry per low-level change" toward lawful
editor transactions.

Context:

- We already know the future causal model should distinguish primitive text
  receipts from higher-level human edits.
- Even before Echo exists in the product, jedit should behave like it
  understands typing bursts, pastes, and command edits as different kinds of
  things.

This is immediate UX work and future runtime work at the same time.

## Non-Goals

- Full causal history UI.
- Persisted receipts or strands.
