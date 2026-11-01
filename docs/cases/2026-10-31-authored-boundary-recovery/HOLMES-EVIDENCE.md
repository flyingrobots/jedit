## Baker Street — HOLMES verification (Sonnet 5.5, blind)

**Verdict: APPROVE.** The five inventory JSONs, `candidate-evidence.json` and the changed READMEs and design text support their claims as historical evidence for the named commits. There are four non-blocking wording and provenance notes below. All citations are `file#line@0f7be721`. Only the diff and files at HEAD were read.

I did no hashing, ran no tests, and made no edits. The tool set was read-only, and the parent owns the Docker validation. I did not scan `CURRENT.md`.

### Verdict table

| # | Claim | Result | Evidence |
|---|---|---|---|
| 1 | Composed: 9 of 28 pass | CONFIRMED | `candidate-composed-bytes.json`: 28 `name` rows, 9 `"status": 0`. The passing names are baseline, bytes-escapes, unsigned-addition, u8, count-bytes, utf8, byte-at, composed-byte-lookup and source-module. That is the README's list (`compiler-inventory/README.md#112`). |
| 2 | Authenticated and boundary drafts: 9 of 28 each | CONFIRMED | Both files show 28 names and 9 passes (README#132, #159). |
| 3 | Variant types: 10 of 28 | CONFIRMED | `candidate-variant-types.json` shows 28 names and 10 passes (README#177). |
| 4 | Constructors: 10 of 30 | CONFIRMED | `candidate-variant-constructors.json` shows 30 names and 10 passes. The new rows are `variant-constructor` and `variant-invalid-payload`, both status 2 (README#195). |
| 5 | Commit and binary identity | CONFIRMED | Compiler `9b5ed1a…` and binary `db47a8e5…` are the same in composed, authenticated, boundary and `candidate-evidence.json#4-5`. Variant types use `da86ed1…`, and constructors use `2e24840…`. Echo is `162d14a1` for composed and `158714ce` for the rest. The provider manifest `81dabc4a…` is identical in all five and in `candidate-evidence.json#vendor/provider`. |
| 6 | Valid constructor reaches `ProviderLowererRefused` for `core.source-functions`; `Probe::Data(true)` gives `TypeMismatch` | CONFIRMED | `candidate-variant-constructors.json#108-109` and `#131`. The `list-literal` row in composed (`#311-312`) is the same provider refusal, as README#112 says. |
| 7 | First draft failures: Text `contentId<T>` at line 89, then 90 once Boundary is a leaf | CONFIRMED | `candidate-authenticated-drafts.json#777` has line 89, and `candidate-boundary-drafts.json#778` has line 90. Both show "expected LParen, found Lt". |
| 8 | Reference `else` at line 55, Rope `depth` at line 24, ReplaceRange enum at line 49 | CONFIRMED | `candidate-boundary-drafts.json#819-824`, `#865-870`, `#912-917`. `ReplaceRange.edict#49` reads `type Spine = enum {…}`. The parser message there is only "expected Semi, found LBrace". It does not say "enum", so the README's "enum" is an inference from the source line, and a correct one. |
| 9 | "No missing-digest error remains" | CONFIRMED | `candidate-authenticated-drafts.json` has four `draft-*` rows and none mention a missing digest. |
| 10 | Helper identity: source hash and module digest | CONFIRMED | `Boundary.edict` source hash `e6c94f58…` is the same in `candidate-evidence.json#8` and in the boundary, types and constructors JSONs. Digest `sha256:fabc38f6…` equals the `use module … digest` pin at `draft/Text.edict#6`. I did not recompute either hash. |
| 11 | `inventorySha256` `d0ba1c84…` (`candidate-evidence.json#5`) names the "prior inventory" | CONFIRMED | The retained `composition-evidence-hashes.json#21` assigns this hash to `authenticated-draft-inventory/report.json`. That report has the same compiler, Echo and binary. It is not `candidate-boundary-drafts.json`, and it should not be read as that file. |
| 12 | Evidence selector `447aacab…`, lowerer `648c7c73…` and verifier `7cb2287c…` | CONFIRMED | `jim-boundary-authored-execution.md#30-35` matches `text-boundary/README.md#51` and `candidate-evidence.json#provider`. |
| 13 | Two builds with identical artifacts | CONFIRMED | `candidate-evidence.json#5259-5276` shows two `exitCode: 0` rows with identical package and report hashes (`0743f3c7…`, `abdadf60…`). |
| 14 | Predicate semantics: zero and length are true, beyond the end is false, continuation bytes 128–191 are not boundaries, and a strict guard precedes `at` | CONFIRMED | `Boundary.edict#7-9`. `index == 0 || index == len || (index < len && (at < 128 || at >= 192))`. The design text at `0159…md#242-249` matches. |
| 15 | "61 cases + ten refusal controls" | CONFIRMED | `text-boundary/README.md#62-63` gives four invalid inputs, five ceilings and one package substitution, which is 10. The retained log (`#45-49`) agrees. The log's "15 refusal checks" adds the five retained-input substitutions from README#65-69, so the two figures are consistent. |
| 16 | Strict scoped Clippy passes; the 1,350-test local gate with 2 ignored | UNVERIFIABLE | The Clippy claim appears in the retained log (`#50`). I found no source for 1,350 in the retained logs. Both are third-party or historical, and no test was run here. |
| 17 | Echo `162d14a1` is a "regular merge of the byte-literal and U8 candidates" | UNVERIFIABLE | Echo is outside this review's scope. |
| 18 | The empty-file lock hash `e3b0c442…` in the `vendor` block | CONFIRMED, informational | That value is the SHA-256 of zero bytes, so `.jedit-text.edict-lawpack-build.lock` was empty when it was selected. This is a retained fact, not a defect. |

Drift count is 0 hard, 3 soft (below). I found no reverse drift that would mislead.

### Soft drifts and observations (non-blocking)

1. **"Proven" and "prove" overstate the evidence.** Examples are `compiler-inventory/README.md#157` and `0159-edict-rope-representation.md#249`. The support is 61 differential cases plus 10 refusal controls plus a build, so it is conformance evidence and not a formal proof. The same section adds the correct qualifier that the rope remains unproved. I suggest "tested" or "witnessed" wording.
2. **Present-tense framing risks reading as current acceptance.** Examples are "Current draft measurement" (`README.md#159`), "Boundary is now a leaf dependency", "now enters Core", and `text-boundary/README.md#73-75` ("The guarded helper passes…"). Several sentences are pinned to a commit ("At that compiler revision…", "for their named source revisions"). The opening line in `README.md#64-69` says the section is local candidate evidence and not an upstream claim. I would still add "as of compiler 9b5ed1a" or "recorded" to the unpinned present-tense sentences. This is wording only. The scope is historical, and the files state the commits.
3. **The reproduction recipe depends on non-repo artifacts.** `text-boundary/README.md#27-52` needs `/jim-recovery/...` paths, a sibling Echo checkout and a prior `report.json` plus `basis/`. The repo holds `candidate-evidence.json`, but the recorded hash `d0ba1c84…` points at a report that is not committed in this diff. Anyone relying on the document needs that retained report.
4. `candidate-evidence.json` has no top-level date or commit stamp. That is acceptable since it records its compiler and Echo commits internally.

### Verification checklist

- **Scope read:** done. I read the full diff head (docs and READMEs), `candidate-evidence.json`, the five JSON headers and result tables, `Boundary.edict`, `Text.edict#6`, `ReplaceRange.edict#45-52`, and the retained execution log and hash manifest. I only counted rows in the bulk JSON and did not read it line by line. I did not read the `.mjs` and `.rs` changes closely. They are outside this brief and have no line-count impact on it.
- **Tests read vs run:** read only. The README test claims, the local-gate and Clippy claims and the pin-mutation tests are cited from retained logs and not executed. The parent owns the Docker validation, and I make no claim that tests ran.
- **Correctness:** counts match rows, hashes and commits are consistent across files, and the predicate semantics match the source and the documentation. There are no hard contradictions.
- **Security/integrity:** the evidence binds compiler, prior inventory, source and vendor trees, and double-build artifacts. The pins are digest-authenticated. The one weak spot is that file hashes were checked only by cross-reference, since I could not hash files.
- **Architecture:** Boundary stays a Jim-owned leaf module. The design text says text semantics do not move into Echo and that the witness is not causal admission. This is consistent with `AGENTS.md`.
- **Docs:** the temporal and provenance framing is mostly adequate (soft drifts 1 and 2). The tests-never-read-docs rule is not violated by this diff. I did not check whether the durable-decision owner needed an update, since the 0159 edit appears to be that owner.
- **Limitations:** the docs say the full Text, Rope and ReplaceRange still do not compile (`text-boundary/README.md#81-83`, `README.md#109-113`). The helper is the only newly witnessed unit. Recovered JSON preserves old hashes, and no current-build inference should be drawn.

### VERDICT
- **Decision:** APPROVE for this bounded historical-evidence recovery candidate.
- **Fidelity grade:** A−. Every checkable claim that could be cross-checked was confirmed. The deductions are the "proven" wording and the unqualified present tense.
- **Drift count:** 0 hard, 3 soft.
- **Worst drift:** the "Proven boundary helper" heading and "prove that helper" (`README.md#157`, `0159…md#249`), which describe conformance testing as proof.
- **Blocking issues:** none.
- **Unverified:** the 1,350-test gate, the Echo merge topology, and the file-hash recomputation. Anyone who needs those should confirm them separately.
