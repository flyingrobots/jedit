# WATSON — blind first deposition

I read this as the intended reviewer would. That reader knows Jim and Edict, is skeptical, and has no other testimony. I ran no tests, builds or hashes, and I wrote no plan file because this is a read-only review. Everything below comes from reading the diff and the files at `0f7be721`.

## Clarity grade: B

The diff is honest about its scope. Nearly every new paragraph says the whole Text, Rope and ReplaceRange drafts still don't compile. The helper-versus-rope boundary is stated repeatedly, and I never mistook it for a full rope. The grade drops because the evidence trail has loose ends, the docs are layered chronologically, and a few words say more than the evidence does.

## What I could confirm by reading

- **Case count.** The 61 predicate cases add up exactly in `runtime.rs`: 48 string cases, 8 raw-octet cases and 5 ceiling cases (`runtime.rs#L1-L304` in the diff, `edict/replace-range-probes/text-boundary/runtime.rs#L1-L304@0f7be721`). The refusal tally also matches the prose: 4 invalid inputs, 5 resource limits and 1 identity case make the "ten refusal controls".
- **Accepted-build counts.** Counting `"status": 0` in the retained JSON gives 9 for `candidate-composed-bytes.json`, `candidate-authenticated-drafts.json` and `candidate-boundary-drafts.json`, and 10 for `candidate-variant-types.json` and `candidate-variant-constructors.json`. That matches the README's "nine of 28" and "ten of 28/30". The 28 case names in the boundary inventory also add up, and the nine accepted ones are the nine the README names.
- **First-refusal lines.** The README's "line 90, 55, 24, 49" matches the diagnostics in `candidate-boundary-drafts.json#L778`, `#L824`, `#L870` and `#L917@0f7be721`. The Text line moved from 89 to 90 because exactly one import line was added above `contentId` (`Text.edict#L6,#L90@0f7be721`).
- **Module digest.** The Boundary digest `sha256:fabc38f6…c971` is the same in `Text.edict#L6@0f7be721` and in `text-boundary/candidate-evidence.json` (`helperModuleDigest`). The helper source hash `e6c94f58…` is the same in the evidence file and in `candidate-boundary-drafts.json`.
- **Doctrine update.** The canonical owner is updated: DL-0159 gains the predicate paragraph (`docs/design/0159-edict-rope-representation.md#L241-L249@0f7be721`).
- **Helper logic.** `Boundary.edict#L6-L10@0f7be721` is the claimed rule: true at 0 and at the length, otherwise the byte is outside 128–191. A `<` guard sits before the lookups. The runtime cases cover empty input, `u64::MAX` and 1 MiB, so safety does not rest only on short-circuit evaluation.

## Stumble list

1. **Orphaned evidence file (biggest stumble).** The README tells the reader to pass `447aacab…` as "that external SHA-256" (`text-boundary/README.md#L51@0f7be721`). Nothing links it to the committed `candidate-evidence.json`. A grep for `candidate-evidence` finds no reference anywhere in the repo.
   - **Commands.** The commands use `/jim-recovery/...` paths that exist only on the recovery host.
   - **Reproduction.** A reader can't tell whether the committed file is the verbatim `evidence.json` that hashes to `447aacab…`. The parent should hash the file to check, and the README should say so.
2. **"Proven" and "prove" overstate the evidence.**
   - **Where.** The heading "Proven boundary helper in the authored closure" is at `compiler-inventory/README.md#L157@0f7be721`. DL-0159 says the witness will "prove that helper separately" (`0159-edict-rope-representation.md#L248-L249@0f7be721`).
   - **What was actually done.** The evidence is a finite conformance witness: 61 cases, with exhaustive offsets over eight short strings plus a few ceiling cases. The README itself says "conformance witness".
   - **Why it matters.** DL-0159 is the canonical doctrine owner, so "prove" there will be read as a formal claim. "Total" is a universal claim that no case list establishes.
