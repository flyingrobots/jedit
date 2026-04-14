---
title: Anchor Transform Semantics
lane: graveyard
owner: eddit runtime
priority: high
acceptance_criteria:
  - The cycle packet defines anchor transforms in terms of logical ReplaceRange receipts rather than rope maintenance.
  - The red contract suite covers left-biased insertion, right-biased insertion, forward shift after replacement, and collapse inside deletion for point anchors.
  - The runtime seam lives in src/domain/anchor-transform-contract.ts and remains intentionally minimal.
  - The cycle scope explicitly excludes interval anchors, anchor persistence, and rope-maintenance events.
---

# Anchor Transform Semantics

## Disposition

Cycle 0002 completed the point-anchor contract that this backlog item described. Keeping the umbrella note in `asap` now creates queue drift because its acceptance criteria are already satisfied. The remaining worthwhile work is narrower and should live as separate follow-on items: interval-anchor semantics, anchor persistence, editor integration, and the Echo adapter contract.

## Original Proposal

After `ReplaceRange`, the next sharp seam is anchor behavior. The point of
this task is not to implement the full anchor system; it is to define the first
contract for how a point anchor moves when a logical text edit happens.

This slice should stay narrow:

- point anchors only
- logical ReplaceRange receipts only
- bias-aware insertion behavior
- forward shift and deletion collapse behavior

## Non-goals

- [ ] Interval anchors.
- [ ] Anchor persistence or serialization.
- [ ] Rope-maintenance transforms.
- [ ] Wiring anchors into the current Bijou editor UI.
