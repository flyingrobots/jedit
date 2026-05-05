# Jedit Echo Reading Model

Status: design sketch

Purpose: describe the exact text reading shape and rewrite semantics `jedit`
wants Echo-hosted contracts to support, without assuming handwritten Echo
runtime edits.

Terminology note: this file predates the stricter "there is no graph" doctrine.
When it says "graph model," it means the graph-like reading vocabulary that the
`jedit` contract can emit or rewrite lawfully over witnessed causal history.
It does not mean Echo owns one canonical precomputed state object.

This note is the detailed companion to:

- [../../contracts/jedit/hot-text-runtime.graphql](../../contracts/jedit/hot-text-runtime.graphql)
- [../../src/app/jedit-contract-runtime.ts](../../src/app/jedit-contract-runtime.ts)
- [0005 - jedit-observer-spec](0005-jedit-observer-spec/jedit-observer-spec.md)
- [0006 - optic-backed-file-model](0006-optic-backed-file-model/optic-backed-file-model.md)
- [text-edit-algebra.md](text-edit-algebra.md)
- [0004 - dynamic-footprint-binding-contract](0004-dynamic-footprint-binding-contract/dynamic-footprint-binding-contract.md)
- [runtime-temperatures.md](runtime-temperatures.md)
- [why-echo.md](why-echo.md)
- [0003 - echo-backed-rope-worldline-contract](0003-echo-backed-rope-worldline-contract/echo-backed-rope-worldline-contract.md)

## One Sentence

`jedit` wants Echo to host canonical causal text history whose first useful
reading shape centers on:

`BufferWorldline -> RopeHead -> Rope DAG`

with ticks as the canonical causal boundary, checkpoints as retained markers,
anchors as first-class position carriers, and structural surfaces such as ASTs
and diagnostics staying observer-relative rather than canonical.

## Why This Exists

I previously talked about "changing Echo," but the real ask is narrower and
cleaner:

- define the graph-like reading nouns that the editor kernel needs
- define the lawful rewrites that may touch those nouns
- make dishonest rewrites impossible or at least statically rejected
- keep parser structure, UI state, and Git export layers out of canonical
  text truth

This document is therefore not a request for ad hoc runtime hacking. It is a
request for a precise contract reading and rewrite model.

The intended integration posture is optic-shaped:

- `jedit` submits intent to Echo
- Echo admits generic substrate history and returns the deterministic result /
  receipt envelope
- `jedit` then observes the resulting worldline state
- app code projects the observed worldline into `jedit` nouns such as
  `BufferWorldline`, `RopeHead`, `TickReceipt`, and `WorldlineSnapshot`

So Echo stays generic causal substrate truth. `jedit` owns the app-facing
contract reading and interpretation layer.

The dynamic/static footprint split for these rewrites is defined in
[0004 - dynamic-footprint-binding-contract](0004-dynamic-footprint-binding-contract/dynamic-footprint-binding-contract.md).
The first authored GraphQL home for that boundary now lives in
[../../contracts/jedit/hot-text-runtime.graphql](../../contracts/jedit/hot-text-runtime.graphql).
That authored contract now also carries the first read-side surface:
`worldlineSnapshot`, which is intentionally limited to canonical-head truth in
v1 rather than pretending the runtime already supports arbitrary retained-head
materialization.
The first app-owned observer shape for that read-side boundary now lives in
[0005 - jedit-observer-spec](0005-jedit-observer-spec/jedit-observer-spec.md),
which intentionally starts with a memoryless canonical-head observer rather
than pretending every read is already a full observer lifecycle.

## What I Need Echo To Own

Echo should own causal text history:

- canonical editable text truth
- head identity
- tick admission
- tick receipts
- anchors and anchor transforms
- checkpoints
- later strands, braids, and admission

Echo should not be required to own:

- AST interpretation
- diagnostics
- preview rendering
- file paths as canonical truth
- editor panes, panels, or mode semantics
- Git commit history as the source of hot truth

## What I Do Not Need As First-Class Hot Nodes

These are explicitly not required as causal text truth in v1:

- one node per character
- AST nodes as canonical text truth
- one node per cursor movement
- one node per viewport change
- one node per keystroke forever-visible in user history
- Git commits as the cadence of editor truth
- file-on-disk as the canonical editable object

