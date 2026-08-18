# Text Edit Algebra

Status: design sketch

> **Ownership correction:** `ReplaceRange` is Jim-owned application law and its
> executable source belongs in `ReplaceRange.edict`. Echo may interpret the
> compiler-produced generic program, but Echo must not acquire a
> `ReplaceRange`, rope, split/join/balance, `Buffer`, or `TextWindow` runtime
> primitive. The schema and oracle are contracts and evidence, not executable
> semantics.

Purpose: define the causal text runtime that sits under `jedit` before more UI
work hardens the wrong abstractions.

Event-class boundaries live in [causal-event-model.md](causal-event-model.md).
The substrate choice is explained in [why-echo.md](why-echo.md).
The detailed Echo-hosted text reading shape is described in
[jedit-echo-graph-model.md](jedit-echo-graph-model.md).
The static/dynamic rewrite-footprint split is described in
[0004 - dynamic-footprint-binding-contract](0004-dynamic-footprint-binding-contract/dynamic-footprint-binding-contract.md).

## One Sentence

`jedit` should treat a buffer as a persistent piece-rope worldline modeled by
the jedit contract over Echo's generic causal substrate, with files, Markdown
ASTs, previews, and viewport state as projections rather than truth.

## Stack

The stack should be read like this:

- WARP is the model.
- Echo is the native, Git-free implementation of that model.
- `git-warp` is an optional interop adapter for Git-shaped environments.
- `jedit` is the editor built on top of Echo-backed text runtime truths.

For `jedit`, that implies:

- Echo owns generic causal truth, scheduler-owned ticks, tick receipts,
  strands, admission, and replay.
- `jedit` contract code owns rope structure, anchors, range transforms, and
  text edit algebra over Echo-hosted graph facts and retained artifacts.
- `jedit` owns UI, buffer lifecycle, viewport, file tree, save/open flows,
  preview, and edit-group policy over ticks.
- `git-warp` stays outside the engine as an import/export or mirroring adapter.
- files on disk are projections, not the canonical truth.

## Runtime Center

The architectural center is:

`BufferWorldline -> RopeRoot -> Branch/Leaf DAG`

Not:

- mutable string buffers
- file-plus-undo-stack
- snapshots as the primary truth

A buffer head points to a persistent rope root carried by jedit contract history
inside Echo-hosted causal evidence.

## Piece-Rope Model

The rope should be a piece-rope, not a copied-string rope.

Leaves do not own text directly. They point at immutable blob slices.

Example:

```text
Blob("hello cruel world")
Leaf(slice: blob#123[0..5])     -> "hello"
Leaf(slice: blob#123[6..11])    -> "cruel"
Leaf(slice: blob#123[12..17])   -> "world"
```

Edits should therefore create:

- a small amount of new structure
- a small number of new blobs or blob slices
- maximal reuse of existing structure

That is what makes history, strands, and admission cheap without dragging
whole-file snapshots forward forever.

## Core Nouns

- `BufferWorldline`: canonical editable object. Holds canonical head, strand
  refs, and admission lineage.
- `RopeRoot`: persistent piece-rope root carried by Echo causal history.
- `RopeBranch`: interior node with child refs and aggregate metrics.
- `RopeLeaf`: leaf node pointing at an immutable blob slice.
- `Blob`: immutable text storage unit.
- `Fragment`: persistent rope fragment used as inserted material.
- `Anchor`: logical point or interval with bias and stickiness policy.
- `Tick`: canonical causal-history append boundary in Echo.
- `TickReceipt`: minimal transition receipt emitted from a materialized tick.
- `EditGroup`: editor-facing grouping over one or more ticks for undo/history.
- `Strand`: alternate head over shared ancestry.
- `Projection`: file path, Markdown AST, preview, viewport cache, diagnostics,
  search index, and other derived surfaces.

Markdown is a projection, not the truth.
The file on disk is a projection, not the truth.
The rendered preview is a projection, not the truth.
The truth is the buffer worldline.

