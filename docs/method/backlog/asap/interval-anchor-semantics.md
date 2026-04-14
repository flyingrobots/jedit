---
title: interval-anchor-semantics
lane: asap
owner: eddit runtime
priority: high
keywords:
  - anchors
  - intervals
  - replace-range
  - domain-law
blocks:
  - anchor-persistence-contract
  - anchor-editor-integration
  - echo-anchor-adapter-contract
acceptance_criteria:
  - The design packet defines interval-anchor semantics in terms of logical ReplaceRange receipts rather than rope maintenance.
  - The red contract suite covers insertion at the start boundary, insertion at the end boundary, replacement fully inside the interval, overlap across one boundary, and full-swallow collapse.
  - The runtime seam remains purely domain-level and does not require Echo, persistence, or editor UI wiring.
  - The cycle clarifies whether a fully collapsed interval remains an interval anchor or normalizes to a point-anchor equivalent.
---

# interval-anchor-semantics

Define the first executable contract for interval-anchor semantics over logical
ReplaceRange receipts.

This is the next sharp seam after point-anchor semantics. It should pin down how
a range anchor behaves when:

- insertions land at the start boundary
- insertions land at the end boundary
- replacements happen fully inside the interval
- a replacement overlaps one boundary
- a replacement swallows the whole interval

The goal is to make selections, comments, diagnostics, and AI target ranges
lawful domain objects before persistence or UI integration is attempted.

## Non-goals

- [ ] Anchor persistence or serialization.
- [ ] Echo adapter wiring.
- [ ] Editor UI wiring.
- [ ] Rope-maintenance transforms.
