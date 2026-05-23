# BEARING

Current bearing: prove, with executable evidence, that jedit is powered by Echo
without moving jedit nouns into Echo.

The active release-gate plan is
[`docs/design/0024-jedit-powered-by-echo-release-gate.md`](design/0024-jedit-powered-by-echo-release-gate.md).
That plan is the source of truth for the next twenty slices.

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

The current local inspection point is slice 14 of the release-gate plan:

1. Plan and bearing signposts.
2. jedit contract package descriptor.
3. Package install preflight.
4. Echo package install adapter.
5. jedit mutation handler registration.
6. jedit query observer registration.
7. installed package `TextBufferOptic` headless flow.
8. trusted host runtime loop.
9. intent outcome observation.
10. retained evidence lookup.
11. agent CLI installed-package witness path.
12. MCP-style witness adapter for agents.
13. unsupported-operation outcome path.
14. Echo-hosted state and restart posture.

Agents can inspect the installed-package witness path with:

```bash
npm run build
node scripts/jedit-echo-powered-session.mjs --json --dry-run
node scripts/jedit-echo-powered-session.mjs --json
```

Pause after slice 14 for inspection. The current branch must remain honest that
jedit has an installed package/evidence path, while the text contract handler
state is still process-local and durable accepted-submission recovery is
reported as unavailable.

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
