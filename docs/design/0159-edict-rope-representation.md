---
title: "DL-0159 - Edict-Authored Rope Representation"
legend: "DL"
lane: "design"
issue: "https://github.com/flyingrobots/jedit/issues/296"
status: "draft"
owners:
  - "@flyingrobots"
created: "2026-10-15"
updated: "2026-10-15"
---

# DL-0159 - Edict-Authored Rope Representation

## Linked Issue

- [#296 Author and prove Jim's first Edict operation: `ReplaceRange`](https://github.com/flyingrobots/jedit/issues/296)
- [#302 Author ReplaceRange as Jedit-owned Edict source](https://github.com/flyingrobots/jedit/pull/302)
- [#350 Reopening a file silently reuses a stale rope](https://github.com/flyingrobots/jedit/issues/350)
- Echo decision: [Application operation semantics authored in Edict source](https://github.com/flyingrobots/echo/blob/docs/edict-authored-operation-effects/docs/topics/GeneratedRules.md#application-operation-semantics-authored-in-edict-source)
  (proposed for review)
- Echo design: [Authored Operation Effects](https://github.com/flyingrobots/echo/blob/docs/edict-authored-operation-effects/docs/architecture/authored-operation-effects.md)
  (proposed for review)

## Decision Summary

The rope that Jim's Edict source reads and writes uses a new text schema,
`jedit.text.schema@2`. Every structural relation is an Echo edge; atoms carry
only scalar facts. Atom payloads use Echo's canonical CBOR v1. Immutable nodes
are content-addressed over their facts and their ordered children, so unchanged
subtrees keep their identity across edits. Every head is anchored to the file
coordinate and the host digest of the bytes its lineage was imported from.

The graph holds the **current** rope only. Echo's ticks and receipts are the
causal history of how it got there; Jim does not duplicate that history as a
chain of reachable heads. Whether superseded nodes stay retained, and how far
back a past state can be reconstructed, is Echo's retention and replay
contract, not a property of rope topology.

This replaces nothing in production yet. `jedit.text.schema@1` (DL-0158), the
native planner, and its oracle remain the current truth. Schema 2 is the
representation the authored source in `edict/replace-range/draft/` targets.

## Sponsored Human

A developer editing in Jim wants every edit to be explainable and recoverable
from Echo's own history, without trusting a native planner whose structure Echo
cannot see.

## Sponsored Agent

An agent needs the current rope, and the file bytes it descends from, to be
reachable through typed graph structure, and needs past edits to be explained
by Echo's causal history, so it never decodes application JSON.

## Hill

A reviewer can check, from this document and the draft source alone, which
node, edge, and atom an Edict-authored `ReplaceRange` reads and writes, and
which guarantees about past versions come from Echo rather than from the rope.

## Current Truth

Schema 1 (DL-0158, `native/jedit-echo-host/src/records.rs`):

- Seven fact types (Buffer, Blob, Leaf, Branch, Head, Rewrite, Diff), each a
  node whose alpha atom is compact field-ordered UTF-8 JSON.
- Child links are node ids inside that JSON. The graph has no edges.
- Leaves reference a byte range inside a separate Blob.
- Per-node metrics include UTF-16 length, which only the native rope reads.
- `BufferFact` is the only mutable node; it names the canonical head by id.

Echo facts that constrain the choice (Echo main `9b3b9396`):

- The state root walks outgoing edges from the worldline root. Nodes reachable
  only through ids inside atom bytes are excluded from it
  (`crates/warp-core/src/snapshot.rs`, `worldline_state.rs`).
- Echo's attachment law forbids hiding structural dependencies in payload bytes
  (`crates/warp-core/src/attachment.rs`; `docs/invariants/warp-two-plane-law.md`).
- Edge ids are caller-chosen 32 bytes; a node may have many incoming edges.
- Nothing is garbage-collected; reachability decides only what the state root
  commits.

So schema 1's current rope is itself invisible to the state root, and Edict
would have to parse JSON to follow a child.

## Problem

Jim's rope must be authored in Edict and realized by generic Echo machinery.
That needs a representation whose structure Echo can see, hash, and retain;
whose bytes have one canonical spelling; and whose identity is honestly related
to the file it came from.

## Scope

- Fact types, codec, identity law, edge types, and metrics for schema 2.
- The head-to-file anchor.
- Which generic Echo and Edict capabilities this representation requires.

## Non-Goals

- Migrating schema 1 buffers. A witnessed migration operation is follow-on work.
- Save/export. The export crossing is designed separately; #350 covers reopen.
- Checkpoints, rewrites, diffs, and anchors beyond the import anchor.
- Any change to Echo or Edict. This document names their gaps only.

## Data / State Model

Facts (alpha atoms, canonical CBOR v1 via `echo-edict-canonical`):

| Node | Atom fields | Mutable |
| --- | --- | --- |
| `Buffer` | `bufferKey`, `version: U64` | yes: `version` and its `canonicalHead` edge |
| `Head` | `byteLength: U64`, `lineCount: U64`, `sequence: U64` | no |
| `Branch` | `byteLength: U64`, `lineBreaks: U64`, `height: U8` | no |
| `Leaf` | `bytes: Bytes<max=4096>`, `lineBreaks: U64` | no |
| `Import` | `fileCoordinate`, `hostDigest: Bytes<exact=32>` | no |
| `Export` | `fileCoordinate`, `logicalDigest: Bytes<exact=32>`, `hostDigest: Bytes<exact=32>`, `exportEvent: Bytes<exact=32>` | no |

Edges (no payload; one edge per source node and type):

| Edge type | From → to | Meaning |
| --- | --- | --- |
| `jedit.text.canonicalHead` | Buffer → Head | current head; retargeted by each edit |
| `jedit.text.root` | Head → Branch or Leaf | the head's tree; absent for empty text |
| `jedit.text.anchor` | Head → Import | the imported bytes this head's lineage descends from (provenance only) |
| `jedit.text.lastExport` | Buffer → Export | the last witnessed write of this buffer to its file; retargeted by each save |
| `jedit.text.left`, `jedit.text.right` | Branch → Branch or Leaf | ordered children |

Identity law:

- Immutable node id: `H("jedit.text.node.v2", typeId, atomBytes, childIds...)`
  with children in edge-type order. Equal subtrees have equal ids.
- Edge id: `H("jedit.text.edge.v2", fromNodeId, edgeTypeId)`. This makes
  "one edge per source and type" hold by construction, and retargeting the
  canonical head an edge replacement rather than a new edge.
- Buffer id: `H("jedit.text.buffer.v2", bufferKey)`, as in schema 1.
- `H` is the domain-separated hash Echo exposes to Edict; which hash that is
  remains an open question below.

Rope law (unchanged from schema 1 except where noted):

- Leaves hold at most 4096 bytes and end on a UTF-8 boundary.
- Branches are binary and AVL-balanced by `height`.
- Edits path-copy: only nodes on the affected paths and the new head are new.
  Nothing is deleted.
- Leaves hold their bytes inline. Schema 1's Blob indirection is dropped;
  content addressing already deduplicates equal leaves.

Coordinate contract:

- Byte offsets into the UTF-8 text are the only authoritative coordinates.
  Every operation takes and returns byte offsets.
- UTF-16 code-unit offsets matter for interoperability (language servers,
  browser selection, external editing protocols), even though no Jim code reads
  them today. Whether they are derived on demand, cached in readings, or
  retained as a per-node witnessed metric is an open decision (see Follow-On
  Debt). Until it is made, schema 2 does not store them, and nothing may treat
  their absence as a decision that they are unneeded.

History, current state, and retained material are three different things:

| | Owner | What it guarantees |
| --- | --- | --- |
| Causal history | Echo ticks and receipts | what happened, in which causal context, with which outcome |
| Current state | this graph | the Buffer, its canonical Head, and the nodes reachable from that Head |
| Retained material | Echo retention and replay | which past states can be reconstructed, from checkpoints or replay inputs |

The graph keeps no edge from a head to the head it replaced. After an edit,
the state root covers the current rope only. Superseded nodes leave the
reachable graph. Whether their bytes remain available is Echo's retention
policy; a tick witnessing a transition does not by itself promise that the
bytes needed to reconstruct the earlier state are still retained.

Undo and redo are forward operations: Jim proposes a new edit whose target
state derives from a past witnessed state, subject to the evidence Echo still
retains and to admission. Nothing moves history backward.

Head-to-file identity (anchored refinement). Three facts are kept apart:

| Fact | Where | Claims | Never claims |
| --- | --- | --- | --- |
| Import provenance | `Import` node, `anchor` edge | these contents descend from the bytes imported from this file, with this host digest | that the rope still matches the file |
| Current logical content | computed from the current rope | the bytes Jim represents now | anything about the file |
| Host synchronization | `Export` node, Buffer `lastExport` edge | these exact bytes were written to this file, with this resulting host digest | that the file is unchanged since |

- Importing a file creates an `Import` node and anchors the import head to it.
  Every edit copies the `anchor` edge to the new head. The anchor is
  provenance only; after an unsaved edit it says nothing about the file.
- The current logical digest is computed over the rope's bytes when a crossing
  needs it (save, reopen, reconciliation), not on every edit, so edits stay
  path-copies. The root node id is not that digest: it depends on tree shape.
- An `Export` is evidence of one crossing: the file, the logical digest of the
  bytes written, the resulting host digest, and `exportEvent`, the identity of
  the causal event that witnessed it. It names the exported head only through
  that event and the logical digest; there is no edge to the head, so a save
  does not keep a historical rope reachable. A pinned saved snapshot, if one is
  ever wanted, is an explicit retention lease with its own lifetime.
- The `Export` reachable through `lastExport` witnesses the last successful
  export. It is never file authority: the filesystem's current bytes are, and
  every crossing re-observes them.
- Save is a crossing to a foreign system, so its steps stay separate
  (`docs/jim-component-ownership.md`, `ExportIntent` and `ExportObserved`):
  1. **Export intent.** An admitted Jim operation records the head to write,
     its logical digest, the expected prior host digest (the last export's,
     or the import's if never exported), and an occurrence key.
  2. **Host write.** A host effector writes the bytes. Its own concurrency
     protocol decides how close it gets to compare-and-write; see below.
  3. **Observation.** The effector reads back the resulting host digest. That
     reading enters Echo as witnessed ingress.
  4. **Export outcome.** An admitted Jim operation records the `Export` and
     retargets `lastExport` only when the observed digest equals the intended
     bytes' digest. Any other observation is a typed conflict that needs an
     explicit reconciliation decision.
  5. **Recovery.** An intent without an outcome is resolved by re-observing
     the file under the same occurrence key: the intended digest means the
     write happened; the expected prior digest means it did not and may be
     retried under the same key; anything else is an external change and a
     conflict.
- What this does and does not guarantee: comparing digests before writing
  detects most external modifications, but a writer that changes the file
  between that check and the write is not prevented by it. Echo's atomic
  commit does not make the host write atomic with it. Preventing that race
  needs a host-side concurrency protocol (an exclusive lock, or an atomic
  compare-and-replace the filesystem actually provides). Until one is chosen,
  the claim is detection after the fact, and step 3's observation is what
  makes it detectable.
- Reopening compares the file's current host digest with the last exported
  digest, or the import digest if the buffer was never exported. A mismatch
  means the file changed outside Jim: a typed obstruction or an explicit,
  witnessed external-edit transition, never silent reuse (#350).
- The `Export` node and `lastExport` edge are part of schema 2; the save
  operation itself is designed separately.

Third-party file changes. Another process (an editor, `git checkout`, a
formatter, a sync client) can write the file while Jim holds a buffer for it.
Jim's view of the file is always a past observation, so this is an ordinary
case, not an error:

- **Synchronization basis.** A buffer's synchronization basis is the host
  digest of its last export, or of its import if it was never exported. It
  says what the file held the last time Jim and the file agreed.
- **Detection.** Jim learns of a change only by observing the file: a watcher
  event (best effort; missed or coalesced events are reported as gaps), focus
  or explicit refresh, reopen (#350), or the save protocol's step 1 and
  step 3. Each observation enters Echo as witnessed ingress. A file whose host
  digest differs from the synchronization basis has changed outside Jim; an
  unobserved file is `Unknown`, never assumed unchanged.
- **External change record.** An observed change is admitted as a new
  `Import` for the same file coordinate with the observed host digest. It is
  provenance for the external bytes, not yet a decision about the buffer.
- **Clean buffer** (the current logical digest equals the synchronization
  basis's content). Jim may adopt the external bytes as a new head anchored to
  the new `Import`, by an admitted operation, either automatically under a
  declared policy or on request. Adoption is a forward edit; the old head stays
  in causal history.
- **Dirty buffer** (unsaved edits since the synchronization basis). The buffer
  and the file have diverged from a common base. Jim never resolves this
  silently. The decision is explicit and witnessed, and the choices are:
  1. **Keep mine.** Save anyway: an export whose expected prior digest is the
     *observed external* digest, recorded as overwriting a known third-party
     change.
  2. **Take theirs.** Adopt the external bytes as a new head. The unsaved head
     remains in causal history, and retention decides how long its bytes stay
     reconstructible; Jim may offer it as a recoverable alternative.
  3. **Merge.** A three-way merge with base = the synchronization basis's
     bytes, ours = the current head, theirs = the external bytes. A clean merge
     is a new head with both `Import`s in its provenance. An overlapping merge
     is a `Plural` outcome the user resolves, never a guess.
  4. **Defer.** Keep editing; the divergence stays recorded, and save is
     obstructed until one of the above is chosen.
- **Merge base availability.** A merge needs the base bytes. Without an
  `Export → Head` edge they live only in causal history, so whether they are
  still reconstructible is Echo's retention decision. If they are not, merge is
  refused with a typed `MergeBaseUnavailable` and only keep-mine and
  take-theirs remain. A retention lease on the last synchronized head would
  guarantee the base; that is an open decision below.
- **Save during divergence.** The save protocol's expected prior digest makes
  an unresolved divergence a conflict at step 1, and a change that lands
  between check and write a conflict at step 3. Neither overwrites silently.

## Runtime / API Contract

The authored `ReplaceRange` operation, in schema 2 terms:

1. Read Buffer and its `canonicalHead`; require it equals the invocation basis.
2. Read the bounded closure of nodes the edit touches: both boundary paths and
   the spines a join may descend.
3. Compute, purely, the new nodes and edges.
4. `ensure` each new immutable node and edge, including the new head's `root`
   and copied `anchor` edges; replace the `canonicalHead` edge and bump
   `Buffer.version`. All or nothing. No edge points from the new head to the
   old one.

Generic capabilities this needs, none of which exists today:

| Need | Owner | Status on main |
| --- | --- | --- |
| Read outgoing edges by type (`edict_read`) | Echo | absent; reads alpha atoms only |
| Bounded closure read guided by a pure selector | Echo + Edict | absent |
| `ensure` (create, or require equal existing) | Echo + Edict | absent; create obstructs on existing |
| Multi-node, multi-edge atomic effects from evaluation | Echo | absent; see Echo bridge design |
| Edge create and replace effects | Echo + Edict | absent |
| Domain-separated hash in Edict source | Edict + Echo | absent |

## Lower Modes

Not applicable: this is a storage representation, not a user surface.

## Accessibility Posture

Not applicable.

## Localization / Directionality Posture

Text is stored as UTF-8 bytes without normalization. Line breaks count `\n`
only, as in schema 1.

## Agent Inspectability / Explainability Posture

Every relation in the current rope is a typed edge, so an agent can traverse it
without decoding application payloads. Past edits are explained from Echo's
causal history and receipts, not from rope topology.

## Linked Invariants

- Echo two-plane law: structure in the skeleton, not in payload bytes.
- History Over State ch. 21 and 42: a rope head is the workspace coordinate,
  an anchored refinement of it, or the source of a witnessed crossing.
- DL-0158: codec or edge migration is a separately admitted operation.

## Design Alternatives Considered

- **Child ids inside atoms (schema 1 shape).** Rejected: children fall outside
  the state root, and the shape breaks Echo's two-plane law.
- **Edges plus duplicated child ids in atoms.** It would let today's
  `edict_read` follow children without an edge read. Rejected: two sources of
  truth for one relation, with nothing enforcing agreement.
- **Keep JSON atoms.** Rejected: forces Edict source to parse JSON
  byte-by-byte (the #302 Buffer-decoder probe) and admits several spellings.
- **Keep Blob slices.** Rejected for schema 2: adds an indirection and a slice
  read per leaf; content-addressed leaves already deduplicate.
- **Link each head to its basis head.** Rejected: it would make every version
  of every buffer permanently reachable, so the state root and retention would
  grow with editing history, and it duplicates the causal history Echo's ticks
  and receipts already own. History is not state.
- **Drop UTF-16 coordinates.** Rejected as a decision: no current consumer is
  not a reason to discard an interoperability coordinate. Left open instead.

## Decision

Adopt schema 2 as above for the Edict-authored rope, on review of this document
and the Echo evaluation-to-effect design.

## Implementation Slices

1. Publish `jedit.text.schema@2` (machine-readable, like schema 1).
2. Write a simple, deliberately inefficient Edict reference `ReplaceRange`
   (semantic target), then the persistent rope (persistence target).
3. Build a schema 2 oracle by differential comparison: the reference and the
   persistent rope must agree on logical text and outcomes, not physical roots.
4. Witnessed schema 1 → 2 migration.

## Tests To Write First

- Canonical codec vectors for every fact type, including rejection of
  non-canonical encodings.
- Identity: equal subtrees produce equal ids; any atom or child change changes
  the id.
- Reachability: after an edit, the state root covers exactly the current Buffer,
  Head, Import, and rope; nodes only the superseded head used are unreachable.
- Reconstruction: a past state is rebuilt from Echo's checkpoints and replay,
  and the test states which retention guarantee it relies on.
- Anchor: reopen with a changed host digest obstructs (#350).
- Third-party change, clean buffer: adoption produces a head anchored to the
  new `Import` with exactly the external bytes.
- Third-party change, dirty buffer: save is obstructed until keep-mine,
  take-theirs, or merge is chosen; each choice leaves the expected head and
  provenance; overlapping merges are `Plural`.
- Merge base gone: with the base bytes unretained, merge refuses with
  `MergeBaseUnavailable` and the other choices still work.
- Race: a file changed between the save's check and its write is reported as a
  conflict at observation, never recorded as a successful export.
- Recovery: a crash between export intent and outcome resolves to written,
  not written, or external change by re-observation.

## Acceptance Criteria

- Schema 2 declaration published with codec vectors.
- The draft authored source reads and writes only schema 2 propositions.
- Every needed generic capability has an owner issue.

## Validation Plan

Codec and identity vectors in this repository; reachability and atomicity
through the Echo bridge once it exists.

## Playback / Witness

None yet. This is a representation decision.

## Risks

- **State-root cost.** Echo recomputes the root by walking the whole reachable
  graph on every commit, so an edit costs in proportion to the current rope,
  not to its history. That is still more than the edit itself; an incremental
  root is Echo's open state-root decision. Recorded; deferred.
- **Unreclaimed nodes.** Echo has no garbage collection today, so superseded
  nodes stay in the store after they leave the reachable graph. Reclaiming them
  is Echo's retention policy, not Jim's.
- **Patch size.** About `(depth + 1) × (node + atom + up to 2 edges)` operations
  per edit, against Echo's 128 operations per tick. Depth stays near
  `1.44 × log2(leaves)`; to be measured.
- **Hash choice.** The id hash must be one Edict and Echo both expose.

## Follow-On Debt

- Open: Jim's UTF-16 coordinate contract: derive on demand, cache in readings,
  or retain as a witnessed per-node metric. Decide from the interoperability
  surfaces Jim commits to (language server, external protocols), not from
  today's consumers.
- Open: which hash Edict source exposes for identities.
- Open: whether the last synchronized head gets a retention lease so a
  three-way merge always has its base (see Third-party file changes), and that
  lease's lifetime and release.
- Open: the host-side concurrency protocol for the export write.
- Settled by the anchor split: a reopen check compares host digests only, so
  it never materializes the rope; the logical digest is computed at save.
- Open: Rewrite and Diff facts in schema 2.

## Retrospective

Not yet.
