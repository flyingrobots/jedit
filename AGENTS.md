# jedit Agent Contract

## Git Safety

- Never amend commits. Make a new commit.
- Never rebase unless the user explicitly approves it after a concrete explanation.
- Never force git operations.

## Quality Doctrine

These are hard repo rules, not suggestions:

1. **Adopt the [Systems-Style TypeScript Coding Standard](CODING_STANDARD.md) project-wide.**
2. No `any`.
3. No `unknown`.
4. Hexagonal architecture, strict.
5. Encoding and decoding happen only at the boundary, inside a port/adapter.
6. One file equals one runtime truth.
7. Runtime truth beats compile-time theater.
8. No ad hoc string comparison in core logic. Prefer `instanceof`, numeric tags, symbols, or explicit runtime objects.
9. No magic strings.
10. No magic numbers.
11. SOLID.
12. DRY.
13. DI.
14. Red to green.
15. Tests are spec.
16. Agent-first.
17. No file over 1000 lines (aim for < 600).
18. Strict limits on function size (35 lines), depth (4), and complexity (8).

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
