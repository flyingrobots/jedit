---
title: queryview-optic-convergence
lane: asap
owner: jedit runtime
priority: high
keywords:
  - echo
  - optic
  - queryview
  - text-window
  - stack-witness
acceptance_criteria:
  - >
    QueryView reads are modeled as optic-shaped observations at the jedit
    boundary instead of a permanent direct-query side door.
  - >
    The Stack Witness 0001 consumer path can run against a real Echo-hosted
    ReadingEnvelope plus QueryBytes result when the Echo WASM package is
    consumable from jedit.
  - >
    Text-window payload decoding happens only in the boundary adapter, and the
    editor core continues to consume app-owned TextWindowReading objects.
  - >
    The cutover keeps create/edit/read tests intact for createBuffer,
    replaceRange, and textWindow.
  - >
    The implementation does not add Continuum dependencies or redesign the
    jedit contract surface.
---

# queryview-optic-convergence

Carry the Stack Witness 0001 `QueryView` read toward the intended optic-shaped
boundary.

The current jedit seam is already Echo-shaped: it submits intent bytes through
an `EchoWasmKernelTransport` and observes through the same port. The fake host
is still an app-local scaffold, though, and its `textWindow` response is already
decoded into a jedit reading object rather than first consuming Echo's real
`ReadingEnvelope + QueryBytes` fixture output.

The next convergence step is not to redesign jedit's contract. The next step is
to let the boundary adapter consume the real Echo Stack Witness result and map
that byte payload into the app-owned `TextWindowReading` shape.

## Desired Shape

- jedit submits create/edit intent through an Echo transport.
- Echo admits or obstructs the intent and owns causal-history truth.
- jedit observes an optic-shaped `textWindow` read.
- Echo returns `ReadingEnvelope + QueryBytes`.
- the boundary adapter decodes those bytes into the existing app-facing
  `TextWindowReading`.

## Non-Goals

- Implementing Continuum transport in this task.
- Renaming the jedit product contract to match Echo's temporary fixture names.
- Moving text editor nouns into Echo core.
- Replacing the fake transport before the real Echo WASM package can be loaded
  by jedit tests.
