# Repair review: authored-recovery candidate `93fbad26`

I could not confirm that the working tree is at `93fbad26`, because I have no git access. I read the repair diff and the actual files at the worktree path. The logs do not record a commit SHA, so their tie to that commit rests on the parent's statement.

**Verdict: APPROVE**, for the bounded recovery candidate only.

## Superseded and prior findings

- **Blocking finding 1 (stale `echoCommit`): resolved.**
  - `text-boundary/build.mjs#72-74` now spreads `inventoryProvenance(prior)`, which gives `compilerCommit` and `echoCheckoutCommit`. It also keeps the legacy `echoCommit` alias.
  - The helper (`inventory-provenance.mjs#4-17`) takes `echoCheckoutCommit` if the key exists, even as `undefined`, and otherwise falls back to `echoCommit`. It requires both commits to match `^[a-f0-9]{40}$` and refuses when the two labels disagree.
  - `build.mjs#215` runs it before the compiler-hash check, so the build fails closed.
- **Blocking finding 2 (overstated "complete trees" claim): resolved.**
  - `text-boundary/README.md` now says "every listed file". It adds "does not reject additional files". The "formal proof" claim is gone, and the "Proven" heading became "Witnessed".
  - The README now spells out that the committed evidence is the verbatim retained file and that its inventory report is external.
- **Docs, additionally.**
  - The short-circuit assumption is now explicit (DL-0159, `text-boundary/README.md`, `draft/README.md`).
  - DL-0159 adds a caller obligation: `boundaryAtOrBefore` still needs an offset no greater than the byte length.
- **My earlier non-blocking D1–D7 hypotheses are untouched.** They stay out of scope, and I do not claim they were tested or fixed.

## Verification checklist

| Item | Status | Basis |
|---|---|---|
| Scope read | Done | The full repair diff, `inventory-provenance.mjs`, its test, the `build.mjs` hunk, the CI step, and the README and DL-0159 hunks. |
| Correctness of the helper | Read | Logic traced for current, historical, missing, malformed and conflicting inputs. Both reports carry full 40-character commits (the RED log shows `980c3ae3…` and `9c32e0b5…`). |
| Tests read vs run | Read, plus parent logs | I ran nothing. See the log table below. |
| Historical evidence unchanged | Partly confirmed | The final log hashes `candidate-evidence.json` as `447aacab…`, the selector in the README. The same log hashes `Boundary.edict` as `e6c94f58…`, which equals `helperSourceSha256` in the retained evidence. Byte-identity against the pre-repair evidence file is inferred from the diff touching neither. |
| Security and integrity | Improved | The Echo identity can no longer vanish silently, and conflicting labels are refused. Docs now match enforcement. The refusal tests check the 40-hex pattern, undefined and conflict inputs. |
| Architecture | OK | The helper is a small pure module with an injected `prior`. Files are far below the size limit. The new test reads JSON inventories, not documentation, which is consistent with the repo rule. |
| CI | Read | `ci.yml#235-239` runs both test files and `draft-modules.mjs --check`. It sits after `npm ci` (`#231-233`), on a job that has Node set up (`#221-226`). |
| Limitations | Stated | See "Remaining issues" below. |

## Logs read

| Log | What it shows |
|---|---|
| `authored-provenance-red.log` | Test 1 fails (`echoCheckoutCommit: undefined` against `9c32e0b5…`). Test 3 fails ("Missing expected exception"). Test 2 passes, as expected for a historical-label fallback. This is the expected RED. |
| `authored-provenance-green.log` | 3 of 3 pass. |
| `authored-recovery-final.log` | 5 of 5 pass (2 pin tests and 3 provenance tests). The two SHA-256 lines match what I cross-checked above. |
| `authored-recovery-pins.log` | The 2 pin tests pass. |
| `authored-recovery-retained-replay.log` | A replay binary hash (`0b8adecd…`), five `RETAINED_INPUT_REFUSED` lines, and `JIM_TEXT_BOUNDARY_INPUT_BINDINGS_OK 5 refused substitutions`. The "61 cases" figure is not printed. It is implied because `check-retained-inputs.mjs#25-26` asserts the baseline output contains `61 cases` before it reaches the refusal loop. |

## Tested vs read boundary

- **Parent-tested, as logged:** 5 unit tests, the retained-input replay (5 refusals), the evidence and `Boundary.edict` hashes.
- **Read only:** the `build.mjs` wiring, the CI step, the docs.
- **Not tested:**
  - A fresh `build.mjs` run with a newly built compiler. The parent says the replay used the old binary, and the log shows no new build.
  - The pin check and syntax check lines. They are silent on success, so I cannot see them in the final log. Only the parent's statement says they ran.
  - Any CI execution.
  - Whole Text, Rope or ReplaceRange compilation, which still does not exist.

## Remaining issues (non-blocking)

1. **`build.mjs` has no automated test.** Only the helper is covered. A mistake in the spread or the alias at `#72-74` would be invisible to the unit tests. Impact: low. The code reads correctly.
2. **Regenerated evidence will differ from the retained file.** Newly generated evidence gains an `echoCheckoutCommit` key next to `echoCommit` (`build.mjs#72-74`), so its hash will not equal `447aacab…`. The README says a new evidence hash must be selected. It does not explicitly mention the added key.
3. **The refusal test regex is loose.** `/inventory provenance/` matches both the "invalid" and "conflicting" messages, so the test cannot tell the two refusal reasons apart. Impact: minor.
4. **The log-to-commit binding rests on the parent's statement.** The logs carry no commit SHA, and the RED log shows a different checkout path (`/jim-recovery/jedit-authored-review`).

None of these changes the approval for this helper-slice candidate. Items 1 and 2 are cheap follow-ups.

```
VERDICT: APPROVE (bounded helper-recovery candidate at 93fbad26; not a rope implementation)
Prior blocking findings: both superseded/resolved
Fidelity: A- (read) ; 5 unit tests + 5 retained refusals verified only via parent logs
Not claimed: new-compiler rebuild, CI run, D1-D7, whole Text/Rope/ReplaceRange compilation
```

I made no modifications and ran nothing. The case testimony files remain untracked, as you noted.
