# Save Integration Boundary

Status: integration ADR. Records what Jim means by Save and which contract each
participant owns. It does not implement Save, change dependencies, or restate
the normative contracts it references.

Acceptance of this document is not production conformance. Sections below label
evidence that exists today, obligations proposed for the first implementation,
and fixtures that are not yet written or run.

## What Save Means

The buffer is not in TypeScript. It is an immutable graph rope in Echo's
worldline. Save is therefore not "write the buffer to disk". It is:

> Prove what the buffer contains at an exact basis, cause exactly those bytes
> to exist at an authorized destination, and record the correspondence without
> claiming more than the evidence supports.

BEARING states the governing prohibition: *do not call local file writes a save
when no Echo basis was exported*.

## The Command Names The Artifact; It Does Not Carry It

The buffer is already content-addressed. A save request therefore carries a
typed content identity and its length, not file bytes. This keeps request
encoding independent of file size.

That bounds the **request**, not the **work**. Reading, staging, verifying and
publishing still scale with the bytes involved, and the effect footprint covers
the destination namespace entry, authorized staging entries, and their
metadata. Budgets must be stated against the work, not against the request.

## Three Witnesses, Composed

Save is established by three separate witnesses. None establishes the whole,
and each arrow between them requires its own binding validation.

| Witness | Establishes |
| --- | --- |
| Source correspondence | The exact full-buffer serialization at basis `B`, under profile `S`, has typed content identity `K` and length `N`. |
| Reconstruction | This completed reconstruction authenticated and emitted the content named by that same `K`, with the expected length and proof scope, into the identified private stage. |
| Publication | This authorized attempt published that same validated stage to the named destination, with the evidence required by filesystem profile `P`. |

Two non-implications are load-bearing:

- Source correspondence does **not** guarantee a later reconstruction succeeds.
  It establishes what that reconstruction must match **if** it succeeds.
- Staging validation establishes the staged bytes are **eligible** for
  publication. It does **not** establish that publication occurred.

Only after validating those bindings and admitting the corresponding settlement
may Jim record a save correspondence.

### Source Correspondence Is Not Source Ownership

These are separate obligations and must not be conflated:

```text
T = Serialize(ReadExact(buffer, B), S)
K = KeepBlobId(T)
N = byteLength(T)

Correspondence evidence establishes that relationship.
Owning source retention keeps the required source available.
```

Owning the wrong bytes reliably is still owning the wrong bytes. The source
boundary must establish the relationship from the actual exact-basis
serialization, carry it through ingestion, and validate the returned
reconstruction coordinates against it. Packaging a valid basis, a valid content
identity and an owning handle together is insufficient.

This closes the dangerous substitution: a caller supplying a legitimate blob of
unrelated bytes alongside a legitimate but unrelated basis.

Keep's authenticated reconstruction contract deliberately grants no application
authority. Keep proves bytes satisfy their content identity; the Jim export
boundary proves those bytes represent this buffer at this basis. Neither proof
substitutes for the other.

**This document does not freeze a witness encoding.** It fixes the proposition,
the construction and validation responsibilities, the required bindings, and
the rejection cases. Concrete encoding belongs to the implementation decision
that owns it.

### Serialization Profile

One serialization policy is frozen for v1. Encoding, line endings, BOM handling
and final-newline behaviour are explicit. Full-file save binds the whole
buffer, never a previously observed byte range or viewport.

## Three Promises With Separate Owners

"Durable" names three different guarantees. Each requires its own witness.

| Promise | Established by |
| --- | --- |
| The completed destination publication is durable. | The destination adapter's publication and synchronization contract. |
| A pending save retains enough source to proceed after restart. | Durable source retention, or exact reconstruction from another retained authority. |
| The original proof can be revalidated later. | Retention of the view and supporting evidence named by that proof. |

A process-resident source can feed a destination publication that becomes
durable. Losing the in-memory source afterwards does not retroactively make the
destination volatile. Conversely, a durable source does not prove the
destination write succeeded.

## The v1 Profile

V1 uses an authenticated process-resident source bound to an exact buffer basis
and serialization profile. The runtime retains an owning reference to that
source — not merely a content identity — while the pending operation requires
it. Destination publication and its durability guarantees are specified
separately by the admitted filesystem profile.

V1 does not promise restart-resumable source availability or replayable
retained Keep evidence, and advertises neither.

### Common Law Admits Both Postures

A profile may specialize the law. It may not contradict it. If the common law
required every admitted operation to use a durable pinned view, a
process-resident profile would be a documented violation rather than a lawful
implementation.

The common law therefore states the invariant obligations shared by every
admitted profile — exact identity, no substitution, required proof scope,
explicit source-availability semantics, bounded execution, truthful outcome
classification — and admits distinct source and evidence postures explicitly.
A source posture does not implicitly decide destination durability; that is
bound separately.

### Artifact Identity Across Profile Changes

