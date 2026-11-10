---
title: "DL-0162 - Iterative Rope Capability Inventory"
legend: "DL"
lane: "design"
issue: "https://github.com/flyingrobots/jedit/issues/388"
status: "active"
owners:
  - "@flyingrobots"
created: "2026-11-08"
updated: "2026-11-10"
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

- [x] Slice 1: Define stage/provenance checks and reachable source fixtures;
  prove rejection of invalid controls and substituted inputs.
- [x] Slice 2: Run the current public compiler/provider tuple, including
  complete closures, positive controls, and generic execution where reached.
- [x] Slice 3: Reconcile upstream owners and update the canonical inventory
  entrance with measured boundaries and unresolved requirements.
- [ ] Slice 4: Prove existing supported behavior and unchanged rope obligations;
  complete current-head CI and independent review.

## Tests To Write First

- [x] The real public command rejects an invalid positive-control measurement.
- [x] Source/compiler/provider substitution and incomplete closures fail their
  named provenance checks instead of being reported as unsupported language.
- [x] A reachable iterative shape differs observably from a declaration-only
  probe; refusal reports leave unreached stages unmeasured.
- [x] Supported controls preserve exact result/artifact expectations; generated
  reports distinguish compiler, provider, and runtime boundaries.

## Acceptance Criteria

- [x] Exact public source/closure/component identities accompany every result.
- [x] First unsupported boundaries have reproducers and existing owners; any
  proposed new issue has a concrete reproducer and is separately authorized.
- [x] Amblicit #261–268 are reconciled without closing broad issues from partial
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

The bounded iterative entry point is
`edict/replace-range-probes/compiler-inventory/iterative.mts`; its README names
the public build command and separate generic runtime consumer. The older
`run.mjs` retains the declaration and draft-closure inventory. A passing helper
probe is never a rope witness.

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

The first checkpoint builds reachable scalar, bounded-list, and record-list
folds through the public compiler and checked provider. All three run through
generic Echo pure evaluation; a dynamic fold bound refuses at source type
checking. A wrong list expectation fails its result assertion, then the restored
expectation passes in debug and optimized builds. Exact-budget replay and
one-unit-short limits are metamorphic checks, not independent cost formulas.

The next checkpoint makes evidence admission explicit in report v2. Eight
previously missed refusal cases first executed against the old consumer, then
refused after complete tree inventories, separate source/dependency snapshot
comparisons, positive-control checks, and completion markers were enforced.
All ten admission tests pass in debug and optimized builds; emitted public
package/report pairs are unchanged. The compiler identity remains a selected
binary hash, not an independently reproduced compiler build.

The list-composition checkpoint adds nine reachable shapes. Six publish and
execute through generic pure evaluation; three stop in the provider lowerer.
An indexed record fold isolates a smaller refusal than the composed rebuilding
fold, while guarded list selection and transfer succeed separately. Thirty
total runtime inputs pass in debug and optimized builds. Six wrong-expectation
calibrations fail at their named result checks, then pass after restoration.
Source/Core/Target success for the provider refusals is inferred from the
selected public command's order, not from separately emitted artifacts. The
precise range-judgment owner and alternative index guards remained unresolved
at that checkpoint.

The range checkpoint removes records and folds from the failing source and
compares strict, non-strict and equality branch guards. All five forms refuse
in the provider lowerer, while addition under an intent input constraint
publishes and executes. Source inspection shows branch predicates absent from
the lowerer's addition-proof inputs. A proposed generic Echo issue is prepared
for publication authorization; this inventory does not itself repair that gap.

The consumer now emits hash-bound, per-case stage observations. Four stage tests
first failed, and two tampered diagnostic/status reports exposed missed
refusals. CLI stream corroboration fixes both. Fifteen admission tests pass on
the range and expanded-list inventories in debug and optimized builds; four
range stage tests pass in both builds. A wrong scalar result demonstrates that
failed witnesses remain distinct from later successful cases. These checks
still do not establish component regeneration or full operation acceptance.

This is a partial implementation: none of the four slices is complete. Complete
whole-draft closures, the remaining iterative shapes, wider stage/fault coverage,
provenance fault coverage, upstream reconciliation, required application checks,
and independent review remain. The 40-case rope oracle and production pins are
unchanged; no new rope acceptance result is claimed.

The source-closure checkpoint invokes an imported fold step through a second
digest-authenticated module. Both Bool inputs produce their opposite. A changed
transitive leaf and a missing leaf refuse at source authentication before Core
or provider execution. The v3 evidence format binds each complete supplied
source graph and checks the application's exact source selection, including
root ordering. The prior consumer admitted an empty application source list;
the retained regression first failed, then refused before runtime after repair.
All three module assertions and twenty admission tests pass in debug and
optimized builds, alongside the earlier v2 thirty-input runtime witness and its
source-selection regression. TypeScript, repository quality and Clippy pass.
This proves a reachable transitive module control, not the full rope draft or
its schema-2 lawpack closure. See the
[source-closure measurement](../../edict/replace-range-probes/compiler-inventory/source-closures.md).

The arithmetic/byte checkpoint measures ten additional source shapes. Intent
constraints admit subtraction and slicing, and invoked byte-metric helpers
publish. Guarded subtraction/slice helpers instead refuse in the provider;
its order proofs omit branch-path facts. Function preconditions and typed
failure declarations refuse in parsing, while `min`/`max` refuse in source
checking. The first direct-return wrappers stopped at Target `NoTargetSteps`;
both that evidence and the subsequent explicit-binding measurements remain.
The [owner reconciliation](../../edict/replace-range-probes/compiler-inventory/upstream-status.md)
records the landed compiler/runtime prerequisites without closing broader
issues or scheduling their reimplementation. Whole-draft closures, structured
effects, remaining composite shapes and the full gates are still unfinished.

The whole-draft checkpoint supplies the unchanged five source modules and
checks each root's exact dependency list. Text, Reference, Rope and ReplaceRange
retain distinct first parse refusals; the generic controls still execute.
A separate small probe reaches Target's `UndigestedCoreImport` for the draft's
`jedit.text@2` import. The selected publication remains version 1, so this
measurement does not establish the requested version-2 lawpack closure.
See the [draft closure boundary](../../edict/replace-range-probes/compiler-inventory/draft-closures.md).

The structured-effect checkpoint publishes a standalone single-profile effect
lawpack beside the unchanged basis. Merging the effect into `jedit.text@1`
was measured first and refused twice: the lawpack builder admits one local
resource per coordinate, and Echo's compiler adapter admits exactly one
operation profile. Through the standalone lawpack, one `create` effect
publishes as the fixed create-if-absent intrinsic; two effects stop in the
provider lowerer; an effect inside a branch or a bounded loop stops at Target
with `UnsupportedCoreNode`. All seven effect assertions and four effect
admission assertions first failed against the preceding consumer, then pass
in debug and optimized builds. Review added six admission assertions; of these,
only a traversing lawpack path and an extra lawpack field were admitted by the
earlier consumer. The retained draft and primitive reports still
pass with the new consumer. See the
[structured-effect measurement](../../edict/replace-range-probes/compiler-inventory/structured-effects.md).
The [owner reconciliation](../../edict/replace-range-probes/compiler-inventory/upstream-status.md#measured-boundary-of-each-shape)
joins all six groups and gives every proposed prerequisite a reproducer, an
existing owner and a reason. Runtime of the published effect package,
component regeneration and full operation stay unmeasured. The oracle and
production pins are unchanged; rope acceptance remains 0/40.
