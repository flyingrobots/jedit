# Jedit Observer Spec

Status: design sketch

Purpose: define the first lawful app-owned observer shape for `jedit` without
pretending that a GraphQL query alone is the whole observer.

This note is the detailed companion to:

- [../../src/app/jedit-observer-spec.ts](../../src/app/jedit-observer-spec.ts)
- [../../contracts/jedit/hot-text-runtime.graphql](../../contracts/jedit/hot-text-runtime.graphql)
- [../jedit-echo-graph-model.md](../jedit-echo-graph-model.md)

## One Sentence

`jedit` should author observers in app code as lawful `ObserverSpec` objects
that Wesley can compile and Echo can host generically, beginning with a
memoryless canonical-head `worldlineSnapshot` observer.

## Why This Exists

The current integration posture is optic-shaped:

- app-authored mutations define the set side
- Echo admits generic substrate intents and returns deterministic result and
  receipt envelopes
- later readings come from observers over sliced holographic truth

That means the get side needs a real authoring surface of its own.

The important correction is:

- a GraphQL query shape is not automatically a full observer
- a full observer has static law and runtime state
- the app must author the static part legally without handing Echo arbitrary
  callbacks

## Observer Layers

This packet keeps three layers distinct.

### 1. ObserverSpec

App-authored, mostly static, and lawful.

For `jedit`, the first observer spec declares:

- canonical-worldline aperture
- `jedit` causal-text basis
- memoryless state shape
- replace-with-latest-slice update law
- snapshot-reading emission law
- author-visible rights with canonical-text-only revelation

### 2. ObserverInstance

Runtime object hosted by Echo.

Even the memoryless case is still a runtime object in principle. It may have a
trivial state, but it is still distinct from the authored spec.

### 3. Reading

Observer-relative emitted output for one frontier or hologram.

For the first `jedit` proving slice, that reading is the contract
`worldlineSnapshot` result.

## Current First Observer

The first `jedit` observer is intentionally narrow:

- name: `worldlineSnapshot`
- aperture: one canonical worldline slice
- basis nodes:
  - `BufferWorldline`
  - `RopeHead`
  - `Checkpoint`
- derived surface:
  - `text`
- history window:
  - canonical head only
- state mode:
  - memoryless

This is the degenerate observer case where `M` is trivial and the update law is
almost identity-like.

That is acceptable because it proves the authored/compiled/runtime split
without pretending `jedit` already needs the full observer zoo.

## Why Memoryless First

The first `worldlineSnapshot` observer is a safe proving target because it lets
us prove:

- app code can author an observer lawfully
- the observer is not the same object as the GraphQL query itself
- the observer spec can name aperture, basis, state, update, emit, budgets,
  and rights explicitly
- the emitted reading can still be the same generated contract family used by
  the rest of the app

Later `jedit` observers should become accumulative where it earns real value,
for example:

- retained cursor or anchor context
- retained edit-group awareness
- retained provenance or receipt windows
- conflict or settlement-aware editor lenses

## Current Rule

`jedit` must not define observers by handing Echo arbitrary host callbacks.

The app may define:

- lawful observer specs in app code
- app-owned reading families
- app-owned observer rights and exposure policy

But those must lower into compiler-produced and runtime-legal observer plans.

## Immediate Next Step

The next step after this note is not to widen `worldlineSnapshot`.

It is to:

1. let Wesley compile the first `ObserverSpec` into an `ObserverPlan`
2. let Echo host that plan through a generic Observer API
3. keep the resulting reading envelope distinct from the original mutation
   result and receipt envelope
