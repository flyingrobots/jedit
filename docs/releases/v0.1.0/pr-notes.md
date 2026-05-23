# jedit + Echo Release-Gate PR Notes

## Summary

This branch closes the twenty-slice local release gate for proving a narrow
jedit edit/read workflow is powered by Echo while Echo remains generic.

jedit now owns the hot text package descriptor, preflight, mutation handlers,
query observers, app-facing `TextBufferOptic`, agent witness surfaces, MCP-style
witness adapter, release quickstart, and release-gate command. Echo is treated
as the generic package/operation/query/handler/observer/evidence runtime
boundary; no jedit text nouns are introduced into Echo.

## Evidence

- `npm run release-gate:echo`
- `npm run check`
- `node scripts/jedit-echo-powered-session.mjs --json --text "hello Echo"`
- `node scripts/jedit-echo-powered-session.mjs --json --replay-local`

Recorded reports:

- [`final-witness-report.json`](final-witness-report.json)
- [`local-replay-report.json`](local-replay-report.json)

## Honest Limits

- Handler state is still process-local in this release-gate branch.
- Durable accepted-submission recovery remains unavailable.
- Local replay is proven; Continuum transport and distributed replay are not.
- Query observers are read-only and do not implement the full observer-rights
  lattice.
- Application code still has no tick, start, stop, install, or lifecycle
  authority.
