# jedit

Terminal-first text and Markdown editing, built on Bijou and shaped around
causal history through Echo.

`jedit` is the product pressure for the Echo stack. It is not a protocol lab
and it should not invent substrate doctrine. Its job is to behave like a real
editor while forcing the lower layers to prove the seams that matter:
contract-shaped edits, bounded reads, provenance, replayable observations, and
eventual undo-as-counter-history.

The current build is intentionally stripped down. No starter tabs, no decorative
theme layer, no heavyweight IDE chrome. The editor shape should emerge from
small witnessed product slices rather than scaffold baggage.

## Product invariants

`jedit` is aiming for a quiet editing surface with smart edges, not a terminal
IDE clone.

The full invariant set is written down in
[docs/design/project-invariants.md](docs/design/project-invariants.md).
The short operational guide is [GUIDE.md](GUIDE.md).
The end-to-end buffer rendering path is explained in
[ADVANCED_GUIDE.md](ADVANCED_GUIDE.md).

- Zen core, instrumented edges. The main editor area stays visually quiet;
  richer context appears at the edges and only when it earns the space.
- Minimal by default. Panels are hidden until explicitly opened.
- One-line header. The header identifies what the main pane is showing and
  does not turn into a dashboard.
- Two-line footer. The top line belongs to the focused surface and may change
  rapidly. The bottom line carries slower workspace and buffer truth.
- Buffers are not panes. Panes are not panels. Lenses are not extra buffers.
- Panels are tools, not furniture. File browsing, Graft, diagnostics, and
  similar surfaces should open intentionally, close cleanly, and stay out of
  the way when not needed.
- The same chord should open and close the same panel.
- `tab` cycles only across visible interactive panes. Hidden panels do not
  participate in focus order.
- The editor should remain strongly Vim-shaped without trying to become "vim
  2". Familiarity matters; reenactment is not the goal.
- Alternate views of a file are lenses over the active buffer, not separate
  truths. Markdown preview is the first lens; others must justify themselves.
- Truth beats convenience. If a panel is showing saved-on-disk structure while
  the buffer is dirty, the UI should say so explicitly.
- Anything noisy must earn its existence.

## Stack posture

`jedit` is now the release gate for Echo `v0.1.0`. Echo does not ship that
release until jedit can run a real contract-backed edit/read/replay path on
Echo from this repository.

The proof is deliberately product-shaped:

```text
jedit-authored `TextBufferOptic` contract
-> Wesley generated artifacts
-> Echo package install
-> jedit app submits edit intent
-> trusted Echo host ticks
-> jedit observes outcome
-> jedit queries bounded text reading
-> retained evidence and replay prove the result
```

This replaces the older idea that an in-repo Echo fixture is enough. The fixture
is useful. The release gate is jedit working on Echo without app tick authority.

`jedit` is currently the driving consumer for two narrow Echo/Wesley seams.

The first seam is the transport witness:

```text
Wesley fixture artifact shape
-> Echo runtime and WASM package boundary
-> jedit transport witness
-> TextBufferOptic anti-leak contract
```

The stack checkpoint is deliberately small:

```text
createBuffer
-> replaceRange("hello")
-> textWindow(0..5)
-> Echo ReadingEnvelope + QueryBytes("hello")
-> jedit TextWindowReading
```

That story now exists in two transport postures:

- A fake Echo-shaped transport for default local jedit tests.
- An opt-in real Echo WASM transport that loads Echo's packaged WASM module and
  proves the same consumer-level assertions.

The important invariant is that app-facing jedit assertions do not care whether
the transport is fake or real. The consumer contract is stable; the transport
is replaceable.

Product pressure determines architecture truth. The stack should advance when a
real editor constraint forces a seam to become honest, not when an abstract
protocol theory wants a place to land.

The real Echo WASM witness is opt-in because jedit's default tests must not
depend on sibling repository build state:

```sh
ECHO_WARP_WASM_DIR=/path/to/echo/crates/warp-wasm \
  scripts/run-real-echo-wasm-stack-witness.sh
```

The runner asks Echo to build its own WASM package boundary, then runs the
jedit witness against the resulting module. This is still a witness ritual, not
a published package contract.

Current status: the opt-in real Echo WASM witness uses the required application
and host authority split:

- jedit application code submits canonical intents and observes readings;
- trusted Echo host code owns package install, scheduler control, until-idle
  policy, and fault recovery;
- no jedit app path can tick or tunnel scheduler control through dispatch.

Agents should start with the shell witness before any richer MCP surface:

```sh
ECHO_WARP_WASM_DIR=/path/to/echo/crates/warp-wasm \
  node scripts/jedit-echo-witness.mjs --json
```

The second seam is schema authority for structural history:

