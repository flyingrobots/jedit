# Re-run the ReplaceRange compiler inventory

This measures the current boundary between authored rope drafts, Core lowering,
provider schema admission, and provider lowering/verification. It does not make
the drafts executable or establish graph effects, rope behavior, or recovery.

The [source-module result](current-source-modules.json) records the exact compiler
and Echo commits, compiler binary hash, lawpack and provider manifest hashes,
source hashes, exit codes and structured diagnostics. The separate
[default-publication control](current-default.json) accepts the function-free
baseline and rejects source-function tables before provider execution. Diagnostic paths in the
report are relative to the output directory. Each output case retains its full
source and raw JSONL diagnostic streams.

Run with the application's pinned Node and Rust releases, inside the admitted
resource-guarded worker with its existing Cargo target. Set `EDICT_REPO` to a clean
compiler checkout (the repository is now called Amblicit) and `ECHO_REPO` to a
clean Echo checkout. Choose new output paths inside the runner's accounted data
root; the commands compile code and produce test artifacts.

For source-function and source-module probes, explicitly generate Echo's
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
- Unsigned literal addition, byte count, UTF-8 checks and a digest-authenticated
  source module pass public build with the explicit publication.
- Byte literal helpers and list literal helpers reach the provider and are refused
  there; these are not lexer failures.
- Variants, recursive records/functions, Option, function preconditions and typed
  pure failures still refuse before provider invocation.
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


## Proven boundary helper in the authored closure

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