The first text readings should stay text-native.

## Minimal First-Class Node Kinds

This is the node set I actually want to declare.

### 1. `BufferWorldline`

The canonical editable object.

Responsibilities:

- names the logical buffer identity
- points to the current canonical head
- owns the tick chain
- owns checkpoint references
- owns anchor membership
- later owns strand membership

Suggested fields:

- `worldlineId`
- `bufferKey`
- `createdAtTick` or equivalent causal basis
- optional app-facing metadata such as `projectionPath`

Important note:

- `projectionPath` is metadata, not truth
- the worldline must remain lawful even when there is no file path or when the
  path changes

### 2. `RopeHead`

The materialized hot head for one worldline state.

Responsibilities:

- names one specific rope state
- points to the rope root node
- carries aggregate text metrics for the whole head
- serves as the basis for structural readings

Suggested fields:

- `headId`
- `worldlineId`
- `byteLength`
- `lineCount`
- `utf16Length`
- `equivalenceDigest` or similar canonical digest

Design note:

- I do not strictly need both `RopeRoot` and `RopeHead` as separate node kinds
- one `RopeHead` node that points at the root rope node is enough if that keeps
  the schema simpler

### 3. `RopeBranch`

Interior rope node.

Responsibilities:

- ordered composition of child rope nodes
- aggregate metrics for subtree navigation

Suggested fields:

- `branchId`
- `byteLength`
- `lineCount`
- `utf16Length`
- optional `height` or balancing metadata

### 4. `RopeLeaf`

Leaf rope node pointing at immutable text storage.

Responsibilities:

- represent one text slice in the rope
- carry slice-local metrics
- point at one blob plus a byte range

Suggested fields:

- `leafId`
- `startByte`
- `endByte`
- `byteLength`
- `lineCount`
- `utf16Length`

### 5. `TextBlob`

Immutable storage unit for text bytes.

Responsibilities:

- hold immutable text payload
- allow many leaves to reuse the same underlying bytes

Suggested fields:

- `blobId`
- `encoding`
- `byteLength`
- `contentHash`

Design note:

- the payload may be externalized or stored in a content-addressed side store
- I do not need the graph itself to inline arbitrarily large strings if Echo
  prefers a blob store

### 6. `Anchor`

First-class logical position or interval.

Responsibilities:

- carry cursor, selection, bookmark, comment, diagnostic target, or AI target
  identity
- survive lawful text rewrites by deterministic transform

Suggested fields:

- `anchorId`
- `kind`
- `basisHeadId`
- `startByte`
- optional `endByte`
- `startBias`
- optional `endBias`
- optional `stickiness`

Design note:

- anchors are not UI junk
- they are required substrate truth because many later features depend on them

### 7. `Tick`

Canonical hot causal append boundary.

Responsibilities:

- record one admitted hot rewrite boundary
- connect base head to next head
- connect to its receipt
- participate in the hot worldline chain

Suggested fields:

- `tickId`
- `worldlineId`
- `kind`
- `sequenceNumber`
- `author` or actor metadata if available

### 8. `TickReceipt`

Minimal witness for one tick.

Responsibilities:

- capture the lawful rewrite at a hot boundary
- retain enough information to explain and replay the transition
- drive anchor transforms

Suggested fields:

- `receiptId`
- `tickId`
- `baseHeadId`
- `nextHeadId`
- `rewriteKind`
- `startByte`
- `endByte`
- `insertedByteLength`
- `deletedByteLength`
- optional `inverseFragmentDigest`
- optional summary metadata

Important note:

- this is the hot witness
- it should not be polluted by rope housekeeping details like split/merge/rotate

### 9. `Checkpoint`

Retained marker over the hot worldline.

Responsibilities:

- mark save points
- mark explicit bookmarks or admissions later
- allow durable history retention without freezing every primitive event forever

Suggested fields:

- `checkpointId`
- `worldlineId`
- `headId`
- `kind`
- `label`
- `createdByTickId`

## Optional But Likely Later Node Kinds

These are not required for the first useful cut, but I expect to want them.

### `Strand`

Alternate head lineage over shared ancestry.

Used for:

- draft alternatives
- AI suggestions
- speculative edits
- later braid/admission semantics

### `Braid`

