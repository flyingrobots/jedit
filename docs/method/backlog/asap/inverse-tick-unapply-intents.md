---
title: inverse-tick-unapply-intents
lane: asap
owner: jedit runtime
priority: high
keywords:
  - undo
  - inverse
  - tick
  - intent
  - causal
acceptance_criteria:
  - The contract has explicit `unapplyTick` and `unapplyTickSequence` planning shapes.
  - Undo appends an inverse tick rather than deleting or rewriting old history.
  - A test demonstrates `add h`, `add e`, `add l`, `add l`, `add o`, then unapplying one `l` to project `helo`.
  - The result includes a receipt that records which tick or tick sequence was inversed.
  - Stale, missing, or non-invertible target ticks return an obstruction rather than corrupting history.
---

# inverse-tick-unapply-intents

Model undo as Intent-admitted inverse history.

Context:

- In the Echo model, the file is its admitted changes at a coordinate.
- Undo should not erase a tick from history.
- The editor needs a direct way to say "admit the inverse of this tick" and
  later "admit the inverse of this sequence."

This task should add the contract and fake-runtime proof before connecting it
to keyboard undo.

## Non-Goals

- Designing the full human undo grouping UI.
- Guaranteeing that every future tick kind is invertible.
- Compressing history or introducing wormholes.

