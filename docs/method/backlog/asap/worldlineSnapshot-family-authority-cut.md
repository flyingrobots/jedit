---
title: worldlineSnapshot-family-authority-cut
lane: asap
owner: jedit runtime
priority: high
keywords:
  - worldlineSnapshot
  - graphql
  - generated
  - reading
  - authority
acceptance_criteria:
  - The repo states exactly which parts of `worldlineSnapshot` are authored family truth, which are generated artifacts, and which are later runtime-emitted values.
  - The packet explains how the generated observer-plan artifact relates to the GraphQL-authored family without becoming a second source of truth.
  - The cut leaves downstream maintainers with one clean authority story for the `worldlineSnapshot` slice.
---

# worldlineSnapshot-family-authority-cut

Freeze the authority story for `worldlineSnapshot`.

Right now the slice is useful but easy to misread because several layers are
present at once:

- GraphQL-authored contract family
- generated observer-plan artifact
- runtime reading-envelope wrapper

This item should make the layers explicit so that future work does not treat a
generated artifact or runtime wrapper as peer authority with the authored
contract itself.

## Non-Goals

- Widening `worldlineSnapshot` to solve every future read need.
- Replacing the whole app projection layer in one move.

