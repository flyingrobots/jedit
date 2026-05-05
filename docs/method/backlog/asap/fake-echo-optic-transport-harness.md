---
title: fake-echo-optic-transport-harness
lane: asap
owner: jedit runtime
priority: high
keywords:
  - optic
  - echo
  - fake
  - transport
  - tests
acceptance_criteria:
  - Tests exercise a fake Echo-backed Text File Optic only through `EchoWasmKernelTransport`.
  - The fake accepts encoded query and mutation bytes and returns encoded readings, receipts, or obstructions.
  - App tests cannot call the in-memory hot text runtime directly for file mutations.
  - Boundary encoding and decoding stay inside an adapter or codec module.
  - The fake proves stale-base rejection or obstruction for at least one edit.
---

# fake-echo-optic-transport-harness

Build the test harness that lets `jedit` prepare for Echo Optics before Echo
ships the real API.

Context:

- The current `createInMemoryJeditOpticClient` is GraphQL-shaped but still maps
  directly to app runtime calls.
- The future seam should look like Echo: encoded Intent or query bytes enter a
  transport, and encoded result bytes come back.
- The fake may use the in-memory runtime internally, but that must not leak to
  app-facing tests.

This task is the first executable step after the planning packet because it
lets later slices prove architecture with tests instead of chat.

## Non-Goals

- Cloning Echo inside `jedit`.
- Guessing final EINT wire bytes.
- Implementing the real Wesley-generated client.

