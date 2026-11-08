# Authored character-boundary helper

[`Boundary.edict`](../../replace-range/draft/Boundary.edict) owns the predicate
used by the rope draft's shared Text module. The full Text module still fails
at its unrelated generic identity helper; this witness compiles the exact
Boundary module through a digest-authenticated source import and calls it from
a test-only pure intent. No native Jedit planner or rope implementation is
linked. The boundary rule is owned by
[DL-0159](../../../docs/design/0159-edict-rope-representation.md#rope-law-and-text-invariants).

Under left-to-right short-circuit Boolean evaluation, the predicate returns true at zero and the byte length, false beyond the end,
and otherwise checks that the byte is outside 128 through 191. A strict
`index < len(bytes)` guard dominates every lookup. The strict guard keeps empty input and
out-of-range U64 lookups unreachable under that evaluation rule. It does
not validate UTF-8; the rope's validity checks remain separate.

## Build and execute

Run inside an existing guarded Docker validation worker, using its existing
target and caches. The inventory directory must contain a completed public
inventory's `report.json` and selected `basis/` publication. The public compiler
binary must match that report's exact hash. The retained historical witness selected
Amblicit `9b5ed1a`, Echo source `158714ce`, and the composed components built
from production source `162d14a1`; these identities describe that measurement, not the current state of upstream
branches or a checked-provider promotion.

```sh
node edict/replace-range-probes/text-boundary/build.mjs \
  --inventory /jim-recovery/authenticated-draft-inventory \
  --compiler /jim-recovery/amblicit-9b5ed1a \
  --output /jim-recovery/jim-text-boundary-green
```

The driver copies the publication, imports the exact helper, invokes the public
compiler twice, and retains unchanged package and independent verifier-report
bytes. Its evidence binds the compiler, prior inventory, source bytes, module
digest, application configuration, every listed file in the vendor/provider trees, and
both builds' artifact hashes. No executable IR or package is synthesized.

Acquire the canonical `git locks` keys for the shared worker and its caches
before running these commands. Use only its isolated validation snapshot.

The standalone Rust consumer uses the selected Echo API as a trusted test host.
Temporarily copy it only into the owned validation snapshot, preserve its source
hash in the validation evidence, and remove that temporary copy after execution:

```sh
(
set -eu
boundary_consumer="$ECHO_REPO/xtask/examples/jim_text_boundary.rs"
test ! -e "$boundary_consumer"
trap 'rm -f "$boundary_consumer"' EXIT
cp edict/replace-range-probes/text-boundary/runtime.rs "$boundary_consumer"
cargo run --locked --manifest-path "$ECHO_REPO/Cargo.toml" -p xtask \
  --example jim_text_boundary -- /jim-recovery/jim-text-boundary-green \
  447aacab9c55838deb0fa6c7c5d2eea9a9f6a84b31379fd2784eb5ad68255589
)
```

The committed [candidate-evidence.json](candidate-evidence.json) is the verbatim
retained `evidence.json`; its SHA-256 is the selector shown above. Its
`inventorySha256` names the prior inventory's external `report.json`, which is
not committed here. Reproduction requires that retained inventory and its
`basis/`, or a newly generated inventory with a newly selected evidence hash.

That external SHA-256 selects this exact compiler evidence; a new compiler,
source, publication or inventory requires inspecting and selecting the new
evidence hash. The consumer verifies selected input and artifact hashes, both
build results, provider approval, package identity and Target IR binding before
calling the generic runtime. Its 61 cases compare every offset of several
valid Unicode strings against Rust's independent `str::is_char_boundary`,
cover literal raw-octet boundary cases, empty input, U64 maximum and 1 MiB
input boundaries. Repeated execution must preserve output and accounting.
Four invalid input cases, five resource ceilings and package substitution
must refuse. This is private computation evidence, not causal admission.

`check-retained-inputs.mjs RUNTIME OUTPUT EVIDENCE_SHA256` first executes the
positive cases, then changes the helper, provider component, package, verifier
report and evidence bytes one at a time in an owned temporary copy. All five
substitutions must refuse before a runtime success marker. The retained
original evidence remains untouched, and the temporary copy is removed.

The build driver records `echoCheckoutCommit` as an observed checkout, not a
provider-source attestation. It accepts the historical inventory's `echoCommit`
label for reproduction, normalizes that observation, and rejects missing,
malformed or contradictory compiler/checkout identities. Historical evidence
JSON remains unchanged.

## Evidence boundaries

The original `where` form refused in source parsing. The recorded compiler/runtime pair passed
two public builds with identical artifacts, runtime conformance cases, and
strict scoped Clippy. These are historical validation results, not a current
compiler build or a formal proof. The consumer checks listed input files; it
does not reject additional files in those directories. Text delegates to this exact imported helper, and the
draft pinning tool propagates Boundary edits through Text and Rope into their
dependents. Earlier inventory snapshots remain exact evidence for their older
source revisions; the current snapshot is linked from the inventory README.

These 61 predicate cases are not the retained 40 ReplaceRange oracle cases.
Full Text/Reference/Rope/ReplaceRange compilation, schema-2 identity and
lawpack resolution, structural sharing, effects, admission, Tick/WAL/receipts,
recovery and production editor integration remain open.
