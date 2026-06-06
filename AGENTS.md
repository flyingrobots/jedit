# jedit Agent Contract

## Git Safety

- Never amend commits. Make a new commit.
- Never rebase unless the user explicitly approves it after a concrete explanation.
- Never force git operations.
- Draft pull requests are allowed only for design-cycle kickoff or active cycle
  work. Convert them to ready before merge. If draft PRs are unavailable, use a
  normal PR with the `work-in-progress` label.

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
- `docs/BEARING.md` records the current execution gravity.
- `docs/method/process.md` is the canonical cycle workflow.
- `docs/method/roadmap-planning.md` defines release-gate, roadmap, slice, and
  proof policy for multi-cycle planning.
- `docs/design/TEMPLATE.md` is the required template for full cycle designs.
- `docs/design/0034-design-cycle-template-and-lifecycle.md` records the policy
  decision that made executable design docs official.
- `docs/design/0024-jedit-powered-by-echo-release-gate.md` is the completed
  baseline plan for the first thirty slices proving jedit has an installed
  package/evidence path while Echo remains generic.
- `docs/design/0025-echo-application-hosting-pattern.md` is the completed
  post-release-pressure ten-slice plan for proving the reusable Echo
  application-hosting pattern before applying it to Graft, Think, or other apps.
- `docs/design/0026-echo-hosting-hardening-first-twenty.md` is the completed
  hardening plan for slices 41-60. Keep track of our progress in that plan doc
  by checking off slices just before you make the commit for that slice.
- `docs/design/0027-echo-hosted-production-cutover.md` is the active production
  cutover plan for slices 61-80. Keep track of progress in that plan doc by
  checking off slices just before you make the commit for that slice.
- `docs/BEARING.md` is the active plan for the powered-by-Echo completion
  budget after slice 80. Keep track of progress there by checking off slices
  just before you make the commit for that slice.
- `docs/design/0032-jedit-echo-reading-cache-and-fallback-boundaries.md`
  records the local package for slices 101-110.
- `docs/design/0033-echo-authoritative-recovery-gate-b.md` records the current
  local companion plan for consuming Echo recovery truth through jedit-owned
  ports. Keep track of progress there and in `docs/BEARING.md` by checking off
  slices just before you make the commit for that slice.
- `scripts/quality-gate.mjs` is the current enforceable quality ratchet.
- `quality-baseline.json` is temporary debt tracking, not permission to add more debt.
  Keep it empty when the ratchet is clean.

Keep track of our progress in the plan doc by checking off slices just before
you make the commit for that slice.

## Design Cycle Workflow

- Start full cycles from a fetched merge target, almost always `origin/main`.
- Create or link a GitHub issue before the design doc lands.
- Write full cycle docs from `docs/design/TEMPLATE.md`.
- Commit and push the design doc before implementation work.
- Open an early PR and mark the issue and PR `work-in-progress` while the cycle
  is active.
- Design docs define intent. They do not prove implementation.
- For implementation work, at least one required test must exercise the actual
  software surface: package API, runtime behavior, rendered output, scripted app
  flow, command behavior, schema validation, lower-mode output, or CI/tooling
  behavior.
- Design-doc assertions are allowed only as evidence-ledger checks. They cannot
  be the only acceptance test for product, runtime, UI, or tooling work.
- Fill in the design doc retrospective before marking the PR ready.
- Create GitHub issues for deferred work instead of hiding follow-on debt in
  prose.

## Current Reality

The repo is still converging toward the full architecture doctrine, but the
enforceable quality ratchet is currently clean.

- `scripts/quality-gate.mjs` currently enforces no `any`, no `unknown`, and no
  TypeScript file over 500 lines.
- `quality-baseline.json` should stay empty unless temporary ratcheted debt is
  deliberately introduced and documented.

## Delivery Workflow

- Add or update tests/specs first when behavior changes.
- Make invalid states unrepresentable at runtime where possible.
- Move stringly external data into runtime objects at the boundary immediately.
- Prefer constructor or factory injection over ambient singletons for new code.

## Progress Footer

- End every turn with the compact progress footer:

  ```text
  === ⋆★⋆ Progress Report ⋆★⋆ ===

  <goalpost name>
  <progress bar> <percent> (<done>/<total> slices)

  - [x] <completed slice>
  - [ ] <open slice>

  <roadmap-next>

  ⎇ <branch> +<ahead>/-<behind>
  <pr-icon> <pr-status>
  ```

- After the slice checklist, include a compact roadmap "what's next" summary:
  - `🚏 Goalpost <next number>: <next goalpost title>` when the next roadmap
    item is another goalpost.
  - `📦 X.Y.Z` when the next roadmap item is a version release rather than a
    goalpost.
  - `🙈 OFF-ROADMAP` when there is no known next goalpost or upcoming version
    release.
- Compute `+<ahead>/-<behind>` against the active merge target, normally
  `origin/main`, using local refs unless the turn already fetched.
- Keep the PR line compact:
  - `🚫 none` when no PR exists.
  - `📤 [#N](url)` when a PR is open.
  - `📝 [#N](url)` when a PR is draft.
  - `🏁 [#N](url)` when a PR was merged.
  - `🐇 [#N](url)` when waiting for Code Rabbit.
  - `🧪 [#N](url)` when CI is not finished yet.
