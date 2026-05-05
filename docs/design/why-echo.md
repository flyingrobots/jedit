# Why Echo

Status: active design rationale

Purpose: explain why `jedit` should treat Echo as its native causal substrate
and why Git should become optional interop rather than core architecture.

## One Sentence

Echo fits `jedit` better than Git because Echo gives the editor native ticks,
strands, braids, checkpoints, and replay over live text truth, while Git gives
branches, merges, and commits over serialized artifacts.

## The Break

The design break is simple:

- Git is excellent social and ecosystem infrastructure.
- Echo is a better native reality model for editing.

An editor wants:

- live truth below commit granularity
- partial acceptance of suggestions and edits
- speculative alternatives without duplicate files
- replay over real editing history
- checkpoints that do not destroy hot history
- structural interpretation over unsaved in-memory truth

Git does not fail at these things because it is bad. Git simply was not shaped
for them as first-class runtime objects.

## Git's Shape

Git's core nouns are roughly:

- commit
- branch
- merge
- tree/blob

That is an excellent model for:

- durable history
- distributed collaboration
- public witness
- ecosystem interoperability

It is a weaker model for:

- per-edit hot truth
- editor-native replay
- partial admission of alternate futures
- causal editing below commit boundaries

## Echo's Shape

Echo's core nouns are a better fit for editing:

- tick
- receipt
- strand
- braid
- checkpoint
- admission

These map much more naturally onto editor reality:

- a text mutation can be admitted as a tick
- a suggestion or private draft can live as a strand
- comparison across alternatives becomes a braid problem
- save becomes a checkpoint, not a fake commit
- selective acceptance becomes admission, not "merge and pray"

This is the real reason Echo matters for `jedit`. It is not "better Git." It
is a better native causal model for editing.

## Why jedit made this obvious

`jedit` makes the mismatch hard to ignore because it wants all of these at
once:

- hot editing truth
- dirty-buffer structure
- source and preview as projections
- eventual AI suggestions and partial acceptance
- semantic comparison between nearby alternatives

The moment the editor needs those things, Git starts looking like an adapter
instead of a substrate.

## Architectural Consequence

For `jedit`, the clean stack is:

- Echo owns canonical text truth
- Graft interprets and projects that truth structurally
- the filesystem materializes a working projection
- Git exports or mirrors an ecosystem-compatible projection when needed

## Composition Posture

`jedit` should compose Echo and Graft directly.

That means:

- `jedit -> Echo` for canonical hot text truth
- `jedit -> Graft` for warm structural projections over that truth
- potentially `Graft -> Echo` internally when Graft benefits from Echo-native
  basis, head, or worldline concepts

But not:

- `jedit -> Graft -> Echo` as the only path to canonical editor truth

Why this matters:

- hot truth must not be subordinated to parser structure
- structural readings must not masquerade as the source of truth
- `jedit` should own the composition of substrate and interpreter directly

So the correct stance is:

- Echo is the substrate
- Graft is the interpreter
- `jedit` is the product that composes both

That means:

- Echo should remain the hot canonical layer
- Graft should remain the warm structural layer
- Git and `git-warp` should move to optional ecosystem projection and interop
  adapters

## Do we still need Git?

Not for the editor to be real.

Once `jedit` has:

- Echo-backed rope-worldlines
- durable checkpoints and replay
- strands and braids
- Graft-backed structural intelligence

then Git is no longer required for core editor truth.

Git is still valuable for:

- interoperability with existing repos
- GitHub/GitLab/PR-based collaboration
- CI and deployment pipelines
- exporting or mirroring `jedit` projections into the wider ecosystem

But those are ecosystem advantages, not substrate requirements.

## The resulting stance

The right product stance is:

- Echo is native truth
- Graft is native structural intelligence
- the filesystem is a working projection
- Git is optional ecosystem projection and public compatibility export

Or in the shortest form:

Echo > Git for editor truth because Echo has strands and braids, not just
branches.