## Non-Negotiables

### 1. Logical edits are not maintenance

Logical edits:

- insert text
- delete range
- replace range
- admit strand slice
- move block

Maintenance:

- split leaf
- merge leaves
- rebalance branch
- compact blobs
- recompute metrics

Maintenance is janitorial work. It must not pollute author-facing receipts or
provenance.

### 2. Do not model characters as graph nodes

Character-level graph modeling is too expensive and too noisy.

Use coarse leaves. A starting target of `1-4 KB` per leaf slice is reasonable.
Split and merge lazily.

### 3. Pick position semantics once

Use one canonical internal edit coordinate. The current best candidate is:

- UTF-8 byte offsets on valid text boundaries

Branch metrics should also carry:

- bytes
- lines
- UTF-16 code units

`UTF-16` is not beautiful, but LSP interoperability still needs it. Grapheme
boundaries can be cached lazily for UI movement.

## Minimal Text Edit Algebra

The first version should stay brutally small.

Logical operations:

- `ReadRange(root, range) -> text`
- `ReplaceRange(base_root, range, fragment) -> EditResult`
- `ForkStrand(head) -> StrandHead`
- `AdmitStrandSlice(target_head, source_head, source_range, target_range) -> EditResult`
- `TransformAnchor(anchor, receipt) -> Anchor`

Maintenance operations:

- `Rebalance(root) -> root`
- `Compact(root) -> root`
- `Reindex(root) -> caches`

Sugar should compile down to the primitive:

- insert text = `ReplaceRange([p, p], fragment)`
- delete range = `ReplaceRange([a, b], empty_fragment)`
- replace selection = `ReplaceRange(range, fragment)`

`MoveBlock` does not need to be a substrate primitive in v1. It can be built
from fragment extraction plus one or more `ReplaceRange` calls.

## Echo Tick Alignment

`ReplaceRange` is the primitive logical text law, but Echo's canonical
worldline boundary is the tick.

That means:

- `ReplaceRange` describes what text rewrite is lawful.
- Edict compiles the Jim-owned law to a generic verified package.
- Echo admits and interprets that package as scheduler-owned causal work.
- the scheduler-owned tick emits a tick receipt as the witness of the
  transition.
- `Jim.edict` may group one or more outcomes into an edit group for
  undo/history.

This keeps the canonical boundary aligned with Echo without giving jedit app
code tick authority, while still letting the editor present larger
human-meaningful actions than a single tick.

The footprint for that tick-admitted rewrite should be read as:

- static at the level of slots, closure operators, create surfaces, and
  forbidden surfaces
- dynamic at the level of concrete worldline/head/range bindings and touched
  rope instances

That split is what lets `ReplaceRangeAsTick` stay honest without pretending
the compiler already knows which rope nodes a future edit will touch.

## ReplaceRange

The real primitive should be:

`ReplaceRange(base_root, range, fragment) -> EditResult`

Not `ReplaceRange(range, blobSlice)`.

Why `fragment` instead of `blobSlice`:

- typing inserts new blob-backed fragments
- paste may insert multiple slices
- strand admission should splice persistent structure without reserializing text
- block moves should be able to reuse existing material

## ReplaceRange Invariants

### 1. Purity

`ReplaceRange` is pure.

Given the same:

- base root
- logical range
- fragment
- normalization policy

it must produce the same:

- next root
- logical receipt

No hidden clocks, file I/O, ambient state, or global current-buffer lookups.

### 2. Base root is part of the contract

`ReplaceRange` is defined against an explicit root.

If the caller is on a stale head, that is not "fine." It is a different lane,
rebase, or admission problem.

### 3. Materialization law

Let:

- `T(root)` be the materialized text of the base root
- `T(fragment)` be the materialized text of the inserted fragment

Then:

`T(next) = prefix(T(root), start) + T(fragment) + suffix(T(root), end)`

If that identity fails, the edit is wrong regardless of how plausible the
structure looks.

