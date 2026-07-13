---
title: "replace-range-contract"
legend: "none"
cycle: "0001-replace-range-contract"
source_backlog: "docs/method/backlog/asap/replace-range-contract.md"
---

# replace-range-contract

Source backlog item: `docs/method/backlog/asap/replace-range-contract.md`
Legend: none

## Sponsors

- Human: Backlog operator
- Agent: Implementation agent

These labels are abstract roles. In this design, `user` means the served
perspective, like in a user story, not a literal named person or
specific agent instance.

## Hill

Turn `ReplaceRange` into the first explicit, executable seam of the future
Echo-backed text kernel by locking the contract between prose, tests, and
runtime stub. At the end of this cycle, `jedit` should have a design packet,
executable spec, and minimal green implementation that make three claims
concrete:

1. inserting a fragment satisfies the materialization law
2. deleting text is just replacement by the empty fragment
3. replacing a range with identical logical text is a no-op

This cycle is complete when those claims are named in this design, expressed in
tests, and satisfied by the initial runtime contract implementation. This cycle
still does not require persistent rope storage, anchors, strands, or
admission.

## Playback Questions

### Human

- [ ] ReplaceRange is named as the first kernel seam in this cycle.
- [ ] This cycle pins down insert/materialization, delete-by-empty-fragment,
  and logical no-op.
- [ ] This cycle limits scope to the minimal ReplaceRange seam.
- [ ] This cycle makes accessibility, localization, and agent inspectability
  explicit.

### Agent

- [ ] ReplaceRange insertion satisfies the materialization law.
- [ ] ReplaceRange deletion is replacement by the empty fragment.
- [ ] ReplaceRange returns the same root and no receipt for a logical no-op.
- [ ] The runtime contract stays a minimal ReplaceRange seam rather than a full
  rope engine.
- [ ] The workspace satisfies build, quality, and the ReplaceRange contract
  suite.

## Accessibility and Assistive Reading

- Linear truth / reduced-complexity posture: the cycle should remain readable as
  plain text. The contract is expressed as short invariant-style statements plus
  direct red tests rather than diagram-heavy explanation.
- Non-visual or alternate-reading expectations: playback must be inspectable
  through file reads and test output alone. No claimed result depends on a
  visual demo or terminal animation.

## Localization and Directionality

- Locale / wording / formatting assumptions: the contract uses stable English
  engineering nouns such as `fragment`, `range`, and `receipt`. It should avoid
  idioms that would make future localization harder.
- Logical direction / layout assumptions: the contract is phrased in logical
  range terms (`start`, `end`) and does not depend on left/right UI metaphors.

## Agent Inspectability and Explainability

- What must be explicit and deterministic for agents: the exact public contract
  types and the three expected behaviors must be visible in source and asserted
  in tests. Agents should not need to infer hidden intent from chat.
- What must be attributable, evidenced, or governed: the green implementation
  must be attributable back to these playback questions and the contract tests
  they produced. This cycle's witness is the passing contract suite plus the
  minimal runtime implementation.

## Non-goals

- [ ] Implementing persistent piece-rope storage.
- [ ] Implementing anchor transforms.
- [ ] Implementing strands or admission.
- [ ] Refactoring the current Bijou UI around the future text kernel.

## Backlog Context

Turn the Echo-backed text-kernel direction into a real cycle centered on the `ReplaceRange` primitive. The immediate deliverable is an explicit design hill plus playback questions that align with the existing red contract tests for insertion/materialization law, deletion by empty fragment, and logical no-op behavior.

## Later Evolution

WF-0154 (2026-07-12) removed the module-global root-id counter this cycle's
minimal runtime shipped with: `createBufferRoot`, `createTextFragment`, and
`emptyFragment` now take explicit ids, `replaceRange` takes the next root id,
and tick admission threads `nextRootId` as chain state
(`spec/root-identity-determinism.spec.mjs`). The behavioral laws in this
document (materialization, deletion by empty fragment, logical no-op) are
unchanged.
