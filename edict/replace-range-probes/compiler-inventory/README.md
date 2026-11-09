# Re-run the ReplaceRange compiler inventory

## Reachable iterative probes

`iterative.mts` builds the existing flat-text positive control and reachable
authored sources in `iterative/`. The default `controls` group measures scalar,
bounded-list and record-list folds plus a dynamic-bound refusal. Add
`--group lists` to measure nine more list/record/variant shapes, including
composed rebuilding and smaller probes that isolate its provider refusal.
`--group ranges` compares branch guards with an intent input constraint and
an unsafe-addition refusal control.
`--group modules` invokes a fold through two digest-bound source modules and
includes changed-leaf and missing-leaf authentication controls. See
[the source-closure measurement](source-closures.md) for exact evidence.
`--group primitives` measures [arithmetic and byte shapes](primitives.md).
[Upstream reconciliation](upstream-status.md) distinguishes landed prerequisites
from broader open requirements.
This remains a bounded subset of
[DL-0162](../../../docs/design/0162-iterative-rope-capability-inventory.md);
whole-draft closures, structured effects, and remaining composite shapes
remain part of that cycle.

Run inside the admitted guarded Docker worker, with copied sources, the pinned
Node/Rust toolchain, installed Jedit dependencies, and clean selected Amblicit
and Echo checkouts. `EDICT_REPO` and `ECHO_REPO` select those producer checkouts.
The provider directory is an independent byte selection; its file hashes bind
the selected components without claiming that an arbitrary directory was built
from `ECHO_REPO`.

```sh
node edict/replace-range-probes/compiler-inventory/iterative.mts \
  --provider "$ECHO_REPO/schemas/edict-provider/package/v1" \
  --output "$INVENTORY"
```

`INVENTORY` must be a new directory under the worker's accounted data root.
The command builds the real public compiler, republishes the basis lawpack,
pins each authored import to that publication, and retains all source/config,
provider, lawpack, output-package, verifier-report, and diagnostic bytes. The
v3 report records their hashes plus the compiler binary, drivers, and
producer checkout identities. It retains the driver, original fixtures, and
repinned authored sources separately, including each case's full supplied
module graph. Only a completed run receives
`measurement: complete`; producer identity changes leave it incomplete.
A failed baseline invalidates the inventory.
The report deliberately leaves runtime and full-operation evidence unmeasured.
Each case hardlinks dependency files from the retained basis copy. These links
stay within the new evidence directory; external producer files are copied.
The runner rechecks the basis and external selections after the builds. This
reduces physical storage without changing the 20 MiB logical evidence limit.

Record the printed `INVENTORY_REPORT_SHA256`. The separate Rust consumer binds
that exact report, requires complete file inventories, checks each case against
the selected source/provider/lawpack snapshots, requires the application to
select that source graph with its root first, and checks the independent
verifier's package/Target/projection bindings before calling generic Echo pure
evaluation. It checks scalar parity, exact three-item list results, repeat at
observed resource usage, one-unit-short refusals, and invalid identity/input
controls. The budget checks are boundary/metamorphic evidence, not independently
derived absolute cost formulas. No Tick, graph edit, receipt, or rope acceptance
is established by these pure evaluations.

In the same guarded worker, copy `iterative-runtime.rs` to a new owned example
path `xtask/examples/jedit_iterative_inventory.rs` in the selected Echo checkout.
Copy `iterative-evidence.rs` to the new owned module path
`xtask/examples/jedit_iterative_inventory/evidence.rs` and `iterative-lists.rs`
to `xtask/examples/jedit_iterative_inventory/lists.rs`. Also copy
`iterative-stages.rs` to `xtask/examples/jedit_iterative_inventory/stages.rs`.
Copy `iterative-primitives.rs` to `xtask/examples/jedit_iterative_inventory/primitives.rs`.
From that Echo checkout, run:

```sh
cargo +1.96.0 run --locked -p xtask --example jedit_iterative_inventory -- \
  "$INVENTORY" "$EXPECTED_REPORT_SHA256"
```

Use the hash recorded at build completion; do not recompute it after a suspected
substitution. Retain the copied consumer's exact source hash and output, then
remove only those owned example/module copies before another clean-producer inventory.
The source remains in Jedit. Required CI and the broader #388 acceptance checks
remain separate gates.

