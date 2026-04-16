---
title: "echo-backed-rope-worldline-contract"
lane: asap
owner: "jedit runtime"
priority: high
keywords:
  - "echo"
  - "rope"
  - "worldline"
  - "causal"
  - "editor-runtime"
acceptance_criteria:
  - `jedit` has a written contract for a hot rope-worldline that is parser-independent and lawful while dirty.
  - The contract defines the canonical text edit primitive, receipt shape, anchor expectations, and transaction grouping posture.
  - The contract is explicit about what belongs in the hot layer versus Graft structural projections and cold Git witnesses.
  - The contract is suitable for implementation in Echo or an `echo-text` style crate without forcing Graft snapshot APIs to become the editor kernel.
---

# echo-backed-rope-worldline-contract

Define the hot text-truth substrate for `jedit`.

Context:

- `jedit` needs a canonical editable truth that updates with live editing,
  not Git commit cadence.
- Echo is already the hot runtime in the broader Continuum model and already
  has WASM-facing posture that makes it plausible as the native substrate.
- Graft is now strong enough to own warm structural projections, which sharpens
  the need for a separate hot text-runtime contract.

This note should answer: what exactly is the rope-worldline, what is its
primitive edit law, what are its receipts, and how do anchors and transactions
fit without collapsing into parser or Git concerns.

## Non-Goals

- Implementing the full runtime.
- Deciding every persistence detail for cold storage.
- Replacing Graft structural projections with the hot text substrate.
