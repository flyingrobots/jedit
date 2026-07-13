# BEARING

Current bearing: prove, with executable evidence, that `jedit` is the first
correct Echo-hosted application without moving `jedit` nouns into Echo.

This document is intentionally compact. It records where the repo is now and
where the next work should start. Historical activity ledgers belong in git
history, merged pull requests, release notes, and design docs.

## Current Truth

- `main` includes PR #160, which hardened Echo-backed projection boundaries,
  file materialization preflight, bounded-reading WSC recovery/export posture,
  speculative edit posture, Graft drawer posture, and inactive buffer records.
- The production TUI has no supported non-Echo text runtime mode.
- `TextBufferSessionPort` and `TextBufferOptic` are jedit app capabilities.
- Interactive workspace open, edit, read, render, save, export, and checkpoint
  flows route through the Echo-hosted production text session.
- In production, Echo/session authority owns causal text. `EditorState.lines`
  is the full local visible projection cache used for rendering, cursoring,
  and transitional edit planning. It must not be reconstructed from bounded
  readings. It is not saved or recovered as authority.
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
- Graft-backed source highlighting and projection display consume Graft 0.11.1
  projections. Plain-text prose spans remain available when
  `colorful >= 0.2.1` is on `PATH`, and `.edict` buffers can show upstream
  Core and Echo Target IR projection lanes through a generic projection panel.
  Those lanes can expose bounded provider-owned review payloads for display
  without jedit executing Echo, debugging Edict, hosting an Edict REPL,
  interpreting payload semantics, or admitting Jim artifacts.
- Graph-backed rope runtime authority is now an active hard gate. Do not begin
  new UI causal-honesty work until
  [`HT-0149 - Graph-Backed Rope Runtime Discovery`](design/0149-graph-backed-rope-runtime-discovery.md)
  proves a real graph-backed create/read/replace/checkpoint path.

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

That loop is the product golden path. Keep most roadmap attention here:

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

Safety and recovery work is the second lane. It matters, but it should not
hijack the golden path unless smoke tests, CI, or user-visible trust failures
force it forward:

1. **Recovery UX**: restart can surface inactive/unmaterialized local strands
   and offer resume, inspect disk, abandon, or later braid actions.
2. **External Edit Intake**: host changes become causal External Edit events
   instead of overwrite hazards.
3. **Braid Reconciliation UX**: compare canonical, local, external, historical,
   and proposal worldlines with explicit admit/defer/rewind choices.

Infrastructure and hygiene are the third lane. Keep these scoped:

- issue hygiene after major PRs, so umbrella issues do not become debt fog;
- native Echo speculative intent runtime when product pressure from `:why` and
  recovery proves the metadata shape;
- file watcher and external move detection as UX accelerators, not save-safety
  preconditions.

Immediate order:

