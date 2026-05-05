---
title: dynamic-footprint-binding-contract
lane: asap
owner: jedit runtime
priority: high
keywords:
  - wesley
  - footprint
  - rewrite
  - echo
  - jedit
acceptance_criteria:
  - The repo defines the split between static footprint schema and dynamic runtime binding.
  - The design names the minimum footprint vocabulary needed for `jedit`: slots, bindings, closures, creates, updates, and forbidden surfaces.
  - `ReplaceRangeAsTick` is specified as a bounded causal-text rewrite whose dynamic rope/anchor bindings stay inside a statically declared closure.
  - The design includes at least one second rewrite family, such as `CreateCheckpoint`, to prove the model is not specific to range replacement alone.
  - The packet distinguishes compile-time honesty failures from runtime binding failures.
---

# dynamic-footprint-binding-contract

Define how `jedit`'s real causal-text rewrites should stay dynamically bound at
runtime while still admitting compile-time honesty checks through Wesley.

Context:

- `jedit` does not operate on abstract `Foo` and `Bar` nouns. It operates on
  `BufferWorldline`, `RopeHead`, `RopeBranch`, `RopeLeaf`, `TextBlob`,
  `Anchor`, `Tick`, `TickReceipt`, and `Checkpoint`.
- The most important rewrite, `ReplaceRangeAsTick`, cannot know its exact rope
  path, blob reuse, or affected anchors until runtime.
- The stack still wants dishonest rewrite access to fail statically when the
  implementation tries to reach outside its declared causal-text focus.

This note should define the contract that makes both things true:

- dynamic runtime binding of real editor data
- static honesty of the rewrite capability surface

## Non-Goals

- Implementing the full Wesley directive grammar in this cycle.
- Implementing Echo runtime bindings in this repo.
- Designing strand and braid admission for `jedit` v1.
- Pretending the compiler can know exact runtime node identities ahead of time.
