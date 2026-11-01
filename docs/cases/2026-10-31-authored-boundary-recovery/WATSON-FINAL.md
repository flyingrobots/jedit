# WATSON — final deposition on `93fbad26`

**Decision: APPROVE for the exact candidate `93fbad2620b0b4d9cd2066bb9d8a868f5f93ecb8`.** My review of `0f7be721` stays on record as historical. The blocking findings I raised then are superseded as follows.

## Prior findings

| Prior finding | Status | Evidence |
|---|---|---|
| R1: `build.mjs` read `echoCommit` while the runner wrote `echoCheckoutCommit` (HOLMES-SOURCE row 14) | **Resolved** | See below. |
| R2: "Proven" and "prove" wording | **Resolved** | See below. |
| R3: "complete vendor/provider input trees" | **Resolved in prose, not in code** | See below. |
| R4: orphaned `candidate-evidence.json` | **Resolved** | `text-boundary/README.md` now says the file is the verbatim retained `evidence.json` and that its SHA-256 is the selector. It says `inventorySha256` names an external `report.json` that isn't committed, and that reproduction needs the retained inventory. |
| R5 / A1 / A3: short-circuit assumption and the caller obligation | **Resolved** | See below. |
| CI wiring (B1, R6) | **Resolved** | See below. |
| Trap recipe (C3) | **Resolved** | The README recipe is now wrapped in a subshell `( … )`, and a `git locks` instruction is added. |
| MORIARTY condition 3 (`Boundary.edict` hash) | **Resolved** | `authored-recovery-final.log` shows `e6c94f58…` for `Boundary.edict` and `447aacab…` for `candidate-evidence.json`. |

**R1 detail.**
- `inventory-provenance.mjs#L4-L16` returns the `echoCheckoutCommit` key when it is present, even if its value is `undefined`. A present-but-undefined key therefore cannot fall back to `echoCommit`, because the guard is `Object.hasOwn`.
- It falls back to the historical `echoCommit` label only when the new key is absent. It requires both identities to be 40-hex, and it throws if a present `echoCommit` disagrees.
- `build.mjs#L24,#L72-L74` spreads the result into `selectedInputs` and keeps `echoCommit` as an alias. The v1 fields are kept and a key is added. `runtime.rs` indexes only the fields it names, so the extra key is harmless.

**R2 detail.** The "Proven boundary helper" heading is now "Witnessed" (`compiler-inventory/README.md`). DL-0159 now says "exercise that helper separately with finite conformance cases". A grep for `Proven`, `prove that`, `is total` and `total on its` across the changed docs, drafts and scripts finds no remaining instance.

**R3 detail.** `text-boundary/README.md` now says "every listed file" and states that the consumer does not reject additional files. `runtime.rs` is unchanged, so this is honest prose, not new enforcement.

**R5 detail.**
- **Docs.** The predicate is described as "defined … under left-to-right short-circuit evaluation" in DL-0159, the helper README and the draft README. DL-0159 adds that callers' range obligations are not discharged, naming `boundaryAtOrBefore`.
- **Source.** `Boundary.edict` itself carries no assumption comment. That is deliberate and correct, since editing it would change `e6c94f58…` and every pin.

**CI wiring detail.** `ci.yml#L235-L239` runs both test files and `draft-modules.mjs --check` after `npm ci`. `cbor-x` is a declared dependency (`package.json#L43`). `docs/method/ci.md` describes the step and says the retained runtime replay stays a manual Docker witness, not CI.

## Is "defined for every input" now supported correctly?

The docs now separate the two claims I asked them to separate, and neither is overstated.

- **Code reasoning.** The four-way case split is sound if `&&` and `||` are lazy and left-to-right. The docs state that condition.
- **Finite sample.** The 61 cases are described as conformance, on the recorded compiler and runtime. Nobody claims a formal proof, and the docs say so.
- **Still unverified.** The assumption has no written Edict semantics behind it and no guard-removal negative control. The docs flag the dependence honestly. I do not count the missing control against this candidate, and I do not claim it was tested.

