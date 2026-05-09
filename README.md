# jedit

Terminal-first Markdown and text editing, built on Bijou.

The current build is intentionally stripped down. No starter tabs, no extra
chrome, no decorative theme layer. Just a small custom TUI so the editor shape
can emerge from the actual product instead of scaffold baggage.

## Product invariants

`jedit` is aiming for a quiet editing surface with smart edges, not a terminal
IDE clone.

The full invariant set is written down in
[docs/design/project-invariants.md](docs/design/project-invariants.md).
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

The current causal runtime strata model is written down in
[docs/design/runtime-temperatures.md](docs/design/runtime-temperatures.md).
The authored home for the first causal text contract still uses the legacy
`hot-text-runtime` filename:
[contracts/jedit/hot-text-runtime.graphql](contracts/jedit/hot-text-runtime.graphql).
The app-owned contract adapter that maps those rewrite names onto the current
runtime lives at
[src/app/jedit-contract-runtime.ts](src/app/jedit-contract-runtime.ts).
The first app-owned observer authoring surface now lives at
[src/app/jedit-observer-spec.ts](src/app/jedit-observer-spec.ts).
The intended long-term posture is optic-shaped:

- `jedit` submits intent to Echo
- Echo admits or rejects that intent and returns the deterministic result /
  receipt envelope
- `jedit` then observes the resulting worldline state and projects generic
  causal history into app-specific contract readings

So Echo remains substrate truth, while `jedit` owns the app-facing contract
reading layer.
The first read surface is the canonical
`worldlineSnapshot(input: WorldlineSnapshotInput!)` query, which returns the
current worldline, canonical head, retained checkpoints, and materialized text
without pretending the runtime already supports arbitrary historical head
materialization. That query is now paired with the first explicit app-owned
observer spec so the get side is no longer treated as "just a query."
Refresh the generated contract surfaces with:

```sh
npm run gen:contract
```

That command now writes the Rust-Wesley operation binding artifact beside the
legacy TypeScript/Zod files. The app still keeps the legacy Zod validators until
Wesley has a Rust-native validator emitter, but operation-name and request-input
type seams should prefer the Rust-Wesley generated artifact.

The Echo Rust binding pass is intentionally deferred while Echo's generator
surface is moving. The current readiness gate is
`spec/hot-text-contract-readiness.spec.mjs`: it proves the authored SDL and
generated Wesley TypeScript operation metadata agree on mutation footprints,
bounded reads, and the contract surface that `echo-wesley-gen` will consume
once the warpspace-pinned Echo checkout is available again.

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

## Next steps

- lock the Echo-backed text runtime design around persistent piece-rope
  worldlines and ticks in [docs/design/text-edit-algebra.md](docs/design/text-edit-algebra.md)
- lock the event taxonomy in
  [docs/design/causal-event-model.md](docs/design/causal-event-model.md) so
  logical history, maintenance, and session traces do not collapse into one ledger
- strengthen the Vim layer
- add more motions/operators/text objects and counts
- deepen the Graft drawer beyond outline plus diff summary
- add better preview fidelity
- handle unsaved-buffer flows when switching files
- persist layout and workspace state
