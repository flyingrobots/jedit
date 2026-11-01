# Baker Street: authored boundary recovery

Date: 2026-10-31 (America/Los_Angeles).
Subject: Jedit PR #386, recovered authored boundary helper, source-module pins,
and historical compiler inventory.
Primary evidence: `0f7be721603d1d356f41d057a29806ff74afc45c`, base
`cfcd0baa24b679c69ba2085a6eaa7b53e8c457e1`.
Repaired candidate: `93fbad2620b0b4d9cd2066bb9d8a868f5f93ecb8`.

⚠️ ALL VERDICTS HEREIN ARE VALID ONLY FOR THE COMMITS ABOVE.

## Executive Deduction

The recovered witness silently dropped the observed Echo checkout identity when
fed a current inventory. The repair rejects absent, malformed or conflicting
provenance, retains historical compatibility, and passes its regression.
This approves a helper recovery, not persistent-rope completion.

## Report Card

| Dimension | Primary | After repair |
| --- | --- | --- |
| Fidelity: source HOLMES | B−; request changes | A−; approve |
| Fidelity: evidence HOLMES | A−; approve with wording notes | Historical evidence unchanged |
| Clarity: WATSON | B; request changes | Approve; no new letter grade supplied |
| Resilience: MORIARTY | B−; 11 reported strikes, 11+ attempted; conditional approval | Three conditions verified; no final adversarial rerun claimed |
| Overall, adjudicated | B− | B+ |

## Adjudication

- Source HOLMES found the real provenance-schema mismatch that the historical
  evidence pass missed. Its request for changes took precedence. Commits
  `3b1ed35` and `5b23821` fix the mismatch and keep the v1 observation alias.
- WATSON's R1–R4 are resolved: provenance, conformance wording, listed-file
  scope, and a link to the exact retained evidence. Its same-session final
  deposition explicitly approves `93fbad26`.
- MORIARTY's three conditions pass: the pin/vector tests, evidence hash
  `447aacab9c55838deb0fa6c7c5d2eea9a9f6a84b31379fd2784eb5ad68255589`, and helper
  hash `e6c94f58f16eba252d16865c4c167ff2d0917618abd7dd33a4a326c57ac5549f`.
- Totality by case reasoning assumes lazy Boolean evaluation; finite cases do
  not supply a formal language proof. The docs now state that assumption and
  retain callers' range obligations. No guard-removal mutant was run.
- Unlisted vendor/provider files are not rejected by the runtime consumer.
  That is now explicit; no complete-tree enforcement is claimed.
- Lightweight pin and provenance checks are wired into CI by `93fbad26`.
  The retained historical runtime replay is manual and does not establish a
  current compiler build. Hosted CI is a separate merge gate.

## Repair Menu

1. **Done:** preserve and validate current/historical checkout provenance;
   expected RED was two assertion failures, GREEN three passes.
2. **Done:** link the exact evidence and bound claims to historical conformance.
3. **Done:** add the two pin tests, three provenance tests and pin check to CI.
4. **Remaining, non-blocking experiments:** clean-room repeated build, deeper
   input-substitution controls, driver-level integration coverage and malformed
   or additional import detection. These hypotheses are not certified by this
   case and must not be represented as completed work.
5. **Original goal remains open:** authored persistent-rope ReplaceRange and
   the 40 full-operation cases with admission, budgets, footprint, Tick/WAL,
   receipts and recovery (#296).

## Ship Verdict

**ELEMENTARY** — the bounded repaired helper recovery is sound to ship once
its ordinary CI and repository merge gates pass. This is not a rope, editor,
or release sign-off.

## Validation

[Validation receipt](validation-receipt.json) binds eight isolated Docker files
back to the repaired commit after execution and identifies the retained logs.
Five focused tests pass; pin and syntax checks return success. The unchanged
historical runtime binary passes the baseline 61-case marker assertion and all
five retained-input substitutions. The marker is captured and checked inside
the harness, not printed in the outer log. No new public compiler run occurred.

## Chain of custody

- Four native Claude Sonnet sessions (`claude-sonnet-5-5`) ran blind primary
  passes: two disjoint HOLMES scopes, WATSON, and MORIARTY. The same WATSON
  resumed for Phase 2 after the other testimonies; source HOLMES and WATSON
  then resumed for the repair review. No implementation delegation occurred.
- Primary testimonies and followups are verbatim. The front office wrote only
  this synthesis and the validation receipt. Read-only reviewers did not run
  tests, hash files or directly query Git. The parent pinned Git and ran Docker.
- HOLMES-EVIDENCE's `candidate-evidence.json#5259-5276` citation is a diff-offset
  error: the file has 72 lines; build records are near its end. Source HOLMES's
  final `build.mjs#215` citation is also wrong; provenance selection is line 24.
  Their testimony remains unedited. Other shortened or approximate citations
  should be resolved against the pinned files, not treated as precise line pins.
- The source HOLMES checklist says eight files but enumerates more; the
  enumerated scope and actual tool transcript govern, not that count.
- The RED source extraction was not separately retained at execution; the
  failure log preserves the expected missing-identity assertion, but this case
  does not claim a cryptographic RED source attestation. Final source identity
  was verified post-run and is labelled accordingly.
- Historic compiler full-suite and Clippy claims were not rerun here. Those
  claims must stay tied to their original evidence and are not this gate.
- Raw reviewer transcripts are retained locally under the shared log budget;
  closed sessions may be losslessly compressed. Restoring a session requires
  restoring its transcript and accounting registration before CLI resume.
