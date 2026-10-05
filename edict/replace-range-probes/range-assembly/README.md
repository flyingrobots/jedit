# Authored range-fragment assembly pressure

`RangeAssembly.edict` isolates one append step of Jim's native range reader:
[`plan_replace_with_reason`](../../../native/jedit-echo-host/src/rope/replace.rs)
reads current range bytes at line 176 and compares them with replacement bytes
for the no-op decision. [`read_range_bytes`](../../../native/jedit-echo-host/src/rope/window.rs)
at line 136 calls `collect_range`, which visits left before right and appends
each selected leaf slice with `output.extend_from_slice(slice)` at line 244.
These source coordinates are inspected at Jim `0cd880224fafcd1f26f78552e7b34ad170ae6a04`.

The authored operation receives two already selected fragments and joins them
in order with `+`. Each fragment has an eight-byte probe aperture, making the
sixteen-byte summed output bound explicit and testable with literal data.
Those small apertures are specimen bounds, not the application's rope limits.
This is raw byte concatenation: it does not interpret UTF-8, classify no-op,
traverse nodes, prove range length, fold a collection, join tree references,
or publish facts. Those semantics remain Jim-owned authored work under
[Jim #296](https://github.com/flyingrobots/jedit/issues/296) and draft PR #302.

[`cases.json`](cases.json) specifies ten literal outputs and two input-type
refusals. These are future runtime conformance expectations, not executed
results, executable lawpack input, or the full rope oracle. Empty input has
its literal identity result; reversed fragment order changes the expected
bytes; invalid UTF-8 stays bytes. The full-aperture case requires the sum of
both static bounds, not either operand's bound alone.

## Compiler boundary

Inspection of Edict `ac836e5c42a5c47b0dab30cfb0b09848cca73215` found source `+`
dispatched to `check_string_concat`, which rejects non-String operands. The
[public compiler probe](evidence/public-build-red.json) confirms the source
failure below. GitHub merge `0f38fce33c2b8c0cad7bd8aeba110a34c9166a2d` and this
compiler have the identical source tree `dadd4703a9905a37ff366c7134aea5cfe351e2fd`.
The witness explicitly names the built compiler, not a substituted frozen pin.

Two controls replace only the addition expression with `input.firstFragment`
or `input.secondFragment`. They retain both input fields and the declared
sixteen-byte output bound, so their actual build outcomes distinguish missing
byte concatenation from basic field/projection/type-bound failures. The frozen
boundary application is a third positive control.

| Input | Public result |
| --- | --- |
| Frozen boundary source | Exit 0, package and separate report |
| First-fragment-only control | Exit 0, package and separate report |
| Second-fragment-only control | Exit 0, package and separate report |
| Exact `RangeAssembly.edict` | Exit 2, `ApplicationCompilationFailed` with `TypeCheck/TypeMismatch`; no application artifacts |

The primary diagnostic is `string concatenation requires string operands`,
covering source bytes 430–472 at line 19. Later shorthand/return diagnostics are
cascades. [Raw assembly diagnostics](evidence/assembly-stderr.jsonl) and all
control streams are retained unchanged. The successful paired witness ends with
`JIM_RANGE_ASSEMBLY_SOURCE_BOUNDARY_CONFIRMED`. No runtime case was executed.

The guarded worker rebuilt Edict with Rust 1.95.0 from the verified 446-file
source manifest, reproducing binary SHA-256
`a937e6f150f73fa20e9868c84adee0a8270cc62130d4aef18e5b891ec268fee2`.
The frozen provider remains Echo `49e9efb68001dfd78563d18bac9359a87671e431`,
manifest SHA-256
`c5b9fb2fe3a0dc4dad282621a97413225c555be0071f3502b3272952069d42dc`.
Source, binary, application, and provider identities were checked before and
after the public builds. One earlier preflight stopped before compilation
because the preserved `/edict/target` symlink appeared as an untracked file;
its destination was verified as the existing shared target before proceeding.
That setup stop is not the source RED.

The unchanged published lawpack provides the profile and budget. The frozen
application root, producer pins, closure, and artifact locks are authoritative
for their existing witness and are not migrated by this development source.

## Reproduction discipline

Use copied inputs, the existing compiler and frozen provider package, the
shared Docker worker and Cargo target, workstation git-locks admission,
native locks, and the mandatory fail-closed disk/process guard. Record exact
compiler source and binary identities before a build. Keep generated apps,
artifacts, and streams under the owned bounded runtime-data directory. Do not
use historical build-in-image recipes or create another image, worker, or
cache. The twelve runtime expectations require separate generic evaluator
execution after an actual public build succeeds.

Copy both this directory and the unchanged sibling `leaf-slice/run.py`; the
runner reuses that file's public-build and identity helpers. Provide the frozen
application root and provider package as read-only copied inputs, then invoke
inside the admitted guarded worker:

```sh
python3 "$PROBE_ROOT/range-assembly/run.py" \
  --compiler "$EDICT_BINARY" \
  --compiler-source "$EDICT_SOURCE" \
  --compiler-manifest "$PROBE_ROOT/range-assembly/evidence/compiler-source.json" \
  --application-source "$APPLICATION_SOURCE" \
  --provider-package "$PROVIDER_PACKAGE" \
  --work-root /tmp/echo-726-runtime/jim-range-assembly-proof
```

The source manifest is read-only provenance, not executable compiler input.
Use a fresh work-root; retain unique evidence and recycle only owned disposable
copies after export. The runner's stream-size check does not replace the external
disk/process guard. The retained result is a compiler refusal witness, not
byte-concatenation runtime support or complete `ReplaceRange` behavior.
