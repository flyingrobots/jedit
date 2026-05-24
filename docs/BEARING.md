# BEARING

Current bearing: prove, with executable evidence, that `jedit` is the first
correct Echo-hosted application without moving `jedit` nouns into Echo.

The completed release-gate baseline is
[`docs/design/0024-jedit-powered-by-echo-release-gate.md`](design/0024-jedit-powered-by-echo-release-gate.md).
That plan records slices 1-30 and the proof that `jedit` has an installed
package/evidence path.

The active post-release-pressure direction is
[`docs/design/0025-echo-application-hosting-pattern.md`](design/0025-echo-application-hosting-pattern.md).
That plan is the source of truth for the next ten slices: make `jedit` prove the
reusable Echo application-hosting pattern before applying the model to Graft,
Think, or other apps.

The active hardening plan is
[`docs/design/0026-echo-hosting-hardening-first-twenty.md`](design/0026-echo-hosting-hardening-first-twenty.md).
That plan records slices 41-60. The current branch closes slice 60: trusted
lifecycle start/drain/stop, package identity, install posture, Echo no-app-noun
guards, ticketed mutation authority, read-only query observers, local receipt
correlation, retained lookup, restart recovery, replay identity, counter
template portability, guide drift checks, and release-gate consolidation are
closed locally.

The proposed next plan is
[`docs/design/0027-echo-powered-ui-adoption-next-ten.md`](design/0027-echo-powered-ui-adoption-next-ten.md).
It starts with slice 61: inventory the interactive editor's read/write paths
and prepare the UI cutover to `TextBufferSessionPort`/Echo mode without moving
text semantics into Echo.

The developer-facing recipe lives in
[`docs/echo-application-hosting-guide.md`](echo-application-hosting-guide.md).

## Current Truth

- `TextBufferOptic` is a jedit app capability.
- Text windows, rope/piece-table semantics, panes, commands, cursors, and
  editor policy belong in jedit contracts, generated adapters, or jedit ports.
- Echo owns generic admission, scheduling, ticks, receipts, QueryView routing,
  retained evidence, and obstruction/fault posture.
- Echo must not contain hardcoded jedit or text-buffer behavior.
- The current real Echo witness fails closed with `UNSUPPORTED_QUERY` unless a
  jedit-owned query observer is installed.

## Completed Local Batch

The previous local inspection point was slice 40 of the application-hosting
pattern plan:

1. Slice 31: application hosting contract pattern.
2. Slice 32: `jedit` state authority cutover.
3. Slice 33: read-side state authority cutover.
4. Slice 34: submission ledger port.
5. Slice 35: ticketed work boundary.
6. Slice 36: real receipt correlation.
7. Slice 37: real local retained evidence lookup.
8. Slice 38: restart and recovery witness.
9. Slice 39: second-app template proof.
10. Slice 40: developer app host guide.

Agents can inspect the installed-package witness path with:

```bash
npm run build
node scripts/jedit-echo-powered-session.mjs --json --dry-run
node scripts/jedit-echo-powered-session.mjs --json
```

The current branch now extends that proof through slice 60 of the hardening
plan:

1. Slice 41: trusted runtime lifecycle doctrine closure.
2. Slice 42: runtime host port finalization.
3. Slice 43: Echo adapter lifecycle integration.
4. Slice 44: lifecycle failure posture.
5. Slice 45: agent lifecycle surface.
6. Slice 46: contract package identity audit.
7. Slice 47: no app nouns in Echo gate.
8. Slice 48: jedit contract package install fixture.
9. Slice 49: unsupported operation boundary.
10. Slice 50: package reinstall and duplicate policy.
11. Slice 51: ticketed mutation execution tightening.
12. Slice 52: query observer read-only tightening.
13. Slice 53: receipt correlation happy path closure.
14. Slice 54: retained reading lookup closure.
15. Slice 55: restart persistence adapter boundary.
16. Slice 56: local replay proof hardening.
17. Slice 57: second-app template authority audit.
18. Slice 58: developer guide drift check.
19. Slice 59: PR release gate consolidation.
20. Slice 60: drift reflection and next plan.

Slice-60 reflection is complete. The next proposed tranche is interactive
Echo-mode UI adoption, starting with slice 61. Distributed transport,
settlement shells, streaming, and full observer-rights governance remain outside
this batch.

## Non-Negotiables

- Application code cannot tick Echo.
- Application dispatch does not execute synchronously.
- Trusted host lifecycle control stays behind a host adapter.
- Mutation handlers run only during Echo scheduler-owned execution.
- Query observers are read-only.
- Retry is explicit new causal input.
- Unsupported or rejected work is final for that attempt; a retry is a new
  submission, not a hidden runtime loop.
- Echo remains generic.
