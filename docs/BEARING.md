# BEARING

Current bearing: prove, with executable evidence, that `jedit` is the first
correct Echo-hosted application without moving `jedit` nouns into Echo.

This document is intentionally compact. It records where the repo is now and
where the next work should start. Historical activity ledgers belong in git
history, merged PRs, release notes, and design docs.

## Current Truth

- The production TUI has no supported non-Echo text runtime mode.
- `TextBufferSessionPort` and `TextBufferOptic` are jedit app capabilities.
- Interactive workspace open, edit, read, render, save, export, and checkpoint
  flows route through the Echo-hosted production text session.
- `EditorState.lines` is render, navigation, and reading-cache material in
  production. It is not the text authority.
- Production undo/redo remains intentionally unsupported until modeled as
  explicit causal input.
- WSC history listing, current export, historical export, and replay closeout
  exist as agent-facing JSON surfaces.
- The Vim command-line completion surface exists for command and file
  completion, including invalid-command feedback.
- The active Vim/Jim expansion now needs a first-class grammar, motion algebra,
  text-object resolution, registers, repeat, macros, and causal proof.

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

## Active Work

The live product arc is **JIM: Jedit Is Modal**.

The repository, packages, contracts, release gates, WSC directories, and
internal APIs remain `jedit` until the Echo-powered proof and compatibility plan
make a user-facing rename safe. `jim` is the future command/product name for the
modal editor that grows out of this repo.

The immediate roadmap should continue from
[`WF-0105 - Vim Power Moves Causal Parity`](design/0105-vim-power-moves-causal-parity.md).
The next known goalpost is:

```text
Goalpost 7: Reading-Basis Motion Resolver
```

The work should convert motion/range interpretation from imperative cursor
helpers into explicit, basis-bound facts that can feed operator intents,
text-object resolution, repeat, macros, witnesses, and Echo-backed proof.

## Deferred Full Rewrite

Do not do a broad rewrite of `README.md`, `docs/technical-teardown.md`, or the
signpost set until a few more Echo/Jim architecture goalposts land.

Do compact truth passes when signposts become misleading. Save the full rewrite
for after the repo has executable proof for:

- Echo-backed text/edit authority in the interactive TUI;
- basis-bound Vim motion and operator ranges;
- causal or transactional edit operations;
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
  cursor, or editor semantics as core runtime concepts.
