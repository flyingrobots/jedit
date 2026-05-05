---
title: intent-only-editor-mutation-routing
lane: asap
owner: jedit editor
priority: high
keywords:
  - intent
  - optic
  - mutation
  - editor
  - receipts
acceptance_criteria:
  - Editor text mutations route through an optic write client instead of directly rewriting editor-owned canonical text.
  - Each write carries a base coordinate or base head identity from the last accepted reading or receipt.
  - Accepted writes advance editor state from receipts and follow-up readings.
  - Rejected or obstructed writes have a visible app-level handling path.
  - Tests cover insert, delete, paste or multi-character insert, and stale-base obstruction through the optic seam.
---

# intent-only-editor-mutation-routing

Move editor mutations onto the Intent-shaped Text File Optic path.

Context:

- The Echo-backed model says all file truth mutations happen through Intents.
- The Optic can make writes ergonomic, but it must not act like a direct setter.
- `jedit` needs this routing before the real Echo adapter arrives so UI code
  does not grow around a local string model.

This task should preserve current editing behavior while changing the authority
path beneath it.

## Non-Goals

- Implementing collaborative settlement UI.
- Replacing every local UI cache.
- Removing all direct text helpers before the optic path has equivalent test
  coverage.

