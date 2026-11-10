# Measure structured effect emission

The `effects` inventory group asks where one, two, branch-selected and
loop-carried `create` effects stop on the selected public compiler and
provider. [The inventory entrance](README.md) owns guarded setup and replay
commands; add `--group effects` and use `iterative-effects.test.mts`.

## How the effect lawpack is supplied

The six effect sources import a standalone lawpack,
`jedit.inventory.effects@1`, authored in
[`iterative/effects-lawpack.json`](iterative/effects-lawpack.json). It follows
Amblicit's public
[configurable causal cell example#46:66bf6bac369f67e32ddaee099c3198bd30f885a1](https://github.com/flyingrobots/amblicit/blob/66bf6bac369f67e32ddaee099c3198bd30f885a1/crates/amblicit-cli/examples/configurable_causal_cell/document.rs#L46):
one runtime `createValue` effect, one `continuum.profile.create/v1` operation
profile and one `anchored-node-attachment-create-if-absent/v1` target
configuration. The runner publishes it beside the unchanged `jedit.text@1`
basis, so the baseline and fold controls keep their existing lawpack and
digest. Each effect case selects only the effect lawpack. The v3 report adds
`effectDriverSha256` and `effectLawpackSourceSha256`; the consumer checks both.
Each case's application must select exactly the four expected lawpack files,
the effect lawpack for effect cases and the basis for every other case. The
consumer binds the effect build document and the published vendor bytes
separately; like the basis lawpack, it does not prove that one was produced
from the other. The publication streams are retained in the archive, not in
the report.

Two earlier attempts put the effect inside `jedit.text@1` instead. Both were
measured with the selected compiler and provider and both refused before any
effect source compiled:

| Attempt | First refusal | Retained inputs |
| --- | --- | --- |
| Merge into `jedit.text@1`, both configurations under `echo.operation-lowering-configuration/v1` (commit `8d234c4`) | Lawpack publication: `LawpackAuthoringDuplicateIdentity`, "one canonical artifact per resource coordinate" | Merged lawpack `d72500854e378c6817e15dee57f4026ef7495d00650dc1b31bc752bb33f4ae7f`; no report |
| Same merge with the create configuration under its own coordinate (commit `1be66de`) | Baseline, Echo provider lowerer: `UnsupportedSemantics` on `adapter.echo-pure-operation`, "compiler adapter must declare exactly one operation profile" | Merged lawpack `63a53e7cfe5cd6f656c990dd2d0dd8f1e91da811aefa7000885d987210f19759`; incomplete report `86581128e92464746e01b23a5dc61179c30d22f13988b22ce4982a1427c97cbe` |

The first is Amblicit's lawpack builder rule
([lawpack_authoring.rs#1931:66bf6bac369f67e32ddaee099c3198bd30f885a1](https://github.com/flyingrobots/amblicit/blob/66bf6bac369f67e32ddaee099c3198bd30f885a1/crates/amblicit-syntax/src/lawpack_authoring.rs#L1931)).
The second is Echo's compiler-adapter rule
([executable_operation.rs#510:089c849f766d5331835e7d10148a378cdb1237d5](https://github.com/flyingrobots/echo/blob/089c849f766d5331835e7d10148a378cdb1237d5/crates/echo-edict-provider-lowerer/src/executable_operation.rs#L510)).
Together they mean one `jedit.text@1` adapter cannot carry the pure
`replaceRange` profile and a separate create profile for Echo's
compiler-produced path. Both attempts used the lawpack's single adapter; a
second adapter inside `jedit.text@1` is unmeasured.

## Selected artifacts

The 2026-11-10 public run selects Amblicit
`66bf6bac369f67e32ddaee099c3198bd30f885a1`, Echo
`089c849f766d5331835e7d10148a378cdb1237d5`, compiler SHA-256
`12d169ac6d4acccd7dcd614bb9cc11939982c5aa48531a98dc2875936849f872`
and provider-manifest SHA-256
`492b2ac958c49f113500c5b29c12cc41e1b85f4071ef0c9f6424e5aeba3cbe98`.
Both producers were still their remote `main` heads. The basis publishes
`jedit.text@1` at `sha256:f50872ced6d229170258ad145c4d1d14ee341716f5b454ab50a27538787eed0b`,
as before; the effect lawpack publishes at
`sha256:63326eee4303418918f675f4e06bca385b952c4859ffea9b0229ab861ab1c277`.
The eleven-case public report is
`c46c0e50fadf0c48ae0cd33f2dd55c53a814ab7d72477333fa369f38434f8ba8`.

| Case | Source shape | Furthest accepted stage | First refusal |
| --- | --- | --- | --- |
| `effect-linear` | One `createValue` | Verifier | None |
| `effect-repeated` | Two `createValue` in sequence | Target | Provider lowerer: `UnsupportedSemantics`, "operation Core body must contain exactly one node" |
| `effect-branch` | `createValue` inside one `if` arm | Core | Target: `UnsupportedCoreNode`, detail `branch` |
| `effect-loop` | `createValue` inside `for … bounded 2`, then one more | Core | Target: `UnsupportedCoreNode`, detail `for` |
| `effect-nested` | Branch-selected `createValue` inside a bounded loop | Core | Target: `UnsupportedCoreNode`, detail `for` |
| `effect-dynamic-bound` | Loop bound read from input | None | Source type check: `MissingContextFact`, "bounded-loop helper cost requires a resolvable loop bound" |

The accepted linear package is not a generic structured program. Its
`program.kind` is the fixed `anchored-node-attachment-create-if-absent/v1`
intrinsic; its verifier report names Target IR `echo.span-ir/v1`. Its package
is `7efed8094fd8771cfbd7c02d31b882dea845c36f69e726b49f980deabd0b4645` and its
verification report `fc12679ade40f5c3b4c985e6941a7e2d86f93607204bea21c099b97c250b1850`.
The consumer binds that report to the package, its Target IR and its result
projection before any stage is recorded. "Target" and "Core" in the third
column are inferred from the inspected compiler's command order, not from
separately emitted artifacts.

The baseline and three fold controls build, and the four control inputs run
through generic Echo pure evaluation as in every other group. The dynamic fold
still refuses in source checking.

## What is not measured

- **Runtime of the linear effect.** The consumer's runtime witness is pure
  evaluation, which cannot execute an effect. Echo's public
  [`run-edict-operation` command#491:089c849f766d5331835e7d10148a378cdb1237d5](https://github.com/flyingrobots/echo/blob/089c849f766d5331835e7d10148a378cdb1237d5/xtask/src/main.rs#L491)
  is the candidate host witness for this intrinsic package. It was not run.
  Because the package is the fixed create-if-absent intrinsic, running it would
  not test a structured shape.
- **Whether Amblicit's structured `echo.span-ir/v3` lowering accepts these
  shapes.** Every accepted package in this run names `echo.span-ir/v1`, and
  the refusals come from the Target adapter that the selected provider selects.
  Whether PR #272's lowering would admit the effect branch and loop under a
  provider that accepts v3 is unresolved.
- **Component regeneration and full operation.** The provider components are
  the selected checked bytes; regenerating them is unmeasured. No case is a
  ReplaceRange operation.

## Validation and retained evidence

The preceding consumer fails all seven effect assertions and all four effect
admission assertions; it stops at `unsupported inventory group`. Review then
added six admission assertions. Against the consumer at `377e3c5`, a
path that traverses into the basis lawpack and an extra lawpack field on an
effect case were both admitted; the changed bound bytes and a control selecting
the effect lawpack already refused. The extra-field check also runs on a basis
control in every group. The completed consumer passes seven effect assertions
and twenty-six applicable admission assertions in debug and optimized builds;
six assertions for other groups are skipped. Both builds execute the four control inputs with exact and
insufficient budgets and identity/type refusals, and their runtime transcripts
match byte for byte. Rust formatting and Clippy pass. With the same debug and
optimized consumers, the retained draft report `40d6808f…` and primitive report
`71ae4878…` still pass their own stage tests and admission tests.

The complete public snapshot is `jedit-388-effects-v3.tar.gz`, SHA-256
`2790e927531fb51e692f0cd8cf268f02dc2e5c79a27746a0a20a060a1b89872d`.
Debug evidence is `jedit-388-effects-debug-6.tar.gz`, SHA-256
`6406a72e66fa81f232e0d72bf1523da9c915809c0b85e69a10b9f3bfceb7f483`;
optimized evidence is `jedit-388-effects-release-6.tar.gz`, SHA-256
`8c4b3075f9b3048ceb85afc905d635d897b4dbe86f5fc952aebc30c42f28c687`.
The RED runs are `jedit-388-effects-red.tar.gz`, SHA-256
`b5b623842f8cf8610b6bbdd35de14c33254bef2fb7f072cebb1e2ab5b1a2a2fd`, and
`jedit-388-effects-red-report.tar.gz`, SHA-256
`2f822aa36c3f35d57643c55ea19e7848b43875d3fdb600ea64a605bc661122b8`.
The two refused lawpack attempts are `jedit-388-effects-merged-refusal.tar.gz`,
SHA-256 `1a22e33a3f51824926dcdf2d6f1f11fb4b350cfa07728be4b5224a884317d4f4`, and
`jedit-388-effects-v2-refusal.tar.gz`, SHA-256
`eca40949b83b393f4ead2d4928cf08659843180bb5c487dc551f886411872ee9`.
Archives were compared byte for byte with their trees. Verbatim diagnostics
remain outside Git.

## Ownership

[Echo #947](https://github.com/flyingrobots/echo/issues/947) owns structured
bounded effect loops and branches, including repeated effect sites, in the
provider, verifier and runtime. The repeated-effect refusal and the Target
refusals of the branch, loop and nested shapes all fall inside it.
[Amblicit #267](https://github.com/flyingrobots/amblicit/issues/267) owns
lowering bounded `for` loops that emit effects, with the bound charged to the
effect budget; the loop and nested refusals reproduce its stated gap. No open
issue names Target lowering of an effect inside a branch on its own; Echo #947
is its nearest owner.

The two refused attempts show that the rope's effects cannot be added as a
second operation profile on `jedit.text@1`'s single adapter. Whether they
belong in the `replaceRange` profile itself, in a second adapter or in a
separate lawpack is unresolved; each needs a provider path that admits
compiler-produced programs with semantic effects. That authoring decision
belongs to
[Jedit #296](https://github.com/flyingrobots/jedit/issues/296); the provider
path belongs to Echo #947 and
[Echo #684](https://github.com/flyingrobots/echo/issues/684).

The forty-case ReplaceRange acceptance count is still 0/40.
