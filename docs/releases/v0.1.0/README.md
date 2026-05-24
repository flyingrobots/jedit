# jedit v0.1.0 Echo Release Gate

Status: release-gate closeout prepared.

The v0.1.0 release gate is the claim:

```text
jedit is powered by Echo for a narrow local edit/read workflow.
```

This means jedit can install its jedit-owned contract package, submit a
`TextBufferOptic` edit through an Echo-backed adapter path, let the trusted host
drain Echo runtime work, observe an applied outcome, query a bounded
`textWindow` reading, inspect retained evidence posture, and prove local replay
of stable evidence identities.

## What Ships

- jedit-owned hot text contract package descriptor.
- Package install preflight for supported mutations and queries.
- Trusted adapter for Echo's generic installed package boundary.
- jedit-owned mutation handler registry.
- jedit-owned query observer registry.
- Echo-backed `TextBufferOptic` headless witness path.
- Trusted host runtime loop posture.
- Intent outcome observation.
- Retained evidence inventory.
- Agent CLI witness.
- MCP-style witness adapter.
- Unsupported-operation obstruction witness.
- Restart posture that honestly reports process-local handler state.
- Local replay proof.
- Echo-hosted text runtime profile, with explicit `testLocal` dev/test escape hatch.
- Production text session controller for open, edit, and bounded read posture.
- Production text session witness CLI with checkpoint, retained evidence refs,
  local replay, and export-as-reading posture.
- Release quickstart.
- Focused release-gate command.

## Evidence Commands

```bash
npm run build
node scripts/jedit-echo-powered-session.mjs --json
node scripts/jedit-echo-powered-session.mjs --json --replay-local
node scripts/jedit-production-text-session.mjs --json
node scripts/jedit-production-text-session.mjs --json --replay-local
npm run release-gate:echo
```

See [quickstart.md](quickstart.md) for the guided path.

Recorded closeout evidence:

- [`final-witness-report.json`](final-witness-report.json)
- [`local-replay-report.json`](local-replay-report.json)
- [`pr-notes.md`](pr-notes.md)

## Generic Echo Boundary

Echo remains generic. It sees package identities, operation ids, query ids,
handler/observer registrations, runtime lifecycle authority, receipts,
readings, obstructions, and evidence posture.

Echo does not know `TextBufferOptic`, rope, text windows, panes, cursors, editor
commands, or jedit UI policy. Those nouns stay in jedit contracts, generated
adapters, ports, handlers, observers, and application code.

## Authority Boundaries

- Application code cannot tick Echo.
- Application code cannot start or stop the trusted Echo runtime.
- Application dispatch does not execute synchronously.
- `TextBufferOptic` is a jedit capability, not an Echo noun.
- Mutation handlers run only behind the Echo-backed scheduler-owned path.
- Query observers are read-only.
- Unsupported or rejected work is final for that attempt.
- Retry is a new explicit causal input.

## Non-Goals

- No full Continuum transport.
- No distributed suffix import/export release claim.
- No full observer-rights or revelation lattice.
- No durable accepted-submission recovery claim.
- No durable Echo-hosted text-state claim while handler state remains
  process-local.
- No jedit nouns in Echo core.
- No app-controlled tick API.
- No hidden retry queue.

## Remaining Release Question

The release gate is honest once `npm run release-gate:echo` and the final
closeout checklist pass on a clean checkout. Until durable Echo-hosted
submission/text-state recovery exists, restart posture remains explicitly
partial rather than promoted to a durable storage claim.
