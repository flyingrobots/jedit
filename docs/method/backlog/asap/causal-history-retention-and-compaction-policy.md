---
title: causal-history-retention-and-compaction-policy
lane: asap
owner: jedit runtime
priority: high
keywords:
  - retention
  - compaction
  - receipts
  - transactions
  - checkpoints
  - causal
acceptance_criteria:
  - The repo defines separate retention horizons for raw edit receipts, transactions, and checkpoints/admissions.
  - Save semantics are explicit: save is a checkpoint, not a reset.
  - The design states what survives within a session, across save, across restart, and into longer-term durable history.
  - Compaction is explicitly allowed for fine-grained edit receipts without losing higher-level transaction truth.
---

# causal-history-retention-and-compaction-policy

Decide how much editor causality we keep and for how long.

Context:

- `jedit` does not want to lose useful causal history on save.
- `jedit` also should not keep every keystroke forever by default.
- The runtime-temperature model already suggests three truth classes:
  raw receipts, transactions, and checkpoints/admissions.

This note should turn that into an explicit retention and compaction policy so
the hot runtime, warm projections, and cold witnesses have a lawful handoff.

## Non-Goals

- Finalizing every storage backend.
- Committing to indefinite retention for raw keystroke history.
- Treating save as a destructive boundary that discards editor truth.
