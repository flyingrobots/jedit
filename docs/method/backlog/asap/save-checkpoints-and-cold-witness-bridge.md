---
title: save-checkpoints-and-cold-witness-bridge
lane: asap
owner: jedit runtime
priority: medium
keywords:
  - save
  - checkpoints
  - git-warp
  - witnesses
  - cold-runtime
acceptance_criteria:
  - The repo defines how a save checkpoint in `jedit` relates to colder witness layers such as Git and `git-warp`.
  - The design is explicit that Git commits witness or anchor editor truth rather than define when editor truth exists.
  - The bridge design names what artifacts or summaries move from hot/warm layers into cold durable history.
  - The design stays honest about the difference between local editor checkpoints and Git commits.
---

# save-checkpoints-and-cold-witness-bridge

Define how `jedit` save checkpoints connect to colder durable witness layers.

Context:

- The editor needs save to behave like a checkpoint instead of a reset.
- `git-warp` remains valuable for durable repo history and commit-grounded
  AST worldlines.
- Without an explicit bridge, the stack risks either waiting on Git for live
  truth or drifting into two unrelated histories.

This note should define how save checkpoints, explicit admissions, and future
commit witnesses relate without pretending they are all the same event.

## Non-Goals

- Designing a full commit automation workflow.
- Forcing every save to immediately become a durable cold witness.
- Collapsing local editor checkpoints into Git semantics.
