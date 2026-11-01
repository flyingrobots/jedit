# Baker Street review: MORIARTY, native Claude Sonnet 5.5 (blind)

**Pinned evidence:** `jedit-authored-rope@0f7be721`, base `cfcd0baa`. Citations are `path#line@0f7be721`. For new files the line numbers come from diff offsets, so treat them as approximate (±1).

**What I did:** I read the diff's source, docs and Rust consumer in full, plus callers in `Rope.edict`, and grepped `package.json`, the quality gate and CI for wiring. I ran nothing, and I did not read the bulk JSON beyond a few header grep hits.

## Verdict

**APPROVE**, conditional on the parent confirming three items in Docker (below). I found no fatal or high-severity strike. This is a bounded recovery candidate with honest limits. Its main weakness is that nothing automated gates it, and a few claims are worded more strongly than the evidence supports.

## Vector A: "the predicate is total and every lookup is guarded"

Claims: `edict/replace-range/draft/Boundary.edict#6-9@0f7be721`; `docs/design/0159-edict-rope-representation.md` (added paragraph near #241).

- **A1, Medium: guard dominance rests on short-circuit evaluation.** The `at(...)` calls sit behind `index < len(bytes) &&`. Dominance holds only if `||` and `&&` short-circuit left to right, and I found no Edict spec text for that in the repo (grep for "short-circuit" in `edict/**` and `docs/**` found nothing). The only evidence is runtime behavior at length+1, `u64::MAX` and empty input (`text-boundary/runtime.rs#183-215`). **CONJECTURE:** an eager lowering would trap out of range on a different compiler revision. **Experiment:** build a mutant that drops `index < len(bytes) &&` and confirm the 61-case run refuses it. No committed negative control proves the guard is necessary.
- **A2, Low–Medium: "total" and "proven" are sampled, not proved.** The consumer uses 8 strings, 8 raw bytes and 5 ceiling points. The raw-byte oracle covers 8 of 256 values, and the offset sweeps do not reach the 1 MiB length. The inventory README heading "Proven boundary helper", and DL-0159's "prove that helper separately", are conformance language, not proof. The same text carries a caveat ("complete rope remains unproved"), which softens this.
- **A3, Low–Medium: the `where at <= len` precondition became a total predicate.** The pre-diff compile-time obligation is gone. `Rope.edict#209-213@0f7be721` (`boundaryAtOrBefore`) ends in an unconditional `at - 3u64`. For `at > len`, every `isCharBoundary` now returns false, so the function silently returns `at - 3` instead of the caller having to prove `at <= len`. I could not construct a reachable subtraction underflow: `at` of 1 or 2 resolves to 0 before `- 2`/`- 3`. It is dormant while the rope does not compile. Record it as a rope obligation. DL-0159 describes the predicate as total but does not say the callers' proof duty moved.
- **Failed attacks:**
  - The 61-count is correct: sweep `(len+2)` summed over lengths 0, 2, 2, 4, 3, 8, 3, 2 gives 40; plus 8 `u64::MAX` cases, 8 raw bytes and 5 ceiling cases, for 61.
  - The raw-octet oracle matches the stated rule (<128 or ≥192).
  - The `Text.edict#102-103` delegation is faithful.
  - The `at` identifier is a real builtin, covered by the `composed-byte-lookup` probe in `run.mjs`.

## Vector B: provenance, pins and evidence binding

- **B1, Medium: nothing gates the new checks.** `package.json` `test:all` globs only `spec/**` and `tests/**`. The quality gate scans `src`, `spec` and `tests`. `docs/method/ci.md` and `.github` do not mention `draft-modules`, `text-boundary` or `compiler-inventory`. Staleness of the committed digest pins (`240bf409…`, `b32d0b34…`, `fabc38f6…`) is enforced only if someone runs `run.mjs` or `--check` by hand. The repo's "tests are spec" and "CI describes what it runs" doctrine is satisfied only on paper.
- **B2, Medium: the evidence root of trust is operator-supplied and not reproducible from the repo.**
  - `text-boundary/README.md#51@0f7be721` hard-codes `447aacab…` as the external hash.
  - Nothing in the repo shows that `candidate-evidence.json` hashes to it. My grep found that hash in the README only.
  - Reproduction needs `/jim-recovery/...` paths, unpublished Amblicit `9b5ed1a`, Echo `162d14a1`/`158714ce`, and an external Echo checkout.
  - DL-0159, a durable decision document, links to this witness. It is honestly labelled "unpublished candidate", but a reader outside this machine cannot reproduce it.
  - **CONJECTURE:** the committed `candidate-evidence.json` hashes to `447aacab…`. **Experiment:** `shasum -a 256` on it.
- **B3, Low: the consumer's provider/vendor binding is attestation, not enforcement.**
  - `selected_pair` (`runtime.rs#80-140`) re-hashes only the files recorded in `evidence.json`. A file added to `vendor/` or `.build/echo-provider` goes undetected.
  - It never re-runs the compiler, and `evidence.json` and the package sit in the same directory, so the CLI hash is the only anchor.
  - `check-retained-inputs.mjs#27-32` mutates the lowerer component only. The verifier component, vendor lawpack and manifest are not exercised, though the "five substitutions" are categories.
- **B4, Low: `draft-modules.mjs#9-15` hard-codes the dependency and coordinate tables.** A new `use module` line for a module not in the table is silently left unpinned, and `--check` cannot detect it. The mutation test covers only the known graph.
- **B5, Low: the pin and witness digest share one implementation.** `sourceDigest` is used both to write the pins and (via import) in `build.mjs`. The independent canonical-CBOR vector test (`draft-modules.test.mjs#12-15`) mitigates this.
- **Failed attacks:**
  - `Boundary.edict` file hash `e6c94f58…` appears identically in `candidate-boundary-drafts.json#763,809,855,901` and in `candidate-evidence.json`.
  - Pin ordering is valid: Map insertion order is Boundary, Text, Rope, Reference, ReplaceRange, and each dependency is pinned before its dependents.
  - `draftSourcePaths` ordering is asserted in the test.
  - The transitive repin is tested.
  - Path traversal and symlinks are blocked: only `Component::Normal` is accepted, and `symlink_metadata` plus `is_file` rejects symlinks.
  - The compiler binary and provider manifest hashes are compared against the prior report before the build (`build.mjs`).
  - The output directory must be new.
  - Nonregular inputs throw.

## Vector C: tense inflation and silent downgrade

- **C1, Low: "authored" and "executed" read broader than the evidence.** What ran is a test-only probe intent (`build.mjs#27-34`, `profile text.replaceRange … basis none`) calling the helper through an unpublished compiler. The READMEs say so ("private computation evidence, not causal admission"), but the draft README line "Text delegates to this exact imported helper" is true only at source level. The full `Text.edict` still fails to parse at `contentId<T>`, so the delegation has never been compiled or executed.
- **C2, Low: counts shift between sections.** They are consistent (9/28, 10/28, then 10/30 after two new `run.mjs` cases), but a reader must track compiler commits `9b5ed1a`, `da86ed1` and `2e24840` per section. The "Historical upstream result" retitling and the "supersede only what they measure" caveat handle this well.
- **C3, Low: the README Rust consumer recipe.**
  - `trap 'rm -f …' EXIT` fires at shell exit if the block is pasted into an interactive shell. That would leave `xtask/examples/jim_text_boundary.rs` in the Echo checkout.
  - The recipe also mutates a repo outside this one without mentioning `git locks`. Your global instructions require `git locks` for shared resources.
- **Failed attacks:**
  - Whole-program limits are stated repeatedly and consistently ("whole drafts do not compile", "no rope/effect/admission/recovery/editor acceptance").
  - Counts of 9 and 10 passing cases match the case lists.
  - The constructor section separates the provider refusal from the source `TypeMismatch`.

## Vector D: doctrine, architecture and scope

- **D1, Low: probe tooling has literals that a gated file would have to name.** `build.mjs` uses `120000` and `2 * 1024 * 1024`; `runtime.rs` has `2_097_152`, `1_048_576` and similar. The gate does not scan `edict/`, so this isn't a gate violation. It does conflict with the "no magic numbers/strings" doctrine if these files are ever pulled into scope.
- **Failed attacks:**
  - No `any`, `unknown` or TypeScript is added.
  - Every new file is well under 500 lines (`runtime.rs` is 304).
  - Boundary is a leaf module, so the hexagonal direction is fine.
  - Tests do not read documentation: the new `.mjs` files read `.edict` sources and temp fixtures, not docs.
  - DL-0159, the canonical owner, is updated in the same change.
  - The diff adds no runtime code to the editor.

## Severity summary

| ID | Severity | Finding |
|---|---|---|
| B1 | Medium | New checks not wired into any test script, quality gate or CI |
| B2 | Medium | Evidence anchor is operator-supplied and not reproducible from the repo |
| A1 | Medium | Short-circuit assumption is unspecified, with no negative control |
| A2, A3 | Low–Medium | "Proven"/"total" language outruns sampled evidence; the precondition-to-total change shifts a rope obligation |
| B3, B4, C1, C3, D1 | Low | See above |

**Resilience grade: B−.** Eleven or more attacks were attempted and about eight failed, so the claims are well bounded. The grade drops for the unwired, un-reproducible evidence chain.

## Verification checklist

- [x] **Scope read:** Diff source, docs, `.mjs`, `.rs` and the Edict drafts. Callers in `Rope.edict`, `Reference.edict` and `ReplaceRange.edict` checked. Bulk JSON not audited line by line; header fields and the `Boundary.edict` hash sampled.
- [x] **Tests read vs run:** `draft-modules.test.mjs`, `runtime.rs` and `check-retained-inputs.mjs` were **read only**. I ran none, and the historical JSON proves nothing about the current build.
- [x] **Correctness:** The predicate matches its spec and the case arithmetic is right. A1 and A3 are noted.
- [x] **Security/integrity:** Substitution refusals, path and symlink guards, and hash binding are sound. The residual gaps are B2–B4.
- [x] **Architecture:** Boundary is a leaf module and Text delegates to it. No doctrine violations in gated scope.
- [x] **Docs:** DL-0159 is updated, with claims that are honest but a bit strong ("Proven", "prove").
- [x] **Limitations:** Whole `Text`, `Rope` and `ReplaceRange` still do not compile. This candidate has no admission, effects, sharing or recovery evidence. All of this is stated in the documents.

## Required before merge (parent, in the guarded Docker worker; I did not run them)

1. `node edict/replace-range-probes/compiler-inventory/draft-modules.mjs --check` and `node --test …/draft-modules.test.mjs` pass.
2. `shasum -a 256 edict/replace-range-probes/text-boundary/candidate-evidence.json` equals `447aacab9c55838deb0fa6c7c5d2eea9a9f6a84b31379fd2784eb5ad68255589`, or the README states which retained file does.
3. `shasum -a 256 edict/replace-range/draft/Boundary.edict` equals `e6c94f58f16eba252d16865c4c167ff2d0917618abd7dd33a4a326c57ac5549f`.

## Non-blocking follow-ups

- Rename "Proven" to "Witnessed".
- Add an issue for wiring the pin check and test into CI.
- Add a guard-removal mutant to the witness.
- Fix the `trap` recipe.

```
VERDICT: APPROVE (conditional on the three required checks above)
Strikes landed: 11 (0 fatal, 0 high, 3 medium, 2 low–medium, 6 low)
Resilience: B-
Tests run by reviewer: none
Blocking issues: none
```
