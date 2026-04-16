---
title: "echo-backed-rope-worldline-contract"
legend: "none"
cycle: "0003-echo-backed-rope-worldline-contract"
source_backlog: "docs/method/backlog/asap/echo-backed-rope-worldline-contract.md"
---

# echo-backed-rope-worldline-contract

Source backlog item: `docs/method/backlog/asap/echo-backed-rope-worldline-contract.md`
Legend: none

## Sponsors

- Human: Backlog operator
- Agent: Implementation agent

These labels are abstract roles. In this design, `user` means the served
perspective, like in a user story, not a literal named person or
specific agent instance.

## Hill

Turn the hot text-runtime direction into the first explicit contract packet for
the future Echo-backed editor kernel. At the end of this cycle, `jedit` should
have a design packet that makes five claims concrete:

1. the canonical editable truth is a hot rope-worldline rather than an AST
   snapshot or Git-grounded artifact
2. hot, warm, and cold runtime temperatures have explicit ownership boundaries
3. Graft owns warm structural projections over rope heads rather than the
   editor kernel itself
4. save acts as a checkpoint rather than a reset of editor truth
5. causal history retention is tiered across raw receipts, transactions, and
   checkpoints/admissions rather than "keep everything forever" or "discard
   everything on save"

This cycle is complete when those claims are named in this design, aligned with
the runtime-temperature note, and turned into explicit playback questions for
the next executable seams. This cycle is intentionally design-first: it does
not implement Echo bindings, a rope runtime, or new editor UI.

## Playback Questions

### Human

- [ ] The cycle clearly says the rope-worldline is canonical, the AST
  worldline is derived, and Git commits are durable witnesses rather than the
  cadence of editor truth.
- [ ] The cycle makes the hot / warm / cold ownership split explicit across
  `jedit`, Echo, Graft, and `git-warp`.
- [ ] The cycle explains save as a checkpoint rather than a reset.
- [ ] The cycle names a tiered retention model for raw receipts, transactions,
  and checkpoints/admissions.
- [ ] The cycle limits scope to the runtime contract rather than pretending to
  implement the substrate.

### Agent

- [ ] The packet names the hot runtime truths the future rope-worldline must
  own: text receipts, anchors, transactions, and parser-independent editing
  truth.
- [ ] The packet names the warm Graft projection responsibilities: syntax
  spans, folds, diagnostics, node lookup, structural selection, rename
  preview, diff, and semantic summary.
- [ ] The packet names the cold witness responsibilities for Git and
  `git-warp`.
- [ ] The packet makes explicit that Graft's current `StructuredBuffer` shape
  is projection-oriented rather than the canonical editor kernel.
- [ ] The packet leaves the next executable seams obvious: rope contract,
  warm-projection adapter contract, retention policy, and save-to-cold
  witness bridge.

## Accessibility and Assistive Reading

- Linear truth / reduced-complexity posture: this cycle should remain readable
  as a short architecture packet. It should prefer explicit ownership and truth
  classes over diagrams or metaphors that require prior Continuum knowledge.
- Non-visual or alternate-reading expectations: playback must be inspectable
  through plain markdown reads alone. No claim in this cycle depends on visual
  editor demos or interactive runtime screenshots.

## Localization and Directionality

- Locale / wording / formatting assumptions: the packet should use stable
  engineering nouns such as `rope-worldline`, `transaction`, `checkpoint`, and
  `witness`, and should avoid idioms that make later localization harder.
- Logical direction / layout assumptions: hot / warm / cold refer to runtime
  temperature, not visual layout. The packet should avoid left/right or
  top/bottom metaphors when describing causal ownership.

## Agent Inspectability and Explainability

- What must be explicit and deterministic for agents: the ownership split and
  truth classes must be visible directly in repo docs so future agent work does
  not infer editor-kernel behavior from chat or stale assumptions.
- What must be attributable, evidenced, or governed: the packet must be
  attributable to current repo truth in `README.md`, `ARCHITECTURE.md`,
  `docs/design/runtime-temperatures.md`, and the existing text-runtime design
  notes rather than free-floating discussion.

## Non-goals

- [ ] Implementing an Echo crate, WASM guest, or TypeScript bindings in this
  cycle.
- [ ] Implementing the rope runtime itself.
- [ ] Replacing Graft with Echo or collapsing the two into one undifferentiated
  engine.
- [ ] Designing every long-term persistence detail for cold storage.
- [ ] Treating Git commit cadence as the live update cadence of the editor.

## Backlog Context

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
