# jedit Agent Contract

## Git Safety

- Never amend commits. Make a new commit.
- Never rebase unless the user explicitly approves it after a concrete explanation.
- Never force git operations.

## Quality Doctrine

These are hard repo rules, not suggestions:

1. No `any`.
2. No `unknown`.
3. Hexagonal architecture, strict.
4. Encoding and decoding happen only at the boundary, inside a port/adapter.
5. One file equals one runtime truth.
6. Runtime truth beats compile-time theater.
7. No ad hoc string comparison in core logic. Prefer `instanceof`, numeric tags, symbols, or explicit runtime objects.
8. No magic strings.
9. No magic numbers.
10. SOLID.
11. DRY.
12. DI.
13. Red to green.
14. Tests are spec.
15. Agent-first.
16. No file over 500 lines of code.

## Structure

- `ARCHITECTURE.md` is the canonical repo architecture doctrine.
- `scripts/quality-gate.mjs` is the current enforceable quality ratchet.
- `quality-baseline.json` is temporary debt, not permission to add more debt.

## Current Reality

The repo is not fully compliant yet.

- `src/main.ts` currently exceeds the 500 line limit.
- Existing `unknown` usage still exists and is tracked as debt.
- The baseline exists to prevent regression while the code is being broken into proper hexagonal slices.

## Delivery Workflow

- Add or update tests/specs first when behavior changes.
- Make invalid states unrepresentable at runtime where possible.
- Move stringly external data into runtime objects at the boundary immediately.
- Prefer constructor or factory injection over ambient singletons for new code.
