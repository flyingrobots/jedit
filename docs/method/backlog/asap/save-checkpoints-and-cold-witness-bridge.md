---
title: save-checkpoints-and-ecosystem-export-bridge
lane: asap
owner: jedit runtime
priority: medium
keywords:
  - save
  - checkpoints
  - git-warp
  - export
  - projection
acceptance_criteria:
  - The repo defines how a save checkpoint in `jedit` relates to ecosystem export layers such as Git and `git-warp`.
  - The design is explicit that Git commits export or mirror an editor projection rather than define when editor truth exists.
  - The bridge design names what artifacts or summaries move from Echo causal history into filesystem and Git projections.
  - The design stays honest about the difference between local editor checkpoints and Git commits.
---

# save-checkpoints-and-ecosystem-export-bridge

Define how `jedit` save checkpoints connect to filesystem and Git ecosystem
exports.

Context:

- The editor needs save to behave like a checkpoint instead of a reset.
- Echo owns canonical durable causal history.
- The filesystem remains a working projection.
- `git-warp` remains valuable for public hosting, CI, commit-shaped exchange,
  and compatibility with existing repository ecosystems.
- Without an explicit bridge, the stack risks either waiting on Git for live
  truth or treating exports as unrelated side effects.

This note should define how save checkpoints, explicit admissions, and future
Git exports relate without pretending they are all the same event.

## Non-Goals

- Designing a full commit automation workflow.
- Forcing every save to immediately become a Git export.
- Collapsing local editor checkpoints into Git semantics.