Adapter bindings live inside the digested lawpack manifest, so changing them
produces a new manifest digest. An import pinned to the old digest remains a
valid reference to the old artifact; it simply does not accept the new one.
Adopting a new adapter-bearing manifest requires an explicit dependency update.

The operational obligations are therefore: retain exact old artifacts for
supported replay, and never redirect an old digest to a new manifest.

The defensible compatibility statement is *the common semantic contract can
remain stable; adapter and profile changes receive new exact identities, and
existing requests retain their original bindings* — not "the adapter changes
and the law does not".

## Concurrency Non-Claim

Check-then-rename detects a stale destination at check time. It does not
prevent an intervening write. Echo already states this limit for its validated
workspace patch adapter, and Jim inherits it rather than improving on it:

> The adapter refuses a basis already observed stale. It does not provide
> serializability against an external writer racing the final check and rename.
> `beforeContentDigest` records the earlier observation; it does not prove that
> no intermediate write occurred.

V1 therefore declares: atomic replacement, refusal when the destination is
observed stale, serialization of Jim-owned writes to the same destination, and
an **explicit non-claim** of lost-update prevention against uncooperative
external writers. A stronger "replace only the exact version observed" profile
is refused until a backend or authority regime supports that condition.

First-save creation against an `Absent` expectation uses a no-replacement
publication primitive, not "check absent, then ordinary rename".

Refusal wording must be precise: *this attempt did not publish over the
destination*. Not "nothing was written anywhere", since staging may already
have occurred. Not "the destination did not change", since another writer may
have changed it.

## Source Basis And Destination Precondition Are Different Coordinates

```text
sourceBasis:          which exact buffer version is being exported
expectedDestination:  which filesystem state may be replaced
```

Editing the buffer after a save starts does not invalidate the captured source
basis. An external process modifying the destination may invalidate the
replacement precondition. They use different types and different names.

The destination carries a capability-root identity, a relative path, and an
expected state of either `Absent` or `ObservedFile(fingerprint, evidence)`.
Path handling is capability-rooted and component-wise, with an explicit
symlink and special-file policy and a derived staging namespace.

## Outcome Vocabularies Stay Separate

Keep's reconstruction contract distinguishes authenticated success, evidenced
content refusal, and operational failure, where operational failure supports no
content conclusion.

The external-action protocol has `Succeeded`, `Rejected`, `Failed`,
`OutcomeUnknown`.

These are different layers. Keep reconstruction succeeding does not imply
destination publication succeeded, and the fourth outcome belongs to the
external-effect protocol. It is not retrofitted into Keep's reconstruction
result because a consumer eventually writes a file.

Source availability and effect knowledge are also different facts.
`SourceUnavailable` must never overwrite `OutcomeUnknown`: one describes access
to input, the other describes knowledge of an effect.

| Recovery evidence | Permitted conclusion |
| --- | --- |
| Durable state establishes publication could not have begun; source now unavailable | Definite inability to execute from this source. No content conclusion, no publication claim. |
| An attempt may have reached publication; source now unavailable | Source unavailable **and** publication outcome uncertain. |
| A terminal settlement was already durably admitted | Recover that settlement. Source loss does not invalidate it. |
| A reconciler observes a postcondition | Admit only what that observation establishes under the selected reconciliation profile. |

Recovery never blindly repeats the write. A previous attempt may have published
successfully and been followed by an external edit; replaying it would destroy
newer work. Echo's validated workspace patch reconciler is the template: it
observes rather than writes, and settled replay returns retained evidence.

Direct publication established is not the same proposition as desired
postcondition observed during reconciliation. The latter does not prove this
attempt caused those bytes to appear.

## What Jim Replaces

The current TypeScript path calls `exportSnapshot`, normalizes lines, writes via
`saveEditorFile`, fingerprints the locally reconstructed text, and returns
`Exported`. Under this boundary it becomes a **consumer of an admitted result**:

```text
request export/materialization
  -> receive admitted settlement
  -> validate correspondence to this pending save
  -> update durability projection
```

No second filesystem write. No post-identity normalization. No locally computed
intended-text fingerprint standing in for publication evidence.
`materializationPreflightIssue` may remain for early feedback but is not the
authoritative guard once execution happens elsewhere.

`workspaceBufferDurabilityWithExport` consumes verified settlement-derived
evidence, or sits behind a boundary guaranteeing it. Three supplied strings
must not be sufficient to mint "saved".

If a save captures `B1` and editing advances to `B2`, successful publication of
`B1` must not mark `B2` exported, and a later completion from an older save
must not replace a newer correspondence.

## Causal Boundary

The filesystem effect is not an Echo causal rewrite. Echo's external-action
transaction context is documented as non-causal metadata, with LSN and
predecessor coordinates intentionally absent.

What is causal is the checkpoint declaration: at basis `B`, a save was declared.
Record the declaration when it is admitted, referring back to the exported
basis; do not backdate it into that basis. A crash between settlement and
checkpoint requires only idempotent checkpoint completion, never another
filesystem write.

A Jim checkpoint declaration and an Echo causal anchor remain separate
propositions.

