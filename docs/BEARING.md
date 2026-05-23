# BEARING

Current bearing: prove, with executable evidence, that jedit is powered by Echo
without moving jedit nouns into Echo.

The active release-gate plan is
[`docs/design/0024-jedit-powered-by-echo-release-gate.md`](design/0024-jedit-powered-by-echo-release-gate.md).
That plan is the source of truth for the first twenty slices and the current
continuation budget through slice 40.

The release-facing summary lives in
[`docs/releases/v0.1.0/README.md`](releases/v0.1.0/README.md).

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

The current local inspection point is slice 25 of the release-gate plan's
continuation budget:

21. continuation plan and remote posture.
22. runtime work envelope boundary.
23. installed transport work envelope staging.
24. handler invocation boundary.
25. scheduler-owned installed handler guard.

Agents can inspect the installed-package witness path with:

```bash
npm run build
node scripts/jedit-echo-powered-session.mjs --json --dry-run
node scripts/jedit-echo-powered-session.mjs --json
```

Pause after slice 25 for inspection. The current branch must remain honest that
jedit has an installed package/evidence path, while the text contract handler
state is still transitional until the state-port and durable-submission slices
land.

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
