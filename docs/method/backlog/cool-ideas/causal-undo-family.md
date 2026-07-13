---
title: causal-undo-family
lane: cool-ideas
owner: jedit product
priority: high-strategic
keywords:
  - jedit
  - undo
  - causal-history
  - proposal-strands
  - basis
  - anchors
  - agents
blocked_by:
  - plain stack undo cutover (u / ctrl+r as causal counter-edits)
  - Historical Basis Preview (goalpost 3)
  - Search Sets / proposal strand preview + :admit (goalpost 4)
  - why-is-this-character-here-debugger (g? attribution)
acceptance_criteria:
  - Every causal-undo variant lands as a forward counter-edit proposal strand that is previewed and admitted; no history deletion, ever.
  - Regional time-rewind restores a cursor-scoped range to its state at a named time/checkpoint via materialize + diff + replaceRange proposal.
  - Surgical revert attributes a line to its originating fact, synthesizes the inverse, and commutes it to head via anchor transforms; overlap surfaces as a typed obstruction offering cascade.
  - Cascade revert computes downstream dependency closure from basis-bound edit evidence (edits whose reading basis included the reverted region), optionally refined by Graft structural dependencies.
  - Principal-scoped cascade works: "revert everything this agent's edit caused downstream" produces one reviewable proposal strand.
---

# Causal undo — the signature loop pointed backwards

## The proposal

Undo as a family of causal operations, not a stack pop:

1. **Surgical revert** — cursor on a line: "undo the change that introduced
   this line." Attribution (`g?` machinery) -> inverse synthesis -> commute
   to head via `transformPointAnchor` -> proposal strand. Overlap with later
   edits = typed obstruction offering cascade or abort. Prior art: Berlage
   selective undo; Darcs/Pijul unrecord + patch commutation.

2. **Regional time-rewind** — "undo everything in this range since last
   Wednesday." Spatially-scoped `:earlier`. No commutation needed:
   materialize the historical window (Historical Basis Preview machinery),
   diff against current, propose the restoring replaceRange. Cheapest slice;
   ship first.

3. **Cascade revert** — "undo this and its downstream causality." Dependency
   closure over basis-bound edits: an edit whose reading basis/aperture
   included the reverted region is downstream by construction. Bounded
   observation apertures are what make this precise — narrow apertures =
   tight causal graphs. Optional lenses: range-overlap (coarse), basis
   (canonical), Graft structural (semantic).

## Doctrine

Every variant is authored counter-history (VISION "undo as authored
counter-history, not deletion"): explain -> preview -> admit -> recover,
pointed at history. Plain `u` stays dumb and instant; this family lives near
`:why` / `g?`, never on `u`.

## Agent-lane payoff

Principal-scoped cascade is the accountable-editing demo in one command:
"revert everything agent X's edit caused downstream," previewed as one
proposal strand, admitted by a human. Structurally unavailable to editors
without basis-bound reads.

## Open design question to pin early

Do `RopeDiff` facts retain replaced bytes (local inverse synthesis is cheap)
or ranges only (inversion must materialize adjacent states / checkpoints)?
Decides whether surgical revert is cheap or checkpoint-dependent.

## Blast radius containment (design laws)

The butterfly-effect failure mode is real and has exactly two causes to
reject by design:

1. **Dependency is non-commutation, never temporal order.** E2 depends on E1
   only if E1's inverse fails to commute past it (spatial overlap /
   anchor-transform failure). Treating "came after" as "depends on"
   degenerates cascade into global `:earlier`.
2. **Bases on edit intents must be minimal and honest** — the touched range
   plus explicit reads, not the viewport. Aperture tightness is the knob
   that decides scalpel vs bulldozer.

Containment UX:

- Preview shows concentric rings with counts before details: overlapping
  edits / basis-dependent / structurally related (Graft). User picks the cut.
- Hard radius budget: over N edits -> typed obstruction offering narrower
  range, shallower ring, or surgical mode.
- Surgical escape valve always offered: revert only the target, leave
  downstream standing, emit conflict markers where the inverse cannot
  commute (git-revert semantics).
- Classify pathological chains: whitespace/format edits are transparent to
  closure (commute aggressively through them); rename-shaped edits display
  as one group, not per-site entries.
- Huge radius is information, not failure: "212 edits stand on this line"
  is an answer only this substrate can compute. Acting on it stays behind
  preview -> admit.

## Slice ladder

1. `g?` attribution at coordinate (existing cool-idea, blocked on Echo
   session/event attribution).
2. Regional time-rewind via materialize + diff -> proposal -> `:admit`.
3. Surgical revert with anchor-transform commutation + obstructions.
4. Basis-closure cascade, then principal-scoped cascade.
