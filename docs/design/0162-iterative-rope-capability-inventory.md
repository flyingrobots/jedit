---
title: "DL-0162 - Iterative Rope Capability Inventory"
legend: "DL"
lane: "design"
issue: "https://github.com/flyingrobots/jedit/issues/388"
status: "active"
owners:
  - "@flyingrobots"
created: "2026-11-08"
updated: "2026-11-08"
---

# DL-0162 - Iterative Rope Capability Inventory

## Linked Issue

- [Jedit #388](https://github.com/flyingrobots/jedit/issues/388)

## Decision Summary

Extend the existing public compiler inventory with reachable, bounded iterative
source shapes and exact artifact provenance. Report source/Core/Target/provider
verification/publication/runtime/full-operation evidence separately. A stage
that was not reached remains unmeasured. This cycle measures prerequisites; it
does not replace the authored rope or change production package pins.

## Sponsored Human

The Jim maintainer needs reproducible remaining blockers for the authored rope
without scheduling compiler features that already landed.

## Sponsored Agent

An implementation agent needs exact sources, complete module/lawpack closures,
selected component hashes, and stable first refusals to choose its next owner.

## Hill

A maintainer can rerun the public inventory against a named compiler and
published provider tuple and distinguish an unsupported source construct from
provider refusal, runtime failure, and an unmeasured later stage.

## Current Truth

The merge target is Jedit `5f8c44b0f4c400fe3c61e26db2c209b311b67419`.

- [The existing runner#51:5f8c44b0f4c400fe3c61e26db2c209b311b67419](https://github.com/flyingrobots/jedit/blob/5f8c44b0f4c400fe3c61e26db2c209b311b67419/edict/replace-range-probes/compiler-inventory/run.mjs#L51)
  appends helper declarations to a positive-control application and separately
  builds four draft module closures. Most helper probes are not invoked.
- [The public compiler builder#24:5f8c44b0f4c400fe3c61e26db2c209b311b67419](https://github.com/flyingrobots/jedit/blob/5f8c44b0f4c400fe3c61e26db2c209b311b67419/edict/replace-range/tests/compiler.mjs#L24)
  selects the public executable from Cargo metadata. The inventory republishes
  the lawpack through that executable; it does not manufacture Core or packages.
- [The rope draft#19:5f8c44b0f4c400fe3c61e26db2c209b311b67419](https://github.com/flyingrobots/jedit/blob/5f8c44b0f4c400fe3c61e26db2c209b311b67419/edict/replace-range/draft/Rope.edict#L19)
  still describes recursive trees. Its first refusal cannot classify a bounded
  worklist alternative or every later construct in the draft.
- [DL-0159](0159-edict-rope-representation.md) owns the rope representation and
  its 40-case acceptance register. This inventory supplies prerequisite evidence
  to that owner and leaves its physical/semantic oracle unchanged.

## Problem

Historical construct reports mix source and provider boundaries, select older
artifact tuples, and do not establish reachable iterative composition. Reading
their first error as a complete feature inventory can schedule solved problems
or conceal a later missing contract.

## Scope

- Add named, bounded source fixtures for the remaining iterative shapes:
  list/record worklists, state-carrying folds, variant/match state, list access
  and rebuilding, checked arithmetic/slicing, and structured effect emission.
- Invoke accepted helper shapes from an intent; retain complete authenticated
  module closures and lawpacks. Keep malformed-input and positive controls.
- Record exact compiler executable, source, closure, provider manifest,
  component, and produced-artifact hashes alongside raw diagnostics.
- Reconcile Amblicit #261–268 with their merged implementation PRs and current
  public evidence. Route every demonstrated gap to its owning issue.

## Non-Goals

The final rope algorithm, new language/runtime features, production pin changes,
native planner calls, handwritten Core/packages, and full ReplaceRange acceptance
belong to their existing owners. Historical reports remain evidence of their
named input bytes; this cycle does not rewrite their outcomes.

## User Experience / Product Shape

This is a developer command and machine-readable report. A reviewer selects a
compiler, provider directory, and new output directory. A failed positive control
invalidates the measurement. A fresh directory permits an independent rerun;
existing evidence is never overwritten. There is no rendered UI or animation.

### User Journey

Select exact inputs → validate their closure → run positive control → run bounded
reachable probes → inspect stage evidence and owner links.

### Wide UI Mockup

Not applicable: no rendered interface changes.

### Narrow UI Mockup

Not applicable: pipe output has no terminal geometry dependency.

### Accessibility Considerations

Plain diagnostics and structured report fields carry every result. Color and
visual layout carry no required information.

## Runtime / API Contract

The compiler's public application-build command is the only package producer.
The provider's separate verifier result is retained as an artifact, not inferred
from parsing success. Generic runtime evidence uses the exact verified package;
source declarations alone never count as execution.

Each case records its source closure and selected inputs, the process outcome,
diagnostics, produced artifact hashes, and independently supported stage facts.
Stages distinguish observed acceptance/refusal from unmeasured behavior. A
refusal at one stage cannot classify later stages. Missing, stale, substituted,
or malformed provenance invalidates the measurement instead of becoming a
language-feature refusal. A clean checkout SHA is not evidence that arbitrary
selected component bytes were built from that checkout.

## Lower Modes

JSON reports and retained JSONL diagnostics are the primary interface. Output
paths are normalized in committed summaries; verbatim streams and source bytes
remain in the accounted evidence directory. No host execution fallback is used
when the guarded Docker worker cannot admit a run.

## Data / State Model

| Category | Description |
| --- | --- |
| Source of truth | Selected source, lawpack/module closure, compiler and provider bytes |
| Derived state | Build outputs and bounded stage evidence |
| Invalid states | Broken control, substituted inputs, unsupported report shape, invented later-stage success |
| Reset behavior | New output directory; retained earlier evidence remains intact |
| Serialization | Versioned JSON metadata and original compiler artifact bytes |
| Determinism | Fixed source/artifact tuple; repeated successful builds compare artifact hashes |

## Accessibility Posture

Results are available as plain text and JSON without focus, mouse, or color
requirements. No product accessibility behavior changes.

## Localization / Directionality Posture

Not applicable: developer diagnostics and fixture identifiers add no localized
product strings. Reports do not depend on terminal directionality.

## Agent Inspectability / Explainability Posture

Stable case identifiers map source shape to exact artifacts, the first observed
refusal, downstream unmeasured stages, and an existing issue owner. Raw evidence
is retained so an agent can check the summary without trusting its prose.

## Linked Invariants

- [Architecture](../../ARCHITECTURE.md): public compilation and generic Echo
  execution; schema, oracle, program, and receipt remain distinct.
- [Component ownership](../jim-component-ownership.md): rope algorithms stay in
  authored source; Echo has no editor-specific execution branch.
- [Documentation lifecycle](../method/documentation-lifecycle.md): tests read
  executable surfaces and artifacts, never documentation wording.
- [DL-0159](0159-edict-rope-representation.md): fixed-basis reads, atomic candidate
  admission, and all 40 retained physical/semantic obligations remain binding.

## Design Alternatives Considered

### Repeat only the earlier declaration inventory

This is cheap but leaves reachable composition and current publication behavior
unmeasured. Keep it as a historical/control surface, not this cycle's result.

### Use the native planner or construct packages directly

This avoids compiler gaps but proves a different path. Reject this option.

## Decision

Extend the public inventory with bounded reachable fixtures and explicit stage
evidence. Reuse existing compiler/publication helpers where their exact input
contracts apply. Do not build a second compiler or runtime adapter framework.

## Implementation Slices

- [ ] Slice 1: Define stage/provenance checks and reachable source fixtures;
  prove rejection of invalid controls and substituted inputs.
- [ ] Slice 2: Run the current public compiler/provider tuple, including
  complete closures, positive controls, and generic execution where reached.
- [ ] Slice 3: Reconcile upstream owners and update the canonical inventory
  entrance with measured boundaries and unresolved requirements.
- [ ] Slice 4: Prove existing supported behavior and unchanged rope obligations;
  complete current-head CI and independent review.

## Tests To Write First

- [ ] The real public command rejects an invalid positive-control measurement.
- [ ] Source/compiler/provider substitution and incomplete closures fail their
  named provenance checks instead of being reported as unsupported language.
- [ ] A reachable iterative shape differs observably from a declaration-only
  probe; refusal reports leave unreached stages unmeasured.
- [ ] Supported controls preserve exact result/artifact expectations; generated
  reports distinguish compiler, provider, and runtime boundaries.

## Acceptance Criteria

- [ ] Exact public source/closure/component identities accompany every result.
- [ ] First unsupported boundaries have reproducers and existing owners; any
  proposed new issue has a concrete reproducer and is separately authorized.
- [ ] Amblicit #261–268 are reconciled without closing broad issues from partial
  evidence or scheduling an already-landed fold implementation.
- [ ] Current supported behavior passes required checks; the 40-case rope oracle
  remains byte-for-byte unchanged and no new acceptance success is claimed.
- [ ] Documentation, linked issue, current-head CI, and independent review agree.

## Validation Plan

All executable checks run in the maintained guarded Docker worker. Begin with
focused provenance/fixture tests, then real public compiler probes and selected
generic runtime checks. Run `npm run check` and the pinned Edict chain required
by CI before readiness. Retain exact commands, source hashes, RED diagnostics,
and restored GREEN output. Documentation-only kickoff uses whitespace and link
review; tests never inspect this design's contents.

## Playback / Witness

The existing inventory entry point is
`edict/replace-range-probes/compiler-inventory/run.mjs`. The completed inventory
README will name the exact bounded replay command, source/artifact selection,
and retained output format. A passing helper probe is never a rope witness.

## Risks

An obsolete diagnostic can misclassify a current capability. Exact tuples and
fresh positive controls prevent that inference. A first failure can hide later
requirements; independent stage fields preserve that uncertainty. Large copied
provider trees can exhaust evidence storage; finite fixtures and the existing
resource monitor bound each run without deleting unique evidence.

## Follow-On Debt

Existing owners are Amblicit #260–268, Echo #926/#947, and Jedit #296/#389.
New prerequisites need a reproducer and approval before issue publication.

## Retrospective

Implementation has not started. No compiler/runtime result is claimed by this
design. The implementation PR will record the completed slices, actual proof
boundaries, and remaining upstream owners before readiness.
