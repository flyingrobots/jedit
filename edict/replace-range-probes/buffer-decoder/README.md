# Buffer decoder: authored decimal transitions

This is incomplete Jim-owned codec work for [#296](https://github.com/flyingrobots/jedit/issues/296), retained in draft [#302](https://github.com/flyingrobots/jedit/pull/302). The intended outcome remains decoding the actual retained Buffer atom and deriving its canonical Head and version before the ReplaceRange basis check. The frozen application and producer pins remain unchanged.

[`Decimal.edict`](Decimal.edict) specifies an unsigned JSON-number transition for the Buffer codec: decimal digit recognition, no leading zeros, delimiters left unconsumed, checked multiplication/addition, and the schema's U8 or U64 limit. It accepts internal scanner state and a byte token. These are **not operation inputs or authoritative caller-supplied decoded fields**. The enclosing scanner must own the limit, obtain tokens from actual retained bytes, and start at `Start`.

[`cases.json`](cases.json) contains handwritten literal expectations, including 255/256, U64 maximum, and both addition/multiplication overflow. They remain an unexecuted conformance specification. `End` stops before its delimiter; `More` at end-of-input is incomplete. Whitespace can terminate a number, but the enclosing scanner must decide its encoding policy. These transitions neither impose canonical Buffer bytes nor implement the whole JSON grammar.

## Observed public compiler boundaries

The [original result](evidence/original/public-build.json), assembled sources, raw JSONL streams, positive-control artifacts, compiler-source manifest, and failed wrapper evidence are preserved. The authored source is unchanged from that run, SHA-256 `9fc1b006c298866463ab83a28fcb1e54769b970970c571f11d0868d79edc6d87`.

| Input | Actual public build result |
| --- | --- |
| Unchanged atom-read control | Exit 0; package and separate verification report, no diagnostics |
| Read control with one unused identity function declaration | Exit 2; `InvalidApplicationSource`, `ExpectedToken`, `expected type, enum, or intent declaration` at `fn`, bytes 151–153; no application artifacts |
| Read control with the authored decimal declarations | Exit 2; `InvalidApplicationSource`, `Lex`, `invalid string escape`, bytes 861–862 at the carriage-return escape; no application artifacts |

These are distinct boundaries. The lexer processes the source before declaration parsing, so the decimal source stops at its `b"\r"` spelling; it did not reach the function-declaration diagnostic. The trivial function control independently establishes that missing parser production. Neither refusal establishes function-body typing, arithmetic, Option proofs, byte-literal support beyond the observed point, lowering, or evaluation.

The original harness incorrectly expected `ApplicationCompilationFailed` for both negative controls. It wrote all three actual results and completed its input/source/binary integrity checks, then failed the `fn-control` assertion. The [guard log](evidence/original/guard.log), [result](evidence/original/guard.result.json), [launch contract](evidence/original/guard.launch.json), [lock receipt](evidence/original/git-locks-receipt.jsonl), and [original runner](evidence/original/run.py) retain this wrapper **exit 1**. No success marker was produced. Correcting the expectations does not turn that historical run green.

The current runner distinguishes the observed diagnostic kinds and rejects changes to the authored source, read-control source, or provider file hashes. It also requires the exact historical compiler-source manifest and an explicitly pinned compiler binary. The corrected source reproduction described below passed. The original outputs remain evidence of the three compiler invocations inside a historically failed witness harness.

The first corrected-run attempt stopped before compilation or any application-build invocation. Rust 1.95.0 was absent, and invoking it began an automatic toolchain download; the external resource guard stopped the attempt when accounted data exceeded the project limit. The [attempt log](evidence/resource-stop/guard.log) and [launch contract](evidence/resource-stop/guard.launch.json) are retained. The [controller observation](evidence/resource-stop/observer-record.json) records 4,325,788,505 data bytes against the 4,294,967,296-byte limit; it is explicitly observer-authored from the displayed exception, not raw controller stdout. The [cleanup transcript](evidence/resource-stop/partial-toolchain-cleanup.txt) and [subsequent usage](evidence/resource-stop/after-cleanup-usage.json) record removal of only the new partial toolchain/downloads. This resource stop is neither a compiler RED nor a corrected-harness result.

## Corrected source reproduction

The [corrected witness](evidence/reproduction196/public-build.json) passed with wrapper exit 0 and `JIM_BUFFER_DECIMAL_DISTINCT_SOURCE_BOUNDARIES_CONFIRMED`. Its [build/run log](evidence/reproduction196/guard.log), [launch contract](evidence/reproduction196/guard.launch.json), [guard result](evidence/reproduction196/guard.result.json), assembled sources, raw streams, and read-control artifacts are retained separately from the original failure.

The exact same 449-file compiler source was rebuilt with the already installed Rust 1.96.0 (`ac68faa20c58cbccd01ee7208bf3b6e93a7d7f96`) in the reusable worker and stable target. The resulting CLI SHA-256 is `83c70b3fdbb42ac43f0967a0c559c0cc8b66599987774a40412bda4fbc028d36`; this explicit pin was passed to the runner. It reproduces the source boundaries with a different compiler binary, not the historical Rust 1.95.0 binary.

All three assembled source hashes match the original run. The read-control package and report are byte-identical to the originals. The negative cases retain the same kinds and source spans, with raw stderr hashes differing because the diagnostic paths name the new work root. Source, binary, application, and provider integrity checks completed. The executed runner matches checked-in `run.py`, SHA-256 `0d6f644eeccd8acbd0841f7c5420bd0d5353a55948471d3ed13f24618d5e0868`.

This is a successful reproduction of one public-build control and two expected source refusals. No decimal case, scanner, rope algorithm, evaluator, or broader Jim application suite ran in this replay.

## Exact inputs and artifact identities

The experiment used compiler commit `17397e2aad18a83ffc617d1afd628764501f49cd`, tree `bcfd3112cd8b3d4630738a88761860679b45714b`, rebuilt with Rust 1.95.0 in the existing guarded Docker worker. All 449 compiler-source files were checked against the [Git blob manifest](evidence/compiler-source.json) before and after the public builds. Its raw manifest SHA-256 is `625592ab9dd715349255bece0133378c64b3d4539fb50e437d116c2a4296f016`; the compiler binary SHA-256 is `e2700698829b03f437c66425ed9878b002ef7a34ac183a39bac4eaf6a758cc6d`.

The separate read-capable provider is pinned by its complete file-hash map in the result. Its [manifest](evidence/provider-manifest.echo.json) has raw SHA-256 `5b38ae704a071b88aa0cc2f85020de41cb69e76d037afe3592a4d319e22587c8`. Lowerer and verifier component hashes are respectively `4b594a8165079f0a973741b9e27b468cf041f4ad53108fccae641dc35355bd2a` and `d0be4d283399aefc45d75b395b3568f9983521ca5543c9dfd23b9495758050ed`. This witness records those exact package bytes; it does not claim to reproduce their component builds or independently establish their source commit.

The retained read-control [package](evidence/original/read-control/application/executable-operation-package.cbor) has SHA-256 `afd931700018312d6c0d1e249871313d2c21c0ece1ae41d1f17f2be7af9e5284`; its [report](evidence/original/read-control/application/verification-report.cbor) has SHA-256 `9114fdd983d456eb83f69969475f558b6e608be23520212a5db5f26bb095d04b`. These artifacts were produced only for the unchanged read control. No decoder package was emitted and no evaluator was invoked.

## Source contract and composition obligation

The source follows the documented direction for non-recursive, first-order pure `fn` declarations, byte literals, checked arithmetic, and guarded Option handling. The observed failures show that the executable compiler subset is narrower. The experiment uses Edict's public application build; it supplies no native decoder, invented intrinsic, or handwritten Core/Target IR.

The public application format accepts one source module. The experiment inserts the exact helper declarations into the retained [control](control/src/ReplaceRange.edict) before its first type declaration. The unchanged operation does not call the helpers. The assembled sources are retained alongside their diagnostics. Merely accepting unused declarations would not prove executable functions or a decoder.

[Edict #226](https://github.com/flyingrobots/edict/issues/226) owns the full source-function compiler and semantic-contract prerequisite. [Echo #752](https://github.com/flyingrobots/echo/issues/752) depends on it for generic function admission and execution in both pure and bounded-read programs. Their acceptance must exercise called bodies, evaluate arguments once, preserve lexical scope and conditional evaluation, and enforce bounded costs through compiler-produced packages and separate verification. These are outstanding obligations, not capabilities established by this declaration-only probe. Jim #296 continues to own the actual retained-byte scanner and complete rope operation.

The next authored work must scan actual Buffer `FactBytes`: variable-length UTF-8 key and optional path, JSON escapes, exactly 32 decimal head bytes, and version. It must preserve fields needed for encoding and derive the basis from retained state. Immutable list-only statement loops currently provide no result-producing accumulator; bytes are not an iterable List, and no generic fold is implemented. A one-byte `slice` retains the source maximum and drops exact/minimum length, so the `JsonByte` input requires a justified narrowing path. Source aliases, variants, Option, and checked arithmetic also remain separate compiler/evaluator obligations. Function parsing alone cannot complete this scanner.

Native references are [`BufferFact` and its codec](../../../native/jedit-echo-host/src/records.rs), [`plan_replace_with_reason`](../../../native/jedit-echo-host/src/rope/replace.rs), and the [frozen schema](../../../contracts/jedit/lawpacks/replace-range-v1/text-schema-v1.json). Native Buffer reads do not perform the retained Head's universal decode/re-encode/content-identity checks; preserve that distinction. NoOp must precede version/sequence overflow. Full replacement still requires pending intermediate split facts, canonical identities, write ordering, atomic settlement, all forty oracle cases, and recovery.

## Reproduction

Use the existing shared guarded Docker worker and stable Cargo target under workstation git-locks admission. Do not rebuild or start a worker merely to repeat this historical observation. The corrected runner reuses the portable public-build functions in `../leaf-slice/run.py`. Copy this probe, that helper, and the retained control into the accounted worker input tree. Supply the exact compiler-source and provider identities above. By default the runner requires the historical Rust 1.95.0 binary hash. If that binary is unavailable, a controlled rebuild of the same source with an already installed toolchain may supply its own explicit `--compiler-sha256` pin. Retain the build command, toolchain version, source checks, and actual binary hash; such a run reproduces the source boundary, not the historical compiler binary. A self-reported hash alone does not establish which source built a binary. Run inside the guarded lease:

```sh
python3 "$PROBE_ROOT/run.py" \
  --compiler "$EDICT_BINARY" \
  --compiler-sha256 "$EDICT_BINARY_SHA256" \
  --compiler-source "$EDICT_SOURCE" \
  --compiler-manifest "$PROBE_ROOT/evidence/compiler-source.json" \
  --application-source "$PROBE_ROOT/control" \
  --provider-package "$PROVIDER_PACKAGE" \
  --work-root /tmp/echo-726-runtime/jim-buffer-decoder-reproduction
```

The work root must be absent. The runner validates input hashes, records separate case outcomes, and expects `JIM_BUFFER_DECIMAL_DISTINCT_SOURCE_BOUNDARIES_CONFIRMED` only after all assertions pass. That marker describes successful reproduction of compiler refusals, never a working decoder. The external guard must enforce the project build/data/log budgets and stop the owned process group on timeout or monitoring failure; the runner's per-process timeout is not a disk quota. Older probe Dockerfiles that bake build output into images are historical recipes.
