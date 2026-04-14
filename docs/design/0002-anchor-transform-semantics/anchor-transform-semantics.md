---
title: "anchor-transform-semantics"
legend: "none"
cycle: "0002-anchor-transform-semantics"
source_backlog: "docs/method/backlog/asap/anchor-transform-semantics.md"
---

# anchor-transform-semantics

Source backlog item: `docs/method/backlog/asap/anchor-transform-semantics.md`
Legend: none

## Sponsors

- Human: Backlog operator
- Agent: Implementation agent

These labels are abstract roles. In this design, `user` means the served
perspective, like in a user story, not a literal named person or
specific agent instance.

## Hill

Turn point-anchor transform semantics into the next explicit seam after
`ReplaceRange` by locking the contract between prose, tests, and a runtime
contract. At the end of this cycle, `jedit` should have a design packet,
executable spec, and minimal green implementation that make four claims
concrete:

1. a left-biased point anchor stays before inserted text at its byte
2. a right-biased point anchor moves after inserted text at its byte
3. a point anchor after a replacement shifts by the replacement byte delta
4. a point anchor inside a deleted span collapses to the replacement start

This cycle is complete when those claims are named in this design, expressed in
tests, and satisfied by the initial runtime contract implementation. This cycle
does not implement interval anchors, anchor persistence, rope-maintenance
semantics, or editor UI integration.

## Playback Questions

### Human

- [ ] Anchor transforms are defined in terms of logical ReplaceRange receipts
  rather than rope maintenance.
- [ ] This cycle pins down left-bias, right-bias, forward shift, and collapse
  semantics for point anchors.
- [ ] This cycle limits scope to point anchors over ReplaceRange receipts.
- [ ] This cycle makes accessibility, localization, and agent inspectability
  explicit.

### Agent

- [ ] A left-biased point anchor stays before inserted text at its byte.
- [ ] A right-biased point anchor moves after inserted text at its byte.
- [ ] A point anchor after a replacement shifts by the replacement byte delta.
- [ ] A point anchor inside a deleted span collapses to the replacement start.
- [ ] The runtime contract stays a minimal point-anchor seam rather than a full
  anchor system.
- [ ] The workspace satisfies build, quality, and the anchor transform contract
  suite.

## Accessibility and Assistive Reading

- Linear truth / reduced-complexity posture: the contract stays linear and
  point-based. The cycle talks about byte positions, receipts, and bias without
  requiring a visual editor demo.
- Non-visual or alternate-reading expectations: playback must be inspectable
  through file reads and test output. No claimed behavior depends on cursor
  animation or viewport state.

## Localization and Directionality

- Locale / wording / formatting assumptions: the contract uses stable English
  engineering nouns such as `anchor`, `bias`, `receipt`, and `replacement
  delta`, and avoids idiomatic prose.
- Logical direction / layout assumptions: left/right in this cycle refers only
  to bias semantics at a logical point. Position transforms are phrased in byte
  offsets and replacement ranges rather than screen coordinates.

## Agent Inspectability and Explainability

- What must be explicit and deterministic for agents: the point-anchor runtime
  surface, the bias constants, and the four expected transform behaviors must
  be visible in source and in tests. Agents should not need to infer anchor
  rules from chat.
- What must be attributable, evidenced, or governed: the green implementation
  must be attributable back to these playback questions and the anchor-transform
  contract suite.

## Non-goals

- [ ] Implementing interval-anchor semantics.
- [ ] Implementing anchor persistence or serialization.
- [ ] Treating rope-maintenance events as author-facing anchor semantics.
- [ ] Wiring the anchor contract into the current Bijou editor UI.

## Backlog Context

Define the first executable contract for point-anchor transform semantics over ReplaceRange. The cycle should pin down how point anchors behave when text is inserted at the anchor, before it, after a replacement, and inside a deletion, while keeping rope maintenance out of author-facing semantics.