3. **Layered, chronological READMEs.** `draft/README.md` now holds five stacked sections, each narrowing the last: historical, byte candidate, authenticated imports, boundary helper, variants. The unpublished-byte-candidate section also says "the original upstream measurements below remain pinned" (`draft/README.md`), while the inventory README says "snapshots above". I had to rebuild "what is true now" by reading every layer. The `docs/method/documentation-lifecycle.md` rule that obsolete documents are deleted, not kept as history, pulls the other way. Keeping the snapshots is defensible because they are pinned evidence, but a single "current state" table would stop the reader hunting.
4. **Assertions with no retained artifact.**
   - **Unretained validation.** The README says the helper "passes public build twice … actual runtime execution, and strict scoped Clippy" (`text-boundary/README.md#L75-L78`). The build and runtime parts have retained evidence JSON, but no Clippy log or Docker validation log is in the diff. I take it as an assertion that the parent must own.
   - **Native tests.** The line "Its full local gate passes 1,350 tests with two ignored" (`compiler-inventory/README.md`, constructor section) is a compiler-repo claim outside this repo and can't be checked here.
5. **"Complete vendor/provider input trees" is stronger than the code.** `selected_pair` only checks the files the evidence lists (`runtime.rs#L110-L123` in the diff). An extra file dropped into `vendor/` or the provider directory would not be detected. That is a small gap for a test-only consumer, but the README sentence reads as complete-tree integrity.
6. **Weak coverage assertion.** `main` only requires `count >= 40` (`runtime.rs#L300`) while the docs claim exactly 61. Only `check-retained-inputs.mjs` asserts the exact string "61 cases".
7. **New checks are not wired in.**
   - **What CI runs.** The only compiler-adjacent CI step I found is `proof-harness.spec.mjs` (`.github/workflows/ci.yml#L247`).
   - **What is missing.** `draft-modules.test.mjs`, `draft-modules.mjs --check`, `check-retained-inputs.mjs` and the Rust consumer appear in no script, workflow or `docs/method/ci.md`. `run.mjs` does enforce the pin check at startup.
   - **What follows.** `AGENTS.md` says tests are spec, and an unwired stale-pin check will rot silently. The README documents the repin commands, and the exemption for the Rust consumer (which needs an external Echo checkout) is not stated.
8. **Smaller points.**
   - `Rope.edict#L210-L229@0f7be721` still names a parameter `at`, the same identifier as the byte-lookup builtin `at`. `Text.edict` was renamed to `index` and Rope was not. It's harmless while the drafts don't parse, but it's the collision the rename avoided.
   - The compiler-inventory README mentions "Amblicit (formerly Edict)" without saying what that means. Three different Echo SHAs (`162d14a1`, `158714ce`, `9c32e0b5`) appear in separate roles; the "production vs witness" distinction is explained once in the authenticated-drafts section only.

## Plans versus shipped truth

The docs do tell plans from fact. Unfinished work is consistently labelled as open (effects, admission, recovery, the editor cutover, enum and recursive variants). The text-boundary README closes with "Full Text/Reference/Rope/ReplaceRange compilation … remain open."

The remaining tense inflation is "proven/prove" and "total" (stumble 2) and "complete trees" (stumble 5). The `PROPOSED` comment removal in `pinnedDrafts` is silent, which is fine.

## Verification Checklist

- **Scope read.** Done: all 21 changed paths, with the bulk JSON sampled by targeted greps (counts, commits, hashes, first-refusal lines) and not read in full. Not done: I did not recompute any hash and I did not scan `CURRENT.md`.
- **Tests read versus run.**
  - **Read:** `draft-modules.test.mjs`, `check-retained-inputs.mjs` and `runtime.rs`.
  - **Run:** none, by me. I make no claim that anything passes. Parent-owned Docker validation is outstanding.
- **Correctness.** `Boundary.edict` matches its stated rule. `pinnedDrafts` gets the dependency order right, and `draftSourcePaths('ReplaceRange')` returns exactly the list the test asserts. I found no logic defect in the new source. The JSON counts and line numbers match the prose.
- **Security and integrity.**
  - **Pinning:** the digest pinning, the compiler and provider hash checks, and the refusal of substituted inputs are present.
  - **Gaps:** extra files in the vendor or provider trees go unnoticed, and the `>= 40` bound is loose. Nothing here touches production paths.
- **Architecture.** This is probe and test scaffolding under `edict/replace-range-probes`, with no runtime coupling and no native planner. `draft-modules.mjs` and `build.mjs` use bare numeric literals (such as 120000 and 2_097_152) and string literals. That looks acceptable for scripts outside the TS ratchet, but I can't confirm the quality gate's scope by reading.
- **Docs.** DL-0159 is updated in the same change, which is the durable-decision requirement. There are no dangling file links among those I checked. Defects are the orphaned evidence file, the "prove" wording and the layering.
- **Limitations.** The diff states them well. For me the open limitations are that I ran no builds and verified no hash, and that the Clippy, Docker and 1,350-test claims are unretained or external.