The consumer prints a separate `STAGE_INVENTORY` JSON record with schema
`jedit.iterative-stages/v1`, bound to the exact v2 or v3 inventory hash. Per-case
source/Core/Target/lowerer/verifier/runtime facts distinguish accepted, refused,
failed, unreached and unmeasured stages. Earlier-stage inference applies only
to the inspected compiler revision; an uninspected revision retains observed
verifier facts without inheriting that inference. Every accepted package,
including the baseline, must bind its verifier report before runtime starts.
Diagnostic metadata and exit codes must corroborate the retained CLI streams.
A failed runtime witness is recorded, and later cases still run. Component
regeneration and full operation remain unmeasured.

From the Jedit checkout, exercise admission against the built consumer:

```sh
INVENTORY_INPUT="$INVENTORY" \
INVENTORY_REPORT_SHA256="$EXPECTED_REPORT_SHA256" \
INVENTORY_RUNTIME="$CARGO_TARGET_DIR/debug/examples/jedit_iterative_inventory" \
INVENTORY_TEST_OUTPUT="$NEW_TEST_OUTPUT" \
node --test edict/replace-range-probes/compiler-inventory/iterative-admission.test.mts
```

`NEW_TEST_OUTPUT` must be a fresh accounted directory. These tests share
unchanged public inputs through hardlinks and atomically replace each candidate
file before a mutation. They retain each altered report/file and process result
without synthesizing Core or packages. Cleanup verifies that original input
bytes never changed and that the restored derivative matches, then removes
only the duplicate working tree.
Use the release consumer path to repeat admission with an optimized build.
The positive-control assertion requires four runtime inputs for `controls`,
thirty for `lists`, seven for `ranges`, six for `modules`, and twenty-eight for
`primitives`. Use the same environment with
`iterative-stage.test.mts` against a `ranges` inventory for stage assertions.
Use `iterative-module.test.mts` against `modules` for authenticated-import assertions.
Use `iterative-primitives.test.mts` against `primitives` for its stage assertions.

The consumer rejects v1 reports: those lack the retained source snapshots and
completion marker required by v2. Historical measurements below retain their
original identities and can be replayed with their matching consumer revision.
The consumer still admits complete v2 single-source reports; v3 requires its
separate source-closure inventory and closure-driver identity.

### List composition and the provider boundary

The expanded fourteen-case report is
`10c208ec142b1118d7197756005b1c7dd3f47dbbab99494669928269283dce17`.
It selects the same Amblicit/Echo/compiler/provider tuple recorded below.
Ten public builds accept, including the baseline; one refuses in source type
checking and three refuse in the provider lowerer.

| Additional reachable shape | Public build | Generic pure runtime |
| --- | --- | --- |
| Guarded list lookup | Accepted | Six empty, valid, end and maximum-index inputs |
| Concatenation | Accepted | Four empty/full combinations, preserving order |
| Record-state fold | Accepted | Two Bool/payload states, exact final records |
| Variant-state fold | Accepted | Three payloads through Pending/Done matching |
| Lookup through record fields | Accepted | Six empty, valid, end and maximum-index inputs |
| Guarded list transfer | Accepted | Five append/full/out-of-range inputs |
| Indexed record fold | `ProviderLowererRefused` | Unreached |
| List-rebuilding fold | `ProviderLowererRefused` | Unreached |
| Rebuilding with nested guards | `ProviderLowererRefused` | Unreached |

The indexed fold is the smaller refusal: a record carries an index, and each
step uses `index < 3` before incrementing it. Guarded selection and transfer
publish separately. Both conjunctive and nested guards refuse in the composed
rebuilding fold. These observations narrow the boundary; the generic diagnostic
does not establish the exact rejected expression or prove that every index
advancement form fails.

| Stage | Evidence for the three provider refusals |
| --- | --- |
| Source / Core / Target | Prior stages passed, inferred from this compiler's command order |
| Provider lowerer | Observed `UnsupportedSemantics` for `core.source-functions` |
| Independent provider verifier | Unreached |
| Published components | Exact checked component bytes selected; regeneration not measured |
| Generic runtime / full operation | Unreached / unmeasured |

