---
title: text-file-optic-contract-surface
lane: asap
owner: jedit runtime
priority: high
keywords:
  - optic
  - graphql
  - wesley
  - text-window
  - intent
acceptance_criteria:
  - `contracts/jedit/hot-text-runtime.graphql` names a Text File Optic surface without removing the current `worldlineSnapshot` proving read.
  - The contract distinguishes bounded read operations from mutation Intent operations.
  - The read surface includes explicit viewport/window budgets and never requires returning the full file for source painting.
  - The write surface includes base coordinate or base head identity so stale writes can be rejected or obstructed.
  - The contract states which nouns are `jedit` text semantics and which are generic Echo substrate concepts.
---

# text-file-optic-contract-surface

Define the GraphQL-authored Text File Optic contract surface.

Context:

- `jedit` already has `createBufferWorldline`, `replaceRangeAsTick`,
  `createCheckpoint`, and `worldlineSnapshot`.
- That proves the first mutation and observer slices, but the source editor
  still needs bounded reads and Intent-shaped writes through an optic.
- The planning packet is
  [optic-backed-file-model](../../../design/0006-optic-backed-file-model/optic-backed-file-model.md).

This task should evolve the authored contract vocabulary toward:

- `TextFileOptic`
- `TextWindowReading`
- `TextLineReading`
- `openTextFileOptic`
- `textWindow`
- `replaceTextRange` or the optic-facing successor to `replaceRangeAsTick`

## Non-Goals

- Removing `worldlineSnapshot` before the bounded read family is proven.
- Implementing real Echo Optic hosting.
- Making Echo core aware of text files or editor ranges.

