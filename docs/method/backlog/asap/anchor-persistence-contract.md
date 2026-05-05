---
title: anchor-persistence-contract
lane: asap
owner: jedit runtime
priority: medium
keywords:
  - anchors
  - persistence
  - serialization
blocked_by:
  - interval-anchor-semantics
acceptance_criteria:
  - The contract defines how point and interval anchors serialize and reload without leaking Echo storage details into the domain law.
  - The design names the stable persisted fields for anchor identity, boundaries, and bias or gravity semantics.
  - The cycle stays at the contract layer and does not require a production persistence adapter.
---

# anchor-persistence-contract

Define how point and interval anchors serialize and reload without leaking
storage or Echo-specific persistence details into the domain contract.

This slice should happen only after point and interval semantics are stable. The
deliverable is a contract that can later be hosted by filesystem or Echo
adapters without changing the domain law.

## Non-goals

- [ ] Production persistence implementation.
- [ ] Echo adapter implementation.
- [ ] Editor UI integration.
