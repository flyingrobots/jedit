# Reproduce the iterative module-closure measurement

The `modules` group invokes a bounded fold whose imported step calls another
imported helper. A maintainer can distinguish authenticated source composition
from missing/substituted dependencies and from unmeasured rope behavior.
[The inventory entrance](README.md) owns setup, guarded-worker commands,
producer selection, and the consumer's evidence contract.

## Inputs and result

The 2026-11-09 measurement selects Amblicit
`66bf6bac369f67e32ddaee099c3198bd30f885a1`, Echo
`089c849f766d5331835e7d10148a378cdb1237d5`, compiler SHA-256
`12d169ac6d4acccd7dcd614bb9cc11939982c5aa48531a98dc2875936849f872`,
and provider-manifest SHA-256
`492b2ac958c49f113500c5b29c12cc41e1b85f4071ef0c9f6424e5aeba3cbe98`.
The public v3 report is
`ed487546dd9198fc9441d56eaf14c8b54f3568727c65c5f52dc1a8f20e70a35d`.

| Case | First observed result |
| --- | --- |
| Baseline and three existing bounded-fold controls | Public build accepted |
| Imported step calling an imported leaf | Public build and generic pure runtime accepted |
| Changed leaf with its original import digest | Source authentication: `DigestMismatch` |
| Omitted transitive leaf | Source authentication: `MissingModule` |
| Dynamic fold bound | Source type checking: `InvalidBound` |

The positive root supplies `Probe.edict`, `Step.edict`, and `Leaf.edict` through
the public application's `sources` array. Source-domain digests bind the exact
leaf and step bytes. Three steps flip both Bool inputs, with literal expected
outputs. Including the prior controls, six inputs exercise exact-budget replay,
three one-unit-short refusals, and package identity checks; invalid Bool and U8
inputs also refuse. These are pure evaluations, not graph effects or rope edits.

The compiler's
[source loader#31:66bf6bac369f67e32ddaee099c3198bd30f885a1](https://github.com/flyingrobots/amblicit/blob/66bf6bac369f67e32ddaee099c3198bd30f885a1/crates/amblicit-cli/src/application_build/source_inputs.rs#L31)
treats the first source as the root and resolves the remaining explicit sources
as its authenticated closure. The two negative imports refuse there; Core,
provider verification and runtime are unreached. Missing dependencies are
invalid inputs, not evidence that imported folds are unsupported.

## Evidence admission

The v3 report retains each supplied source graph separately from its compiled
case. The consumer compares every case's source bytes against that selection,
checks that the application lists exactly those paths once with the root first,
and admits the complete provider/lawpack trees as before. Single-source v2
reports remain supported; they cannot acquire undeclared module files.

The earlier consumer executed after a case's application source list was
emptied, despite the absence of a selectable root. That regression first failed
its refusal assertion. The repair refuses before runtime. Further controls
cover a self-consistent changed leaf, an omitted leaf removed from both the
case and its file list, a reordered root, and a missing v3 source inventory.
The versioned module consumer also starts RED against the preceding binary,
which lacks v3 admission and imported-fold execution.

All three module assertions and twenty admission tests pass in debug and
optimized builds. Both builds also replay the earlier v2 thirty-input list
witness and pass its exact-artifact/source-selection regression pair.
Strict TypeScript checks, the tooling syntax gate and Rust Clippy pass.

The raw report, selected source trees, public compiler streams, verifier reports,
runtime output and test evidence are retained outside Git. This measurement
does not establish the complete authored draft/lawpack closure, component
regeneration, structured effects, or any of the 40 rope acceptance cases.
