---
title: inverse-fragment-digest-undo-proof
lane: cool-ideas
owner: jedit runtime / echo
priority: medium
keywords:
  - undo
  - inverse-history
  - RopeDiff
  - inverseFragmentDigest
  - causal
acceptance_criteria:
  - The idea documents how inverseFragmentDigest already encodes the information needed for tick-level undo.
  - A plausible implementation path is sketched without requiring changes to the SDL.
---

# inverse-fragment-digest-undo-proof

The `RopeDiff` type in `contracts/jedit/rope.graphql` already has this field:

```graphql
type RopeDiff {
    inverseFragmentDigest: String
    # ...
}
```

This is the SHA-256 hash of the bytes that were deleted by a `replaceRangeAsTick`
operation. It exists specifically to support undo-as-inverse-history.

## What this means

Undo-as-inverse-history doesn't require storing the deleted bytes everywhere —
it only requires being able to *look up* the deleted bytes by digest when an
undo is requested. The full undo proof for any tick is:

1. Find the `RopeDiff` for `tickId N`.
2. Retrieve the deleted fragment by `inverseFragmentDigest` (from a blob store
   or the in-memory roots array).
3. Apply a new `replaceRangeAsTick` with `startByte = ropeDiff.startByte`,
   `endByte = ropeDiff.startByte + ropeDiff.insertedByteLength`,
   `insertText = deletedFragmentText`.

This is already structurally encoded in the schema. The implementation is one
step away from being provable.

## Why this is interesting

- The schema is already telling you the answer to "how do you undo?" — the
  field exists, the semantics are specified, the causal chain is there.
- Undo becomes a first-class causal *operation* rather than a snapshot pop.
  The undo itself gets a tick, a receipt, and a `RopeDiff` — meaning undo is
  auditable, replayable, and can itself be undone (redo).
- The current snapshot-based undo (`undoStack: HistoryEntry[]`) can coexist
  while this is built — the snapshots keep the UX working, the tick-based path
  proves the substrate is ready.

## The open question

Echo needs to be able to retrieve a blob by digest (for the deleted fragment
content). Once durable blob retention is wired, this path is open. The
`missing_retention` posture marker is the exact gap this would close.
