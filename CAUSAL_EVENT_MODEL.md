# Causal Event Model

Status: design sketch

Purpose: define which `eddit` interactions become causal truth, which are
maintenance-only, which belong in session traces, and which should not be
persisted at all.

This document complements [TEXT_EDIT_ALGEBRA.md](TEXT_EDIT_ALGEBRA.md). The
rope model defines what the editable object is. This document defines what
counts as a meaningful event in its history.

## One Sentence

`eddit` should capture every meaningful text mutation as a causal event, while
keeping maintenance work and ephemeral UI motion in separate ledgers so the
buffer worldline stays explainable instead of becoming surveillance sludge.

## Why This Matters

If the editor records too little, it falls back to:

- mutable buffer plus undo folklore
- brittle offsets
- fake versioning reconstructed from flat strings

If the editor records too much, it collapses into:

- provenance landfill
- unreadable receipts
- polluted history
- expensive replay
- a product that feels like a logger wearing an editor costume

The event model is therefore a product boundary, not just a storage choice.

## Event Ledgers

`eddit` should not have one giant undifferentiated event stream.

It should maintain separate ledgers for separate truths:

- `logical ledger`: authorially meaningful text and document mutations
- `maintenance ledger`: semantics-preserving rope and storage housekeeping
- `session ledger`: ephemeral interaction and observation flow
- `projection ledger`: optional cache/build invalidation facts

These ledgers can be correlated. They must not be conflated.

## Primary Event Classes

There are four event classes.

### 1. Logical Causal Events

These define the buffer worldline.

They are the history the editor should use for:

- undo and redo
- strand formation
- admission
- provenance inspection
- "why is this here?"
- author-facing replay

Examples:

- replace range
- grouped typing burst
- paste
- delete selection
- admit strand slice
- move block
- rename heading if implemented as a structural text transform
- explicit formatting transform if modeled as a real text rewrite

Rule:

logical events are the canonical text history.

### 2. Maintenance Events

These keep the piece-rope and substrate healthy without changing the logical
document.

Examples:

- split leaf
- merge leaves
- rebalance branch
- compact blob storage
- rebuild line index
- refresh parse cache
- recalculate subtree metrics

Rule:

maintenance events may be recorded for debugging, auditing, and performance
analysis, but they are not authorial history and must not appear as normal
receipts in the buffer worldline.

### 3. Session and Observer Events

These describe how a user or agent moved through the editor.

Examples:

- cursor moved
- selection changed
- viewport scrolled
- drawer opened or closed
- preview toggled
- file tree expanded
- search panel opened
- command palette invoked
- hover or inspection opened
- help modal opened
- agent requested a suggestion

Rule:

session events are useful for replay, ergonomics analysis, user debugging, and
agent coordination. They are not document truth.

### 4. Projection Events

These belong to derived surfaces.

Examples:

- Markdown AST rebuilt
- preview projection updated
- search index refreshed
- diagnostics rerun
- export generated
- file projection synced to disk

Rule:

projection events should never become the primary history of the document.
They exist to explain derivative artifacts and cache state.

## Non-Negotiable Boundary

Not every interaction becomes a causal event in the same sense.

The editor should preserve this strict distinction:

- text truth is not maintenance
- maintenance is not session motion
- session motion is not document provenance
- projections are not canonical state

That boundary is what keeps the system sharp.

## What Belongs In Logical Truth

A logical event should satisfy at least one of these:

- changes materialized document text
- changes canonical document structure as text sees it
- changes admission state between strands and canonical history
- changes the durable semantic position of anchors
- is something a human would reasonably ask to undo, replay, inspect, or cite

If it fails those tests, it probably does not belong in the logical ledger.

## Grouping Rules

Logical truth does not mean one top-level event per keystroke forever.

The editor should support undo grouping for:

- typing bursts
- paste operations
- structured edits
- agent proposal admission
- explicit commands

Grouping should preserve semantic clarity:

- "inserted this sentence" is good
- "typed 41 adjacent characters" is usually noise

The grouped receipt is the author-facing truth. Raw low-level edits may still
exist inside the group for debugging if needed.

## Suggested Logical Event Family

The first logical event family should stay small:

- `ReplaceRange`
- `ForkStrand`
- `AdmitStrandSlice`
- `SetCanonicalHead`
- `ApplyTransform`

Notes:

- `InsertText`, `DeleteRange`, and `ReplaceSelection` are all
  `ReplaceRange` sugar.
- `MoveBlock` should probably compile into one or more `ReplaceRange`s in v1.
- `SetCanonicalHead` matters when undo, redo, or explicit strand switching is
  modeled as head movement rather than fresh mutation.

## Suggested Maintenance Event Family

- `SplitLeaf`
- `MergeLeaf`
- `RebalanceRoot`
- `CompactBlobSet`
- `ReindexLines`
- `ReindexUtf16`
- `RefreshProjectionCache`

These events are real, but they are not what the author wrote.

## Suggested Session Event Family

- `MoveCursor`
- `SetSelection`
- `ScrollViewport`
- `TogglePreview`
- `OpenDrawer`
- `CloseDrawer`
- `RunCommand`
- `JumpToAnchor`
- `InspectReceipt`
- `OpenHelp`

Session events should be cheap to drop or sample.

## Persistence Policy

Default persistence should differ by class.

Logical ledger:

- always persisted
- content-addressed or hash-addressable
- part of replay and provenance truth

Maintenance ledger:

- persisted selectively
- useful for diagnostics, storage hygiene, and deterministic replay debugging
- not shown as authorial history

Session ledger:

- optional by default
- may be ephemeral, sampled, or bounded
- useful for local replay, user studies, or agent collaboration

Projection ledger:

- optional and disposable
- can usually be rebuilt from logical truth plus current caches

## Replay Modes

The event split enables multiple replay modes.

Authorial replay:

- replays logical events only
- answers "how did the document become this?"

Mechanical replay:

- replays logical plus maintenance events
- answers "how did the runtime realize this exact structure?"

Session replay:

- replays logical plus session events
- answers "how did the user or agent move through the editor while producing
  this?"

Full forensic replay:

- replays all ledgers together
- answers "what happened everywhere?"

Different questions deserve different replay surfaces.

## Features This Unlocks

This event discipline unlocks features that most editors either do badly or do
not unify at all.

- Strand-native drafting.
  Drafts become alternate futures, not temp files.
- Selective admission.
  Accept only the sentence, block, or slice you want from an agent or draft
  strand.
- Stable comments and diagnostics.
  Anchors survive through logical receipts instead of brittle string offsets.
- "Why is this here?" inspection.
  A sentence can expose the receipt or strand lineage that admitted it.
- Honest replay.
  Authorial history stays readable because maintenance and UI noise are kept
  out of it.
- Observer-relative revelation.
  A reviewer can see canonical text, an author can see braid plurality, and an
  agent can receive a bounded aperture.
- AI collaboration without patch soup.
  Suggestions are strands, and acceptance is admission.

None of these depend on recording every twitch. They depend on recording the
right events at the right level.

## Anti-Goals

The event model should explicitly avoid:

- treating every cursor move as canonical history
- exposing rope maintenance as authorial provenance
- letting caches become truth
- capturing so much session data that the product turns into surveillance
- forcing every future feature through one giant ledger

## Initial Implementation Rule

In the first implementation:

- persist logical events
- keep maintenance events separate
- keep session events local and optional
- treat projection events as disposable

That posture is enough to preserve causal sharpness without overbuilding.

## Immediate Follow-On

The next design step after this document is to formalize:

- `ReplaceRange` preconditions and postconditions
- receipt grouping rules
- anchor transform semantics
- strand admission semantics

Those four decisions determine whether the event model remains architecture or
degrades into very sophisticated suffering.