```text
contracts/jedit/structural-history.graphql
-> Wesley generated operation metadata
-> replaceTextRange adapter boundary
-> existing in-memory runtime executor
```

This path does not replace storage and does not wire Echo. It proves that the
`replaceTextRange` operation identity comes from generated Wesley metadata
instead of being duplicated by hand.

## Echo posture

Echo owns substrate truth: admission, receipts, scheduler materialization,
runtime evidence, worldline state, and observed readings.

`jedit` should interact with Echo through intent and observation boundaries:

- `dispatch_intent` for mutations.
- `observe` for bounded readings.
- Echo `ReadingEnvelope` plus `QueryBytes` for evidence-bearing read results.

`jedit` must not grow direct dependencies on Echo internals, raw worldline
coordinates, scheduler implementation details, or current fixture derivation
lore.

The current optic capability contract is the anti-leak boundary:

- App-facing code holds a `TextBufferOptic`.
- The optic may issue an opaque `ReadBasisHandle`.
- The handle has shape `{ kind, id }`; the `id` is diagnostic, not authority.
- The optic/session adapter resolves private runtime coordinates below the app
  boundary.
- Forged or cloned handles are rejected.

This is not the final optic/session protocol. It is the durable product
constraint: jedit core should ask for edits and readings through authorized
capabilities, not by manufacturing Echo substrate coordinates.

## Wesley posture

Wesley is the contract compiler and artifact-shape authority.

For Stack Witness 0001, Wesley publishes the fixture artifact shape that Echo
and jedit can lock against:

- operation ids for `createBuffer`, `replaceRange`, and `textWindow`
- fixture vars bytes and fixture encoding metadata
- declared footprints
- EINT helper shape
- QueryView helper shape
- artifact/schema identity

The current semicolon key-value bytes are fixture bytes only. They are
human-readable scaffolding, not the durable Wesley runtime codec. The durable
target remains Wesley-generated binary codecs shared across Rust and
TypeScript.

For structural history, the authored SDL is now the source of authority:

- `contracts/jedit/structural-history.graphql`
- `scripts/gen-structural-history-wesley.mjs`
- `src/app/structural-history-replace-text-range.ts`

`npm run build` and `npm test` run the structural-history generator before
TypeScript compilation. The generator installs `wesley-cli` 0.0.4 into
`.wesley-cache/cargo` when needed, emits the full TypeScript artifact to
`.wesley-cache/structural-history.wesley.generated.ts`, and extracts an ignored
adapter-facing descriptor at
`src/generated/jedit/structural-history-replace-text-range.wesley.generated.ts`.

That descriptor is generated build output, not committed source. The existing
TypeScript model still executes the edit; generated metadata only owns the
operation identity for this slice.

## Graft posture

`jedit` should use Graft as its structural intelligence engine, not as its
editing truth.

- Graft is the right place for syntax spans, fold regions, node lookup,
  structural selections, diagnostics, rename preview, structural diff, and
  semantic summary over dirty in-memory buffers.
- Echo should own the causal text history: ticks, tick receipts, checkpoints,
  anchors, frontiers, and later strands and braids.
- `jedit` still owns buffer lifecycle, mode semantics, edit-group and undo
  policy over ticks, pane focus, panel lifecycle, save/open flows, and
  rendering policy.
- Files on disk, preview surfaces, Graft views, and future AST lenses are
  projections over buffer truth.
- Future causal text work remains a separate editor-runtime concern. Graft may
  help interpret or compare buffer snapshots, but it does not replace the
  editor’s piece-rope worldline design.
- The current MCP transport is transitional. The long-term product posture is
  Echo and Graft as built-in engines with direct API surfaces.

## Contract and observer posture

The current causal runtime strata model is written down in
[docs/design/runtime-temperatures.md](docs/design/runtime-temperatures.md).

The authored home for the first causal text contract still uses the legacy
`hot-text-runtime` filename:
[contracts/jedit/hot-text-runtime.graphql](contracts/jedit/hot-text-runtime.graphql).

The app-owned contract adapter that maps those rewrite names onto the current
runtime lives at
[src/app/jedit-contract-runtime.ts](src/app/jedit-contract-runtime.ts).

The first app-owned observer authoring surface lives at
[src/app/jedit-observer-spec.ts](src/app/jedit-observer-spec.ts).

The app-owned structural-history contract lives at
[contracts/jedit/structural-history.graphql](contracts/jedit/structural-history.graphql).
It extracts the current in-memory text history model into canonical GraphQL
facts for revisions, replacements, edit groups, checkpoints, provenance,
command status, errors, and bounded readings. The design note is
[docs/design/structural-history-graphql-authority.md](docs/design/structural-history-graphql-authority.md).

