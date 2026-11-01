# HOLMES review: authored-rope recovery candidate

**Scope.** Read-only review of `feat/authored-iterative-rope` at `0f7be721`, base `cfcd0baa`. I read the executable files and checked their callers and the retained evidence structure. I ran nothing, so every runtime and test claim below is read from source, not observed. Citations are `file#line@0f7be721`. Paths are under `edict/replace-range-probes/` unless they start with `draft/`.

## Verdict table

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | The pin graph matches the actual imports. | CONFIRMED | `compiler-inventory/draft-modules.mjs#9-12@0f7be721` against `use module` lines in `draft/Text.edict#6`, `Rope.edict#13`, `Reference.edict#13` and `ReplaceRange.edict#15-16`. |
| 2 | Transitive repinning works, in topological order. | CONFIRMED (by reading) | `draft-modules.mjs#24-38` (pins computed from already-pinned dependencies). `draft-modules.test.mjs#27-38` asserts this. It was not run. |
| 3 | `draftSourcePaths('ReplaceRange')` returns `[ReplaceRange, Text, Boundary, Rope]`. | CONFIRMED | I traced the depth-first walk in `draft-modules.mjs#42-53`. It matches `draft-modules.test.mjs#37-38`. |
| 4 | The checked-in pins are consistent with each other. | CONFIRMED | `Rope.edict#13`, `Reference.edict#13` and `ReplaceRange.edict#15` all carry `240bf409…`. `Text.edict#6` carries `fabc38f6…`, which equals `helperModuleDigest` in `text-boundary/candidate-evidence.json#9`. |
| 5 | The pin values equal the real source digests. | UNVERIFIABLE | I have no hashing tool. `draft-modules.mjs --check` is the authority. It is not wired into any automated gate. `run.mjs#14-17` enforces it only at probe time. |
| 6 | The digest agrees with the compiler's independent canonical-CBOR vector (`b69a636a…`). | UNVERIFIABLE | `draft-modules.test.mjs#10-14`. It needs execution. |
| 7 | The `Boundary.edict` predicate equals `str::is_char_boundary` for valid UTF-8. | CONFIRMED | `draft/Boundary.edict#6-10`: true at 0 or `len`, false beyond, otherwise byte `<128` or `>=192`. This is the same rule as Rust's. |
| 8 | The strict `index < len` guard dominates every lookup, including on empty input. | UNVERIFIABLE | This depends on Edict `\|\|`/`&&` short-circuit semantics, which I cannot see. `runtime.rs#186-196,214-220` would exercise it (index `len+1`, `u64::MAX` and empty input), but I did not run it. |
| 9 | The runtime test has "61 cases". | CONFIRMED | Offset cases are 3+5+5+7+6+11+6+5 = 48 (`runtime.rs#185-198`). Raw-octet cases add 8 (`#200-212`) and ceiling cases add 5 (`#214-223`), giving 61. `check-retained-inputs.mjs#26` and `text-boundary/README.md#58` agree. |
| 10 | Retained-input verification is bounded and refuses path escape. | CONFIRMED | `runtime.rs#14-23` (`symlink_metadata`, `is_file`, 2 MiB cap, re-checked after read). `#112-118` accepts only `Normal` path components. `build.mjs#62` throws on non-regular inputs. |
| 11 | The package, report and Target IR are bound before the runtime is called. | CONFIRMED (by reading) | `runtime.rs#126-163`: a report hash check against the evidence artifacts, then the package digest and the Target IR identity. |
| 12 | The build driver refuses compiler substitution, provider substitution and an existing output directory. | CONFIRMED | `build.mjs#19,23,35`. The provider hash is checked on the copy, not the source. |
| 13 | The build is run twice and its artifacts compared. | CONFIRMED, with a caveat | `build.mjs#77-106`. The caveat is item D3 below. |
| 14 | The evidence records the Echo commit. | **DRIFT** | `build.mjs#70` reads `prior.echoCommit`. The current runner writes only `echoCheckoutCommit` (`compiler-inventory/run.mjs#128`, and `compiler-inventory/README.md#20`). Against a fresh inventory the value is `undefined`, and `JSON.stringify` silently drops it. `echoCommit` survives only in the old retained JSON (`candidate-evidence.json#7`, `candidate-*.json#4`). |
| 15 | The evidence binds the "complete vendor/provider input trees". | **DRIFT** (minor) | `text-boundary/README.md#37`. `runtime.rs#110-125` verifies only the entries listed in the evidence. An extra file added to `vendor/` or the provider tree is not detected. |
| 16 | All five substitutions refuse. | CONFIRMED (by reading) | `check-retained-inputs.mjs#27-47`: each case appends a byte to a copy, expects exit 1 and the reason string, and restores the file in `finally`. I traced all five against the order of checks in `runtime.rs`. |
| 17 | `byte-at` and `composed-byte-lookup` probes now use the correct return type. | CONFIRMED | `run.mjs#74-75` (the `U32` to `U8` fix). |
| 18 | `run.mjs` refuses stale pins, existing destinations and dirty producer checkouts. | CONFIRMED | `run.mjs#14-17`, `#35` (non-recursive `mkdirSync`), `#28-32`. |
| 19 | Whole Text, Rope and ReplaceRange do not compile. | CONFIRMED (framed honestly) | The drafts are full of `PROPOSED` constructs (`Rope.edict#24,125,127,147`, `ReplaceRange.edict#110,113`). The READMEs and file headers say "Not compiled". This is PLANNED, not a defect. |
| 20 | The Docker or Echo toolchain gate passes. | UNVERIFIABLE | The parent owns it. `runtime.rs` is built only by copying it into the Echo `xtask` examples (`text-boundary/README.md#45-51`). |

