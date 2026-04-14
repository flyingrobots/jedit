---
title: echo-anchor-adapter-contract
lane: asap
owner: jedit runtime
priority: medium
keywords:
  - anchors
  - echo
  - adapter
  - warp
blocked_by:
  - interval-anchor-semantics
acceptance_criteria:
  - The design defines the first adapter contract that maps Echo or WARP receipts and heads into the text-domain anchor transform law.
  - The contract makes clear which data belongs to the domain seam and which belongs to the Echo adapter boundary.
  - The cycle proves Echo can host the anchor law without leaking graph or storage details back into the domain contract.
---

# echo-anchor-adapter-contract

Define the first Echo-facing adapter contract that maps real WARP or Echo
receipts and heads into the text-domain anchor transform law.

This slice should come after interval-anchor semantics are defined. The point is
to prove the domain contract can be hosted in Echo without leaking adapter
detail back into the core.

## Non-goals

- [ ] Implementing the full Echo-backed text runtime.
- [ ] Replacing the domain contract with Echo-native types.
- [ ] Editor UI integration.
