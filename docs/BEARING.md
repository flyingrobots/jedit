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
- Graft-backed source highlighting consumes Graft 0.10.0 projections, including
  plain-text prose spans when `colorful >= 0.2.1` is available on `PATH`.

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

Release is off the immediate radar. The next public release decision needs an
explicit release-readiness audit, version policy check, changelog check, release
gate run, UI/UX pass, and a demo path that proves Jim's causal product promise.

Jim's product promise:

```text
Jim is a modal editor for people and agents who need edits to be explainable,
recoverable, and reviewable.
```

The active roadmap is Jim's signature loop:

```text
explain -> preview -> admit -> recover
```

That loop is tracked as goalposts:

1. **Editor Trust Gate**: open, edit, save, quit, search, dirty-state, and
   disk-output guardrails are witness-proven.
2. **Command Provenance And `:why`**: the last meaningful Vim edit can explain
   what ran, what target resolved, what changed, and what evidence proves it.
3. **Historical Basis Preview**: History can preview a bounded historical
   reading while clearly saying the current head is unchanged.
4. **Search Sets And Substitute Strand Preview**: search creates basis-bound
   result sets, `:%s` previews a proposal strand, and `:admit` admits selected
   rows.
5. **Historical Yank And Register Provenance**: retained historical material can
   be yanked into the current head with source evidence.
6. **Vim Power Core**: visual mode, serious registers, semantic repeat, macros,
   marks, structural text objects, and range commands land through causal
   proofs.
7. **Agent-Safe Editing**: agents produce accountable proposal strands with
   basis, range, rationale, evidence, and admission paths.

Immediate order:

1. Land the causal roadmap signpost pass.
2. Start [`WF-0108 - Jim Command Provenance And :why`](design/0108-causal-command-provenance-surface.md).
3. Run the Editor Trust Gate preflight before implementation:
   open/edit/save/quit, `/` and `?` search entry, dirty quit, dirty file switch,
   single-buffer versus multi-buffer posture, and disk-output verification.
4. Implement the first command-provenance slice only after trust blockers are
   either fixed or honestly scoped.

Active checklist:

- [x] Merge the outside-CWD `:edit` path fix.
- [x] Merge title-scene ray acceleration.
- [x] Update the signpost PR with current roadmap truth.
- [x] Land the signpost truth pass.
- [x] Remove the merged outside-CWD worktree and scratch bug note.
- [x] Triage issue #123.
- [x] Land WF-0105 search and structural motion parity start.
- [x] Land causal roadmap signpost pass.
- [ ] Start WF-0108 Editor Trust Gate preflight.

WF-0105 remains the broad Vim/Jim power-move roadmap. Its next slices should be
chosen only when they strengthen provenance, preview, replay, safe destructive
edits, agent witnesses, structural objects, or user trust.

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
| Jim command provenance and `:why` | [`docs/design/0108-causal-command-provenance-surface.md`](design/0108-causal-command-provenance-surface.md) |
| Title render pipeline | [`docs/design/0107-geordi-raytraced-title-render-pipeline.md`](design/0107-geordi-raytraced-title-render-pipeline.md) |

## Next Cycle Anchors

| Cycle | Issue | Role |
| --- | --- | --- |
| WF-0108 | [#131](https://github.com/flyingrobots/jedit/issues/131) | Jim Command Provenance And `:why` |
| WF-0109 | [#134](https://github.com/flyingrobots/jedit/issues/134) | Historical Basis Preview |
| WF-0110 | [#132](https://github.com/flyingrobots/jedit/issues/132) | Search Sets And Substitute Strand Preview |
| WF-0111 | [#133](https://github.com/flyingrobots/jedit/issues/133) | Historical Yank And Register Provenance |

## Active Work

The live product arc is **JIM: Jedit Is Modal**.

The repository, packages, contracts, release gates, WSC directories, and
internal APIs remain `jedit` until the Echo-powered proof and compatibility plan
make a user-facing rename safe. `jim` is the future command/product name for the
modal editor that grows out of this repo.

The active editing roadmap is now the causal product ladder above. WF-0105
remains the Vim power-move substrate, and WF-0108 is the next pinned design
cycle because it turns that substrate into Jim's user-facing differentiator.

## Deferred Full Rewrite

Do not do a broad rewrite of `README.md`, `docs/technical-teardown.md`, or the
signpost set until a few more Echo/Jim architecture goalposts land.

Do compact truth passes when signposts become misleading. Save the full rewrite
for after the repo has executable proof for:

- Echo-backed text/edit authority in the interactive TUI;
- basis-bound Vim search and structural motions;
- causal command provenance beyond the landed core operators;
- previewable broad edits;
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
