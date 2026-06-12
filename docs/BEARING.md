# BEARING

Current bearing: prove, with executable evidence, that `jedit` is the first
correct Echo-hosted application without moving `jedit` nouns into Echo.

This document is intentionally compact. It records where the repo is now and
where the next work should start. Historical activity ledgers belong in git
history, merged pull requests, release notes, and design docs.

## Current Truth

- `main` includes the recent Vim power-move runtime work, the outside-CWD
  `:edit` path fix, and the title-scene ray acceleration work.
- The production TUI has no supported non-Echo text runtime mode.
- `TextBufferSessionPort` and `TextBufferOptic` are jedit app capabilities.
- Interactive workspace open, edit, read, render, save, export, and checkpoint
  flows route through the Echo-hosted production text session.
- `EditorState.lines` is render, navigation, and reading-cache material in
  production. It is not the text authority.
- Production undo/redo remains intentionally unsupported until modeled as
  explicit causal input.
- WSC history listing, current export, and historical export exist as
  agent-facing JSON surfaces. Replay closeout exists as app/spec proof, not yet
  as a standalone agent CLI.
- Vim command-line completion exists for command and file completion, including
  invalid-command feedback and forced quit dispatch.
- The Vim/Jim runtime now has parser, normal/operator-pending state, basis-bound
  core motions, core text objects, delete/change/yank/put execution, basic dot
  repeat, transformed-repeat metadata, case operators, joins, and local marks.

## Source Of Truth

Authority flows in this order:

1. Runtime behavior, saved files, generated artifacts, and release-gate output.
2. Tests, witnesses, JSON reports, and command output.
3. GitHub issues, pull requests, commits, and review threads.
4. Design docs and roadmap docs.
5. This bearing note.
6. Coordination memory.

Memory and this file are coordination aids. They do not override source,
commands, generated output, tests, GitHub state, or committed artifacts.

## Roadmap Pin

Do not cut a release just because recent cleanup PRs landed. The next release
decision needs an explicit release-readiness audit, version policy check,
changelog check, and release gate run.

Immediate order:

1. Land the signpost truth pass so the repo stops pointing agents at stale
   ledgers.
2. Clean local workspace debris after the signpost PR lands: the merged
   `fix/open-files-outside-cwd` worktree, merged local branches, and the
   scratch bug note for the already-fixed outside-CWD `:edit` issue.
