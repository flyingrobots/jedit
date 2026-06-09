# BEARING

Current bearing: make `jedit` the first correct Echo-hosted application, then
evolve it into `jim`: a Vim-shaped modal editor powered by Echo evidence rather
than local editor tricks.

This file is not a changelog, slice ledger, or historical archive. Keep it short.
Old activity belongs in commits, PRs, design docs, and executable witnesses. If a
detail is no longer needed to orient the next engineer or agent, delete it.

## Current Focus

The active product arc is
[`docs/design/0105-vim-power-moves-causal-parity.md`](design/0105-vim-power-moves-causal-parity.md).
It defines comprehensive Vim power-move parity through jedit-owned grammar,
motion algebra, text-object resolution, operators, registers, macros, repeat,
search/substitute, marks, visual mode, and causal strand/braid extensions.

The user-facing name direction is locked:

```text
JIM = Jedit Is Modal
```

The repository, packages, WSC paths, and release gates stay named `jedit` until
the Echo-powered proof and compatibility plan make a rename safe.

## Current Power-Moves State

- Slice 1 defined the WF-0105 power-moves design.
- Slice 2 added
  [`docs/design/0105-vim-power-moves-parity-matrix.json`](design/0105-vim-power-moves-parity-matrix.json)
  and `spec/vim-power-parity-matrix.spec.mjs`.
- Slice 3 added
  [`docs/design/0105-vim-power-target-usability-fixtures.json`](design/0105-vim-power-target-usability-fixtures.json)
  and `spec/vim-power-target-usability-fixtures.spec.mjs`.
- Slice 4 now starts with register and transaction doctrine: registers are
  required user-facing Vim language state owned by jedit and backed by Echo
  evidence. Read-resolve-write commands such as `di"` must resolve and mutate on
  one basis, obstruct stale basis, or explicitly transform to a newer basis.

Next useful work: implement the Vim grammar token model without weakening the
transaction doctrine.

## Echo Boundary

- Echo owns generic admission, scheduling, ticks, receipts, QueryView routing,
  retained evidence, obstruction posture, and fault posture.
- jedit owns text/editor semantics, Vim grammar, registers, buffers, cursors,
  panes, file export, and UI policy.
- Echo must not contain hardcoded jedit, Jim, Vim, text-buffer, cursor, file, or
  editor behavior.
- Echo identity doctrine is canonical:
  [`docs/design/echo-identity-doctrine.md`](design/echo-identity-doctrine.md).
- Application code cannot tick Echo. Trusted lifecycle control stays behind a
  host adapter.
- Query observers are read-only.
- Mutation handlers run only during Echo scheduler-owned execution.
- Retry is explicit new causal input.
- Unsupported or rejected work is final for that attempt.

## Current Runtime Truth

- The production text path is Echo-hosted through jedit-owned ports.
- `EditorState.lines` is render/cache/navigation state, not production text
  authority.
- Interactive workspace flows open, edit, render, save, export, and checkpoint
  through the production text session/controller.
- Legacy local line state remains only for render/cache/navigation mechanics and
  explicit fixture support.
- WSC history, export, and replay witnesses exist for the current Echo-hosted
  path.
- The title-screen perf HUD and session profiler are intentionally enabled by
  default while title-scene performance remains under investigation.

## Key Design Documents

- Baseline Echo release gate:
  [`0024-jedit-powered-by-echo-release-gate.md`](design/0024-jedit-powered-by-echo-release-gate.md)
- Echo application-hosting pattern:
  [`0025-echo-application-hosting-pattern.md`](design/0025-echo-application-hosting-pattern.md)
- Echo hosting hardening:
  [`0026-echo-hosting-hardening-first-twenty.md`](design/0026-echo-hosting-hardening-first-twenty.md)
- Echo-hosted production cutover:
  [`0027-echo-hosted-production-cutover.md`](design/0027-echo-hosted-production-cutover.md)
- Reading cache and fallback boundaries:
  [`0032-jedit-echo-reading-cache-and-fallback-boundaries.md`](design/0032-jedit-echo-reading-cache-and-fallback-boundaries.md)
- Echo authoritative recovery gate:
  [`0033-echo-authoritative-recovery-gate-b.md`](design/0033-echo-authoritative-recovery-gate-b.md)
- Design cycle template:
  [`0034-design-cycle-template-and-lifecycle.md`](design/0034-design-cycle-template-and-lifecycle.md)
- CI shard and impact planning:
  [`0034-ci-shard-and-impact-planning.md`](design/0034-ci-shard-and-impact-planning.md)
- Title intro startup modal:
  [`0036-title-intro-startup-file-modal.md`](design/0036-title-intro-startup-file-modal.md)
- Vim command-line completion:
  [`0102-vim-command-line-completion-surface.md`](design/0102-vim-command-line-completion-surface.md)
- Vim power moves:
  [`0105-vim-power-moves-causal-parity.md`](design/0105-vim-power-moves-causal-parity.md)

The developer-facing Echo app recipe lives in
[`docs/echo-application-hosting-guide.md`](echo-application-hosting-guide.md).

## Validation Commands

Use narrow proof first, then the broader gate when changing runtime behavior:

```bash
npm run build
npm run --silent quality
npm run --silent release-gate:jedit-echo
git diff --check
```

For WF-0105 docs/data changes, run:

```bash
node --test --test-concurrency=1 spec/vim-power-parity-matrix.spec.mjs spec/vim-power-target-usability-fixtures.spec.mjs
npx --yes markdownlint-cli2 docs/BEARING.md docs/design/0105-vim-power-moves-causal-parity.md
```
