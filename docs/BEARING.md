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

## Immediate Work

The current local inspection point is slice 40 of the application-hosting
pattern plan:

31. application hosting contract pattern.
32. `jedit` state authority cutover.
33. read-side state authority cutover.
34. submission ledger port.
35. ticketed work boundary.
36. real receipt correlation.
37. real local retained evidence lookup.
38. restart and recovery witness.
39. second-app template proof.
40. developer app host guide.

Agents can inspect the installed-package witness path with:

```bash
npm run build
node scripts/jedit-echo-powered-session.mjs --json --dry-run
node scripts/jedit-echo-powered-session.mjs --json
```

Pause after slice 40 for inspection. The current branch now proves the reusable
Echo application-hosting pattern with `jedit` and a small second-app template,
while remaining honest that distributed transport, settlement shells, streaming,
and full observer-rights governance are outside this batch.

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