## Ownership And Dependency Boundary

| Contract | Owner |
| --- | --- |
| What Save means; integration requirements | Jim / Jedit (this document) |
| Content identity, authenticated reconstruction, refusal classification | Keep |
| Admission, adapter, settlement, reconciliation | Echo |

Cross-reference those contracts; do not duplicate their normative prose.

**Dependency pin.** V1 targets the Keep surface at commit
`0088d1ed8684a28e5ab2b10300270da637dacc45` (`origin/main`), which carries
`src/reference/reconstruction.rs` and `tests/streaming_cas_memory.rs`. This
document changes no manifests or lockfiles.

**Integration sequencing** is owned by Echo #722 (*Implement the Echo–Keep
physical-content boundary*). V1 depends on a narrow slice of it, not its
completion; backfill, global backend cutover and any `echo-cas` replacement are
broader milestones and are not prerequisites for a first save.

**Durable-source upgrade** additionally requires the capabilities described by
`KEEP-RECONSTRUCT-009` (pinned immutable view protected through read
completion) and `KEEP-RECONSTRUCT-010` (durable reconstruction without hidden
whole-blob allocation), together with appropriate refusal evidence under
`KEEP-RECONSTRUCT-006`, pending-operation retention, and active-read
protection. Keep-side production prerequisites include Keep #19 (retention
namespace generation transitions) and Keep #20 (precise verification reports
and corruption refusal).

Keep #22 and #23 are **historical pointers**, closed 2026-08-15 as superseded;
their closure means ownership moved, not that the work is complete.

**Issue completion is not itself capability evidence.** Restart-resumable
source availability, active-read protection, and replayable proof each require
their own implemented protocol and conformance witnesses. No stronger profile
is advertised before its implementation and conformance evidence exist.

A pinned reader also does not cover the whole pending-request lifetime. The
pending/restart interval needs durable retention or another reconstructible
source authority; active reconstruction needs an admitted immutable view held
through read completion. One guard does not replace the other.

## Evidence Status

**Exists today (inspected, not executed as part of this document):**

- Keep `ReferenceStore::reconstruct(target, output: &mut W)` emits into a
  caller-owned writer rather than returning bytes; a dedicated allocation test
  exists at `tests/streaming_cas_memory.rs`.
- Keep `BlobId` is a typed identity carrying a 32-byte digest and a logical
  length. It is not an unqualified hex digest string.
- Echo's external-action lifecycle: durable request recording, claim, attempt,
  settlement, and the four settlement kinds.
- Echo's validated workspace patch adapter and its observing reconciler.
- Jim-side durability projection, `export` as an admitted checkpoint reason,
  and obstruction plumbing.

**Proposed obligations of the first implementation:** source correspondence
evidence and its validation, the request-only intent, the Echo-owned
materialization adapter, and replacement of the TypeScript write path.

**Not yet written or run:** every fixture in the acceptance matrix below.

## Acceptance Matrix

Wrong-binding cases first; these are where separately correct components fail
to compose.

| Case | Required result |
| --- | --- |
| Correct blob, wrong basis | Rejected before destination publication |
| Correct basis, wrong serialization profile | Rejected before destination publication |
| Correct reconstruction receipt, wrong stage | Rejected before destination publication |
| Correct stage, wrong request or destination | Rejected before destination publication |

Operational counterexamples:

| Case | Required result |
| --- | --- |
| Byte-sensitive input, including newline and EOF cases | Exactly the declared serialization; no hidden transformation |
| Source owner survives buffer closure while a save is queued | Save completes or refuses on its own terms |
| Reconstruction succeeds but publication fails | No false success; precise evidence posture |
| Source disappears after publication may have occurred | Source unavailable **and** outcome uncertain |
| Destination changed before execution | Stale refusal retaining both expected and observed evidence |
| Another writer races final publication | Behaviour matches the declared concurrency profile |
| Crash around publication, directory sync, settlement, checkpoint | Honest recovery; no blind rewrite |
| Settlement commits but checkpoint declaration does not | Idempotent checkpoint completion; no second write |
| Duplicate delivery or lost settlement acknowledgement | Original settlement recovered; no duplicate effect |
| Older save completes after newer editing | No late-save rollback or false clean state |
| Old request meets a newly installed lawpack | Recovered under original bindings, or reported unavailable |
| File larger than the historical 64 KiB fixture budget | Success from actual streaming and bounded-resource evidence, not a small request encoding |

## Non-Goals

- A general Edict interpreter. A request-only profile compiles to zero callable
  steps, so the materialization leg does not need one. The complete workflow
  additionally requires a lawful basis-bound source export, which is not a
  reason to implement rope semantics inside `warp-core`.
- A multi-file or cross-system transaction. Save has multiple durable
  boundaries, not one transaction.
- A storage migration, backend cutover, or universal durability framework.
- A fourth repository. The lawpack belongs with the vocabulary owner, the
  intent with the application, the adapter with the effect boundary.