## VERDICT

```
reviewer: WATSON (Sonnet 5.5), blind first deposition
pinned: 0f7be721603d1d356f41d057a29806ff74afc45c  base: cfcd0baa
clarity_grade: B
decision: REQUEST_CHANGES  (small, docs-only; no source defect found)
blocking:
  1. Link candidate-evidence.json to the 447aacab… hash, or say it is not that file;
     the README's reproduction command is not traceable from the repo.
  2. Replace "Proven"/"prove"/"total" with "conformance-witnessed" wording in
     compiler-inventory/README.md#L157 and 0159-edict-rope-representation.md#L248.
non_blocking:
  3. Wire draft-modules --check/test into CI or docs/method/ci.md, or state why not.
  4. Fix "complete vendor/provider trees" wording or add an extra-file check.
  5. Add a current-state summary atop draft/README.md; fix "below"/"above".
  6. Retain or cite the Clippy and Docker validation log; do not rely on assertion.
tests: none run by this reviewer; parent owns Docker validation
not_claimed: any build of whole Text/Rope/ReplaceRange; any current-build inference from old JSON
```

## Second Deposition — The Repair Menu

# WATSON — second deposition: the Repair Menu

I read `HOLMES-SOURCE.md`, `HOLMES-EVIDENCE.md` and `MORIARTY.md` in full. I ran nothing. I confirmed one claim myself: `build.mjs#70@0f7be721` reads `prior.echoCommit`, and `compiler-inventory/run.mjs#128` writes only `echoCheckoutCommit`. A grep found no other reader or writer of either field.

## Adjudication

- **Verdicts.** HOLMES-SOURCE said REQUEST_CHANGES. HOLMES-EVIDENCE said APPROVE. MORIARTY said APPROVE, conditional on three Docker checks.
- **The conflict is resolved by reading depth.** HOLMES-EVIDENCE says it did not read the `.mjs` and `.rs` files closely, so it could not see the field drift. HOLMES-SOURCE read them and found it. I rule for HOLMES-SOURCE on that point.
- **My earlier gaps.** My first deposition missed the field drift. It also said the runtime cases mean "safety does not rest only on short-circuit evaluation". That was loose, and MORIARTY's A1 is the correct framing (see "Is 'total' supported?" below).
- **MORIARTY's conditions.** Parent replays cover conditions 1 and 2: the pin check and tests pass, and `candidate-evidence.json` hashes to `447aacab…`. Condition 3 is still open. It asks for `shasum -a 256 edict/replace-range/draft/Boundary.edict` to equal `e6c94f58…`, and the parent has not mentioned it.
- **Blocking:** R1 to R4 below, plus MORIARTY's condition 3. Everything else is follow-up.

## Is "total" supported?

Two claims are being treated as one, and they should not be.

- **Code reasoning.**
  - **The case split.** `Boundary.edict#6-10` splits every input into four classes: `index == 0`, `index == len`, `index < len`, and `index > len`. Only the `index < len` class reaches `at(bytes, index)`. Under lazy left-to-right `&&` and `||`, every lookup is in range and the function returns a Bool for all `Bytes<max=1048576>` and all U64. That is a short, sound argument, but a conditional one.
  - **The assumption.** It depends on short-circuit evaluation surviving lowering to the Echo evaluator. No document in this repo states that semantics (my grep for short-circuit and lazy found nothing in `edict/` or `docs/`), and under eager evaluation `at(bytes, index)` runs for `index > len` and would trap.
- **Finite sample.**
  - **What was run.** The 61 cases, replayed by the parent, exercise every class. They include empty input, `len+1`, `u64::MAX` and a 1 MiB input, and the oracle agrees at each point.
  - **What it shows.** The one compiler and runtime pair under test behaves lazily on those inputs. It does not prove the semantics in general. The oracle comparison covers valid UTF-8 plus 8 of 256 raw byte values.
- **Formal proof.** Nobody has produced one, because it would need a written Edict semantics.
- **Wording I would defend.** "Defined for every bounded byte input and U64 offset, assuming left-to-right short-circuit evaluation. Witnessed by 61 differential cases and 10 refusal controls on the recorded compiler and runtime." Do not use "proven", "prove" or an unqualified "total".

