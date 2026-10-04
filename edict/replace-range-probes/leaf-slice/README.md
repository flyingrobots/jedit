# Authored leaf-byte slicing pressure

`LeafSlice.edict` isolates the byte extraction used by persistent leaf splitting
in [Jim #296](https://github.com/flyingrobots/jedit/issues/296). It is an authored
compiler input, not a completed rope operation or a native callback.

The frozen [fact law](../../../contracts/jedit/lawpacks/replace-range-v1/text-schema-v1.json)
stores a leaf's `blob_id`, `byte_start`, and `byte_length`. The existing
[`locate_leaf_slice` and `make_leaf_slice`](../../../native/jedit-echo-host/src/rope/tree.rs)
first check absolute offsets, extract the half-open byte range, validate UTF-8,
and derive metrics. This source isolates extraction after absolute offsets have
been obtained. It does not decode facts, validate UTF-8, derive metrics, or
publish a new leaf.

The proposed generic primitive is `slice(bytes, start, end)`. Offsets are U64;
the result retains the operand's maximum byte bound and drops any exact-length
refinement. The source requires `start <= end` and `end <= len(bytes)` before
evaluation. Invalid inputs must fail ordinary input constraints, without
clipping, truncation, wrapping, or a host panic. A slice inside a UTF-8 code
point is still a lawful byte slice; Jim's later UTF-8 validation owns rejection
as a text operation.

[`cases.json`](cases.json) records literal future runtime expectations, including
empty, full, interior, binary, Unicode, invalid-range, and U64-limit inputs.
They are not claimed to have executed. The file is a conformance specification, never
an executable lawpack input or a substitute for the retained 40-case rope
oracle.

## Current boundary

Source inspection of Edict main `ac63fe679973e8119244471c124cde44dea5984f`
found no implementation of this primitive. Its closed Bytes prelude currently
provides comparison and length. Its source compiler also rejects Option types,
so the first capability uses explicit range proofs instead of relying on an
unavailable Option result.

The [retained public-build result](evidence/public-build-red.json) uses the
already built experimental compiler `2405a550e93e1e97fff640caa44bbd0f65ffff3c`,
with the unchanged Echo provider from `49e9efb68001dfd78563d18bac9359a87671e431`.
It does **not** use or replace the frozen application's `3f81f759` compiler pin.
The witness checks all 440 copied compiler-source files against their Git blob
identities before and after execution and records the existing binary hash.
It reuses that binary; this run does not reproduce its compilation.

| Authored input | Public build result |
| --- | --- |
| Frozen boundary source | Exit 0; executable package and separate verification report |
| Leaf source with only the `slice(...)` expression replaced by `input.blobBytes` | Exit 0; executable package and separate verification report |
| Exact `LeafSlice.edict` | Exit 2; `ApplicationCompilationFailed`, with `TypeCheck` / `UnresolvedFunction`: `pure helper \`slice\` has no compiler context fact`; no application artifacts |

The primary source diagnostic covers bytes 521–575, the call at line 22. The
following unresolved-binding and return diagnostics are cascading failures.
The paired control proves the range constraints and output shape compile; the
new slice expression is the first missing source capability. Neither control
package was evaluated during this run.

The first harness run incorrectly expected the guarded control to reach a
provider refusal. Its actual successful build disproved that expectation. The
harness assertion was corrected, with no source change, and the full paired
witness passed with `JIM_LEAF_SLICE_SOURCE_BOUNDARY_CONFIRMED`.

The frozen `edict/replace-range/` application, lawpack closure, producer pins,
and artifact locks remain authoritative for the existing pure-boundary witness.
This development source imports the same published lawpack in an isolated copy.
It does not repin or regenerate that application.

## Reproduction discipline

Use copied inputs in the existing guarded project Docker worker. Do not build
another image or use the older probe Dockerfiles as the default recipe: those
historical recipes bake Cargo output into image layers. Reuse the compiler and
provider only after identifying their exact source/build coordinates; retain
outputs outside image layers in the project's bounded owned storage. Follow the
shared lease, disk, memory, process, and log limits before invocation.

Copy this directory and the unchanged application root into the worker, then
run the following command inside the guarded lease. The compiler-source root
must contain the copied `2405a550` tree; the provider root must be the pinned
`49e9efb` package. Use a fresh `work-root` under the existing accounted directory.

```sh
python3 "$PROBE_ROOT/run.py" \
  --compiler "$EDICT_BINARY" \
  --compiler-source "$EDICT_SOURCE" \
  --compiler-manifest "$PROBE_ROOT/evidence/compiler-source.json" \
  --application-source "$APPLICATION_SOURCE" \
  --provider-package "$PROVIDER_PACKAGE" \
  --work-root /tmp/echo-726-runtime/jim-leaf-slice-proof
```

The source manifest is a read-only export of `git ls-tree -r` at `2405a550`,
not a compiler input. Its retained formatting differs from the original run's
manifest, so its raw file digest differs; its commit, tree, 440 paths, and blob
identities are unchanged. Logs and an evidence JSON file remain under the work
root. The runner's log-size check supplements the mandatory external resource
guard; it is not a disk quota or permission to run without the guard.

Passing this refusal witness identifies the compiler boundary. Accepted slice
compilation, independent verification, generic execution of the literal cases,
and complete rope acceptance remain separate gates.