Explicit relation across multiple strands or heads.

Used for:

- compare/select/admit flows
- structured alternative handling

### `Admission`

Explicit record that selected material from one strand or head was admitted into
another.

Used for:

- partial acceptance
- causal editorial history

I do not need these in the first schema cut if they complicate initial progress,
but the v1 graph should not block them.

## Edge Kinds I Actually Care About

The edges matter as much as the node kinds.

### Worldline ownership and current truth

- `BufferWorldline -CANONICAL_HEAD-> RopeHead`
- `BufferWorldline -HAS_TICK-> Tick`
- `BufferWorldline -HAS_CHECKPOINT-> Checkpoint`
- `BufferWorldline -HAS_ANCHOR-> Anchor`

Later:

- `BufferWorldline -HAS_STRAND-> Strand`

### Tick chain and transition edges

- `Tick -PREV_TICK-> Tick`
- `Tick -BASE_HEAD-> RopeHead`
- `Tick -NEXT_HEAD-> RopeHead`
- `Tick -HAS_RECEIPT-> TickReceipt`

This gives us:

- hot history chain
- explicit transition basis
- explicit witness

### Rope structure edges

- `RopeHead -ROOT_NODE-> RopeBranch | RopeLeaf`
- `RopeBranch -CHILD_AT[index]-> RopeBranch | RopeLeaf`
- `RopeLeaf -SLICE_OF-> TextBlob`

Important note:

- child order is not optional
- whether order lives as an edge property or child slot field is an
  implementation detail, but it must be stable and deterministic

### Checkpoint edges

- `Checkpoint -AT_HEAD-> RopeHead`
- optionally `Checkpoint -CAUSED_BY-> Tick`

### Anchor edges

I only need enough edge structure to keep anchors scoped and basis-bound.

Minimal:

- `BufferWorldline -HAS_ANCHOR-> Anchor`
- `Anchor -BASIS_HEAD-> RopeHead`

I do not need anchors to point directly into individual branch or leaf nodes if
that makes transforms harder. Byte-range basis against a head is sufficient as
long as transform law is strong.

## Minimal Required Rewrite Families

These are the rewrites I actually want to declare.

## 1. `CreateBufferWorldline`

Purpose:

- create a new empty or seeded editable worldline

Touches:

- create `BufferWorldline`
- create initial `RopeHead`
- create initial rope node(s)
- maybe create initial `TextBlob`
- optionally create initial `Checkpoint`

Semantics:

- this is the seed event for a buffer truth
- it may start empty or from a projected file snapshot

Example conceptual input:

```ts
createBufferWorldline({
  bufferKey: "src/main.ts",
  initialText: "console.log('hello')\n"
})
```

Expected outcome:

- one worldline exists
- one initial head exists
- text materializes exactly to the provided initial text

## 2. `ReplaceRangeAsTick`

This is the most important rewrite.

Purpose:

- admit one lawful text rewrite into the hot worldline

Conceptually it combines:

- `ReplaceRange`
- tick admission
- tick receipt emission

Inputs I care about:

- `worldlineId`
- `baseHeadId`
- `startByte`
- `endByte`
- inserted fragment or inserted text payload
- optional actor metadata

Reads:

- current base head
- touched rope path
- touched blob slices

Creates:

- zero or more new `TextBlob`
- zero or more new `RopeLeaf`
- zero or more new `RopeBranch`
- one new `RopeHead`
- one new `Tick`
- one new `TickReceipt`

Updates logically:

- `BufferWorldline.CANONICAL_HEAD`
- tick chain membership

Reuses:

- every untouched subtree by identity

Required laws:

- no-op replace does not mint a tick
- next head materializes exactly to the textual replacement result
- unchanged subtrees are reused
- tick receipt names base and next heads
- anchor transform can be derived from the receipt

Dynamic binding note:

- the exact touched rope path and affected anchor set are runtime bindings
- the lawful kinds of slots, closures, creates, and updates must still be
  declared statically
- see [0004 - dynamic-footprint-binding-contract](0004-dynamic-footprint-binding-contract/dynamic-footprint-binding-contract.md)

Conceptual example:

```ts
replaceRangeAsTick({
  worldlineId: "buf-1",
  baseHeadId: "head-10",
  startByte: 6,
  endByte: 11,
  insertText: "kind"
})
```