The first structural-history consumer is
[src/app/structural-history-replace-text-range.ts](src/app/structural-history-replace-text-range.ts).
`applyBufferEdit(...)` carries the generated `replaceTextRange` operation
identity through its result while the old in-memory hot-text runtime remains
the executor.

The intended long-term posture remains optic-shaped:

- `jedit` submits contract intent to Echo.
- Echo admits or rejects that intent and returns deterministic runtime evidence.
- `jedit` observes through a capability-backed read aperture.
- The app receives product-shaped readings, not substrate coordinates.

In product terms: the runtime should be able to explain why a visible reading is
true and which admitted edits produced it. That is the human meaning of an
evidence-bearing reading.

So Echo remains substrate truth, while `jedit` owns the app-facing contract
reading layer.

The first read surface is the canonical
`worldlineSnapshot(input: WorldlineSnapshotInput!)` query, which returns the
current worldline, canonical head, retained checkpoints, and materialized text
without pretending the runtime already supports arbitrary historical head
materialization. That query is paired with the first explicit app-owned observer
spec so the get side is no longer treated as "just a query."

Refresh the generated contract surfaces with:

```sh
JEDIT_WESLEY_ROOT=/path/to/wesley npm run gen:contract
```

`JEDIT_WESLEY_ROOT` must point at a Wesley checkout that contains both
`packages/wesley-host-node/bin/wesley.mjs` and
`crates/wesley-cli/Cargo.toml` for the legacy hot-text and observer generation
paths. Structural-history metadata is the exception: it uses the published
`wesley-cli` 0.0.4 crate through `scripts/gen-structural-history-wesley.mjs`
and does not require a sibling Wesley checkout.

The current readiness gate is `spec/hot-text-contract-readiness.spec.mjs`: it
proves the authored SDL and generated Wesley TypeScript operation metadata agree
on mutation footprints, bounded reads, and the contract surface that Echo-side
generation will consume when that seam graduates beyond fixture witnesses.
Structural-history readiness lives in
`spec/structural-history-contract-readiness.spec.mjs` and
`spec/structural-history-replace-text-range-metadata.spec.mjs`.

Near-term product direction:

- `jedit .` opens the current directory
- file tree plus text buffer editing
- Markdown source mode with richer preview options
- keyboard-first pane layout instead of heavyweight IDE chrome

## Run

```sh
npm run dev
```

## Current state

Right now the app gives you:

- current-directory file drawer
- a Graft drawer backed by a repo-local MCP session for current-file outline
  and structural change context
- simple directory navigation
- a real editable text buffer
- modal source editing with a growing Vim normal/insert split
- core Vim motions and operators like `w`, `b`, `e`, `dd`, `yy`, `p`, `u`, and `ctrl+r`
- source editing with dirty tracking and save
- Markdown preview rendered from the in-memory buffer
- Stack Witness 0001 consumer coverage through a fake Echo-shaped transport
- an opt-in real Echo WASM Stack Witness runner with separate app and trusted
  host transport surfaces
- a JSON-capable `scripts/jedit-echo-witness.mjs` command for agents and CI
  that reports generated contract metadata, observed reading identity, artifact
  hash, and authority split
- a `TextBufferOptic` boundary with opaque `ReadBasisHandle` support that keeps
  raw Echo coordinates below the app-facing optic client
- a structural-history GraphQL authority surface
- build-generated `replaceTextRange` Wesley operation metadata consumed by the
  hot-buffer adapter boundary

## Next steps

- keep pushing the real Echo WASM witness toward retained evidence and replay
  without granting app code tick authority
- graduate `TextBufferOptic` and `ReadBasisHandle` from witness/session
  scaffolding into a real optic/session bootstrap contract
- route the next structural-history operation through generated Wesley metadata
  without replacing storage
- make jedit consume an Echo-owned, versioned WASM package artifact rather than
  relying on sibling-repo witness setup
- remove the remaining fixture-only raw worldline derivation once Echo can
  provide session-owned basis resolution through the proper boundary
- preserve ordinary user-facing undo semantics while implementing undo as
  authored inverse history below the product boundary
- lock the Echo-backed text runtime design around persistent piece-rope
  worldlines and ticks in
  [docs/design/text-edit-algebra.md](docs/design/text-edit-algebra.md)
- lock the event taxonomy in
  [docs/design/causal-event-model.md](docs/design/causal-event-model.md) so
  logical history, maintenance, and session traces do not collapse into one
  ledger
- strengthen the Vim layer
- add more motions/operators/text objects and counts
- deepen the Graft drawer beyond outline plus diff summary
- add better preview fidelity
- handle unsaved-buffer flows when switching files
- persist layout and workspace state
