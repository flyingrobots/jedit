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
5. causal history retention is tiered across tick receipts, ticks, edit
   groups, and checkpoints/admissions rather than "keep everything forever" or
   "discard everything on save"

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
- [ ] The cycle names a tiered retention model for tick receipts, ticks, edit
  groups, and checkpoints/admissions.
- [ ] The cycle limits scope to the runtime contract rather than pretending to
  implement the substrate.

### Agent

- [ ] The packet names the hot runtime truths the future rope-worldline must
  own: ticks, tick receipts, anchors, and parser-independent editing truth.
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
  engineering nouns such as `rope-worldline`, `tick`, `edit-group`,
  `checkpoint`, and `witness`, and should avoid idioms that make later
  localization harder.
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

## Contract

### Core law

- The rope-worldline is canonical.
- The AST worldline is derived.
- Git commits are durable witnesses, not the cadence of editor truth.

`jedit` therefore must not wait for `git commit` before live editor truth,
syntax surfaces, or structural context catch up.

### Runtime temperatures

`jedit` should treat its causal runtime as a temperature stack:

- `hot`
  the live editable text truth
- `warm`
  live structural projections over current text heads
- `cold`
  durable witness, history, and interop layers

The same noun must not silently slide between these temperature classes.

### Hot runtime truths

The hot layer is the editor-native truth.

It must own:

- `BufferWorldline`
- `RopeRoot`
- ticks as the canonical hot-worldline boundary
- tick receipts as the fine-grained hot witness surface
- anchors
- future strands and admissions

It must remain lawful when:

- the buffer is dirty
- the buffer does not parse
- the language is unsupported
- the editor has not saved yet
- the repo is not a Git repo

The hot layer is where `ReplaceRange`, anchor transforms, and tick admission
ultimately live.

`jedit` may layer edit groups and undo groups over ticks, but those groupings
must not be mistaken for the canonical worldline boundary.

### Warm projection truths

The warm layer is a structural interpretation of hot truth.

It must own:

- syntax spans
- fold regions
- parser-backed diagnostics
- node lookup
- structural selections
- rename preview
- structural diff and semantic summary
- anchor-affinity style snapshot mapping

The warm layer follows current rope heads or tick heads. It is allowed
to be partial when parsing fails and must degrade honestly for unsupported
languages.

Warm projections are not allowed to masquerade as canonical text truth.

### Cold witness truths

The cold layer is durable witness and long-horizon history.

It must own:

- Git-grounded repo artifact history
- commit-anchored AST worldlines
- durable provenance witnesses
- long-horizon replay and interop artifacts

Cold layers may lag behind live editing truth. They are not allowed to define
when truth exists inside the editor.

## Ownership

### `jedit`

`jedit` owns:

- product behavior
- modes
- panes, panels, and lenses
- save and open flows
- focus and interaction policy
- rendering policy

`jedit` does not own parser semantics or durable Git witness history.

### Echo / `echo-text`

Echo is the intended owner of hot rope-worldline truth.

That means:

- persistent piece-rope storage
- ticks and tick receipts
- anchors and transformable positions
- future strands and admissions

Echo is not the owner of UI behavior, panel lifecycle, or structural parser
projection semantics.

`jedit` is the right place for edit-group and undo policy layered over Echo
ticks.

### Graft

Graft owns warm structural intelligence over rope heads.

That means:

- interpreting current in-memory content
- producing parser-backed projections
- remaining truthful about partial parses and unsupported languages

Graft's current `StructuredBuffer` shape is already a strong warm projection
surface, but it is still projection-oriented. It is not the canonical editable
buffer runtime.

### `git-warp`

`git-warp` owns cold durable witness and Git-native causal history.

It should witness or anchor editor truth later. It should not decide the live
update cadence of the editor.

## Save and retention

### Save

Save is a checkpoint, not a reset.

Saving may:

- create a checkpoint
- materialize the current head to disk
- emit or prepare colder witness artifacts

Saving must not:

- destroy the hot rope-worldline
- discard undoable editor truth by default
- redefine when the editor's truth started to exist

### Retention tiers

Retention should be tiered:

- tick receipts
  short-horizon, compactable, not forever by default
- ticks
  canonical hot-worldline history that survives saves
- edit groups
  medium-lived, human-meaningful history layered over one or more ticks
- checkpoints and admissions
  durable long-horizon history

The contract should permit compaction of fine-grained tick-receipt history
without destroying higher-level tick, edit-group, or checkpoint truth.

## Immediate executable seams

This cycle should leave the next implementation seams obvious:

1. `echo-backed-rope-worldline-contract`
   the hot text-runtime contract itself
2. `graft-hot-structural-projections-over-rope-heads`
   the warm adapter contract
3. `causal-history-retention-and-compaction-policy`
   the retention law
4. `save-checkpoints-and-cold-witness-bridge`
   the hot-to-cold bridge

This packet is successful if those seams become more precise rather than more
poetic.

The first executable seam in this cycle is save-checkpoint semantics, because
it pins down one of the most user-visible consequences of the hot rope model
without requiring the full runtime to exist yet.

The next executable seam after save-checkpoint semantics is tick-admission
semantics: a lawful `ReplaceRange` should be admissible as a tick with a tick
receipt, while a logical no-op should not mint a new tick.

The executable seam after tick-admission semantics is edit-group semantics:
`jedit` should be able to group one or more known ticks into a human-meaningful
edit group without redefining the canonical tick boundary.

The executable seam after edit-group semantics is an app-facing hot-runtime
port and a truthful in-memory adapter: `jedit` should be able to compose
ReplaceRange, tick admission, edit-group policy, and checkpointing without
pretending that Echo is already embedded in-process.

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
primitive edit law, how do ticks and tick receipts fit, and how do anchors and
edit groups fit without collapsing into parser or Git concerns.

## Non-goals

- Implementing an Echo crate, WASM guest, or TypeScript bindings in this cycle.
- Implementing the rope runtime itself.
- Replacing Graft with Echo or collapsing the two into one undifferentiated
  engine.
- Designing every long-term persistence detail for cold storage.
- Treating Git commit cadence as the live update cadence of the editor.