If `head-10` materializes to:

```text
hello cruel world
```

then the next head must materialize to:

```text
hello kind world
```

and the rewrite should create:

- a new blob for `"kind"` if needed
- one or more new leaves/branches for the changed local path
- a new head
- a tick
- a tick receipt

It should not:

- rebuild the whole rope
- mutate old heads
- require AST success

## 3. `CreateCheckpoint`

Purpose:

- retain a meaningful marker over the current canonical hot head in v1

Typical uses:

- save
- later admission marker once checkpoint scope widens explicitly

Inputs:

- `worldlineId`
- `kind`
- optional `label`

Reads:

- current worldline and its canonical head

Creates:

- one `Checkpoint`

Must not do:

- change the canonical head
- clear tick history
- rewrite text

Conceptual example:

```ts
createCheckpoint({
  worldlineId: "buf-1",
  kind: "save",
  label: "manual save"
})
```

This should preserve:

- existing canonical head
- existing tick chain
- existing edit-group policy in `jedit`

## 4. `RegisterAnchor`

Purpose:

- create a durable logical point or interval over a head

Inputs:

- `worldlineId`
- `basisHeadId`
- start and optional end byte positions
- bias/stickiness

Creates:

- one `Anchor`

Design note:

- this can be a small standalone rewrite or part of a broader app-level flow
- I do not need it to be especially clever, but I do need it to be first-class

## 5. `TransformAnchorAcrossTick`

This can be implemented one of two ways:

- as an explicit rewrite that updates persisted anchor basis and positions
- or as a derived transform function over `TickReceipt`

My preference:

- make anchor transform derivable from the tick receipt
- only persist anchor updates when the product truly needs persistence

That means `ReplaceRangeAsTick` may read the affected anchor set to establish
the lawful transform window, while still leaving persisted anchor movement out
of the v1 rewrite itself.

What I need semantically:

- left-biased insertion stays before inserted text
- right-biased insertion moves after inserted text
- anchors after a replacement shift by the replacement delta
- anchors inside deleted content collapse deterministically

## Maintenance-Only Rewrite Families

These are valid, but they must stay semantically separate from authorial text
history.

### `RebalanceHead`

Purpose:

- improve rope shape without changing materialized text

Allowed effects:

- create equivalent branch/leaf structure
- maybe replace the internal root path of a head

Must not change:

- materialized text
- logical byte positions
- anchor behavior
- author-facing tick semantics

Important note:

- if maintenance requires a new head identity, that identity must be typed as
  maintenance and excluded from authorial history surfaces
- better still, maintenance should remain below the level of canonical author
  heads if Echo can model that honestly

### `CompactBlobStore`

Purpose:

- deduplicate or compact blob storage

Allowed effects:

- rewrite physical storage representation
- preserve logical blob content identity

Must not change:

- head materialization
- logical receipt meaning
- anchor transforms

## Later Rewrite Families

I do not need these in the first useful cut, but I do want the graph model to
make them possible.

### `ForkStrand`

Purpose:

- create an alternate editable future from an existing head

### `AdmitStrandSlice`

Purpose:

- admit selected material from one strand or head into another

### `CreateBraid`

Purpose:

- relate alternatives without flattening them into one branch/merge story

## Focus Boundaries I Want Wesley To Enforce

This is where the model gets especially important.

I want the rewrite focus to be explicit enough that dishonest graph mutation
becomes a compile-time error.

### `ReplaceRangeAsTick` should be allowed to touch

- `BufferWorldline`
- `RopeHead`
- `RopeBranch`
- `RopeLeaf`
- `TextBlob`
- `Tick`
- `TickReceipt`
- optionally `Anchor` if anchor persistence is part of the rewrite

It should not be allowed to silently mutate:

- unrelated worldlines
- checkpoints
- warm AST or diagnostics nodes
- Git witness history
- UI state

### `CreateCheckpoint` should be allowed to touch

- `BufferWorldline`
- `Checkpoint`
- `RopeHead`
- optionally `Tick`

It should not be allowed to mutate rope structure or text content.

### `RegisterAnchor` should be allowed to touch

- `BufferWorldline`
- `Anchor`
- `RopeHead`

