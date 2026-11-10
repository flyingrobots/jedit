# Drive the pending structured-effect probes

These seven files are authored inputs for the structured-effect part of
[Jedit #388](https://github.com/flyingrobots/jedit/issues/388). No compiler,
provider or runtime has measured them. They record no result and establish no
capability or refusal. [The inventory entrance](../README.md) owns the guarded
replay commands for the measured groups.

## Why they are not in `iterative/`

`iterative.mts` copies and hashes every file under `iterative/` into each
report's `probeSources`. A file there without a registered case changes every
group's inventory identity while measuring nothing. With these files held here,
`iterative/` again contains exactly the 33 probe sources bound by the last
complete public report,
`40d6808fff828559f5100bbde8d76cd9f64ee007ca1b535117e71da6e826a76a`.

## Inputs

| File | Source shape | Question |
| --- | --- | --- |
| `effect-linear.edict` | One `createValue` effect | Positive control for the effect family |
| `effect-repeated.edict` | Two effects in sequence | Is a second effect in one intent admitted? |
| `effect-branch.edict` | An effect inside one `if` arm | Do branch-selected effects publish and execute? |
| `effect-loop.edict` | An effect inside `for … bounded 2` | Do bounded effect loops publish and execute? |
| `effect-nested.edict` | A branch-selected effect inside a bounded loop | Does the composition hold? |
| `effect-dynamic-bound.edict` | A loop bound read from input | Expected refusal control |
| `structured-lawpack.json` | Additions to the `jedit.text@1` authoring lawpack | Supplies the `createValue` effect the six sources import |

The lawpack additions follow Amblicit's public
[configurable causal cell example#46:66bf6bac369f67e32ddaee099c3198bd30f885a1](https://github.com/flyingrobots/amblicit/blob/66bf6bac369f67e32ddaee099c3198bd30f885a1/crates/amblicit-cli/examples/configurable_causal_cell/document.rs#L46):
one runtime `create` effect, its failure mapping, a `continuum.profile.create/v1`
adapter profile and an `anchored-node-attachment-create-if-absent/v1` target
configuration. Whether the public lawpack builder accepts them merged into the
existing `jedit.text@1` lawpack is itself unmeasured.

## What a measurement needs

1. Add an `effects` group to `iterative.mts`. It merges the additions into the
   copied basis lawpack before publication: exported types, effects,
   obstructions and operation profiles; the adapter's operation profiles, effect
   implementations and budgets; and `configuration` as a local resource.
2. Point each effect case's `lawpacks[0].targetConfiguration` at the published
   `vendor/jedit-text/echo-create-configuration.cbor`. The compiler selects one
   configuration from the required Core profile and compares the supplied bytes
   with it
   ([selection#1772:66bf6bac369f67e32ddaee099c3198bd30f885a1](https://github.com/flyingrobots/amblicit/blob/66bf6bac369f67e32ddaee099c3198bd30f885a1/crates/amblicit-cli/src/application_build.rs#L1772)).
   The flat-text baseline and fold controls keep the existing configuration.
3. Admit the group in the Rust consumer and bind any new driver module by hash,
   as the `drafts` group binds its source-pin driver.
4. Move these files back into `iterative/` in the same change, write the stage
   assertions first, and record the first refusal of every case.

The consumer's runtime witness is pure evaluation, which cannot execute an
effect. Echo's public
[`run-edict-operation` command#161:089c849f766d5331835e7d10148a378cdb1237d5](https://github.com/flyingrobots/echo/blob/089c849f766d5331835e7d10148a378cdb1237d5/xtask/src/main.rs#L161)
runs one compiler-produced create-if-absent package on the real host. It is a
candidate execution witness for the linear control only if that package
publishes; this inventory has not tried it.

## Owners

[Echo #947](https://github.com/flyingrobots/echo/issues/947) owns generic
structured loops and branches, their independent verification and publication.
[Amblicit #267](https://github.com/flyingrobots/amblicit/issues/267) owns
bounded effect loops in Target lowering and the declared effect budget. Routing
a specific case to either owner waits for its measured first refusal.
