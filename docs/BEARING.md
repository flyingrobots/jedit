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

The next local inspection point is the first three slices of the release-gate
plan:

1. Plan and bearing signposts.
2. jedit contract package descriptor.
3. Package install preflight.

After those land, pause and inspect the boundary before registering mutation
handlers or query observers.

## Non-Negotiables

- Application code cannot tick Echo.
- Application dispatch does not execute synchronously.
- Trusted host lifecycle control stays behind a host adapter.
- Mutation handlers run only during Echo scheduler-owned execution.
- Query observers are read-only.
- Retry is explicit new causal input.
- Echo remains generic.
