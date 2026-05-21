---
title: graphql-authored-observer-plan-lowering
lane: asap
owner: jedit runtime
priority: high
keywords:
  - observer
  - graphql
  - wesley
  - worldlineSnapshot
  - optic
---

# graphql-authored-observer-plan-lowering

Define the jedit-owned observer authoring and lowering path for the get side of
the hot text runtime boundary.

Context:

- GraphQL authors the set side for jedit contract operations.
- jedit also needs a lawful get-side path for app-authored observer specs,
  compiled observer plans, observer-state codecs, and reading codecs.
- Wesley should provide generic compiler support, but jedit owns the first
  product observer proof.

## Hill

jedit can lower one app-authored observer spec into a substrate-legal observer
plan with explicit state/read codecs and without normalizing arbitrary callbacks.

## Done looks like

- one design packet names `ObserverSpec`, `ObserverPlan`, and
  `ObserverInstance` as distinct layers
- one compiler-facing authored shape is chosen for the first observer lane
- output shapes are named for observer plan, observer state codec, reading
  codec, and any needed hologram/frontier envelope helpers
- the first proving target is `worldlineSnapshot` as a memoryless observer
- one accumulative observer proof slice is named as follow-on work

## Non-goals

- Do not normalize arbitrary JavaScript or Rust callbacks into observer
  legality.
- Do not pretend a GraphQL query shape is already a full observer.
- Do not collapse authored spec, compiled plan, hosted instance, and reading
  into one object.