It should not be allowed to mint ticks or mutate rope content.

### `RebalanceHead` should be allowed to touch

- `RopeHead`
- `RopeBranch`
- `RopeLeaf`
- `TextBlob` only if storage compaction genuinely needs it

It should not be allowed to mutate:

- checkpoints
- other worldlines
- structural reading state

## Concrete Example: Typing Into An Empty Buffer

Start state:

- `BufferWorldline(buf-1)`
- `RopeHead(head-0)` materializes to `""`
- no ticks yet or one seed tick, depending on implementation

Operation:

```ts
replaceRangeAsTick({
  worldlineId: "buf-1",
  baseHeadId: "head-0",
  startByte: 0,
  endByte: 0,
  insertText: "hello"
})
```

Expected result:

- create `TextBlob(blob-1, "hello")`
- create `RopeLeaf(leaf-1 -> blob-1[0..5])`
- create `RopeHead(head-1 -> leaf-1)`
- create `Tick(tick-1)`
- create `TickReceipt(receipt-1)`
- update `BufferWorldline(buf-1).CANONICAL_HEAD = head-1`

Materialized text:

```text
hello
```

## Concrete Example: Replacing Interior Text

Current text:

```text
hello cruel world
```

Possible existing leaves:

```text
leaf-a -> "hello "
leaf-b -> "cruel"
leaf-c -> " world"
```

Operation:

```ts
replaceRangeAsTick({
  worldlineId: "buf-1",
  baseHeadId: "head-10",
  startByte: 6,
  endByte: 11,
  insertText: "kind"
})
```

Expected result:

- `leaf-a` reused
- `leaf-c` reused
- new blob and leaf for `"kind"`
- new parent path
- new head, tick, and receipt

Materialized next text:

```text
hello kind world
```

The important part is local reuse. The rewrite should not clone `leaf-a` and
`leaf-c` just because `leaf-b` changed.

## Concrete Example: Save

Current hot state:

- worldline at `head-11`
- ticks `tick-1 .. tick-9`

Operation:

```ts
createCheckpoint({
  worldlineId: "buf-1",
  headId: "head-11",
  kind: "save"
})
```

Expected result:

- one new checkpoint node
- no new head
- no text mutation
- tick chain remains intact

This is the exact reason save should not be modeled as "reset causal rope."

## Concrete Example: Anchor Survives Edit

Suppose there is a point anchor after `"hello"`:

```ts
registerAnchor({
  worldlineId: "buf-1",
  basisHeadId: "head-11",
  startByte: 5,
  bias: "right"
})
```

Now we insert `" there"` at byte `5`.

For a right-biased anchor, the transformed anchor should land after the
inserted content, not before it.

Conceptually:

```ts
const next = replaceRangeAsTick({
  worldlineId: "buf-1",
  baseHeadId: "head-11",
  startByte: 5,
  endByte: 5,
  insertText: " there"
})

const moved = transformAnchorAcrossTick(anchor, next.receipt)
```

Expected logical result:

- old text: `hello world`
- new text: `hello there world`
- old anchor at `5`
- new right-biased anchor at `11`

## Things I Expect To Stay Outside This Graph

These should stay outside the hot Echo text graph unless a later proof shows
otherwise:

- AST nodes
- diagnostics
- syntax spans
- fold regions
- file explorer state
- active pane/focus state
- preview mode state
- Git branch metadata
- workspace-level build output

Those belong in observer readings, product state, or ecosystem projections.

## Summary Of The Smallest Useful First Cut

If I had to compress this to the smallest text reading and rewrite model that
still feels honest, it would be:

- `BufferWorldline`
- `RopeHead`
- `RopeBranch`
- `RopeLeaf`
- `TextBlob`
- `Tick`
- `TickReceipt`
- `Checkpoint`
- `Anchor`

with these rewrites:

- `CreateBufferWorldline`
- `ReplaceRangeAsTick`
- `CreateCheckpoint`
- `RegisterAnchor`
- derived or explicit `TransformAnchorAcrossTick`
- maintenance-only `RebalanceHead`

That is enough for:

- canonical causal text truth
- lawful local editing
- save as checkpoint
- anchor stability
- structural reading basis for Graft

without forcing ASTs, Git commits, or UI behavior into canonical causal text
history.