The inference uses the pinned public
[application-build path#318:66bf6bac369f67e32ddaee099c3198bd30f885a1](https://github.com/flyingrobots/amblicit/blob/66bf6bac369f67e32ddaee099c3198bd30f885a1/crates/amblicit-cli/src/application_build.rs#L318):
Core compilation and Target lowering precede provider invocation. It does not
claim independently emitted Core/Target artifacts for the refused cases.
[Echo #960](https://github.com/flyingrobots/echo/issues/960) describes related
range-judgment differences for effect programs. The range probes below isolate
a separate branch-context gap; publication of its proposed owner is pending.

The consumer executes 26 new inputs plus the four earlier controls. Each checks
literal expected output, exact-budget replay, three one-unit-short budget
refusals, and a wrong package identity. Twelve additional malformed inputs
refuse (oversized lists, invalid U8 values, and negative U64 indices); the three
earlier malformed-input checks also remain. Debug and optimized results agree.
Six wrong-expectation calibrations, one per new accepted shape, each fail the
named result check before restored GREEN. The earlier consumer first failed the
expanded obligation because it executed only four of thirty required inputs.
These are consumer checks, not repaired compiler/runtime defects.

All fifteen admission tests now pass against this expanded tree in debug and
optimized builds. They include the original ten controls and refusal cases,
unknown groups, mismatched diagnostics/status, a substituted baseline verifier
report, and disabled inference for an uninspected compiler. Full operation
acceptance remains 0/40.

### Range facts and corroborated stages

The twelve-case range report is
`95af84cce76d08c96664b5491ad3b2839f19c87f5baed9fc63cb179f5287def5`.
It uses the same compiler/provider tuple. Five builds accept, two refuse in
source checking, and five refuse in the provider lowerer.

| Range shape | First observed result |
| --- | --- |
| Record fold guarded by `< 3`, `<= 2`, or `== 2` | Provider lowerer refuses all three |
| Scalar helper guarded by `<= 2` | Provider lowerer refuses |
| Inline intent expression guarded by `<= 2` | Provider lowerer refuses |
| Addition under `where input.index <= 2` | Public build and generic runtime accept |
| Unguarded addition | Source `typeCheck/UnsupportedSourceShape` refuses |

The accepted constrained addition maps 0, 1 and 2 to 1, 2 and 3. Inputs 3 and
U64::MAX refuse at `where.0`. All seven runtime inputs, including earlier
controls, agree in debug and optimized builds with exact/insufficient budgets.
The inline branch refusal removes both records and folds from the reproducer;
accepting non-strict comparison operators alone cannot resolve it.

In the pinned lowerer,
[branch predicates#592:089c849f766d5331835e7d10148a378cdb1237d5](https://github.com/flyingrobots/echo/blob/089c849f766d5331835e7d10148a378cdb1237d5/crates/echo-edict-provider-lowerer/src/executable_operation/source_functions.rs#L592)
enter `self.path`, while the
[addition proof#722:089c849f766d5331835e7d10148a378cdb1237d5](https://github.com/flyingrobots/echo/blob/089c849f766d5331835e7d10148a378cdb1237d5/crates/echo-edict-provider-lowerer/src/executable_operation/source_functions.rs#L722)
receives proven predicates, local caps and count bounds. Branch facts do not
reach that call. Runtime support for these refused forms remains unreached.

Four stage assertions first failed against the preceding consumer, then passed
in debug and optimized builds. Two further metadata-tampering tests first
demonstrated invented stage/status claims, then refused after CLI stream
corroboration. All fifteen admission tests also pass on the range inventory.
Deliberately failing the scalar result records a failed runtime witness while
the later constrained-addition witness still succeeds; restoration is GREEN.

### Complete-evidence admission

The v2 report is
`b5bb52568e7958b901ae43baa91b066b5b22400b8ec543009a0ac965074eb02e`.
It selects the same producer tuple below, and all four accepted public
package/report pairs remain byte-identical to v1. The stronger contract changes
evidence admission, not the emitted programs.

Ten admission tests pass in debug and optimized builds. Before the repair, the
unchanged positive control and wrong-report-hash refusal passed, while eight
regressions demonstrated missed refusals: invalid baseline, missing compiler
identity, omitted provider/lawpack files, duplicate paths, incomplete run, and
self-consistent case source/provider substitutions. A case's file hash alone
cannot establish that its bytes match the separately retained selection.

These checks validate retained evidence and metadata consistency. The compiler
binary hash identifies the selected executable; it is not an independent
reproducible-build attestation. Full module closures and the remaining source
shapes remain unfinished #388 work.

### First portable measurement (v1)

The 2026-11-08 checkpoint selects Amblicit
[`66bf6bac`](https://github.com/flyingrobots/amblicit/commit/66bf6bac369f67e32ddaee099c3198bd30f885a1)
and Echo
[`089c849f`](https://github.com/flyingrobots/echo/commit/089c849f766d5331835e7d10148a378cdb1237d5).
The exact compiler binary SHA-256 is
`12d169ac6d4acccd7dcd614bb9cc11939982c5aa48531a98dc2875936849f872`;
the selected provider manifest SHA-256 is
`492b2ac958c49f113500c5b29c12cc41e1b85f4071ef0c9f6424e5aeba3cbe98`.
The retained inventory report is
`a42c204d0c424f33e0c7329bf09bc6f8fa5ac18a6e0db7eb597ccadd6bfb5604`.

| Probe | Public build | Generic pure runtime |
| --- | --- | --- |
| Flat-text baseline | Accepted | Not measured by this consumer |
| Scalar fold | Accepted | Both Bool inputs produce their opposite |
| Bounded-list fold | Accepted | Exactly `[7, 7, 7]` |
| Record-list fold | Accepted | Exactly three `{ index: 7 }` records |
| Dynamic fold bound | `InvalidBound` at `typeCheck` | Unreached |

The public package/report pairs match the preceding exploratory build byte for
byte. Debug and optimized runtime results agree. Changing the consumer's list
expectation from 7 to 8 fails its result assertion; restoring it passes. A
substituted inventory hash refuses before evaluation. This calibrates the
consumer assertion, not a compiler defect. Record-list accumulation does not
yet demonstrate worklist traversal, popping, tree rebuilding, or rope edits.

## Earlier declaration inventory

The reports and commands below describe their recorded historical producer
revisions. They are not current-main capability claims: in particular, the
historical `--source-modules` publisher flag is absent from the Echo revision
selected by the new iterative probes. Use the command above for those probes.

This measured the boundary between authored rope drafts, Core lowering,
provider schema admission, and provider lowering/verification. It does not make
the drafts executable or establish graph effects, rope behavior, or recovery.

The [source-module result](current-source-modules.json) records the exact compiler
commit and observed Echo checkout commit, compiler binary hash, lawpack and
provider manifest hashes,
source hashes, exit codes and structured diagnostics. Each report has 27 results:
the baseline, 21 construct probes, one source module and four whole drafts. The separate
[default-publication control](current-default.json) accepts the function-free
baseline; the source-module candidate accepts five cases. The default publication
rejects function-bearing probes that pass the compiler at schema admission,
before provider execution.
Diagnostic paths in the committed reports are relative to the output directory.
Each rerun writes full case sources and raw JSONL streams into its owned output
directory; these generated case directories are not committed with the summaries.

`echoCheckoutCommit` identifies the clean checkout inspected by the runner. The
`--provider` directory is selected independently: its manifest hash binds the
chosen bytes, while the checkout commit does not attest their source revision.
The recorded snapshots use this label for the original captured checkout value;
their case results are unchanged.

Run with the application's pinned Node and Rust releases, inside the admitted
resource-guarded worker with its existing Cargo target. Set `EDICT_REPO` to a clean
compiler checkout (the repository is now called Amblicit) and `ECHO_REPO` to a
clean Echo checkout. Choose new output paths inside the runner's accounted data
root; the commands compile code and produce test artifacts. Set `JEDIT_ROOT` to
the Jedit checkout root before changing directories.

For source-function and source-module probes, first explicitly generate Echo's
source-module publication from its checked component carriers:

```sh
cd "$ECHO_REPO"
cargo +1.96.0 run --locked -p echo-wesley-gen \
  --example source_functions_publication_witness -- \
  /owned-data/source-modules-provider --source-modules
cd "$JEDIT_ROOT"
node edict/replace-range-probes/compiler-inventory/run.mjs \
  --provider /owned-data/source-modules-provider \
  --output /owned-data/current-source-modules

# Separate control using the checked default publication.
node edict/replace-range-probes/compiler-inventory/run.mjs \
  --provider "$ECHO_REPO/schemas/edict-provider/package/v1" \
  --output /owned-data/current-default
```

The runner builds the public compiler selected by Cargo metadata. It copies the
application into the owned output directory, rebinds its adapter to the selected
provider, republishes the lawpack through the compiler, and uses the resulting
import digest. Every case goes through public application build; no case writes
a package or substitutes a verifier report. An unsuccessful baseline invalidates
the inventory. A source-function probe can fail at provider admission even when
its source compiled successfully, so read its stage and kind rather than treating
all failures as missing language features.

The generated publication is an explicit consumer candidate assembled from
checked components. This run does not promote a checked provider package, prove
component reproducibility, or grant application authority. The default
`schemas/edict-provider/package/v1` publication remains separate; its schema
rejects a Core function table.

Keep unpublished producer measurements in a separately named candidate report;
do not overwrite `current-default.json` or `current-source-modules.json` with
unmerged local changes. The runner records the selected producer commits and
binary/provider hashes, so a candidate result does not become an upstream claim.
For an explicit candidate component pair, use the publisher's paired
`--lowerer-component` and `--verifier-component` paths and retain the designated
build evidence. Selection does not establish independent reproducibility.

The byte-lookup probe returns its exact U8 result. Its older U32-returning form
was sufficient to expose an unresolved `at` on the historical compiler, but
cannot classify a compiler that implements the U8 operation. A composed probe
also applies `at` directly to a raw byte literal, so measuring the prerequisites
separately cannot hide an integration failure.

The upstream snapshots distinguish useful capabilities from remaining blockers:

- The default flat-text reference remains the positive control.
- Unsigned literal addition, byte count, UTF-8 checks and a source-module import
  carrying the correct digest pass public build with the explicit publication.
  The inventory does not test a wrong module digest.
- The `bytes-escapes` and `list-literal` probes reach the candidate provider and
  are refused there. The generic diagnostic does not isolate literals from return
  types or escapes; `count-bytes` contains a byte literal and passes.
- The probes for variants, recursive records/functions, Option, function
  preconditions and typed pure failures refuse before provider invocation.
- Whole drafts fail first at a generic helper or an undigested module import.
  Those first errors do not classify every later construct in each program.

Accepted helper declarations are deliberately narrow evidence: this inventory
has not invoked those helpers at runtime. The complete ReplaceRange gate still needs
execution evidence for its authored program; helper declarations must not replace
the persistent rope with the already proven flat-text reference.

## Unpublished composed byte prerequisites

[Candidate measurement](candidate-composed-bytes.json) selects Amblicit
`9b5ed1a49c84867d6959e20222b827e4fa7d2789` and Echo
`162d14a183312bfadd4fd8abac0c4a4919b51dd7`, a regular merge of the byte-literal
and U8/byte-lookup candidates. The exact compiler binary is
`db47a8e5c13ba5e47a0e7468ea06aebec146409ca378f82dc33146e644594faa`;
selected provider manifest is
`81dabc4af55c459eed6e80ae47a8071d3487a4c3562e13c686d7d4b054683eec`.
This is local candidate evidence, not checked-component promotion or a statement
that these changes are on upstream main.

Nine of 28 public-build cases pass: baseline, raw bytes/escapes, unsigned
addition, U8, count, UTF-8, byte lookup, literal-plus-lookup composition, and the
digest-authenticated source module. Unsafe addition, variants, recursive
records/functions, Option, list length/concatenation, function preconditions,
typed pure failure, division/min/max and generic helpers still refuse in the
compiler. The list-literal helper reaches the provider and is refused there.

The complete drafts still stop first at `contentId<T>` in `Text.edict` or a
missing source-module digest in the other three drafts. Later constructs in
those drafts remain unmeasured by their first failure. The candidate source
and component checks do not establish the rope's oracle agreement, sharing,
effects, admission, recovery or editor cutover. The upstream snapshots above
remain unchanged.


## Authenticated draft source closures

[Follow-up candidate measurement](candidate-authenticated-drafts.json) uses the
same Amblicit `9b5ed1a` and component pair, with Echo witness source `158714ce`.
The component production code remains `162d14a1`; the later commit changes only
the witness selection and its documentation. Nine of 28 cases still pass.

The authored drafts now pin their imported source bytes. `run.mjs` checks those
pins before building and supplies each root's complete source-module closure,
sets its declared package coordinate, and records every source hash. To repin
after an intentional dependency edit, run from the repository root:

```sh
node edict/replace-range-probes/compiler-inventory/draft-modules.mjs --write
node edict/replace-range-probes/compiler-inventory/draft-modules.mjs --check
node --test edict/replace-range-probes/compiler-inventory/draft-modules.test.mjs
```

The tests check an independent compiler digest vector and an actual leaf-source
mutation that must repin both direct imports and the transitive rope import.
These commands do not compile the drafts. The public inventory measures that
separately, preserving the earlier snapshots unchanged.

The next actual parse refusals are `contentId<T>` in Text (line 89), an `else`
inside the reference read expression (line 55), the rope's recursive `depth`
clause (line 24), and the operation draft's enum declaration (line 49). No
missing-digest error remains. Later constructs and schema-2 lawpack resolution
are still unproven; a first parse error cannot classify their support.


## Witnessed boundary helper in the authored closure

[Current draft measurement](candidate-boundary-drafts.json) keeps the same
compiler/component selection and nine of 28 accepted builds. The new
[Boundary module witness](../text-boundary/README.md) separately invokes the
exact Jim-authored character-boundary predicate through public build and the
generic runtime. Its 61 predicate cases and ten refusal controls do not replace
the 40 retained ReplaceRange oracle cases.

Boundary is now a leaf dependency of Text. The pin check and mutation test
propagate changes through Text and Rope into Reference and ReplaceRange, and
every current draft result hashes that full source-module closure. Full Text
still first refuses at `contentId<T>` (now line 90); Reference, Rope and
ReplaceRange retain their `else`, `depth` and enum parser refusals. The older
snapshots above remain unchanged for their named source revisions.


## Acyclic variant declaration graph

[Variant-type candidate measurement](candidate-variant-types.json) selects
Amblicit `da86ed1` and the same Echo source/component publication. Ten of 28
public builds accept: the additional accepted case is the source variant type
declaration. Its exact case and payload graph now enters Core instead of being
rejected before Core; the selected provider accepts that declaration too.

This probe declares an unused variant. It does not construct a variant value,
match one, or exercise variant-valued input/results. Native compiler tests also
cover aliases, original imported module and nominal payload identities,
canonical order independence, and missing/empty/duplicate/cyclic/deep/wide
refusals. At that compiler revision, constructors and matching remain explicit
compiler refusals. Enum
and recursive-variant support are still separate work, and the whole drafts'
first generic/read-expression/depth/enum errors are unchanged. The earlier
snapshots above remain bound to their original compiler/source selections.

## Checked source constructors and the provider boundary

[Constructor candidate measurement](candidate-variant-constructors.json) selects
Amblicit `2e24840` with the unchanged Echo `158714ce` publication. Ten of 30
public builds accept; the two additional cases separate a valid constructor
from an invalid payload. Existing 28-case snapshots remain unchanged.

The valid helper `Probe::Data(value)` with `value: U8` now passes source/Core
checking and reaches `ProviderLowererRefused` for `core.source-functions`.
The diagnostic identifies the checked pure-function profile; it does not
identify which variant type or expression check refused first. This helper is
unused by the baseline operation. No variant-valued package or runtime
execution is established. `Probe::Data(true)` instead refuses during source
type checking with `TypeMismatch` before provider invocation.

The compiler candidate separately checks constructor tags, payload presence,
payload types/bounds, original imported coordinates, exact named union
identity through helper calls, and payload capture/cycles/depth/totality.
Its full local gate passes 1,350 tests with two ignored. This compiler evidence
does not establish Echo admission, execution, wire representation, matching,
recursive variants, or full rope acceptance. The whole drafts' first failures
remain generic `contentId<T>`, read-expression `else`, `depth`, and enum syntax.
