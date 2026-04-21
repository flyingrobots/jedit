---
title: graphql-authored-observer-family-cutover
lane: asap
owner: jedit runtime
priority: high
keywords:
  - graphql
  - observer
  - wesley
  - continuum
  - jedit
acceptance_criteria:
  - The repo states how the current `ObserverSpec` slice should be re-expressed under the stronger rule that authored truth is GraphQL plus directives.
  - The packet distinguishes authored family, compiled plan artifacts, and later runtime-emitted reading values.
  - The cut explains how `worldlineSnapshot` should remain a proving slice without preserving a side authoring DSL by accident.
  - The design names what stays app-owned in `jedit` versus what belongs to the Continuum observer module boundary.
---

# graphql-authored-observer-family-cutover

Reconcile `jedit`'s current observer-spec work with the now-locked doctrine
that GraphQL is the authored language and directives are the extension
mechanism.

Context:

- `jedit` already has a useful first proving slice around
  `worldlineSnapshot`.
- the repo currently still treats `ObserverSpec` as an app-authored object in
  TypeScript.
- the broader stack later froze a stronger rule:
  - authored truth is GraphQL
  - directives carry specialized semantics
  - there is no parallel side DSL

This item should stop that tension from lingering as folklore.

## Non-Goals

- Deleting the first observer slice.
- Rewriting the whole `jedit` runtime in this cycle.
- Turning generic Wesley into an observer host again.