## What the logs establish

| Log | I read | It shows |
|---|---|---|
| `authored-provenance-red.log` | yes | Tests 1 and 3 fail, test 2 passes. Test 1 gets `echoCheckoutCommit: undefined` against `9c32e0b5…` from `current-source-modules.json`, which is the HOLMES-SOURCE bug. Test 3 shows "Missing expected exception." |
| `authored-provenance-green.log` | yes | 3 of 3 pass. |
| `authored-recovery-final.log` | yes | 5 of 5 pass (digest vector, transitive repin, three provenance tests). It ends with the two hashes. |
| `authored-recovery-retained-replay.log` | yes | Five `RETAINED_INPUT_REFUSED` lines and `JIM_TEXT_BOUNDARY_INPUT_BINDINGS_OK 5 refused substitutions`. |

Three limits on that evidence:
- **RED stub not on record.** The RED log does not show which implementation the helper had when it failed, so I take "expected RED" from the parent's account and the failure shape.
- **Replay log lacks the 61-case marker.** The retained-replay log does not print `JIM_TEXT_BOUNDARY_RUNTIME_OK 61 cases`. `check-retained-inputs.mjs` asserts that string before any substitution case, so the 5 refusals imply it, but the log doesn't show it.
- **Silent steps.** The pin check and the syntax check produce no output in the final log, so I can't distinguish a pass from a skipped step. I rely on the parent's statement that they passed.

## Verification Checklist

- **Scope read.** All of `authored-recovery-repair.diff`. The actual files read were `inventory-provenance.mjs`, its test, the `build.mjs` handoff, `ci.yml#L205-L264`, `package.json` for `cbor-x`, and greps for residual claims. I did not re-read the full `0f7be721` diff.
- **Read vs run.** I ran nothing. Parent Docker ran the RED, GREEN and FINAL tests, the pin check, the syntax check, and the replay of the unchanged old binary. That replay is not a new compiler build.
- **Not tested.**
  - The CI workflow itself: no pipeline run.
  - The `build.mjs` wiring (the spread and the alias): unit-tested only through the helper, so a typo in the wiring would pass CI.
  - Any new compiler or provider build.
  - The guard-removal mutant, extra-file detection, clean-room second build, and vendor-to-inventory binding.
- **Correctness.** The helper logic is right on reading. It refuses missing, malformed and conflicting identities, accepts the historical label, and keeps the v1 fields. Historical evidence bytes are unchanged (`447aacab…` matches).
- **Security and integrity.** Fail-closed on provenance. The residual gaps are unchanged and documented: extra files go unnoticed, and the evidence anchor is the operator-supplied hash.
- **Architecture.** Probe tooling only; the new files are small and nothing is coupled to the editor.
- **Docs.** DL-0159 (the canonical owner), the READMEs, `ci.md` and the CHANGELOG agree with each other and with the code. The retrospective references #296, which DL-0159 also links in its header. One small point: the retrospective says "Independent review found that handoff bug", which is a review-process remark in a design document and is acceptable only because it describes why the doc changed.
- **Limitations.** Whole Text, Rope and ReplaceRange still do not compile. The historical reports measure old compiler revisions, and the 61 helper cases are not the 40 full-operation oracle cases.

## VERDICT

```
decision: APPROVE  (candidate 93fbad2620b0b4d9cd2066bb9d8a868f5f93ecb8)
superseded: all blocking findings from 0f7be721 review (R1–R4) and MORIARTY conditions 1–3
blocking: none
residual impact (non-blocking):
  - build.mjs wiring covered only via the helper's unit tests
  - lazy-evaluation assumption has no negative-control experiment
  - extra files in vendor/provider trees are not rejected (documented)
  - CI step unrun; pipeline result still pending
tests run by this reviewer: none
```
