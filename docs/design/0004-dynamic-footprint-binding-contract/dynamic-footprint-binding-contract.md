---
title: "dynamic-footprint-binding-contract"
legend: "none"
cycle: "0004-dynamic-footprint-binding-contract"
source_backlog: "docs/method/backlog/asap/dynamic-footprint-binding-contract.md"
---

# dynamic-footprint-binding-contract

Source backlog item: `docs/method/backlog/asap/dynamic-footprint-binding-contract.md`
Legend: none

## Sponsors

- Human: Backlog operator
- Agent: Implementation agent

These labels are abstract roles. In this design, `user` means the served
perspective, like in a user story, not a literal named person or specific
agent instance.

## Hill

Turn the `jedit` hot-graph model into the first explicit contract for dynamic,
honest rewrite footprints. At the end of this cycle, `jedit` should have a
design packet that makes five claims concrete:

1. rewrite footprints are static at the level of slots, bindings, derivation
   grammar, and capability surface
2. rewrite bindings are dynamic at the level of concrete worldline/head/range
   values and runtime graph state
3. `ReplaceRangeAsTick` can bind a dynamic rope/anchor focus without gaining
   arbitrary graph reach
4. `CreateCheckpoint` can stay narrow without borrowing the `ReplaceRange`
   shape by accident
5. compile-time honesty failures and runtime binding failures are distinct and
   both necessary

This cycle is complete when those claims are explicit in repo truth, grounded
in `jedit`'s real hot-text nouns, and illustrated with concrete rewrite
examples rather than generic placeholder entities.

## Playback Questions

### Human

- [ ] The packet clearly states that footprint schema is static while concrete
  bindings are dynamic.
- [ ] The packet uses `jedit`'s real nouns and rewrite families rather than
  abstract `Foo`/`Bar` stand-ins.
- [ ] The packet includes at least one detailed `ReplaceRangeAsTick` example.
- [ ] The packet distinguishes compile-time and runtime failure classes.
- [ ] The packet stays focused on footprint law rather than drifting into full
  runtime implementation.

### Agent

- [ ] The packet names the minimum vocabulary needed for honest dynamic
  rewrites: slots, binding sources, closures, create/update surfaces, and
  forbidden surfaces.
- [ ] The packet shows how `ReplaceRangeAsTick` may dynamically derive its
  touched rope path while remaining statically bounded.
- [ ] The packet shows how `CreateCheckpoint` stays narrower than
  `ReplaceRangeAsTick`.
- [ ] The packet states what Wesley should prove at compile time and what Echo
  should enforce at runtime.
- [ ] The packet leaves the next executable seam obvious: Wesley directive
  grammar plus one proof-slice rewrite compilation.

## Accessibility and Assistive Reading

- Linear truth / reduced-complexity posture: this packet should remain readable
  as direct prose plus one proposed GraphQL footprint shape. It should avoid
  requiring a diagram to understand the law.
- Non-visual or alternate-reading expectations: all claims should be
  inspectable from markdown alone. No argument depends on visual rope diagrams
  or UI mockups.

## Localization and Directionality

- Locale / wording / formatting assumptions: the packet uses stable nouns such
  as `slot`, `binding`, `closure`, `ReplaceRangeAsTick`, and `Checkpoint`.
  It should avoid idioms that would make future localization harder.
- Logical direction / layout assumptions: the packet speaks in logical range,
  basis, and closure terms rather than left/right or screen-space metaphors.

## Agent Inspectability and Explainability

- What must be explicit and deterministic for agents: the rewrite capability
  boundary must be visible in repo docs so future generator/runtime work does
  not infer honesty rules from chat alone.
- What must be attributable, evidenced, or governed: the proposed footprint
  shape must be attributable to the existing hot-text graph model and text edit
  algebra rather than free-floating compiler folklore.

## One Sentence

`jedit` should treat a rewrite footprint as a statically declared slot-and-
closure grammar whose concrete worldline, head, rope, and anchor instances are
bound dynamically at runtime.

## Why This Exists

The current simplified proof slice is enough to prove one thing:

- Wesley can generate a bounded Rust capability surface from a declared
  footprint.

It is not enough for `jedit`, because `jedit`'s real hot-text rewrites are not
static object updates over pre-known nodes. `ReplaceRangeAsTick` needs:

- a runtime `worldlineId`
- a runtime `baseHeadId`
- a runtime byte range
- a dynamically discovered touched rope path
- optionally a dynamically discovered affected-anchor set

If the footprint model cannot express that honestly, it will either:

- become too weak and allow dishonest arbitrary traversal
- or become too rigid and fail to model the editor's real rewrite law

This packet defines the middle path.

The first authored GraphQL home for that contract now lives in
[../../../contracts/jedit/hot-text-runtime.graphql](../../../contracts/jedit/hot-text-runtime.graphql).

