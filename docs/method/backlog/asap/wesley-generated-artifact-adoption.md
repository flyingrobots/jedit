---
title: wesley-generated-artifact-adoption
lane: asap
owner: jedit runtime
priority: high
keywords:
  - wesley
  - generated-artifacts
  - hot-text
  - contract
  - echo
---

# wesley-generated-artifact-adoption

Adopt Wesley-generated artifacts as jedit's authority surface for the hot text
runtime boundary.

Context:

- Wesley can emit Rust and TypeScript model plus operation-binding artifacts
  from the hermetic jedit hot text runtime GraphQL fixture.
- The next proof belongs in the repos that own the runtime behavior, not in
  generic Wesley.
- jedit should replace handwritten shadow model metadata where the authored
  GraphQL schema already owns the operation identity.

## Hill

jedit consumes Wesley-generated artifacts as the shared protocol surface for hot
text runtime capabilities, with no handwritten shadow models competing with the
authored GraphQL schema.

## Done looks like

- jedit replaces handwritten hot text runtime shape definitions with generated
  Wesley Rust/TypeScript artifacts where those artifacts are the source of
  authority.
- jedit adapters keep product behavior and editor runtime semantics app-owned.
- Echo consumption stays behind intent and observation boundaries; jedit does
  not import Echo substrate internals.
- Any missing generator configurability is brought back to Wesley as a specific
  source-level requirement with a fixture and failing test.

## Non-goals

- Do not move editor behavior into Wesley.
- Do not make Echo core aware of text files, buffers, ranges, or ropes.
- Do not treat generated fixture bytes as a permanent codec contract.
