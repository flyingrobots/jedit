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

[`cases.json`](cases.json) records literal runtime expectations, including
empty, full, interior, binary, Unicode, invalid-range, and U64-limit inputs.
They were not executed by the public compiler witnesses below. The file is a conformance specification, never
an executable lawpack input or a substitute for the retained 40-case rope
oracle.

## Current boundary

Source inspection of Edict main `ac63fe679973e8119244471c124cde44dea5984f`
found no implementation of this primitive. Its closed Bytes prelude currently
provides comparison and length. Its source compiler also rejects Option types,
so the first capability uses explicit range proofs instead of relying on an
unavailable Option result.

The [retained public-build RED](evidence/public-build-red.json) uses the
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

## Candidate public build

With Edict [PR #221](https://github.com/flyingrobots/edict/pull/221) at
`0835f398336ce1c693b5531b262228cd909c0b4b`, the **unchanged** source passes the
public application-build boundary with the same frozen provider. Both controls
also pass. The [retained candidate result](evidence/public-build-candidate.json)
records all source and output hashes. The witness checks all 445 compiler-source
files and the existing compiler binary before and after the run.

The actual boundary is further than initially expected: the frozen provider
produces the [executable package](evidence/candidate-artifacts/executable-operation-package.cbor)
and [verification report](evidence/candidate-artifacts/verification-report.cbor).
A separate read-only CBOR inspection observed `outcome: accepted`, zero diagnostic
bytes, the `jedit.text.replace_range@1.sliceLeaf` coordinate, and the explicit
`core.bytes.slice` call in both retained Core and Target. Its
[inspection summary](evidence/candidate-report-inspection.json) records those
observations. This is an inspection of the existing verifier's report, not a
new independent verification implementation or evidence of evaluator support.

| Retained artifact | Raw SHA-256 |
| --- | --- |
| Executable package | `bfacd029cf2dc9247cbcee47d747eca3f8298c7184cac3866eb36f3ab55573c1` |
| Verification report | `943ac86ea20c40d68881cc8413b926f98ba2a4ee99408e3dcede4eead1e7bb86` |

The first candidate harness expected a provider refusal, so it failed its own
assertion after recording the successful builds. That was a harness expectation
mismatch, not a compiler failure. A fresh run with the correct package-boundary
assertion passed with `JIM_LEAF_SLICE_PACKAGE_BOUNDARY_CONFIRMED` and reproduced
identical package/report bytes for all three sources. The original source RED
and both positive controls are preserved.

No evaluator was invoked during these public-build runs. The accepted report
does not establish runtime availability, metering, refusals, or rope behavior.
The separate runtime witness below covers the byte primitive.

The frozen `edict/replace-range/` application, lawpack closure, producer pins,
and artifact locks remain authoritative for the existing pure-boundary witness.
This development source imports the same published lawpack in an isolated copy.
It does not repin or regenerate that application.

## Separate generic runtime witness

[Echo PR #746](https://github.com/flyingrobots/echo/pull/746) at
`bf11732478067e43dda400bab94aa0f6d186b614` consumes the exact retained package
and report. Its evaluator RED failed on the first interior slice with
`UnsupportedProgram`. Generic `core.bytes.slice` support then passed all twelve
literal cases, plus malformed-artifact and exact-budget controls. A test-only
application-name renaming control preserves outputs and costs; no Jim name
selects runtime behavior. Those mutated test controls are not new compiler or
verifier artifacts.

The runtime change passed 40 relevant integration tests, four evaluator unit
tests, strict Clippy/formatting, and 187 routing assertions in guarded Docker.
[The exact test source](https://github.com/flyingrobots/echo/blob/bf11732478067e43dda400bab94aa0f6d186b614/crates/warp-core/tests/edict_byte_slice_tests.rs)
retains literal outputs and bounds. This establishes that generic primitive on
the named candidate; it does not migrate Jim's frozen evaluator pin, complete
rope traversal, or admit an edit with Tick/WAL/receipt/recovery evidence.

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

For the candidate build, use the exact `0835f398` compiler source and existing
binary SHA-256 `a5ffea7b16b641448db4d5dc608bec1539211ab683df3ab78985e12bb1c2fd15`,
select `evidence/candidate-compiler-source.json`, and add `--boundary package`.
That manifest has the same formatting qualification as the RED manifest.
Keep the provider unchanged: its manifest SHA-256 is
`c5b9fb2fe3a0dc4dad282621a97413225c555be0071f3502b3272952069d42dc`.
The runner records its actual hash and refuses mutation during the run.

The public source RED, candidate package construction, and separately named
generic runtime witness are established. Complete rope acceptance and an
explicit consumer migration remain separate gates.