## Core Law

The core split is:

- **static footprint schema**
  what kinds of things the rewrite may bind, derive, create, update, or forbid
- **dynamic footprint binding**
  which concrete nodes or closures satisfy those bindings for a particular
  invocation

This means the compiler must prove:

- the implementation can only act through declared slots and declared closure
  operators
- the implementation cannot reach undeclared graph surfaces

And the runtime must prove:

- the supplied ids and arguments resolve lawfully
- the derived closures are valid for this invocation
- the resulting rewrite satisfies materialization and admission law

## Minimum Footprint Vocabulary

The current flat `reads` / `writes` lists are not enough for `jedit`.

The minimum honest vocabulary is:

### 1. Slots

Named logical bindings for specific graph nouns.

Examples:

- `worldline: BufferWorldline`
- `baseHead: RopeHead`
- `checkpoint: Checkpoint`

### 2. Binding sources

How a slot gets its concrete runtime binding.

Minimum binding modes:

- from explicit mutation args
- from the current canonical relation of an already-bound slot
- from a declared derivation over an already-bound slot
- from creation inside the rewrite

### 3. Closures

A declared derived focus over graph truth rather than a single fixed node.

For `jedit`, the important closures are things like:

- rope-range closure over a `RopeHead` plus `[startByte, endByte]`
- affected-anchor closure over a `BufferWorldline`, a `basisHead`, and a
  receipt transform window

The closure operator itself must be named in the footprint contract, not
invented ad hoc inside Rust.

### 4. Create surfaces

Which node kinds the rewrite may mint.

For example:

- `TextBlob`
- `RopeLeaf`
- `RopeBranch`
- `RopeHead`
- `Tick`
- `TickReceipt`
- `Checkpoint`

### 5. Update surfaces

Which bound slots may be updated and which logical fields/relations they may
change.

For example:

- `BufferWorldline.CANONICAL_HEAD`
- tick-chain membership

### 6. Forbidden surfaces

Which noun families are explicitly out of bounds even if they are available
elsewhere in the wider product stack.

For `jedit` hot rewrites, the important forbidden surfaces are:

- AST state
- diagnostics
- Git witness history
- UI state

## Compile-Time vs Runtime

This split is non-negotiable.

### Compile-time honesty failures

These should be static failures or unavailable methods:

- a `ReplaceRangeAsTick` implementation tries to read AST state
- a checkpoint rewrite tries to create a `Tick`
- a hot text rewrite tries to inspect Git witness history
- a rewrite tries to use a closure operator that was not declared

### Runtime binding failures

These are real invocation-time failures:

- `worldlineId` does not resolve
- `baseHeadId` does not belong to that worldline
- `[startByte, endByte]` is invalid for that head
- a declared closure resolves to no result or ambiguous results where the
  contract required exactly one
- the logical replacement is a no-op and therefore must not mint a tick

## Proposed GraphQL Footprint Shape

This is illustrative, not frozen syntax, but it is concrete enough to drive
Wesley and Echo work.

```graphql
directive @wes_footprint(
  slots: [WesFootprintSlot!]!
  closures: [WesFootprintClosure!]
  creates: [WesFootprintCreate!]
  updates: [WesFootprintUpdate!]
  forbids: [String!]
) on FIELD_DEFINITION

input WesFootprintSlot {
  slot: String!
  kind: String!
  bindFromArg: String
  bindFromSlot: String
  bindRelation: String
  access: [WesAccess!]!
  cardinality: WesCardinality = ONE
}

input WesFootprintClosure {
  slot: String!
  fromSlot: String!
  operator: String!
  argBindings: [String!]
  reads: [String!]!
  cardinality: WesCardinality = MANY
}

input WesFootprintCreate {
  slot: String!
  kind: String!
  cardinality: WesCardinality = ONE
}

input WesFootprintUpdate {
  slot: String!
  fields: [String!]!
}

enum WesAccess {
  READ
  WRITE
  DELETE
}

enum WesCardinality {
  ONE
  OPTIONAL
  MANY
}
```

The important point is not the exact spelling. The important point is that the
contract names:

- what gets bound directly
- what gets derived as a closure
- what may be created
- what may be updated

without pretending the compiler already knows the concrete node IDs.

## `ReplaceRangeAsTick`

This is the real center.

### Dynamic input

`ReplaceRangeAsTick` takes runtime values such as:

- `worldlineId`
- `baseHeadId`
- `startByte`
- `endByte`
- inserted fragment or text

### Static contract

The rewrite should still have a statically honest footprint like:

```graphql
type Mutation {
  replaceRangeAsTick(
    worldlineId: ID!
    baseHeadId: ID!
    startByte: Int!
    endByte: Int!
    insertText: String!
  ): ReplaceRangeAsTickResult!
    @wes_op(name: "replaceRangeAsTick")
    @wes_footprint(
      slots: [
        {
          slot: "worldline"
          kind: "BufferWorldline"
          bindFromArg: "worldlineId"
          access: [READ, WRITE]
        }
        {
          slot: "baseHead"
          kind: "RopeHead"
          bindFromArg: "baseHeadId"
          access: [READ]
        }
      ]
      closures: [
        {
          slot: "touchedRope"
          fromSlot: "baseHead"
          operator: "ropeRangeClosure"
          argBindings: ["startByte", "endByte"]
          reads: ["RopeBranch", "RopeLeaf", "TextBlob"]
          cardinality: MANY
        }
        {
          slot: "affectedAnchors"
          fromSlot: "worldline"
          operator: "anchorsIntersectingEditWindow"
          argBindings: ["baseHead", "startByte", "endByte"]
          reads: ["Anchor"]
          cardinality: MANY
        }
      ]
      creates: [
        { slot: "newBlob", kind: "TextBlob", cardinality: OPTIONAL }
        { slot: "newLeaves", kind: "RopeLeaf", cardinality: MANY }
        { slot: "newBranches", kind: "RopeBranch", cardinality: MANY }
        { slot: "nextHead", kind: "RopeHead" }
        { slot: "tick", kind: "Tick" }
        { slot: "receipt", kind: "TickReceipt" }
      ]
      updates: [
        { slot: "worldline", fields: ["canonicalHead"] }
      ]
      forbids: ["AstState", "Diagnostics", "GitWitness", "UiState"]
    )
}
```

### What this lets the compiler prove

Wesley can then generate a bounded capability surface such that the rewrite
implementation may only:

- inspect the bound `worldline`
- inspect the bound `baseHead`
- inspect the declared `touchedRope` closure
- inspect the declared `affectedAnchors` closure
- create the listed hot-text nouns
- update the allowed worldline relation

It cannot:

- ask for arbitrary graph traversal
- inspect AST state
- mutate diagnostics
- perform Git witness operations
- touch UI state

### What runtime still must do

Echo still needs to:

- bind `worldlineId`
- bind `baseHeadId`
- derive the rope-range closure
- derive the affected-anchor closure
- reject stale or invalid basis
- enforce no-op discipline
- enforce materialization law

That is correct. The runtime is supposed to own those instance-level truths.

## `CreateCheckpoint`

This second example matters because it proves the model is not just a range
editing trick.

The rewrite can stay much narrower:

```graphql
type Mutation {
  createCheckpoint(
    worldlineId: ID!
    kind: String!
    label: String
  ): Checkpoint!
    @wes_op(name: "createCheckpoint")
    @wes_footprint(
      slots: [
        {
          slot: "worldline"
          kind: "BufferWorldline"
          bindFromArg: "worldlineId"
          access: [READ]
        }
        {
          slot: "currentHead"
          kind: "RopeHead"
          bindFromSlot: "worldline"
          bindRelation: "CANONICAL_HEAD"
          access: [READ]
        }
      ]
      creates: [
        { slot: "checkpoint", kind: "Checkpoint" }
      ]
      updates: []
      forbids: ["RopeBranch", "RopeLeaf", "TextBlob", "Tick", "TickReceipt"]
    )
}
```

This means the generated Rust surface for checkpoint creation should not expose:

- rope-edit closures
- blob creation
- tick creation
- receipt creation

If the implementation tries to do any of those things, it should fail
statically.

## What This Means For `jedit`

The hot rewrite boundary can now be stated precisely:

- `ReplaceRangeAsTick` is allowed a dynamic rope-local and anchor-local focus
  over a statically declared hot-text closure
- `CreateCheckpoint` is not
- later rewrites such as `RegisterAnchor` and strand/braid admission can be
  added with the same slot/binding/closure model instead of inventing a new
  honesty system each time

This is exactly the missing bridge between:

- `jedit`'s hot graph model
- Wesley's compile-time honesty goal
- Echo's runtime binding and admission law

## Immediate executable seams

The next useful seams are now clearer:

1. define the first actual Wesley directive grammar for slot and closure
   footprints
2. compile one `ReplaceRangeAsTick` proof slice into a bounded Rust surface
3. prove that AST/diagnostic/Git/UI access is unavailable from that generated
   surface
4. bind the resulting surface in Echo against a real runtime focus closure

## Backlog Context

`jedit` already knows the hot graph nouns it needs. What it lacked was the
honest bridge between static footprint law and dynamic runtime binding.

This packet defines that bridge. It should now guide both:

- Wesley footprint grammar work
- Echo runtime focus-binding work

without weakening either side into vague capability theater.
