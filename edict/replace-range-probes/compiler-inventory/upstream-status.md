# Reconcile the rope capability owners

This 2026-11-09 inventory keeps merged prerequisites distinct from the broader
open requirements. It is part of [Jedit #388](https://github.com/flyingrobots/jedit/issues/388);
the [inventory entrance](README.md) owns public replay commands and exact
artifact selections. No broad issue is closed by these bounded witnesses.

## Existing capability issues

| Owner | Measured or merged progress | Remaining scope |
| --- | --- | --- |
| [Amblicit #261](https://github.com/flyingrobots/amblicit/issues/261) | The list group publishes and executes variant-state construction/matching for three payloads. | This is not complete Option, enum, or recursive-variant support. |
| [Amblicit #262](https://github.com/flyingrobots/amblicit/issues/262) | Bounded folds and bounded lists provide a measured iterative building block. | Actual descent/rebuild composition and the authored rope remain unproved; recursion is not established. |
| [Amblicit #263](https://github.com/flyingrobots/amblicit/issues/263) | Constrained addition/subtraction publish and execute. Unsafe arithmetic without a proof refuses. | `min`/`max` still refuse in source; declared overflow/underflow failures are not established. Branch addition also has a provider gap. |
| [Amblicit #264](https://github.com/flyingrobots/amblicit/issues/264) | Intent range constraints admit subtraction and slice; guarded helpers pass source/Core/Target but stop in the provider. | Function `where` declarations still refuse in parsing; caller contract propagation and provider branch facts remain incomplete. |
| [Amblicit #265](https://github.com/flyingrobots/amblicit/issues/265) | The new reachable call fixture isolates a parse refusal at the function's `fails` declaration. | Failure propagation and caller mapping are unreached, not separately measured refusals. |
| [Amblicit #266](https://github.com/flyingrobots/amblicit/issues/266) | Invoked `at`, `count`, and `isUtf8` helpers publish and execute over twelve byte-metric inputs with budget/identity/type controls. | Broader integration into the authored text/rope law remains separate; this run does not close the issue. |
| [Amblicit #267](https://github.com/flyingrobots/amblicit/issues/267) | Structured Target lowering landed in PR #272. Root result projection work is recorded by closed #300. | A bounded `for` that emits an effect still refuses at Target with `UnsupportedCoreNode` against the selected provider ([structured effects](structured-effects.md)); the declared effect budget is unreached. |
| [Amblicit #268](https://github.com/flyingrobots/amblicit/issues/268) | PRs #285/#286 and Echo #944 landed bounded folds and public pure/read witnesses. Current inventory adds record/list/variant and transitive-module execution. | Complete rope descent/rebuild, terminal-state effect behavior and full-operation obligations are not discharged by these probes. |

The arithmetic/byte rows use the
[primitive measurement](primitives.md), not the older declaration-only reports.
Guarded helper refusal belongs to generic provider work under
[Echo #684](https://github.com/flyingrobots/echo/issues/684), alongside the
source contract owner #264. Echo #684 stays the owner of the branch-fact gap
until a narrower issue is authorized; that proposed issue remains unpublished.
It must preserve these distinct source, lowerer, verifier and runtime evidence
boundaries.

## Landed prerequisites are not new tasks

- [Amblicit PR #272](https://github.com/flyingrobots/amblicit/pull/272), merge
  `fdd6b86e4315855343011b8cfd5d396f6d4ba379`, added structured `echo.span-ir/v3`
  lowering. Its PR explicitly leaves #267's effect-budget requirement open.
- [Amblicit PR #285](https://github.com/flyingrobots/amblicit/pull/285), merge
  `2269d81f257f7794b44270cf3f7ca330966a0784`, added first-order bounded fold
  compilation, hygienic imported step identity and conservative native costs.
- [Amblicit PR #286](https://github.com/flyingrobots/amblicit/pull/286), merge
  `669e46b0bd10bcf20830b169fdbfc1e59ef010ae`, repaired obstruction annotation
  accounting and records public pure/read-result fold evidence.
- [Echo PR #944](https://github.com/flyingrobots/echo/pull/944), merge
  `65c5e82f5854960c13d98dcbf71fc0491cd8ddbf`, added generic bounded fold
  provider/verifier/runtime support and checked publication evidence.

Live GitHub state confirmed those four PRs merged. Git ancestry checks place
the three Amblicit merges in selected compiler `66bf6bac` and the Echo merge in
selected runtime `089c849f`. Reimplementing those features would duplicate
landed work. Their published review/test claims retain their named scope;
this inventory does not convert them into new full-operation evidence.

[Amblicit #300](https://github.com/flyingrobots/amblicit/issues/300) is closed.
[Echo #947](https://github.com/flyingrobots/echo/issues/947) is the open owner
for generic structured loops/branches, independent verification, atomic
buffering, reproducible components and public source witnesses. Its dependency
on #300 is already represented in frontmatter. The
[structured-effect measurement](structured-effects.md) now places its first
gaps: two effects in one intent stop in the provider lowerer, and an effect
inside a branch or a bounded loop stops at Target.

The [whole-draft measurement](draft-closures.md) now retains every supplied
source module unchanged. Its four roots still refuse in parsing. A separate
small probe reaches Target's `UndigestedCoreImport` refusal for `jedit.text@2`;
the selected application supplies only the published version-1 lawpack.
The requested version-2 lawpack closure remains unresolved under Jedit #296.

## Measured boundary of each shape

This table joins the six measured groups. Every row is bound to Amblicit
`66bf6bac369f67e32ddaee099c3198bd30f885a1` and Echo
`089c849f766d5331835e7d10148a378cdb1237d5`; both were still their remote main
heads on 2026-11-10, and every issue below was still open. Each group's page
names its report hash, compiler binary and provider manifest.

| Shape | Furthest accepted stage | First stable refusal | Owner |
| --- | --- | --- | --- |
| Flat-text baseline | Verifier | None; this consumer does not execute it | Positive control |
| Scalar, bounded-list and record-list folds | Generic pure runtime | None | Progress under Amblicit #268 |
| Guarded list lookup, concatenation, record-state fold, record-field lookup, guarded transfer | Generic pure runtime | None | Progress under Amblicit #262/#268 |
| Variant-state fold with construction and matching | Generic pure runtime | None | Progress under Amblicit #261 |
| Fold step imported through two digest-bound modules | Generic pure runtime | None | Progress under Amblicit #268 |
| Addition, subtraction and slice under an intent `where` | Generic pure runtime | None | Progress under Amblicit #263/#264 |
| Invoked `at`, `count` and `isUtf8` helpers | Generic pure runtime | None | Progress under Amblicit #266 |
| Addition guarded by a branch: inline intent, scalar helper, indexed record fold | Target | Provider lowerer: `ProviderLowererRefused` | Echo #684 and Amblicit #264; narrower issue proposed below |
| Subtraction or slice in a guarded helper | Target | Provider lowerer: `ProviderLowererRefused` | Echo #684 and Amblicit #264; narrower issue proposed below |
| List-rebuilding fold, with conjunctive or nested guards | Target | Provider lowerer: `ProviderLowererRefused` | Echo #684; rebuild composition under Amblicit #262 |
| `min` and `max` | None | Source type check: `UnresolvedFunction` | Amblicit #263 |
| Function `where` declaration | None | Parse: `ExpectedToken` | Amblicit #264 |
| Function `fails` declaration | None | Parse: `ExpectedToken` | Amblicit #265 |
| Draft Text | None | Parse: `contentId<T>`, line 90 | Jedit #296; identity inputs under Amblicit #260 |
| Draft Reference | None | Parse: nested read-expression `else`, line 55 | Jedit #296; reads under Echo #926 |
| Draft Rope | None | Parse: recursive variant `depth`, line 24 | Jedit #296; Amblicit #262 |
| Draft ReplaceRange | None | Parse: enum declaration, line 49 | Jedit #296; Amblicit #261 |
| Small intent importing `jedit.text@2` | Core | Target: `UndigestedCoreImport` | Jedit #296; no version-2 lawpack input exists |
| One `create` effect through a standalone effect lawpack | Verifier, as the fixed create-if-absent intrinsic | None; its runtime is unmeasured | Positive control for the effect family |
| Two `create` effects in one intent | Target | Provider lowerer: `UnsupportedSemantics`, one Core body node | Echo #947 |
| `create` inside an `if` arm | Core | Target: `UnsupportedCoreNode` `branch` | Echo #947 |
| `create` inside a bounded `for`, alone or under a branch | Core | Target: `UnsupportedCoreNode` `for` | Amblicit #267 and Echo #947 |
| A `create` profile added to the `jedit.text@1` lawpack | None | Lawpack publication or provider lowerer, depending on the resource coordinate | Jedit #296; provider path under Echo #947 and #684 |

Dynamic fold and effect-loop bounds, unproved addition and subtraction, and
changed or missing module leaves refuse in source as intended; they are
controls, not gaps.
"Target" in the second column is inferred from the inspected compiler's
command order, not from separately emitted Core or Target artifacts. The
provider components are the selected checked bytes; regenerating them is
unmeasured. No row measures a full operation, so the rope acceptance count
stays 0/40. A first refusal says nothing about the stages behind it.

## Prerequisites without a dedicated issue or a recorded edge

These are findings for the roadmap owner. This inventory does not publish
issues or change dependency edges.

- **Branch facts in the provider's range proofs.** Owner: Echo #684 until a
  narrower Echo issue is authorized. The
  lowerer records a branch predicate on its path but proves addition,
  subtraction and slice from other facts
  ([range facts](README.md#range-facts-and-corroborated-stages),
  [branch-fact boundary](primitives.md#branch-fact-boundary)). The smallest
  reproducer is `iterative/intent-guarded-add.edict` in range report
  `95af84cce76d08c96664b5491ad3b2839f19c87f5baed9fc63cb179f5287def5`;
  `subtraction-helper.edict` and `byte-slice-helper.edict` reproduce it in
  primitive report
  `71ae487876901523e7538ad32ebb191ba033622ec75f0b9ab2b97200ced808ee`.
  Every measured fold that advances an index under a branch refuses there, so
  an iterative rope written in that shape cannot publish until the gap closes.
  Echo #684 covers generic checked arithmetic and bounded control flow but does
  not name this gap; Echo #960 aligns range judgments for effect programs only.
  Jedit #296 has no edge to either.
- **The draft's first parse refusals have owners that do not block #296.**
  Jedit #296 is blocked by Amblicit #260, Echo #926, #946, #947 and #979, and
  Jedit #389 and #403. Amblicit #261, #262, #263, #264 and #265 own syntax the
  current drafts use, yet none is a recorded blocker. Either the drafts are
  rewritten onto the measured iterative shapes within #296, or those edges are
  missing. Which holds is unresolved.
- **No `jedit.text@2` authoring lawpack exists to publish.** Owner: Jedit
  #296, which owns the draft's version-2 application contract. The drafts
  import it and this checkout has nothing to supply; the reproducer is
  `missing-draft-lawpack.edict` in draft report
  `40d6808fff828559f5100bbde8d76cd9f64ee007ca1b535117e71da6e826a76a`. #296
  does not yet name the lawpack input as a deliverable.
- **The rope's effects need a single-profile lawpack.** Owner: Jedit #296 for
  authoring, Echo #947 and #684 for the provider path. A `jedit.text@1`
  adapter cannot add a second operation profile for Echo's compiler-produced
  path, and the pure adapter admits no semantic effects
  ([structured effects](structured-effects.md#how-the-effect-lawpack-is-supplied)).
  Reproducers are commits `8d234c4` and `1be66de` of this branch.

## What remains unmeasured

Runtime of the one published effect package, regeneration of the selected
provider components, and every full operation remain unmeasured. The retained
ReplaceRange acceptance count is 0/40.
