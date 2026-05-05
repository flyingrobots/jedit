---
title: optic-client-generation-cutover
lane: asap
owner: jedit runtime
priority: medium
keywords:
  - optic
  - wesley
  - generated
  - echo
  - cutover
acceptance_criteria:
  - The fake/direct optic client and the future Wesley-generated Echo client share one app-facing port.
  - Generated contract types become the source of input and reading shapes for optic operations.
  - App code does not depend on fake-only operation names, codecs, or transport shortcuts.
  - The cutover plan names exactly which adapter can be deleted when Echo supports hosted contract optics.
  - Existing optic tests can run against the fake and later against a real Echo adapter with minimal fixture changes.
---

# optic-client-generation-cutover

Prepare the eventual switch from fake/direct Optic clients to Wesley-generated
Echo Optic clients.

Context:

- `jedit` can do useful internal work before Echo ships contract optics.
- That work must not create a second permanent client model.
- The port should stay stable while adapters change beneath it.

This task should define the cutover boundary so the fake remains a scaffold,
not a forked runtime.

## Non-Goals

- Depending on an Echo API that has not shipped yet.
- Preserving fake-only codecs after the generated client exists.
- Rewriting the entire app around generated types in one pass.

