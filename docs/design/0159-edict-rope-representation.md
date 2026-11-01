---
title: "DL-0159 - Edict-Authored Rope Representation"
legend: "DL"
lane: "design"
issue: "https://github.com/flyingrobots/jedit/issues/296"
status: "draft"
owners:
  - "@flyingrobots"
created: "2026-10-15"
updated: "2026-10-20"
---

# DL-0159 - Edict-Authored Rope Representation

## Linked Issue

- [#296 Author and prove Jim's first Edict operation: `ReplaceRange`](https://github.com/flyingrobots/jedit/issues/296)
- [#350 Reopening a file silently reuses a stale rope](https://github.com/flyingrobots/jedit/issues/350) (closed by #356)
- Echo design: [Authored Operation Effects](https://github.com/flyingrobots/echo/blob/main/docs/architecture/authored-operation-effects.md)
  (on main; its own status line says not implemented)
- Echo implementation: [echo#921 exact-parent authored graph effects](https://github.com/flyingrobots/echo/pull/921) (draft)

## Decision Summary

Review ruling (2026-10-20): **enhance**. The architectural direction is
approved; schema 2 is not frozen until the corrections below hold and the
representation gate passes. The filesystem save and recovery guarantees of the
previous revision are withdrawn and replaced by the file-crossing contract
below.

Jim's Edict-authored rope uses a new text schema, `jedit.text.schema@2`:

- Every structural relation is a typed Echo edge; atoms carry only scalar
  facts, encoded with Echo's exact canonical codec profile.
- Immutable nodes are content-addressed under Echo's generic bridge identity
  law `ContentAddressV1`, so unchanged subtrees keep their identity across
  edits and both Edict and Echo compute the same ids from the stored facts.
- The graph holds the **current** representation and its current obligations
  only. Echo's ticks and receipts are the causal history; Jim keeps no chain of
  predecessor heads.
- Four file facts stay apart: import provenance, the current logical content,
  the **accepted host basis** Jim works against, and the evidence of each
  export.

The design has two acceptance gates. The **representation gate** covers the
schema, identity, structural invariants, authored effects, resource behavior,
atomic publication, and recovery of edits. The **file-crossing gate** covers
observation evidence, the accepted host basis, the export lifecycle,
retention, interference guarantees, and reconciliation. Passing the first does
not imply anything about the second.

This replaces nothing in production yet. `jedit.text.schema@1` (DL-0158), the
native planner, and its oracle remain the current truth until the authored rope
passes the representation gate and cuts over; then the native law is deleted.

## Sponsored Human

A developer editing in Jim wants every edit to be explainable and recoverable
from Echo's own history, without trusting a native planner whose structure Echo
cannot see, and wants Jim never to claim more about their file than it knows.

## Sponsored Agent

An agent needs the current rope, and the identity of the file bytes it
descends from, to be reachable through typed graph structure from the worldline
root, and needs past edits explained by Echo's causal history, so it never
decodes application JSON. When it needs earlier bytes, it needs a named
retention contract that says whether they are still available.

## Hill

A reviewer can check, from this document and the draft source alone, which
node, edge, and atom an Edict-authored `ReplaceRange` reads and writes, how
every id is computed, which resource envelope it supports, and which claims
about the file are backed by which evidence.

## Current Truth

Schema 1 (DL-0158, `native/jedit-echo-host/src/records.rs`):

- Seven fact types (Buffer, Blob, Leaf, Branch, Head, Rewrite, Diff), each a
  node whose alpha atom is compact field-ordered UTF-8 JSON.
- Child links are node ids inside that JSON. The graph has no edges.
- Leaves reference a byte range inside a separate Blob.
- Per-node metrics include UTF-16 length, which only the native rope reads.
- `BufferFact` is the only mutable node; it names the canonical head by id.

Echo facts that constrain the choice:

- The state root walks outgoing edges from the worldline root. Nodes reachable
  only through ids inside atom bytes are excluded from it
  (`crates/warp-core/src/snapshot.rs`, `worldline_state.rs`).
- Echo's attachment law forbids hiding structural dependencies in payload bytes
  (`crates/warp-core/src/attachment.rs`; `docs/invariants/warp-two-plane-law.md`).
- The bridge design fixes `ContentAddressV1`: content node ids, content edge
  ids, and mutable slot edge ids, each BLAKE3 over its own domain
  (Authored Operation Effects, *Identity laws*). Echo recomputes every id a
  proposal creates and refuses a mismatch.
- The bridge refuses duplicate effect targets, including identical `ensure`s
  (*EffectProposal*), and caps one Action batch at 128 patch operations
  (*Current implementation*). Oversized proposals are refused, not split
  across Ticks (*Basis, budget, retries*).
- The bridge preserves keyed readability of unreachable records until a
  witnessed or versioned semantic mechanism changes it. Unreachable is not
  permission to reclaim.
- Continuum import dispatch is not wired and returns `NOT_SUPPORTED`
  (`continuum-transport.md`, *Import law*). Participant-history braids are an
  accepted design whose implementation does not yet provide separated
  Hold/Judge/Apply or conflict barriers.

So schema 1's current rope is invisible to the state root, and Edict would have
to parse JSON to follow a child.

## Problem

Jim's rope must be authored in Edict and realized by generic Echo machinery.
That needs a representation whose structure Echo can see, hash, and retain;
whose bytes have one canonical spelling; whose ids both implementations compute
identically; and whose relationship to the file is stated at exactly the
strength its evidence supports.

## Scope

- Representation gate: fact types, codec, identity law, edge types, metrics,
  reachability, text invariants, the resource envelope, and the authored
  `ReplaceRange`.
- File-crossing gate: observation evidence, the accepted host basis, the export
  lifecycle and its declared guarantees, recovery, retained material, path
  classification, and divergence handling.
- The generic Echo and Edict capabilities both gates require, each with an
  owner issue.

## Non-Goals

- Migrating schema 1 buffers. A witnessed migration is a later slice.
- Any change to Echo or Edict in this document; it names their gaps and owners.
- Reintroducing predecessor-head chains to compensate for an unspecified
  retention contract.
- Splitting one atomic `ReplaceRange` into several visible edits to fit a
  batch limit.
- Making the first authored rope wait for every part of distributed braiding.
  The first executable witness stays small and complete.

## Data / State Model

### Facts

Atoms use Echo's canonical codec profile exactly as `echo-edict-canonical`
defines it, with published vectors. "Canonical CBOR" alone is not a precise
interoperability label: RFC 8949 allows more than one deterministic profile.

| Node | Atom fields | Identity class |
| --- | --- | --- |
| `Buffer` | `bufferKey`, `version: U64` | mutable |
| `Head` | `byteLength: U64`, `lineCount: U64`, `sequence: U64` | content |
| `Branch` | `byteLength: U64`, `lineBreaks: U64`, `height: U8` | content |
| `Leaf` | `bytes: Bytes<max=4096>`, `lineBreaks: U64` | content |
| `Import` | `fileCoordinate`, `hostDigest: Bytes<exact=32>`, `observation: Bytes<exact=32>` | content |
| `HostBasis` | `fileCoordinate`, `hostDigest: Bytes<exact=32>`, `evidence: Bytes<exact=32>`, `generation: U64` | content |
| `Export` | `exportIntent: Bytes<exact=32>`, `fileCoordinate`, `logicalDigest: Bytes<exact=32>`, `hostDigest: Bytes<exact=32>`, `observation: Bytes<exact=32>` | content |

`observation`, `evidence`, and `exportIntent` name causal evidence that
already exists when the node is written: an admitted observation's occurrence
identity, or an admitted export intent's identity. None names the commit that
contains the node itself, so no identity is circular.

### Edges

| Edge type | From → to | Meaning |
| --- | --- | --- |
| `jedit.text.buffer` (conceptual; layout pending echo#927) | worldline root → Buffer | attaches each buffer to the committed state |
| `jedit.text.canonicalHead` | Buffer → Head | current head; retargeted by each edit |
| `jedit.text.acceptedHostBasis` | Buffer → HostBasis | the host version Jim currently works against; retargeted by the transitions below |
| `jedit.text.lastExport` | Buffer → Export | what Jim last exported; never the synchronization basis |
| `jedit.text.root` | Head → Branch or Leaf | the head's tree; absent for empty text |
| `jedit.text.anchor` | Head → Import | the import this head's lineage descends from (provenance only) |
| `jedit.text.left`, `jedit.text.right` | Branch → Branch or Leaf | ordered children |

"One edge per source and type" is enforced where Echo enforces it, not only by
Jim's constructor: a mutable source's slot edge id is fixed by its source and
type, and Echo scans a mutable source's outgoing bucket and refuses any alias
of the same type (`IdentityLawViolation`).

### Identity law

Every id is computed under `ContentAddressV1`, the bridge's generic law, never
an application-specific recipe:

- A content node's id commits to its type, the attachment digest of the atom it
  actually stores, and its complete outgoing edge set (each edge's type and
  target), exactly the edges its creating proposal gives it.
- A content node is created with every outgoing edge it will ever have, in one
  proposal, and is immutable afterwards.
- `Buffer` is mutable with a program-chosen id: `BufferId` is derived from
  `bufferKey` under a Jim domain, as in schema 1, and is not a content address.
- An edge from a content node has a content edge id; an edge from a mutable
  node has a slot edge id that stays the same when `ReplaceEdge` retargets it.

A `Head`'s id is therefore computed from its actual `HeadFact` and its actual
outgoing edges: `anchor`, plus `root` when the text is non-empty. The empty
head has no `root` edge and its id says so; nothing extra is hashed and nothing
stored is omitted.

Scope of "equal subtrees have equal ids": equal under `ContentAddressV1`
within one warp instance. Ids from different identity profiles or different
warps are not comparable.

Edict source computes ids from the inputs the bridge uses (edict#260). Both
implementations must match published, independent identity vectors, including
empty and non-empty heads.

### Effect normalization

Repeated text produces repeated content ids. The authored program normalizes
its proposal before emitting it, because the bridge rejects duplicate targets:

- identical target and identical intended content: emit one effect;
- identical target and different intended content: an integrity failure,
  never a silent choice;
- effects in canonical order.

The bridge's generic rejection stays; silent deduplication there would hide
mistakes in the proposal Echo is meant to witness.

### Rope law and text invariants

- Leaves hold at most 4096 bytes, are valid UTF-8, and end on a character
  boundary.
- Branches are binary and AVL-balanced by `height`.
- Line breaks count `\n` only; `lineCount = lineBreaks + 1`.
- All length, line, and height arithmetic is checked; overflow is
  `ArithmeticOverflow`, never wraparound.
- `Head.sequence` is the predecessor head's `sequence + 1`.
  `Buffer.version` increases by one with every admitted change to the Buffer's
  atom or its outgoing edges.
- A replacement whose bytes equal the bytes it replaces is `NoOp` and writes
  nothing.
- Edits path-copy: only nodes on the affected paths, fresh leaves, and the new
  head are new.

The application-owned character-boundary predicate is defined for every bounded
byte input and U64 offset under left-to-right short-circuit evaluation: zero and the byte length are boundaries, offsets
beyond the end are false, and an interior offset is a boundary when its byte
is outside the continuation range 128 through 191. UTF-8 validity is a separate
check; this predicate does not make arbitrary octets valid text. Every byte
lookup is dominated by a strict in-range guard. This refines the boundary
check used by the rope law without moving text semantics into Echo. The
[authored module and conformance witness](../../edict/replace-range-probes/text-boundary/README.md)
exercise that helper separately with finite conformance cases; the complete
rope remains unproved. This predicate does not discharge callers' range
obligations: `boundaryAtOrBefore` still requires an offset at most the byte
length, even though an out-of-range predicate call returns false.

### Coordinates

Byte offsets into the UTF-8 text are the only authoritative coordinates.
UTF-16 offsets matter for interoperability, so schema 2 stores none and treats
them as a derived reading, cached by immutable subtree identity and conversion
version. Cold conversion cost is measured before any decision to store a
witnessed per-node metric.

### Reachability

A worldline holds many buffers, so the Buffer is not the worldline root. Each
Buffer must be reached from the worldline root, in the same proposal that
creates it. The relation is conceptual: its concrete layout is unresolved.
Under `ContentAddressV1` a mutable source has one slot edge per source and
type, so one fixed `jedit.text.buffer` type from the root admits only one
buffer. echo#927 owns the choice between a per-key slot type and a root-owned
index; the index is investigated first, because a derived per-buffer type id
must also satisfy the bridge's admitted schema and type allowlists. The
committed current state is then:
the Buffer, its canonical Head and rope, the Head's Import, the
`acceptedHostBasis` and `lastExport` targets, and declared current metadata,
with no edge from any head to the head it replaced.

The reachability fixture starts at the **actual worldline root**, never at a
conveniently chosen Buffer, and attaches at least two buffers: both stay
reachable and committed, and editing one neither replaces nor disconnects the
other. A one-buffer fixture would pass while missing the problem.

### History, current state, and retained material

| | Owner | What it guarantees |
| --- | --- | --- |
| Causal history | Echo ticks and receipts | what happened, in which causal context, with which outcome |
| Current state | this graph | current representation and current obligations |
| Retained material | named retention contracts | which bytes remain available, acquired before the operation that needs them |

After an edit, superseded nodes leave the reachable graph. Echo keeps them
keyed-readable until a witnessed mechanism changes that; Jim does not depend on
it without a retention contract. Undo and redo are forward operations whose
target derives from a past witnessed state, subject to retained material and
admission.

## Resource Envelope

The v1 operation supports an explicit envelope and refuses atomically outside
it. Each limit is a lawpack constant:

| Limit | Constant | Bounds |
| --- | --- | --- |
| Replacement bytes | `text.maxReplacementBytes` | fresh leaves and the equal-length no-op read |
| Traversed nodes and edges | `text.maxClosureNodes`, `text.maxTreeHeight` | the closure read |
| Decoded and hashed bytes | `text.maxDecodedBytes` | atom decoding and id computation |
| Generated nodes and effects | `text.maxCreatedLeaves`, `text.maxCreatedBranches`, `text.maxEffects` | the proposal |
| Evaluation work and allocation | `text.replaceRangeBudget` | the evaluator meter |

A proposal's construction is three parts, where `h ≤ 1.44 log2(leaves)`:

- **Replacement tree.** `fromBytes` produces K leaves for a non-empty
  replacement and K − 1 internal branches. K is the constructor's actual leaf
  count, not `ceil(replacement / 4096)`: it splits at character boundaries
  near the midpoint, so 8,194 ASCII bytes split into two 4,097-byte halves and
  then into four leaves and three branches, where `ceil(8194 / 4096) = 3`.
- **Boundary and join reconstruction.** Up to two split boundary leaves and
  the branches the splits and joins path-copy, about `O(h)` per boundary and
  per join spine.
- **Publication.** One head with its `root` and `anchor` edges and one Buffer
  update.

Each content node is one node, one atom, and up to two edges. Construction work
and emitted effects differ: normalization can merge equal-content targets, so
fewer effects may be emitted, but the work to build and recognize that content
is still spent and metered. The equal-length no-op check reads the replaced
range, so its reads grow with the replacement, not only with boundary paths and
spines; the replacement bound bounds it.

Under Echo's current 128 patch operations per Action batch, a 1 MiB replacement
(256 fresh leaves and 255 branches) is far outside any envelope. The v1 values
are chosen from a measurement fixture over generated trees, including sizes
just above split thresholds (4,097, 8,193, and 8,194 bytes, not only powers of
two), and recorded with their cost model before the representation gate; raising a cap without that
model is out of scope. Larger edits are a separate operation family (#382).

Three failures stay distinct, and none accuses valid data of corruption:

| Failure | Meaning |
| --- | --- |
| `ResourceLimitExceeded` | a valid operation exceeds the declared envelope |
| `ClosureInsufficient` | the selector asked for too little closure; a defect in the law |
| `MalformedRope` | the stored rope violates its invariants |

## Runtime / API Contract

The authored `ReplaceRange`, in schema 2 terms:

1. Read the Buffer and its `canonicalHead`; require it equals the invocation
   basis, else `BasisNotCanonical`.
2. Check the request against the envelope, else `ResourceLimitExceeded`.
3. Read the bounded closure the edit touches in one witnessed read (echo#926),
   deduplicating material by node identity while preserving traversal meaning
   by edge path and interval: a leaf shared by both children of one branch is
   two positions.
4. Compute, purely, the new nodes and edges and their `ContentAddressV1` ids.
5. Normalize the proposal; `ensure` each new content node with all its edges,
   including the new head's `root` and `anchor`; retarget `canonicalHead` and
   bump `Buffer.version`. All or nothing.

Generic capabilities the representation gate needs:

| Need | Owner |
| --- | --- |
| Authored effects lowered, admitted, scheduled, and published atomically with receipts and WAL | echo#921 |
| Typed edge reads and a guided bounded closure read | echo#926 |
| Mutable nodes reachable from the worldline root | echo#927 |
| `ContentAddressV1` inputs in Edict source | edict#260 |
| Variant and `Option` types | edict#261 |
| Bounded recursion over depth-bounded variants | edict#262 |
| Checked arithmetic, `min`, `max`, division | edict#263 |
| Function preconditions for subtraction and slice | edict#264 |
| Typed failures in pure functions | edict#265 |
| Byte primitives (`at`, `count`, `isUtf8`) | edict#266 |
| Bounded effect-emitting loops lowered to Target IR | edict#267 |

## File-Crossing Contract

This section is the file-crossing gate. None of it is part of the
representation gate.

### What a filesystem observation proves

A digest is a value witness, not a write receipt. Three claims stay distinct:

| Claim | Evidence required |
| --- | --- |
| "These bytes were observed at this path." | A validated observation of those bytes. |
| "This export performed the write." | Evidence attributable to that host operation. |
| "No intervening external update was overwritten." | A concurrency protocol that excludes or conditionally rejects such updates. |

Read-back cannot establish the third claim. If Jim reads B, another editor
writes X, and Jim writes L and reads L back, the read-back is correct and X is
gone; nothing in the final bytes shows X existed.

Export profiles declare which claims they make:

- **Best effort (v1).** Makes the first two claims only. It records an attempt
  and the observed result, and says it cannot exclude an overwritten update.
- **Exclusive.** Also makes the third claim; needs an adapter with a real
  exclusion or compare-and-replace protocol (#377). A caller that requires
  lost-update prevention obstructs with `ExportGuaranteeUnavailable` on an
  adapter that cannot provide it.

Durability is declared separately: a validated read, an atomically published
file, and a crash-durable save (file and containing directory flushed) are
different guarantees, and each export records which it obtained.

Digest comparability: host and logical digests are SHA-256 over raw bytes, and
v1 import and export apply no transformation (no newline or encoding change),
so equality between them is meaningful. A later transformation must declare
its mapping.

### The accepted host basis

`acceptedHostBasis` answers "which host version are we working against?";
`lastExport` answers only "what did Jim last export?". Its transitions:

| Operation | Accepted host basis afterward |
| --- | --- |
| Initial import | the imported host version |
| Hold a new observation | unchanged |
| Adopt external contents H | H |
| Accept observed agreement H = L | H, with no Export fabricated |
| Reconcile B, L, H into local result M | H; M stays locally dirty when M ≠ H |
| Confirm an applicable export of S | the witnessed exported host version S |

Each `HostBasis` names the evidence that made it current and a `generation`
that increases with every transition. The generation orders Jim's own
transitions; it does not make an observation newer. Adopting a delayed older
observation would advance the generation while the accepted external version
went backward, so applicability is a separate rule (requirement 5 under
Observation, holding, and adoption).

### Versions and conditions

| Version | Meaning |
| --- | --- |
| Base B | the accepted host basis |
| Local L | the current rope, including unsaved edits |
| Host H | the file contents in the latest validated observation |

| Condition | Jim's behavior |
| --- | --- |
| H = B, L = B | nothing changed |
| H = B, L ≠ B | local edits only; ordinary export |
| H ≠ B, L = B | external change only; Jim may adopt H as a forward transition |
| H = L, H ≠ B | accept agreement: the basis becomes H, no Export is recorded |
| H ≠ B, L ≠ B, H ≠ L | divergence; preserve both and require an explicit settlement |

### Export lifecycle

- **One unresolved export per file binding.** The binding is the file, not the
  buffer, so two buffers addressing one file share it. The effector serializes
  or fences writes per binding: each intent carries a fencing generation, and
  an effector holding a stale generation does not write.
- **Each export captures** its stable intent identity, the exact head
  exported, the file binding and its authorization, the observations and
  host-attempt evidence that belong to it, and two separate preconditions:
  - `expectedAcceptedBasis`: the identity and generation of the accepted host
    basis B when the export was admitted. It decides whether the outcome still
    applies to Jim's current state.
  - `expectedHostContents`: the host version the write expects to replace,
    enforced as far as the export profile allows. For an ordinary export it is
    B. Only Overwrite sets it to an observed H ≠ B, and then also carries
    `overwriteAuthority`, the authorization bound to H's observation.
- **Outcomes are evidence first.** An outcome advances the accepted host basis
  only if its intent is the binding's current one and its
  `expectedAcceptedBasis` is still accepted. Otherwise it is retained as historical evidence and changes
  no current state. A delayed older outcome never regresses a newer basis.
- **Observation identity.** The intent keeps one identity across retries. Each
  physical read is a new observation with a new identity; retransmitting an
  existing observation reuses its identity.
- **Edits during a save.** A save captures head h₁; the user edits to h₂ while
  the write runs. Completion records the export of h₁ and leaves h₂ canonical.
  h₂ is not synchronized unless its content equals what was exported.

### Recovery

An intent without an outcome is resolved by a new observation, classified:

| Classification | Meaning |
| --- | --- |
| `IntendedContentObserved` | the file now holds the intended bytes |
| `PriorContentObserved` | the file holds the expected prior bytes |
| `DifferentContentObserved` | the file holds something else |

Each classification also records whether the original write's occurrence is
witnessed or **unknown**. Another process may have produced the intended
bytes; Jim may have written and another process restored the prior bytes; a
no-op save makes the two indistinguishable. A recovered postcondition may
settle the pending workflow under a declared policy; it never invents an
`Export` event.

### Observation, holding, and adoption

The filesystem is another authority. Following AIΩN Paper VII ("WARP: Optics,
Holograms, and Worldlines over Shared Causal History"), transport precedes
judgment and a braid is not a merge: Jim holds an observed claim, judges B, L,
and H under its own Edict-authored law, and applies only a witnessed forward
commit. The adapter authors an honest local observation of bytes; it cannot
turn a snapshot into an external editor's witnessed causal history.

1. **Watchers are hints.** Every decision uses a validated observation: the
   file read with a stable result. A read whose result changes during the read
   decides nothing. An unobserved file is `Unknown`.
2. **Hold changes neither the canonical head nor the logical text.** It admits
   the observation as evidence through Continuum import (echo#928); evidence
   and status may change.
3. **Occurrence identity is the adapter's, and honest.** Re-delivering one
   observation returns the retained outcome; distinct observations stay
   distinct; identical bytes from two observations are two pieces of evidence,
   not two distinct external writes, unless the adapter can tell writes apart.
4. **Adoption is a separate admitted forward transition** that creates a head
   anchored to the new `Import` and sets the accepted host basis. Automatic
   adoption is allowed only under a declared policy, and is still witnessed.
5. **Observation ordering and applicability.** This concerns the order of
   Jim's own observations, not external writers' histories:
   - An observation names its file binding and the receiving basis it was
     captured against (the accepted host basis and its generation).
   - Where the adapter can establish the order of its observations, it records
     that order as epoch, sequence, or causal evidence.
   - Historical observations may still enter history as evidence.
   - An observation older than, or unordered with, the current host view
     cannot automatically replace the current host view, the canonical head, or
     a conflict judgment.
   - Adoption and settlement revalidate the receiving basis and the
     observation's applicability at admission. If applicability cannot be
     established, Jim obtains a fresh observation instead.

### Path classification

The adapter classifies observable mechanics first, then a declared policy
decides:

| Observed mechanics | v1 policy |
| --- | --- |
| same object, changed contents | modification |
| path names another ordinary file | modification of the path under the replacement policy; never claimed to continue the prior writer's history |
| path absent | deletion; a divergence-style decision, no implicit save recreates it |
| non-ordinary object (symlink, directory, special file) | refused |
| permissions forbid reading or writing | obstruction naming the permission |
| identity or observation stability unresolved | no decision; observe again |

Atomic-save replacement can give the path a different object identity, and a
final observation cannot tell an editor's atomic save from `git checkout`. The
policy supports ordinary-file replacement without claiming more.

### Divergence

The barrier follows the disputed dependency, not the buffer's origin:

| Operation during divergence | Treatment |
| --- | --- |
| Read or navigate current text | allowed |
| Edit current text on an admissible basis | allowed |
| Hold another host observation | allowed |
| Preserve material or perform an explicit settlement | allowed under its own preconditions |
| Ordinary export assuming host agreement | obstructed |
| Other work requiring an established host basis | obstructed while that dependency is unsatisfied |

Settlements, each an admitted forward operation:

- **Reload:** adopt H. L stays recoverable only if its material was retained
  before the Reload; that retention is acquired first, or Reload refuses.
- **Keep local:** keep editing L; export stays obstructed by the divergence.
- **Overwrite:** an explicit export whose `expectedAcceptedBasis` is B,
  whose `expectedHostContents` is the observed H, and whose
  `overwriteAuthority` is bound to H's observation, recorded as overwriting a
  known third-party change. H is never accepted just to satisfy the
  applicability check. A confirmed Overwrite of S advances the accepted host
  basis from B to S.
- **Reconcile:** build M from B, L, and H and submit it as a forward edit; the
  accepted host basis becomes H. The base may be an observed host version that
  was never a Jim head.

### Retained material

A recorded digest is not retained bytes. Each promise names its material and
acquires it before the operation that needs it (#378, echo#896):

| Material | Needed by | Acquired |
| --- | --- | --- |
| held host version H | Adopt, Reconcile, Overwrite comparison | at Hold |
| accepted base B | Reconcile | when it becomes the accepted host basis |
| displaced local version L | Reload's recoverability promise | before Reload applies |
| frozen bytes of a pending export | write, retry, recovery | at export intent |

Missing material is a precise `MaterialUnavailable` obstruction, never a
corrupt-rope classification. Without B's bytes, Reconcile refuses with
`MergeBaseUnavailable` and the other settlements still work.

Generic capabilities the file-crossing gate needs:

| Need | Owner |
| --- | --- |
| Continuum import dispatch for observations | echo#928 |
| Separate braid construction, judgement, and admission | echo#898 |
| Retention guarantees | echo#896, #378 |
| Exclusive export profile | #377 |

## Lower Modes

Not applicable: this is a storage and crossing representation, not a user
surface.

## Accessibility Posture

Not applicable.

## Localization / Directionality Posture

Text is stored as UTF-8 bytes without normalization. Line breaks count `\n`
only, as in schema 1.

## Agent Inspectability / Explainability Posture

Every relation in the current rope is a typed edge reachable from the
worldline root, so an agent traverses it without decoding application payloads.
Every claim about the file names its evidence class: observation, attempt,
exclusion, or durability.

## Linked Invariants

- Echo two-plane law: structure in the skeleton, not in payload bytes.
- Echo `ContentAddressV1`: one identity law for every authored content node.
- History Over State ch. 21 and 42: a rope head is the workspace coordinate,
  an anchored refinement of it, or the source of a witnessed crossing.
- DL-0158: codec or edge migration is a separately admitted operation.
- AIΩN Paper VII, as an architectural foundation, not as evidence that
  anything here is implemented: §3.3 (commitment, folding, and revelation are
  separate), §4.2 and §4.3 (braid plurality, transport before import), §6.2
  (the authored hot-text optic's `ropeRangeClosure` slice and single head
  retarget), §8 (app-authored optics and export semantics as open seams).

## Design Alternatives Considered

- **Child ids inside atoms (schema 1 shape).** Rejected: children fall outside
  the state root, and the shape breaks Echo's two-plane law.
- **Edges plus duplicated child ids in atoms.** Rejected: two sources of truth
  for one relation.
- **Keep JSON atoms.** Rejected: forces Edict source to parse JSON and admits
  several spellings.
- **Keep Blob slices.** Rejected: an indirection and a slice read per leaf;
  content-addressed leaves already deduplicate.
- **An application-specific id recipe.** Rejected: Echo recomputes ids under
  `ContentAddressV1` and refuses any other; two recipes would disagree.
- **Link each head to its basis head.** Rejected: every version would stay
  reachable, and it duplicates the history Echo's ticks already own.
- **Use `lastExport` as the synchronization basis.** Rejected: adoption and
  observed agreement change the basis without any export, so a later save would
  rediscover an already-accepted change as divergence.
- **Infer a write from the current digest.** Rejected: equal final bytes cannot
  establish which operation happened.
- **Store UTF-16 metrics now.** Deferred: derived readings first, measured.

## Decision

Approve schema 2's direction with the corrections above. Freeze the schema
only when the representation gate passes; accept the file crossing only when
its own gate passes.

## Implementation Slices

Representation gate:

1. Publish `jedit.text.schema@2` (machine-readable) with codec vectors and
   `ContentAddressV1` identity vectors, including empty and non-empty heads.
2. A deliberately simple Edict reference `ReplaceRange` (semantic target).
3. The persistent rope (persistence target), with effect normalization and
   the three failure classes.
4. The resource-envelope measurement fixture and its recorded v1 values.
5. The schema 2 oracle: reference and persistent rope agree on text semantics
   within their shared supported domain; each implementation's resource
   behavior is validated against its own declared profile, so a disagreement
   between resource limits is never reported as an editing disagreement.
   Representation invariants and admission/effect behavior are validated
   separately. Stored-buffer size and the complete encoded invocation size are
   separate limits.
6. Cutover, then deletion of the native schema 1 law.

File-crossing gate:

7. Observation evidence and the accepted host basis.
8. The best-effort export lifecycle with fencing, recovery classification, and
   retained material.
9. Divergence settlements.

## Tests To Write First

Representation gate:

| Fixture | Required result |
| --- | --- |
| Codec vectors for every fact type | canonical bytes; non-canonical encodings rejected |
| Empty and non-empty Head identity vectors | authored source and bridge compute identical ids from the actual stored fact and edges |
| Identity | equal subtrees have equal ids within one warp; any atom or child change changes the id |
| Two equal-content leaves | the proposal has no duplicate targets; both text positions still exist |
| `aa` as one shared leaf, edit the second `a` | the edit addresses the second position |
| Exhaust a closure or effect budget, or fail the final effect | correctly classified outcome; no partial application |
| Traverse from the actual worldline root with two buffers attached | both reachable and committed; editing one leaves the other attached; no historical-head chain |
| Replacements of 4,097, 8,193, and 8,194 bytes | leaf and branch counts match the constructor, not `ceil(n / 4096)` |
| Restart after edits | recovered state equals the pre-restart state |

File-crossing gate:

| Fixture | Required result |
| --- | --- |
| Read B → external write X → Jim writes L → read L | no claim that interference was detected or prevented |
| Crash with final bytes equal to the intended or the prior bytes | recovery preserves uncertainty about the original write |
| Adopt an external version after an earlier export | the next save uses the newly accepted basis |
| B ≠ H; authorize Overwrite against H; export S | the accepted basis advances to S; the next ordinary save does not rediscover the settled divergence |
| Two observations captured against the same B, delivered in reverse order | the older one cannot be adopted over the newer; adoption revalidates applicability or asks for a fresh observation |
| H = L ≠ B | agreement accepted; no Export fabricated |
| Reconcile to M, then save | the accepted basis is H; the same divergence is not rediscovered |
| An older export outcome arrives after a newer one | evidence retained; current basis not regressed |
| An earlier effector resumes late | fencing prevents stale publication |
| Edit while an earlier head is being saved | the newer canonical head is preserved |
| Release or fail to acquire required material | a precise availability obstruction |
| Each path classification | the declared policy, never an invented history |

## Acceptance Criteria

- Representation gate: slices 1–6 green, with identity vectors matched by both
  implementations and the envelope recorded with its cost model.
- File-crossing gate: slices 7–9 green, with every claim recorded at the
  strength its evidence supports.
- Every needed generic capability has an owner issue (listed above and in the
  draft README), or the first witness stops needing it. This stays a gate
  criterion until the mapping is complete.

## Validation Plan

Codec and identity vectors in this repository; reachability, atomicity,
receipts, WAL, and restart through the Echo bridge (echo#921) once it exists.
The file-crossing gate validates against a deterministic hostile-schedule
adapter (#380).

## Playback / Witness

None yet.

## Risks

- **State-root cost.** Echo recomputes the root by walking the reachable graph
  on every commit, so an edit costs in proportion to the current rope. An
  incremental root is Echo's open decision (echo#845).
- **Unreclaimed nodes.** Superseded nodes stay keyed-readable; reclaiming them
  is Echo's retention policy.
- **Envelope.** Under the current batch cap the supported replacement size may
  be small; the measurement decides it, and #382 covers larger edits.

## Follow-On Debt

- Open: Rewrite and Diff facts in schema 2.
- Open: the UTF-16 derived reading and its cache.
- Ideas: settlement offers that carry their prerequisites (#379), inspectable
  edit costs (#381).

## Retrospective

The recovered boundary-helper slice has a public compiler/runtime conformance
witness and authenticated transitive module pins. Its historical evidence is
kept at exact identities; the compiler-inventory handoff now rejects missing or
conflicting checkout provenance. Independent review found that handoff bug and
prompted clearer evidence scope. This is a completed helper slice only: neither
the representation gate nor the file-crossing gate has passed, and the full
cycle remains open under #296.
