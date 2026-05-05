# Causal Runtime Strata

`runtime-temperatures.md` is kept as the stable link target, but the old
hot / warm / cold model is no longer the active doctrine.

The current doctrine is:

> There is no privileged materialized graph. There is witnessed causal history,
> and graph-like structure is an observer-relative reading over that history.

The rationale for choosing Echo as native truth is written down in
[why-echo.md](why-echo.md). The Optic-shaped file model is written down in
[0006-optic-backed-file-model](0006-optic-backed-file-model/optic-backed-file-model.md).

## Core Law

- Witnessed causal history is primary.
- Ticks, receipts, checkpoints, strands, braids, admissions, frontiers, payload
  hashes, and boundary artifacts are the durable reality model.
- A "graph" is a lawful reading emitted by an observer or Optic.
- There is no substrate-owned god's-eye graph object.
- Files, ASTs, diagnostics, Git commits, and editor panes are projections over
  causal history, not authorities.

The old temperature language was useful while separating latency and ownership
concerns. It became misleading once it made Git sound like a peer truth layer
or made Echo sound like it stores one canonical materialized graph.

## The Strata

### 1. Causal History

This is the canonical layer.

It owns:

- admitted transitions
- lane and worldline identities
- frontiers
- payload hashes
- receipts
- checkpoints
- strand and braid admissions
- witness for obstruction, rejection, preservation, or loss

Echo is the intended durable substrate for this stratum.

### 2. Boundary Artifacts And Suffixes

Runtimes exchange witnessed suffixes, not state snapshots.

This stratum includes:

- encoded Intents
- receipts and reading envelopes
- content-addressed payloads
- checkpoint artifacts
- replay and retention records
- import/export envelopes

The important rule is that these artifacts witness claims about history. They
do not become a second source of document truth.

### 3. Observers And Optics

An observer is not just a query.

It has:

- aperture
- basis
- state
- update law
- emission law

An Optic is the focused read/write version of that idea. It observes a bounded
projection and writes only by submitting Intents.

### 4. Holographic Readings

Graph-like shape appears here.

Examples:

- text windows
- worldline snapshots
- syntax spans
- diagnostics
- search results
- diff views
- proposal previews
- pane contents

These are real as readings. They are not primary as ontology.

### 5. Materialized Projections

Materialization is allowed when it is useful.

Examples:

- editor viewport cache
- filesystem working tree
- Graft parse cache
- rendered Markdown
- exported Git commit
- CI snapshot

Materialized projections must carry enough basis to avoid pretending they are
canonical truth.

## Product Stack

The clean stack for `jedit` is:

- Echo owns canonical durable causal history.
- Graft emits structural readings over that history.
- The filesystem is a working projection.
- Git is an ecosystem projection and compatibility export.
- `jedit` composes these surfaces into a calm editor product.

This is stronger than saying Git is a cold witness. Git is useful, portable,
and socially legible, but it is not the long-horizon truth once Echo is real.

## Ownership Split

- `jedit`
  Owns product behavior, modes, buffers, panes, panels, lenses, save/open
  flows, edit-group and undo policy over causal events, and rendering policy.
- Echo
  Owns durable causal history, admission, frontiers, receipts, checkpoints,
  strand/braid semantics, retention, and replay.
- Graft
  Owns structural interpretation as lawful readings over causal text history.
- Filesystem
  Owns ordinary working projections and host interoperability.
- Git / `git-warp`
  Owns optional import, export, mirroring, public hosting, CI, and ecosystem
  compatibility.

`jedit` should compose Echo and Graft directly. Graft may become Echo-aware
internally, but it should not become the only path from `jedit` to canonical
causal truth.

## Retention Horizons

Not every causal artifact should stay hot forever.

- tick receipts
  finest-grained witnesses, useful for active-session replay and short-horizon
  explanation, compactable
- ticks and admitted transitions
  canonical causal history
- edit groups
  human-meaningful groupings over admitted transitions
- checkpoints and admissions
  durable continuity points
- retained suffixes and wormholes
  acceleration or compression artifacts that preserve witness rather than
  deleting history
- ecosystem exports
  Git commits, filesystem snapshots, CI artifacts, or public archive formats

The cold long-horizon layer is Echo persistence and retained causal witness.
Git is one possible export of that layer.

## Design Consequences

- Save is a checkpoint and projection event, not a reset.
- The AST is a reading over causal text history.
- The filesystem is a working projection.
- Git commits export or mirror a projection; they do not define what happened.
- Synchronization means exchanging witnessed suffixes, not copying a universal
  graph state.
- Unsupported or malformed buffers still have lawful causal history even when
  structural readings are partial or absent.
- Observer and Optic readings must carry basis, frontier, budget, and rights
  posture.

## Non-Goals

- Treating Graft's parsed snapshots as canonical editor truth.
- Treating Git commit cadence as live editor cadence.
- Treating filesystem writes as the document's reality history.
- Pretending there is one universal graph object inside Echo.
- Keeping every primitive receipt hot forever by default.