1. Land
   [`HT-0149 - Graph-Backed Rope Runtime Discovery`](design/0149-graph-backed-rope-runtime-discovery.md)
   as the active runtime authority gate before more causal UI posture work.
   In parallel, land
   [`WF-0153 - E-Brake: Observed Absurdity Fixes`](design/0153-e-brake-absurdity-fixes.md)
   (issue #267): wire the existing undo/redo reducers as causal
   counter-edits, freeze the title scene behind a `title-unfreeze` label,
   replace the process-global root-id counter with a per-runtime allocator,
   and make the top-level guides pass an executable doc-path witness. The
   root-id slice gates future Echo transport parity witnessing.
2. Lock
   [`WF-0108A - :why Observation Evidence Roadmap`](design/0108a-why-observation-evidence-roadmap.md)
   and the cross-repo issue topology.
3. Keep
   [`WF-0106 - Emacs Ideas To Steal Causally`](design/0106-emacs-ideas-to-steal-causally.md)
   as the supporting product-surface packet for command catalog, describe,
   register, macro, buffer, diagnostics, and trace surfaces.
4. Do not resume the `:why` evidence gap sequence until the graph-backed
   create/read/replace/checkpoint path and witnesses land. When that runtime
   proof exists, resume in this order: local observation coordinate model,
   typed evidence obstructions, text-window evidence fields, Echo
   ReadingEnvelope identity, Supported Outcome Settlement outcome vocabulary,
   range-at-head rope history, then golden command witnesses.
5. Use existing proven Vim operations first: `dw`, `ciw`, `dd`, and `gUap`.
   Keep `n`/`N` and `:%s` for later slices once search entry and proposal
   preview are product-complete.

Active checklist:

- [x] Merge the outside-CWD `:edit` path fix.
- [x] Merge title-scene ray acceleration.
- [x] Update the signpost PR with current roadmap truth.
- [x] Land the signpost truth pass.
- [x] Remove the merged outside-CWD worktree and scratch bug note.
- [x] Triage issue #123.
- [x] Land WF-0105 search and structural motion parity start.
- [x] Land causal roadmap signpost pass.
- [x] Start WF-0108 Editor Trust Gate preflight.
- [x] Land PR #160 Echo projection and materialization hardening.
- [x] Split #158 and #159 into focused post-#160 follow-up issues.

PR #160 closed the highest-risk projection/materialization blockers. Remaining
trust work should now be selected by product pressure:

- Restart recovery UI for inactive and unmaterialized buffers proves
  "recoverable" to users.
- External Edit intake turns host changes into causal inputs instead of save
  obstructions only.
- `/` and `?` search entry still needs product-complete behavior before search
  sets and substitute preview can be the main slice.

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
| Supported Outcome Settlement and `:why` | [`docs/design/supported-outcome-settlement-and-why.md`](design/supported-outcome-settlement-and-why.md) |
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
| `:why` observation evidence | [`docs/design/0108a-why-observation-evidence-roadmap.md`](design/0108a-why-observation-evidence-roadmap.md) |
| Graph-backed rope runtime gate | [`docs/design/0149-graph-backed-rope-runtime-discovery.md`](design/0149-graph-backed-rope-runtime-discovery.md) |
| Strand/braid worldline UX | [`docs/design/0121-strand-braid-worldline-ux.md`](design/0121-strand-braid-worldline-ux.md) |
| Optimistic strand worldline phases | [`docs/design/0146-optimistic-strand-worldline-phases.md`](design/0146-optimistic-strand-worldline-phases.md) |
| Unmaterialized file frontier | [`docs/design/0147-unmaterialized-file-frontier.md`](design/0147-unmaterialized-file-frontier.md) |
| Title render pipeline | [`docs/design/0107-geordi-raytraced-title-render-pipeline.md`](design/0107-geordi-raytraced-title-render-pipeline.md) |

## Next And Follow-Up Anchors

| Cycle | Issue | Role |
| --- | --- | --- |
| WF-0106 | [#192](https://github.com/flyingrobots/jedit/issues/192) | Emacs Ideas To Steal Causally |
| WF-0108 | [#131](https://github.com/flyingrobots/jedit/issues/131) | Jim Command Provenance And `:why` |
| WF-0108A | [#181](https://github.com/flyingrobots/jedit/issues/181) | Complete `:why` Through Observation Evidence |
| WF-0109 | [#134](https://github.com/flyingrobots/jedit/issues/134) | Historical Basis Preview |
| WF-0110 | [#132](https://github.com/flyingrobots/jedit/issues/132) | Search Sets And Substitute Strand Preview |
| WF-0111 | [#133](https://github.com/flyingrobots/jedit/issues/133) | Historical Yank And Register Provenance |
| WF-0121 | [#153](https://github.com/flyingrobots/jedit/issues/153) | Strand/Braid Worldline UX foundation |
| WF-0124 | [#161](https://github.com/flyingrobots/jedit/issues/161) | Restart Recovery UI |
| WF-0125 | [#162](https://github.com/flyingrobots/jedit/issues/162) | External Edit Intake |
| WF-0126 | [#163](https://github.com/flyingrobots/jedit/issues/163) | Braid And Diff Reconciliation UX |
| WF-0127 | [#164](https://github.com/flyingrobots/jedit/issues/164) | Native Echo Speculative Intent Runtime |
| WF-0128 | [#165](https://github.com/flyingrobots/jedit/issues/165) | File Watcher And External Move Detection |

## Active Work

The live product arc is **JIM: Jedit Is Modal**.

The repository, packages, contracts, release gates, WSC directories, and
internal APIs remain `jedit` until the Echo-powered proof and compatibility plan
make a user-facing rename safe. `jim` is the future command/product name for the
modal editor that grows out of this repo.

The active editing roadmap is now the causal product ladder above. WF-0105
remains the Vim power-move substrate, WF-0108 is the shipped base for command
provenance, WF-0108A is the current `:why` evidence-completion plan, and
WF-0106 is the supporting product-surface plan.

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