## Drift count and worst drift

There are 2 DRIFT rows (14 and 15). The worst is row 14: the stale `echoCommit` field name.

- **Mechanism.** It is a provenance tool reading a field its sibling stopped emitting. The evidence is still "valid" JSON and still hashes consistently. It just omits the Echo checkout identity.
- **History.** Commit `f14fe2c` deliberately renamed that field to `echoCheckoutCommit` ("without claiming provider provenance"). `build.mjs` was not updated.
- **Why nothing catches it.** No test covers the `build.mjs` to `run.mjs` schema handoff, and `runtime.rs` never reads the field, so a missing identity passes silently.

## Reverse drift (reality the target does not mention)

- **D1. Untested refusal branches.** `runtime.rs#147-163` (package/report mismatch, Target IR mismatch) have no negative test. A byte-append mutation is caught earlier by artifact-hash binding, so those branches are unreachable from `check-retained-inputs.mjs`. The `Probe.edict`, `edict.application.json` and `vendor/` substitutions are also not mutation-tested. Only 5 of the bound inputs are exercised.
- **D2. Vendor not bound to the inventory.** `build.mjs#31-33` copies `vendor/` from the basis without comparing it to the report's `lawpackSha256` (`run.mjs#131`). `selectedInputs.vendor` then records whatever was copied. The `providerManifestSha256` check at `#35` is the only content check.
- **D3. Repeat build is not clean-room.** `build.mjs#77-99` runs both builds in the same output directory. If build 1 returned 0 without rewriting artifacts, stale build-0 bytes would be hashed and "repeat is identical" would hold vacuously. This is CONJECTURE. An experiment would run build 1 into a removed `outputDirectory`.
- **D4. Inconsistent failure path.** `build.mjs#94-95` throws on a verifier refusal before `evidence.json` is written. Other failures write evidence and set `exitCode` 1 (`#100-104`). The behavior is still fail-closed.
- **D5. Draft-level failure handling.** `Rope.edict#56` declares `idOf … fails ClosureTooSmall`. `ReplaceRange.edict#145,147,156,161` call it with no `expect` or `else`. `rope.isCharBoundaryIn` and `rope.rangeBytes` (also `fails`) are used in `require … else <other obstruction>` at `#122-126` with no `ClosureTooSmall` mapping. The drafts are uncompiled and `PROPOSED`, so this is low severity, but it contradicts the file's own `expect` convention.
- **D6. No total-size cap in the rope path.** `Reference.edict#72` enforces `maxReferenceBufferBytes`. `ReplaceRange.edict#101` bounds only the replacement, and the `+` operations are marked "needs checked +". Any cap would live in the lawpack, which I did not inspect.
- **D7. Test coverage of the pin tool.** `draft-modules.test.mjs` does not test the refusals: the import-count check (`draft-modules.mjs#31`) or the unknown-draft check (`#43`). It also does not test `--check` or `--write`.

## Verification checklist

