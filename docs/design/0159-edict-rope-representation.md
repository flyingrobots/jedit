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
subtrees keep their identity across edits. Each head links to its basis head, so
every retained version stays reachable from the worldline root and therefore
inside the state root. An imported head is anchored to the file coordinate and
the host digest of the bytes it was built from.

This replaces nothing in production yet. `jedit.text.schema@1` (DL-0158), the
native planner, and its oracle remain the current truth. Schema 2 is the
representation the authored source in `edict/replace-range/draft/` targets.

## Sponsored Human

A developer editing in Jim wants every edit to be explainable and recoverable
from Echo's own history, without trusting a native planner whose structure Echo
cannot see.

## Sponsored Agent

An agent needs every rope version, and the file bytes each version came from,
to be reachable through typed graph structure, so it can explain or replay an
edit without decoding application JSON.

## Hill

A reviewer can check, from this document and the draft source alone, which
node, edge, and atom an Edict-authored `ReplaceRange` reads and writes, and why
old versions remain visible to the state root.

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

So schema 1 rope versions persist in the store but are invisible to the state
root, and Edict would have to parse JSON to follow a child.

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

Edges (no payload; one edge per source node and type):

| Edge type | From → to | Meaning |
| --- | --- | --- |
| `jedit.text.canonicalHead` | Buffer → Head | current head; retargeted by each edit |
| `jedit.text.root` | Head → Branch or Leaf | the head's tree; absent for empty text |
| `jedit.text.basis` | Head → Head | the head this one was derived from |
| `jedit.text.anchor` | Head → Import | the imported bytes a head descends from |
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
- UTF-16 length is dropped from stored metrics. No consumer outside the native
  rope reads it; a reading may derive it.

History reachability: worldline root → Buffer → `canonicalHead` → Head →
`basis` → older Head → … Every retained version is reachable, so the state root
commits all of them.

Head-to-file identity (anchored refinement):

- Importing a file creates an `Import` node for its coordinate and the host
  digest of the imported bytes, and anchors the import head to it.
- Every later head reaches its `Import` through the `basis` chain.
- Reopening compares the current host digest with the anchored digest. A
  mismatch is a typed obstruction or an explicit, witnessed external-edit
  transition, never silent reuse (#350).
- Export to the file is a separate witnessed crossing, designed later.

## Runtime / API Contract

The authored `ReplaceRange` operation, in schema 2 terms:

1. Read Buffer and its `canonicalHead`; require it equals the invocation basis.
2. Read the bounded closure of nodes the edit touches: both boundary paths and
   the spines a join may descend.
3. Compute, purely, the new nodes and edges.
4. `ensure` each new immutable node and edge; replace the `canonicalHead` edge
   and bump `Buffer.version`. All or nothing.

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

Every relation an agent needs is a typed edge, so an agent can traverse rope
history without decoding application payloads.

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
- **Keep UTF-16 length.** Deferred: adds a Unicode-counting primitive to the
  critical path for a metric nothing outside the native rope reads.

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
- Reachability: after N edits, all N+1 heads are reachable and inside the state
  root.
- Anchor: reopen with a changed host digest obstructs (#350).

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
  graph on every commit. Keeping all history reachable makes that walk grow
  with history. This is a generic Echo cost (an incremental or Merkle root
  would fix it), not a reason to hide history. Recorded; deferred.
- **Patch size.** About `(depth + 1) × (node + atom + up to 2 edges)` operations
  per edit, against Echo's 128 operations per tick. Depth stays near
  `1.44 × log2(leaves)`; to be measured.
- **Hash choice.** The id hash must be one Edict and Echo both expose.

## Follow-On Debt

- Open: which hash Edict source exposes for identities.
- Open: whether Head should carry a content digest of its full text, so a
  reopen check need not materialize the rope.
- Open: Rewrite and Diff facts in schema 2.

## Retrospective

Not yet.
