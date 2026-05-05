---
title: braid-backed-file-projection-optic
lane: asap
owner: jedit runtime
priority: high
keywords:
  - braid
  - strand
  - optic
  - projection
  - echo
acceptance_criteria:
  - The repo defines how a Text File Optic can focus a worldline plus an active braid.
  - The first braid law is sequential: each new edit forks from the current braid projection frontier.
  - Reads observe the projected braid state, not an editor-local patch list.
  - Writes carry the braid frontier coordinate and either admit the next strand or return an obstruction.
  - Tests or design examples cover `baseline + S0 + S1 + S2` projection behavior.
---

# braid-backed-file-projection-optic

Define the first braid-backed Text File Optic model.

Context:

- Echo has strands and braids as first-class concepts.
- `jedit` wants a file to be readable and writable as a worldline plus active
  braid projection.
- For the first useful model, edits can be sequential: each next strand forks
  from the current projected frontier.

This task should keep the braid projection in Echo-shaped causal vocabulary
rather than recreating a local patch-list authority inside the editor.

## Non-Goals

- Full multi-user merge policy.
- Rich visual braid inspection UI.
- Wormhole or history-compaction implementation.

