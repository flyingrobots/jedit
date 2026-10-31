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

The probes distinguish useful current capabilities from the remaining blockers:

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
has not invoked those helpers at runtime. The next ReplaceRange step must add
execution evidence and preserve the authored-source boundary; it must not replace
the persistent rope with the already proven flat-text reference.
