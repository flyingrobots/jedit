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
- `docs/jim-component-ownership.md` owns the Jim/Jedit/Edict/Echo target
  ownership and causal model.
- `docs/BEARING.md` records the current execution gravity and the roadmap toward
  the `Jim.edict` goalpost.
- `docs/method/process.md` is the canonical cycle workflow.
- `docs/method/durable-decisions.md` owns the durable decision policy and the
  canonical-owner register.
- `docs/method/documentation-lifecycle.md` owns when documentation is kept,
  rewritten, or deleted.
- `docs/method/roadmap-planning.md` defines release-gate, roadmap, slice, and
  proof policy for multi-cycle planning.
- `docs/method/ci.md` describes what CI runs for a change.
- `docs/design/TEMPLATE.md` is the required template for full cycle designs.
- `scripts/quality-gate.mjs` is the current enforceable quality ratchet.
- `quality-baseline.json` is temporary debt tracking, not permission to add more debt.
  Lower an entry when the debt shrinks, and remove it when the debt is gone.

When a cycle has a plan doc with a slice checklist, check off each slice just
before you make the commit for that slice.

## Durable Decision Discipline

`docs/method/durable-decisions.md` owns this policy. Read it before completing
any architecture, authority, identity, causal-settlement, recovery,
compatibility, ownership, public-API, or release-boundary decision.

Agent-specific enforcement: a change carrying such a decision is not complete
until the canonical owner named in that document is updated in the same change.
Chat transcripts, Think memories, pull-request prose, and review threads may
motivate a decision; none of them is its repository home.

Treat missing or stale canonical decision documentation as incomplete
engineering work, not optional polish. When durable current architecture
changes, update the current owning doctrine. Obsolete documents are deleted, not
kept as history; follow `docs/method/documentation-lifecycle.md`.

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
- Tests never read documentation. No spec, test, or gate may open a Markdown
  file or assert its wording; see
  [documentation-lifecycle.md](docs/method/documentation-lifecycle.md).
- Fill in the design doc retrospective before marking the PR ready.
- Create GitHub issues for deferred work instead of hiding follow-on debt in
  prose.

## Current Reality

The repo is still converging toward the full architecture doctrine.

- `scripts/quality-gate.mjs` enforces the rules it prints (`npm run quality`),
  including no `any`, no `unknown`, no enums, no type assertions, function,
  parameter, import, complexity, and line-length limits, and a 500-line file
  limit that also covers specs and tests.
- `quality-baseline.json` records the remaining ratcheted debt: line counts for
  a few oversized spec and test files. A change may lower an entry, never raise
  one.

## Delivery Workflow

- Add or update tests/specs first when behavior changes.
- Make invalid states unrepresentable at runtime where possible.
- Move stringly external data into runtime objects at the boundary immediately.
- Prefer constructor or factory injection over ambient singletons for new code.

## Progress Footer

- End every turn with the compact progress footer:

  ```text
  <progress bar> <percent> (<done>/<total> slices)
  WIP: <goalpost name>

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

## Goalpost, Merge, And Release Prompts

- When the final slice of a goalpost is complete, ask:

  ```text
  ■ 🙌 Goalpost Reached
  ░
  ■ 🙋 Do you want me to open a PR to <target>?
  ```

- When an open PR is merge-ready, ask:

  ```text
  ■ 👍 Merge Ready
  ░
  ✪ 🟢 Do you want to merge this to <target>?
  ```

- Treat a PR as merge-ready only when CI is green, there are zero unresolved
  issues in the open PR thread, and Code Rabbit has approved, is rate limited,
  or has run out of credits.
- After a successful merge, when it is possibly time to cut the next release,
  ask:

  ```text
  ■ 🚢 Ship It
  ░
  ■ 🚀 Do you want to release version <version>?
  ```