3. Triage the live command-surface bug:
   [#123 Preview panel stays empty for command/file completions](https://github.com/flyingrobots/jedit/issues/123).
4. Resume the Jim/Vim roadmap from
   [`WF-0105 - Vim Power Moves Causal Parity`](design/0105-vim-power-moves-causal-parity.md).

Active checklist:

- [x] Merge the outside-CWD `:edit` path fix.
- [x] Merge title-scene ray acceleration.
- [x] Update the signpost PR with current roadmap truth.
- [x] Land the signpost truth pass.
- [x] Remove the merged outside-CWD worktree and scratch bug note.
- [x] Triage issue #123.
- [x] Start WF-0105 search and structural motion parity.

The next implementation lane is **search and structural motion parity**:

- Active issue:
  [#128 WF-0105: Search and structural motion parity](https://github.com/flyingrobots/jedit/issues/128).
- `/`, `?`, `n`, and `N` should resolve against explicit reading-basis match
  facts instead of hidden UI state.
- `%`, section, paragraph, and structure-aware motions should become explicit
  motion results with typed unsupported posture where structure is unavailable.
- Search history and match identity should be visible to tests and agents.
- Operator integration must keep the same basis-bound execution discipline as
  the landed core motion and text-object work.

Lane checklist:

- [x] Paragraph motions resolve blank-line basis boundaries.
- [x] `%` resolves balanced bracket pairs with structural pair identity.
- [x] `n` and `N` resolve stored literal search match identity.
- [ ] `/` and `?` populate search history from UI input.
- [x] `[[` and `]]` expose honest section-motion posture.

After that lane, continue WF-0105 through:

- Graft-backed structural text objects for functions, classes, comments, tags,
  and language blocks.
- Visual selection state and visual operators.
- Register hardening: append, black-hole, numbered, expression, and clipboard
  policy.
- Macro recording/replay as causal scripts with obstruction reports.
- Substitute/global/range commands with previewable causal strand posture.
- Agent/MCP Vim power witnesses and a parity release gate.

## Parked Lanes

- [`WF-0107 - Geordi Ray-Traced Title Render Pipeline`](design/0107-geordi-raytraced-title-render-pipeline.md)
  is a valid title-rendering lane, but it is not the current editor-product
  roadmap. Return to it when title-render debug output, frame targets, packed
  cells, or GPU-ready scheduling are the objective.
- Title FPS real key-state input remains tracked by
  [#114](https://github.com/flyingrobots/jedit/issues/114), with the transport
  dependency tracked outside this repo.
- Cool-ideas issues are backlog, not roadmap. Promote one only when it has a
  design anchor, proof surface, and clear release-gate relationship.

## Roadmap Anchors

| Area | Current anchor |
| --- | --- |
| Roadmap policy | [`docs/method/roadmap-planning.md`](method/roadmap-planning.md) |
| Echo release gate | [`docs/design/0024-jedit-powered-by-echo-release-gate.md`](design/0024-jedit-powered-by-echo-release-gate.md) |
| Echo hosting pattern | [`docs/design/0025-echo-application-hosting-pattern.md`](design/0025-echo-application-hosting-pattern.md) |
| Production cutover | [`docs/design/0027-echo-hosted-production-cutover.md`](design/0027-echo-hosted-production-cutover.md) |
| Identity doctrine | [`docs/design/echo-identity-doctrine.md`](design/echo-identity-doctrine.md) |
| Reading cache boundary | [`docs/design/0032-jedit-echo-reading-cache-and-fallback-boundaries.md`](design/0032-jedit-echo-reading-cache-and-fallback-boundaries.md) |
| WSC durability scope | [`docs/design/0035-jedit-wsc-durability-scope.md`](design/0035-jedit-wsc-durability-scope.md) |
| End-to-end Echo path | [`docs/jedit-echo-end-to-end.md`](jedit-echo-end-to-end.md) |
| Stack map | [`docs/stack-map.md`](stack-map.md) |
| Vim command surface | [`docs/design/0102-vim-command-line-completion-surface.md`](design/0102-vim-command-line-completion-surface.md) |
| Vim target workflows | [`docs/design/0105-vim-target-usability-tests.md`](design/0105-vim-target-usability-tests.md) |
| Vim/Jim power moves | [`docs/design/0105-vim-power-moves-causal-parity.md`](design/0105-vim-power-moves-causal-parity.md) |
| Emacs ideas to steal causally | [`docs/design/0106-emacs-ideas-to-steal-causally.md`](design/0106-emacs-ideas-to-steal-causally.md) |
| Title render pipeline | [`docs/design/0107-geordi-raytraced-title-render-pipeline.md`](design/0107-geordi-raytraced-title-render-pipeline.md) |

## Active Work

The live product arc is **JIM: Jedit Is Modal**.

The repository, packages, contracts, release gates, WSC directories, and
internal APIs remain `jedit` until the Echo-powered proof and compatibility plan
make a user-facing rename safe. `jim` is the future command/product name for the
modal editor that grows out of this repo.

The active editing roadmap is WF-0105. The currently pinned lane is search and
structural motion parity, with command-surface bug #123 as the nearest
user-visible bug to triage.

## Deferred Full Rewrite

Do not do a broad rewrite of `README.md`, `docs/technical-teardown.md`, or the
signpost set until a few more Echo/Jim architecture goalposts land.

Do compact truth passes when signposts become misleading. Save the full rewrite
for after the repo has executable proof for:

- Echo-backed text/edit authority in the interactive TUI;
- basis-bound Vim search and structural motions;
- causal or transactional edit operations beyond the landed core operators;
- at least one open/edit/save/quit usability witness;
- durable WSC evidence that can recover and export a historical basis.

## Non-Negotiables

- Application code cannot tick Echo.
- Application dispatch does not execute synchronously.
- Trusted host lifecycle control stays behind a host adapter.
- Mutation handlers run only during Echo scheduler-owned execution.
- Query observers are read-only.
- Retry is explicit new causal input.
- Unsupported or rejected work is final for that attempt.
- Echo remains generic and must not learn jedit, Vim, Jim, text, buffer, pane,
  cursor, register, macro, or editor semantics as core runtime concepts.