- **Scope read.** All eight in-scope executable files read in full: `draft-modules.mjs`, its test, `run.mjs`, `build.mjs`, `check-retained-inputs.mjs`, `runtime.rs`, and `draft/{Boundary,Text,Rope,Reference,ReplaceRange}.edict`. I also checked `text-boundary/README.md`, the `candidate-evidence.json` header, and the import exports in `scripts/deps/echo-edict-relock.mjs` and `tests/compiler.mjs`. The historical candidate JSONs were not audited, per the instructions. I did not read other reviewers' testimony.
- **Tests read vs run.**
  - Read: the 2 `node:test` cases in `draft-modules.test.mjs`, the mutation harness in `check-retained-inputs.mjs`, and the positive and negative cases in `runtime.rs`.
  - Run: none.
  - Specifically unrun: the unit tests, the retained-input check, `runtime.rs`, strict Clippy, the Docker gate.
- **Correctness.** The pinning graph, path ordering, boundary predicate and case arithmetic hold up on reading. The one defect is row 14. D5 is a latent draft inconsistency. The rope algorithm in `Rope.edict` is plausible on trace: AVL join and split, relative offsets in `rangeBytesBranch`, and the closure selector. I found no logic error, but it is uncompiled and untested, so I make no claim beyond that.
- **Security and integrity.**
  - Strengths: new-output-only, compiler and provider hash binding, path-traversal and symlink refusal, bounded reads, resource-limit and package-substitution negatives, fail-closed exit codes. The evidence hash is supplied out of band (CLI argument).
  - Weaknesses: row 14 (Echo identity can be silently absent), row 15 and D2 (non-exhaustive input binding), D3 (repeat-build weakness).
- **Architecture.** This is probe and tooling code outside the app core. It respects the "no IR synthesis" boundary (`build.mjs#3`). Every file is far below 500 lines. There is no `any` or `unknown`. The `.mjs` files contain many literals (timeouts, byte caps), which sit outside the TypeScript quality-gate scope as far as I can tell. I did not check the gate configuration.
- **Docs.** The READMEs mostly state the limits honestly. They say the full Text module still fails, that the work is a private computation witness and not causal admission, and that Text/Rope/ReplaceRange compilation remains open. The doc/code drift is the "complete input trees" wording (row 15) and the `echoCommit` field name used by the retained evidence. No test reads documentation, which is consistent with the repo rule.
- **Limitations.**
  - I cannot recompute SHA-256 pins or run any code.
  - The Edict short-circuit semantics are unknown to me.
  - The retained old logs were not read.
  - Historical JSON hashes say nothing about current builds.
  - This candidate does not provide whole Text, Rope or ReplaceRange compilation, structural sharing, effects, admission, Tick/WAL/receipts, or recovery. The READMEs say so.

## Fidelity grade: B−

Most claims check out and the framing is honest about what does not compile. The deductions are one real provenance-schema bug, one overstated binding claim, and several untested refusal paths.

## Required changes

1. **Fix `build.mjs#70`.** Read `prior.echoCheckoutCommit`. Then make the driver throw if any of `compilerCommit` or the Echo identity is `undefined`, so a silently missing identity cannot recur. A test that feeds a minimal `report.json` through `build.mjs`, or through a small extracted function, would pin the handoff. The retained candidate evidence (`447aacab…`) uses the old field and is not affected by the fix.
2. **Fix the wording in `text-boundary/README.md#37`.** Either narrow it to "every listed file", or make `runtime.rs` also refuse unlisted files in the vendor and provider trees.

Strongly recommended, but not blocking: run the build twice from a clean output directory (D3), and bind `vendor/` to the inventory (D2).

## VERDICT

```
VERDICT: REQUEST_CHANGES
Scope:            bounded recovery candidate (helper + pin tooling + probes), not a rope implementation
Fidelity:         B-
Drift:            2 (worst: build.mjs#70 echoCommit vs run.mjs#128 echoCheckoutCommit)
Confirmed (read): 14   Unverifiable: 5   Planned: 1
Tests:            read only; none run by this reviewer
Blocking:         (1) stale echoCommit field, silent omission of Echo identity
                  (2) overstated "complete input trees" binding claim
Non-blocking:     D1-D7 above
Re-review:        one-line fix plus wording fix; the rest is sound on reading
```

I made no modifications, ran no tests, and took no external actions.