### 4. Structural sharing

Unaffected regions must be reused by identity or content address.

A local edit must not cause broad churn through unrelated subtrees.

### 5. Meaningful receipts only

Logical receipts should record:

- base root
- next root
- replaced logical range
- inserted fragment
- inverse fragment
- actor or group metadata
- anchor transform reference

They should not narrate:

- leaf split
- leaf merge
- branch rotation
- cache rebuilds

### 6. Anchor transform is part of the result

`ReplaceRange` must produce or make derivable the transform needed to move
anchors from `base_root` space to `next_root` space.

Anchors should respond to logical text change, not to physical rope
maintenance.

### 7. Maintenance is semantics-preserving

`Rebalance` and `Compact` may change structure, but they must not change:

- materialized text
- logical positions
- anchor behavior
- author-visible history

### 8. Determinism

For the same inputs, the result must be identical every time.

No opportunistic balancing based on ambient timing, allocator behavior, or
runtime heuristics that leak into logical outcomes.

### 9. No-op discipline

If the logical text does not change, return the same root and either:

- no logical receipt
- or an explicitly marked non-authorial no-op receipt

### 10. Local complexity

The target shape is:

- `O(log n + k)`

where `k` is the number of touched leaves or fragments, not a whole-buffer walk
for ordinary edits.

## Anchors

Anchors should be first-class from day one.

They are needed for:

- cursor positions
- selections
- comments
- diagnostics
- bookmarks
- AI suggestion targets
- review ranges

Anchor payload should support:

- point or interval
- bias or gravity (`left` / `right`)
- optional stickiness policy for boundary cases

Anchors transform through logical receipts, not through rope housekeeping.

## Suggested Runtime Shapes

Illustrative only:

```text
BufferWorldline
  canonicalHead -> RopeRoot
  strands -> StrandHead[]
  receipts -> Receipt[]

RopeRoot
  branch -> RopeBranch | RopeLeaf

RopeBranch
  children -> RopeNode[]
  metrics -> { bytes, lines, utf16 }

RopeLeaf
  slice -> BlobSlice
  metrics -> { bytes, lines, utf16 }
```

## Projections and Caches

The ontology can be rich. The render loop must stay boring.

Do not walk graph-like readings or generic causal storage on every frame.

Build fast projections from the current head:

- line index cache
- viewport cache
- parse cache
- search index
- diagnostics cache
- Markdown preview projection

These are all derived from the current rope head and updated incrementally.
Witnessed causal history is truth. The editor loop needs speed.

## Undo, Grouping, and History

Undo should not be reverse-diff folklore.

It should be:

- head movement
- or lawful root-to-root reversal using inverse fragments or receipts

Author-facing history should be grouped intentionally:

- typing burst
- paste
- explicit command
- agent admission
- structural transform

Do not treat every keystroke as a sacred top-level event forever.

## Strands and Admission

Agent suggestions should be strands, not patch files taped to the side.

Selective acceptance should be admission of slices from one strand into another,
not generic hunk application with optimistic string matching.

That gives the runtime:

- cheap speculative branches
- precise partial acceptance
- provenance that explains why canonical text exists

## Persistence Direction

The likely persistent shape is:

- Echo-backed causal truth
- `echo-text` schema for rope roots, blobs, anchors, and receipts
- `.jedit/` for local persistence, refs, checkpoints, caches, and workspace
  state
- ordinary files as projections for interoperability

Git is optional interop, not architecture.

## Initial Build Order

1. persistent piece-rope in memory
2. `ReadRange`
3. `ReplaceRange`
4. anchor transforms
5. undo groups
6. strands
7. strand-slice admission
8. persistence to `.jedit/`
9. Markdown and block-aware projections

## Immediate Design Test

The next useful test is simple:

define the exact invariants, preconditions, and postconditions for
`ReplaceRange`.

If that one operation feels elegant, the whole editor can stay clean.
If it feels cursed, the architecture is just expensive poetry.