## Repair Menu, ranked by yield per effort

| # | Type | Edit | Effort | Priority |
|---|---|---|---|---|
| R1 | Bug | See below. | S | Blocking |
| R2 | Claim | See below. | XS | Blocking |
| R3 | Claim | See below. | XS | Blocking |
| R4 | Evidence | See below. | XS | Blocking |
| R5 | Doc | See below. | XS | Recommended |
| R6 | Process | File a GitHub issue to wire `draft-modules.mjs --check`, `draft-modules.test.mjs` and `check-retained-inputs.mjs` into CI. Add a line to `docs/method/ci.md` only when wired. | XS to file, M to build | Follow-up |
| R7 | Test | Add a guard-removal mutant: build `Boundary.edict` without `index < len(bytes) &&` and confirm the runtime refuses it. This tests the laziness assumption directly. | M (Docker) | Follow-up |
| R8 | Hygiene | See below. | S–M each | Follow-up |

**R1 (bug), `build.mjs#70`.**
- Read the Echo identity under the current key, `echoCheckoutCommit`, and throw if it or `compilerCommit` is missing or not 40-hex.
- Add a regression that feeds a minimal `report.json` to `build.mjs` or to an extracted function. Assert a defined 40-hex Echo identity, and a throw when the field is absent.
- **Trap.** The README's reproduction command names `/jim-recovery/authenticated-draft-inventory`. That report predates the rename and, from the `echoCommit` header in `candidate-authenticated-drafts.json`, appears to carry `echoCommit`. A strict fix would break the documented command on its own named input.
- **Decision for the parent.**
  - **Option A:** accept the legacy key explicitly and record which one was used.
  - **Option B:** document that the command needs a post-rename inventory.
  - **Recommendation:** Option A, with no silent fallback. Ordinary `??` chaining would blur the distinction commit `f14fe2c` introduced.
- **Evidence output.** Keep the evidence output key and schema `jedit.text-boundary-witness/v1` as they are, because `runtime.rs` checks that string and the retained `447aacab…` evidence stays valid. If the parent renames the output key, bump the schema and have the consumer accept both.

**R2 (claim).**
- Change "Proven boundary helper in the authored closure" in `compiler-inventory/README.md#157`.
- Change "prove that helper separately" in `0159-edict-rope-representation.md#248-249`.
- Use the wording above and the "witnessed" language.

**R3 (claim), `text-boundary/README.md#37`.** Change "complete vendor/provider input trees" to "every listed file in the vendor and provider trees". `runtime.rs#110-125` never notices an extra file, so enforcing completeness is a code change for a later issue.

**R4 (evidence).** Add to `text-boundary/README.md` that `candidate-evidence.json` is the retained `evidence.json`, with SHA-256 `447aacab…` (the parent verified this). Also say the `inventorySha256` `d0ba1c84…` names a `report.json` that is not committed.

**R5 (doc).**
- Add the short-circuit assumption as a comment in `Boundary.edict` and in the DL-0159 paragraph. If the comment changes the source bytes, the module digest and the pins must be regenerated, so prefer the DL-0159 and README placement.
- Record MORIARTY's A3: the old `where at <= len` obligation became a total predicate, and `Rope.edict#209-213`'s callers lost the compile-time check.

**R8 (hygiene), from the testimonies.**
- Wrap the README `trap` recipe in a subshell and name `git locks` for the Echo checkout.
- Run the second build from a clean output directory (HOLMES D3).
- Bind `vendor/` to the inventory (D2).
- Add negative tests for the unreached refusal branches (D1).
- Make `draft-modules.mjs` throw on a `use module` coordinate missing from its table (B4).
- Rename the `Rope.edict` `at` parameters, which shadow the `at` builtin.
- Stop at the minimum for this candidate: nothing in R8 is blocking.

## Verdict

```
decision: REQUEST_CHANGES until R1–R4 land and the Boundary.edict hash
          (e6c94f58…) is confirmed; then APPROVE on re-read
approved: no unwritten repair
fatal strikes: none
tests run by this reviewer: none
parent evidence taken as reported: pin tests 2 pass, 61-case replay + 5 substitutions pass,
          candidate-evidence.json = 447aacab… (I have not read the logs)
```
