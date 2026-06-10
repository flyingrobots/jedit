# BEARING

Current bearing: prove, with executable evidence, that `jedit` is the first
correct Echo-hosted application without moving `jedit` nouns into Echo.

The completed release-gate baseline is
[`docs/design/0024-jedit-powered-by-echo-release-gate.md`](design/0024-jedit-powered-by-echo-release-gate.md).
That plan records slices 1-30 and the proof that `jedit` has an installed
package/evidence path.

The active post-release-pressure direction is
[`docs/design/0025-echo-application-hosting-pattern.md`](design/0025-echo-application-hosting-pattern.md).
That completed plan proved the reusable Echo application-hosting pattern before
applying the model to Graft, Think, or other apps.

The active hardening plan is
[`docs/design/0026-echo-hosting-hardening-first-twenty.md`](design/0026-echo-hosting-hardening-first-twenty.md).
That plan records slices 41-60. The current branch closes slice 60: trusted
lifecycle start/drain/stop, package identity, install posture, Echo no-app-noun
guards, ticketed mutation authority, read-only query observers, local receipt
correlation, retained lookup, restart recovery, replay identity, counter
template portability, guide drift checks, and release-gate consolidation are
closed locally.

The active production cutover plan is
[`docs/design/0027-echo-hosted-production-cutover.md`](design/0027-echo-hosted-production-cutover.md).
It records slices 61-80. The mission is no longer "support Echo mode" as a
parallel product path. The mission is to make jedit's production text model
Echo-hosted, quarantine or delete the legacy in-memory authority path, and keep
Echo free of text/editor nouns.

The current branch closes slices 61-80 at the production session and witness
boundary: text runtime posture is now Echo-hosted only, direct text authority
paths are inventoried, and the production text session opens, edits,
checkpoints, observes bounded windows, exports materialized text, reports
retained refs, and proves local replay through `TextBufferSessionPort`. The
release gate now runs the production session witness and static guard.

The current branch extends that proof through slices 81-90: interactive
workspace open, initial read, render, insert/delete/backspace, viewport refresh,
save/export, checkpoint, and static guard coverage now run through the
jedit-owned production text session. `EditorState.lines` remains a render and
navigation cache, not production text authority.

The current branch also closes slices 101-110: render-cache terminology is
explicit, reading-cache behavior is isolated, edit range planning has a
jedit-owned boundary, replace commands flow through the production session,
production undo/redo is explicitly unsupported until modeled as causal input,
footer/preview/highlight surfaces consume reading material, active-buffer save
targeting is covered, and non-Echo text runtime profiles have been removed
from the production TUI surface.
The local notes for this package live in
[`docs/design/0032-jedit-echo-reading-cache-and-fallback-boundaries.md`](design/0032-jedit-echo-reading-cache-and-fallback-boundaries.md).

The current branch also advances the Echo retained-evidence release-gate batch:
the text-window observer adapter now projects reading retained-evidence posture
into `TextBufferSessionPort`, and the witness consumes those refs instead of
manufacturing reading evidence after observation. The same witness now carries
generated structural-history `replaceTextRange` intent material from Wesley
metadata while the lower hot-text executor remains a transitional adapter
detail. The structural-history contract also has an explicit generated-package
descriptor that installs through the same generic Echo contract-package port;
the witness now reports an explicit mutation/query round trip: the
structural-history package owns the `replaceTextRange` mutation and receipt
coordinate, while the transitional hot-text package still owns the bounded
`textWindow` observer until the generated structural-history query path lands.
`scripts/jedit-echo-release-gate.mjs --json-report` now emits the consolidated
happy path, unsupported mutation path, local replay posture, retained evidence,
and authority-boundary report for the current release-gate PR.

The developer-facing recipe lives in
[`docs/echo-application-hosting-guide.md`](echo-application-hosting-guide.md).

The current branch closes slices 127-136: WSC history listing now exposes
app-safe submissions, outcomes, receipts, readings, checkpoints, rejection
reasons, export refs, and typed missing-evidence posture; WSC replay compares
semantic evidence while excluding host timing; current export ignores retained
rejections for applied-text export; an agent JSON CLI lists and exports
historical bases; the release gate includes the WSC history/export/replay
witnesses; and the reusable Echo hosting guide carries the portability template
and Graft/Think readiness checklist.

The active title startup UX slice is
[`docs/design/0036-title-intro-startup-file-modal.md`](design/0036-title-intro-startup-file-modal.md).
It records the deterministic intro timing, Enter/Escape skip behavior, and the
post-intro startup modal with input and current-directory files. This is jedit
UI state only; it does not create Echo work, add a recent-workspace database, or
reopen non-Echo runtime modes.

## Active Plan: Vim Command-Line Completion Surface

The next file-selection consolidation plan is
[`docs/design/0102-vim-command-line-completion-surface.md`](design/0102-vim-command-line-completion-surface.md).
The goal is to make `:` in Normal mode enter a Vim-shaped command-line context,
render provider-backed inline completions as Bijou-shaped components, open files
through `:edit <path>`, and reuse the same completion component for later
Graft-backed editor symbol, documentation, source-definition, and causal-history
previews.

The target workflow ledger is
[`docs/design/0105-vim-target-usability-tests.md`](design/0105-vim-target-usability-tests.md).
It records common Vim-shaped end-to-end usability tests for open, edit, save,
quit, invalid command recovery, dirty quit obstruction, unsupported files,
restart recovery, and multi-file editing. These workflows are target contracts
until the production TUI harness can drive them and verify filesystem and
Echo-hosted text evidence.

## Active Plan: Vim Power Moves Causal Parity

The Vim parity expansion plan is
[`docs/design/0105-vim-power-moves-causal-parity.md`](design/0105-vim-power-moves-causal-parity.md).
The goal is comprehensive Vim power-move parity through a jedit-owned grammar,
motion algebra, text-object resolver, operator compiler, registers, macros,
repeat, search/substitute, marks, visual mode, and causal strand/braid
extensions, while preserving Echo as generic causal authority rather than
teaching Echo Vim or editor nouns.

This arc locks `jim` as the future user-facing command and editor name:
`JIM = Jedit Is Modal`. The repository, packages, internal contracts, WSC
directories, and release gates stay `jedit` until the Echo-powered proof and
compatibility plan make the rename safe. The arc is intentionally 30 slices,
doubling the first draft so each Vim parity step has a focused proof surface
instead of becoming a broad compatibility bucket.

The stacked power-moves branches advance Slice 2 by adding
[`docs/design/0105-vim-power-moves-parity-matrix.json`](design/0105-vim-power-moves-parity-matrix.json)
and `spec/vim-power-parity-matrix.spec.mjs`. The matrix is the current-state
inventory for motions, operators, text objects, visual modes, registers, marks,
macros, repeat, search/substitute, and ex commands. It records supported,
partial, unsupported, and causally enhanced rows without turning planned work
into fake proof.

The stacked power-moves branches also advance Slice 3 by adding
[`docs/design/0105-vim-power-target-usability-fixtures.json`](design/0105-vim-power-target-usability-fixtures.json)
and `spec/vim-power-target-usability-fixtures.spec.mjs`. Those fixtures turn
the target workflows into structured witness inputs tied back to matrix row ids,
while still marking them as target fixtures rather than runtime proof.

The current branch advances Slice 4 by making register and transaction doctrine
the first part of the grammar-token goalpost. Registers remain required
user-facing Vim language state, backed by Echo evidence but owned by jedit.
Read-resolve-write commands such as `di"` are transaction-optic candidates:
they must resolve and mutate on one basis, obstruct stale basis, or explicitly
transform to a newer basis. Silent read-then-later-write is forbidden.

The `vim/power-moves-execution` branch adds the first runtime execution package
after the grammar/state-machine scaffolding: reading-basis motion resolution,
core motion parity, text-object resolution, operator execution, delete, change,
yank, put, named register storage, register provenance facts, Normal-mode
pending Vim keys, and dot repeat. The proof surface is
`spec/vim-power-execution.spec.mjs`; full search, structural motions, advanced
registers, transformed repeat, macros, marks, visual mode, substitute, and
causal strand previews remain open.

## Active Plan: Executable Design Cycle Template

The current branch advances
[`docs/design/0034-design-cycle-template-and-lifecycle.md`](design/0034-design-cycle-template-and-lifecycle.md).
The goal is to make full-cycle design docs official, repo-specific, and hostile
to fake proof: design defines intent, while implementation requires executable
witnesses over real software surfaces.

## Active Plan: CI Shard And Impact Planning

The current branch advances
[`docs/design/0034-ci-shard-and-impact-planning.md`](design/0034-ci-shard-and-impact-planning.md).
The goal is to shorten jedit pull-request iteration time by splitting the
single `npm run check` CI monolith into auditable shards, while keeping a final
aggregate `check` gate and forcing full CI whenever the planner cannot prove a
narrower shard set is sufficient.
Shard jobs consume the build job's `dist` artifact through
`spec/dist-helpers.mjs`; spec-local loaders must not rebuild TypeScript when
`JEDIT_DIST_PREBUILT=1`.

## Active Plan: Echo Authoritative Recovery Gate B

The current branch advances
[`docs/design/0033-echo-authoritative-recovery-gate-b.md`](design/0033-echo-authoritative-recovery-gate-b.md).
Echo now exposes a generic recovery gate payload; jedit must consume that truth
through app-owned ports, keep CLI/process/WAL details adapter-private, block
legacy local-memory fallback, and emit an honest recovery report.

Gate question:

```text
Can jedit consume Echo truth through ports without local memory fallback?
```

- [x] Slice 18: \[jedit] Echo recovery port interface.
- [x] Slice 19: \[jedit] Echo recovery adapter implementation.
- [x] Slice 20: \[jedit] generic-to-editor posture mapping.
- [x] Slice 21: \[jedit] stable edit submission identity.
- [x] Slice 22: \[jedit] recovery evidence report fields.
- [x] Slice 32: \[jedit] production legacy memory static guard.
- [x] Slice 33: \[jedit] release-gate runtime tripwire mode.
- [x] Slice 23: \[jedit] recovered bounded reading path.
- [x] Slice 24: \[jedit] happy-path recovery gate scenario.
- [x] Slice 25: \[jedit] retry after local amnesia scenario.
- [x] Slice 34: \[jedit] materialize artifact from recovered causal basis.

## Active Plan: Interactive Workspace Echo Cutover

The next plan is not WSC. WSC waits until the interactive workspace cutover is
credible. The current production text session and witness prove that jedit can
drive its text model through a jedit-owned Echo-hosted session. Slices 81-90
make the interactive workspace consume that session as production text
authority for open, edit, render, save, export, and checkpoint flows.
Slices 101-110 close remaining render-cache, edit-planner, status, and
runtime-profile ambiguity before WSC durability begins.

Core claim:

```text
jedit's interactive workspace opens, edits, renders, saves, exports, and
checkpoints text through jedit-owned ports backed by Echo-hosted causal state.
Echo remains generic and contains no text, editor, file, buffer, cursor, or
selection nouns.
```

Closed drift:

- `src/app/workspace/file-tree.ts` opens production files through the text
  session port.
- `src/app/workspace/viewer-key.ts` plans production text mutations through
  session commands instead of mutating cached lines.
- `src/app/workspace/viewer-content.ts` renders production text from the
  reading cache.
- `src/app/workspace/global-key-bindings.ts` saves production text by exporting
  and checkpointing through the session port.
- The production cutover guard covers current production session files and
  catches legacy authority bypass tokens.

Remaining caveat:

- The legacy line model still exists for render/cache/navigation mechanics and
  focused fake-port tests. It is not production text authority.

Slices 81-90 are now closed locally. Each slice below includes its user story,
acceptance criteria, test plan, and checklist.

### Slice 81 - Workspace Text Authority State

User story:

As a jedit workspace user, I want the UI to represent Echo-hosted text authority
separately from the render cache, so the displayed lines never become the
production source of truth.

Acceptance criteria:

- Workspace state records the production text authority posture for each open
  text buffer.
- Rendered lines are modeled as a reading-derived cache, not authoritative
  mutable text.
- Pending, opened, dirty, obstructed, checkpointed, and exported postures can
  be represented without granting tick authority to the UI.
- The production default remains Echo-hosted; local direct text authority is
  allowed only as an explicit test fixture posture.

Test plan:

- Add state-model tests proving Echo-hosted authority and render cache are
  distinct fields.
- Add tests for pending, opened, obstructed, and dirty postures.
- Add a guard assertion that workspace state does not expose lifecycle tick or
  scheduler controls.

Checklist:

- [x] Add or update workspace text authority types.
- [x] Keep display lines as cache-only data.
- [x] Cover authority/cache distinction in tests.
- [x] Update design docs if names differ from this plan.

### Slice 82 - Open File Through Production Session

User story:

As a user opening a file, I want jedit to import file bytes into the production
text session and receive an Echo-backed buffer posture, instead of treating the
loaded file as mutable in-memory authority.

Acceptance criteria:

- File open routes through `ProductionTextSession.openBuffer` or the equivalent
  `TextBufferSessionPort` method.
- The file adapter is used only to read host bytes before jedit submits them
  into its Echo-backed text session.
- Failed or obstructed open operations produce explicit UI posture and do not
  leave the workspace pretending the file opened successfully.
- Opening a file does not call lifecycle drain, scheduler tick, or runtime
  control directly.

Test plan:

- Add file-tree or workspace command tests proving open calls the production
  session port.
- Add obstruction tests proving failed open leaves an obstruction posture.
- Add a no-tick-authority assertion for the open path.

Checklist:

- [x] Route production file open through the text session port.
- [x] Preserve file adapter as an import source, not text authority.
- [x] Represent open obstruction in workspace state.
- [x] Cover open behavior with deterministic tests.

### Slice 83 - Initial Bounded Reading After Open

User story:

As a user after opening a file, I want the first visible editor contents to come
from a bounded Echo-backed reading with evidence, so the workspace can explain
what it is showing.

Acceptance criteria:

- Successful open requests an initial bounded window reading.
- The UI render cache is populated from that reading.
- The reading identity and posture are retained in workspace state.
- Query observer behavior remains read-only.

Test plan:

- Add tests proving open success triggers `observeWindow` or the equivalent
  bounded read.
- Assert rendered lines match the reading payload.
- Assert reading evidence reaches workspace state.
- Assert read path does not mutate text state.

Checklist:

- [x] Trigger initial bounded read after open.
- [x] Populate render cache from reading output.
- [x] Store reading identity/posture.
- [x] Prove query/read path remains read-only.

### Slice 84 - Render From Reading Cache

User story:

As a user viewing text, I want the editor surface to render from the latest
bounded reading cache, so rendering cannot accidentally become another source of
truth.

Acceptance criteria:

- Viewer rendering in the production profile reads from the reading-derived
  cache.
- Source highlighting and preview materialization consume reading text through
  ports.
- Missing or stale reading state renders an explicit posture instead of silently
  falling back to direct line authority.
- No production render path depends on direct mutable `EditorState.lines`
  authority.

Test plan:

- Add viewer-content tests proving production rendering consumes the reading
  cache.
- Add missing-reading tests for explicit posture.
- Extend the static guard to catch direct production render authority imports
  if needed.

Checklist:

- [x] Route production viewer rendering through reading cache.
- [x] Route preview/highlighting through reading materialization ports.
- [x] Add explicit missing-reading posture.
- [x] Expand guard coverage for direct render authority.

### Slice 85 - Insert And Replace Command Planner

User story:

As a user typing or replacing selected text, I want jedit to plan a contract
operation from the current cursor or selection and submit it through the
Echo-hosted text session, so local key handling never mutates production text
directly.

Acceptance criteria:

- Insert and replace commands translate UI cursor/selection state into jedit
  contract ranges.
- Production insert and replace submit through `insertText`/`replaceRange` or
  equivalent port methods.
- The UI does not mutate cached lines before an applied outcome or refreshed
  reading is available.
- Obstructions are surfaced as editor issues without pretending the edit
  succeeded.

Test plan:

- Add key-command tests proving insert routes through the session port.
- Add replace tests proving selection ranges become contract ranges.
- Add obstruction tests proving cached lines are unchanged on failure.
- Add no-direct-mutation assertions for the production edit path.

Checklist:

- [x] Add production insert command planner.
- [x] Add production replace command planner.
- [x] Refresh bounded reading after applied outcome.
- [x] Cover obstruction and no-local-mutation behavior.

### Slice 86 - Delete And Backspace Command Planner

User story:

As a user deleting text, I want delete and backspace to submit bounded jedit
contract operations, so deletion has the same Echo-backed evidence path as
insert and replace.

Acceptance criteria:

- Delete and backspace commands translate UI state into contract delete ranges.
- Production delete submits through `deleteRange` or the equivalent port method.
- Unsupported multi-range or structurally ambiguous deletes return typed
  obstruction until explicitly designed.
- Production delete never falls back to direct line mutation.

Test plan:

- Add delete/backspace command tests proving the session port is called.
- Add edge tests for start-of-buffer, end-of-buffer, and selection deletion.
- Add unsupported multi-range obstruction tests if multi-range is not in scope.
- Add no-direct-mutation assertions for production delete paths.

Checklist:

- [x] Add production delete command planner.
- [x] Add production backspace command planner.
- [x] Define unsupported multi-range posture if needed.
- [x] Cover delete behavior with deterministic tests.

### Slice 87 - Cursor And Viewport Refresh Reads

User story:

As a user moving the cursor or viewport, I want jedit to update local view
position without creating edits, and request new bounded readings only when the
visible aperture changes.

Acceptance criteria:

- Cursor movement changes UI cursor state without submitting mutation intents.
- Viewport movement may request a new bounded reading when the reading aperture
  changes.
- Echo basis/reading identity and UI cursor position remain separate.
- Movement paths do not call lifecycle drain, scheduler tick, or runtime
  control directly.

Test plan:

- Add cursor movement tests proving no edit intent is submitted.
- Add viewport movement tests proving bounded reads occur only on aperture
  changes.
- Add state tests proving reading basis and cursor state are separate.

Checklist:

- [x] Separate cursor state from Echo reading basis.
- [x] Add aperture-change read refresh logic.
- [x] Avoid edit submission on movement.
- [x] Cover movement and viewport refresh with tests.

### Slice 88 - Save And Export UI Boundary

User story:

As a user saving a file, I want jedit to materialize file bytes from the
Echo-backed reading/export path, so save is a jedit-owned artifact export and
not a mutation of Echo state.

Acceptance criteria:

- Save/export materializes text from the production session or reading
  materialization port.
- Host file writes happen only after successful materialization.
- Checkpoint remains a contract/session operation distinct from file export.
- Save/export failure does not clear dirty posture.

Test plan:

- Add save tests proving host file write happens after successful materialized
  reading/export.
- Add failure tests proving dirty posture remains true.
- Add checkpoint tests proving checkpoint uses the session port and does not
  imply file export.
- Add no-Echo-mutation assertion for export-only paths.

Checklist:

- [x] Route save through materialized Echo-backed text.
- [x] Keep checkpoint and file export distinct.
- [x] Preserve dirty posture on failed save/export.
- [x] Cover save/export behavior with tests.

### Slice 89 - Legacy Direct Mutation Quarantine

User story:

As a maintainer, I want legacy direct line mutation quarantined behind fixtures
or adapter-private modules, so future production code cannot accidentally
restore the in-memory source of truth.

Acceptance criteria:

- Legacy direct text helpers are renamed, moved, or documented as fixtures,
  test-local behavior, or adapter-private implementation details.
- Production workspace files cannot import direct load/save/edit helpers.
- The static guard catches direct `EditorState.lines` authority usage in
  production paths.
- Tests and fixtures keep explicit escape hatches where they are still needed.

Test plan:

- Extend the production cutover guard to fail on direct production imports of
  direct load, save, insert, replace, delete, or raw line-authority helpers.
- Add a fixture import allow-list test if needed.
- Run the release gate and verify the guard reports actionable failures.

Checklist:

- [x] Quarantine legacy helper modules.
- [x] Expand static guard over production workspace paths.
- [x] Preserve explicit fixture/test-local escape hatches.
- [x] Update docs naming legacy state as non-production authority.

### Slice 90 - Interactive Echo Cutover Gate

User story:

As a maintainer preparing jedit for real Echo-powered use, I want one release
gate command to prove interactive open, edit, read, save/export, and checkpoint
flows all use the Echo-hosted production session without giving the app tick
authority.

Acceptance criteria:

- The release gate includes an interactive workspace smoke or equivalent
  executable witness.
- The witness covers open, initial read, insert/replace or delete, refreshed
  read, save/export, and checkpoint.
- The witness proves no direct lifecycle tick authority is exposed to UI or app
  command handlers.
- The gate fails with clear output when the interactive workspace bypasses the
  production text session.
- BEARING and design docs identify WSC as the next durability plan only after
  this cutover is credible.

Test plan:

- Add the interactive workspace smoke to `npm run release-gate:jedit-echo`.
- Run `npm run release-gate:jedit-echo`.
- Run `npm test` or the narrow relevant suites covering workspace command and
  render paths.
- Run `git diff --check`.

Checklist:

- [x] Add interactive workspace witness to release gate.
- [x] Prove open/edit/read/save/checkpoint through production session.
- [x] Prove no UI tick authority.
- [x] Mark slices 81-90 complete before starting WSC work.

## Next Plan: Powered By Echo Completion Budget

This is the 50-slice budget for moving from "interactive workspace cutover is
credible" to "jedit is powered by Echo" without weakening the generic Echo
boundary. Keep checking off slice items just before committing the slice that
closes them.

The plan has five bars:

1. [jedit] Make the current branch and release gate names unambiguous.
2. [jedit] Prove the real app path, not only seam fixtures.
3. [jedit] Quarantine or delete remaining legacy text-authority ambiguity.
4. [Echo][jedit] Persist and recover causal editing history through WSC.
5. [jedit][Echo] Close replay, export, authority, and release-readiness proofs.

Recovered execution posture:

- [x] Free slice A: recover the active branch context. The current branch is
  `enable-echo-hosted-tui-default`; recovered planning work through slice 110 is
  already present on this branch.
- [x] Free slice B: make the 50-slice budget visible as one progress ledger.
- [x] Free slice C: set the next execution window. Work proceeds through slices
  111-125, then pauses for a drift check before slice 126.

Drift-check watch items:

- WSC iteration time is now a first-class concern for the slice-126 drift
  check. Current observed focused witnesses are slow: `cargo test -p warp-core
  --test wsc_store_tests --no-run` and `cargo clippy -p warp-core --test
  wsc_store_tests -- -D warnings -D missing_docs` have taken roughly 45-68s
  because the target pulls `echo-graph` and `echo-dry-tests`; the Echo
  pre-commit hook adds roughly 25s for `warp-core` lib clippy/check. Candidate
  follow-up: split or slim the WSC store contract target so WSC envelope/store
  changes can validate without the broader adapter stack.
- jedit WSC reducer slices can keep a fast red/green loop by running the
  focused Node spec first, then `tsc`, `quality-gate`, and `git diff --check`
  once before commit. Slice 122's focused witness stayed near two seconds.

Progress ledger:

- [x] 91 - Rename The jedit Echo Gate.
- [x] 92 - Real App Harness Boundary.
- [x] 93 - Real App Open File Proof.
- [x] 94 - Real App Edit Proof.
- [x] 95 - Real App Save And Export Proof.
- [x] 96 - Real App Obstruction Posture.
- [x] 97 - Agent Workspace Witness.
- [x] 98 - UI Lifecycle Authority Audit.
- [x] 99 - Legacy Text Authority Inventory.
- [x] 100 - PR Gate And Review Package.
- [x] 101 - Rename Render Cache Concepts.
- [x] 102 - Text Reading Cache Module Boundary.
- [x] 103 - Cursor And Selection Planner Boundary.
- [x] 104 - Replace Selection Through Session.
- [x] 105 - Undo And Redo Policy Boundary.
- [x] 106 - Dirty, Pending, And Stale UI Posture.
- [x] 107 - Source Highlight From Reading Material.
- [x] 108 - Preview From Reading Material.
- [x] 109 - Multi-Buffer Authority Map.
- [x] 110 - Fixture-Local Fallback Quarantine.
- [x] 111 - WSC Durability Scope Document.
- [x] 112 - Echo WSC Store Port.
- [x] 113 - Persist Accepted Submission Events.
- [x] 114 - Persist Ticket And Receipt Correlation.
- [x] 115 - Persist Reading And Retention Refs.
- [x] 116 - WSC Atomic Commit Markers.
- [x] 117 - Recover Pending Submissions.
- [x] 118 - Recover Decided Submissions.
- [x] 119 - Reject Half-Accepted WSC State.
- [x] 120 - jedit WSC Workspace Store Adapter.
- [x] 121 - Startup Recovery From WSC.
- [x] 122 - Persist Edits After Settlement.
- [x] 123 - Restart Round Trip Proof.
- [x] 124 - Historical Basis Selection.
- [x] 125 - Current History Export.
- [x] 126 - Point-In-Time Export.
- [x] 127 - History Listing And Evidence View.
- [x] 128 - Replay Same Edits Same Evidence.
- [x] 129 - Host Timing Permutation Proof.
- [x] 130 - Conflict And Rejection Retention.
- [x] 131 - Multi-File History Recovery.
- [x] 132 - Agent Historical Export.
- [x] 133 - WSC Release Gate Integration.
- [x] 134 - DIND Replay Closeout.
- [x] 135 - Portability Template Update.
- [x] 136 - Graft/Think Readiness Checklist.
- [ ] 137 - End-To-End Guide Refresh.
- [ ] 138 - Version And Compatibility Audit.
- [ ] 139 - Authority And Security Audit.
- [ ] 140 - Powered By Echo Release Candidate Gate.

### Slice 91 - Rename The jedit Echo Gate

User story:

As a maintainer, I want the Echo-integration release gate named as a jedit gate,
so no one mistakes jedit application tests for Echo core release tests.

Acceptance criteria:

- `release-gate:jedit-echo` is the canonical package script.
- `release-gate:echo` remains only as a temporary compatibility alias or is
  removed with explicit docs.
- Docs and specs use the canonical jedit-prefixed name.
- The gate still runs the same focused jedit Echo-integration witnesses.

Test plan:

- Add or update the release-gate script spec.
- Run `npm run release-gate:jedit-echo`.
- Run `npm run build && npm run quality`.

Checklist:

- [x] Add canonical `release-gate:jedit-echo` script.
- [x] Update docs and quickstarts.
- [x] Preserve or intentionally remove the old alias.
- [x] Cover script naming with tests.

### Slice 92 - Real App Harness Boundary

User story:

As a maintainer, I want a non-terminal app harness that constructs the real
workspace app dependencies, so the next proofs exercise production wiring
instead of isolated reducers only.

Acceptance criteria:

- The harness builds the same workspace runtime path used by `main`.
- It injects deterministic file, clock, random, and production text ports.
- It does not expose trusted Echo lifecycle controls to app-facing tests.
- It can drive app messages and inspect rendered/state posture.

Test plan:

- Add a harness spec proving initialization uses the production text profile.
- Assert injected ports receive calls through their public interfaces only.
- Assert no lifecycle tick/drain method is exposed by the harness API.

Checklist:

- [x] Add real app harness module or test helper.
- [x] Inject deterministic ports.
- [x] Keep trusted lifecycle hidden.
- [x] Cover harness construction with tests.

### Slice 93 - Real App Open File Proof

User story:

As a user opening a file in jedit, I want the real app path to import host bytes
into the production text session before rendering the file.

Acceptance criteria:

- The harness opens a fixture file through the real file-tree/update path.
- Host file bytes are only an import source.
- Production text authority becomes opened with a bounded reading cache.
- The UI does not treat host-loaded lines as production authority.

Test plan:

- Add an app-harness open-file spec.
- Assert `openBuffer` and initial `observeWindow` calls.
- Assert rendered text comes from the returned reading.
- Assert no app-facing lifecycle control is called.

Checklist:

- [x] Drive real app file open.
- [x] Verify production session open/read calls.
- [x] Verify rendered cache comes from reading.
- [x] Verify no tick authority leak.

### Slice 94 - Real App Edit Proof

User story:

As a user typing in jedit, I want the real app key path to submit edits through
the production text session and wait for refreshed reading evidence.

Acceptance criteria:

- Insert, delete, and backspace go through the real key-binding/viewer path.
- The app submits session edit commands, not local authoritative mutation.
- The displayed text updates only from the applied result or refreshed reading.
- Receipt posture is retained in workspace state.

Test plan:

- Extend the app harness to send key messages.
- Assert production edit requests and receipt identity.
- Assert stale local cache does not become the final rendered text.
- Assert obstruction leaves the prior reading intact.

Checklist:

- [x] Drive insert through real app key path.
- [x] Drive delete/backspace through real app key path.
- [x] Assert receipt and reading posture.
- [x] Assert no direct authoritative line mutation.

### Slice 95 - Real App Save And Export Proof

User story:

As a user saving a file, I want the real app to export materialized text from
the production session and then write host file bytes.

Acceptance criteria:

- The real `ctrl-s` path exports text before host file write.
- Checkpoint and file export remain distinct operations.
- Failed export does not clear dirty posture or write stale text.
- Successful save records export and checkpoint posture.

Test plan:

- Add a real app save/export harness test.
- Assert host file writes use exported text.
- Assert checkpoint calls do not imply file write success.
- Add failure tests for export obstruction.

Checklist:

- [x] Drive `ctrl-s` through real app key path.
- [x] Verify export precedes host file write.
- [x] Verify checkpoint remains separate.
- [x] Cover export failure posture.

### Slice 96 - Real App Obstruction Posture

User story:

As a user, I want failed open, edit, read, export, or checkpoint operations to
show honest jedit posture instead of silently reverting to local state.

Acceptance criteria:

- Open obstruction leaves an explicit failed-open posture.
- Edit/read/export/checkpoint obstructions create visible runtime issues.
- Dirty and stale states are not cleared by obstruction.
- Obstruction does not trigger automatic retry.

Test plan:

- Add harness tests for each obstruction stage.
- Assert runtime issues are emitted with typed stage information.
- Assert production session calls are not repeated automatically.

Checklist:

- [x] Cover open obstruction.
- [x] Cover edit/read obstruction.
- [x] Cover export/checkpoint obstruction.
- [x] Assert no hidden retry.

### Slice 97 - Agent Workspace Witness

User story:

As an AI agent using jedit, I want a CLI or MCP witness that can open, edit,
read, save, and report evidence without privileged Echo authority.

Acceptance criteria:

- The agent witness uses the same production text session port.
- It reports structured JSON for open, edit, read, save, and checkpoint.
- It exposes no trusted lifecycle start, drain, stop, or tick controls.
- It fails closed with typed obstruction on unsupported operations.

Test plan:

- Add CLI or MCP adapter tests with deterministic fixture input.
- Assert JSON includes operation, receipt, reading, export, and checkpoint ids.
- Assert lifecycle authority names are absent from the public schema.

Checklist:

- [x] Add agent-facing workspace witness.
- [x] Cover successful structured report.
- [x] Cover obstruction report.
- [x] Guard against lifecycle authority exposure.

### Slice 98 - UI Lifecycle Authority Audit

User story:

As a maintainer, I want executable proof that interactive UI code cannot call
trusted Echo lifecycle controls.

Acceptance criteria:

- Production UI modules cannot import trusted lifecycle ports.
- App-facing production text session types do not expose tick/drain controls.
- Static guard catches `requestRunUntilIdle`, `requestStart`, and `requestStop`
  in production UI paths.
- Fixture-only exceptions are explicit and narrow.

Test plan:

- Extend the production cutover guard.
- Add a sample forbidden-file test.
- Run the jedit Echo release gate.

Checklist:

- [x] Expand lifecycle authority guard.
- [x] Add fixture allow-list if required.
- [x] Verify app-facing types remain safe.
- [x] Run release gate.

### Slice 99 - Legacy Text Authority Inventory

User story:

As a maintainer, I want every remaining direct text authority path inventoried,
so we can either delete it, fixture-scope it, or put it behind an adapter.

Acceptance criteria:

- BEARING or a design doc lists every remaining direct line-authority helper.
- Each entry has a disposition: delete, fixture, adapter-private, or keep as
  render cache.
- No entry is left as ambiguous production authority.
- The inventory is referenced by the static guard.

Test plan:

- Add a doc drift spec or guard that checks listed files exist.
- Run `rg` for legacy tokens and classify every match.
- Run `npm run build && npm run quality`.

Checklist:

- [x] Inventory legacy helper paths.
- [x] Assign a disposition to each path.
- [x] Reference inventory from docs or guard.
- [x] Verify no ambiguous production authority remains.

### Slice 100 - PR Gate And Review Package

User story:

As a reviewer, I want one PR package that explains the real app proof and gate
renaming without mixing it with WSC durability work.

Acceptance criteria:

- PR notes summarize slices 91-99.
- The branch has focused commits and clean status.
- `release-gate:jedit-echo`, build, quality, and diff checks pass.
- The summary states WSC is next and not included.

Test plan:

- Run `git diff --check`.
- Run `npm run release-gate:jedit-echo`.
- Run `npm run build && npm run quality`.
- Self-review the diff against this plan.

Checklist:

- [x] Update PR notes.
- [x] Run all local gates.
- [x] Self-review against plan.
- [x] Push for review.

### Slice 101 - Rename Render Cache Concepts

User story:

As a maintainer, I want display-line terminology to make cache status obvious,
so future work does not treat render data as production text authority.

Acceptance criteria:

- Production-facing names distinguish reading cache from text authority.
- `EditorState.lines` usage is documented as render/navigation cache where it
  remains.
- No app-facing name implies local lines are source of truth.
- Tests still prove render output comes from readings.

Test plan:

- Add or update naming-focused tests where public state is constructed.
- Run the production cutover guard.
- Run workspace render and edit specs.

Checklist:

- [x] Rename ambiguous render cache fields or helpers.
- [x] Update docs and tests.
- [x] Keep compatibility where necessary.
- [x] Run focused workspace specs.

### Slice 102 - Text Reading Cache Module Boundary

User story:

As a maintainer, I want text reading cache behavior isolated in one module, so
render, preview, highlight, and save paths cannot each invent authority rules.

Acceptance criteria:

- Reading cache creation, refresh, stale posture, and materialization live in a
  focused module.
- Consumers do not inspect raw reading internals unless needed for rendering.
- Missing or stale cache has explicit typed posture.
- The module has no Echo lifecycle authority.

Test plan:

- Add unit tests for cache creation, stale posture, and materialization.
- Add import guard coverage for production consumers.
- Run workspace render/save specs.

Checklist:

- [x] Add text reading cache module.
- [x] Move cache materialization helpers.
- [x] Cover missing/stale posture.
- [x] Update consumers.

### Slice 103 - Cursor And Selection Planner Boundary

User story:

As a user selecting text, I want jedit to translate cursor and selection state
into contract ranges through a planner, not through ad hoc key handlers.

Acceptance criteria:

- Cursor-to-byte and selection-to-range conversion live behind a planner.
- The planner owns unsupported selection posture.
- Production edit code does not duplicate range math.
- Echo remains unaware of cursor, selection, and text semantics.

Test plan:

- Add planner tests for single-line, multi-line, start, and end ranges.
- Add unsupported multi-range tests if not in scope.
- Run workspace edit specs.

Checklist:

- [x] Add cursor/selection planner boundary.
- [x] Move range conversion there.
- [x] Cover supported ranges.
- [x] Cover unsupported ranges.

### Slice 104 - Replace Selection Through Session

User story:

As a user replacing selected text, I want jedit to submit a replace operation
through the production text session with retained receipt and reading posture.

Acceptance criteria:

- Selection replacement uses the planner from slice 103.
- The production text session receives a replace-range request.
- The UI updates from the applied result or refreshed reading only.
- Failed replace leaves prior cache and selection posture honest.

Test plan:

- Add key or command tests for selection replacement.
- Assert replace request range and text.
- Add obstruction tests for invalid/stale selection.

Checklist:

- [x] Route selection replace through planner.
- [x] Submit replace through production session.
- [x] Refresh reading after applied replace.
- [x] Cover obstruction path.

### Slice 105 - Undo And Redo Policy Boundary

User story:

As a user, I want undo and redo behavior to be honest about causal history, so
jedit does not silently mutate local text outside Echo.

Acceptance criteria:

- Production undo/redo either submit explicit jedit contract intents or return
  typed unsupported posture.
- Local undo stacks do not mutate production text authority.
- Docs state undo is causal input, not historical rollback.
- Tests prove hidden local undo is unavailable in production profile.

Test plan:

- Add undo/redo key tests for production profile.
- Assert unsupported posture or explicit intent submission.
- Assert cached lines do not change on unsupported undo.

Checklist:

- [x] Define production undo/redo policy.
- [x] Block hidden local undo/redo.
- [x] Add tests for chosen policy.
- [x] Update docs.

### Slice 106 - Dirty, Pending, And Stale UI Posture

User story:

As a user, I want the UI to distinguish pending, dirty, stale, exported, and
checkpointed text state, so Echo-backed editing does not feel ambiguous.

Acceptance criteria:

- Workspace state exposes these postures without granting authority.
- Viewer/footer can render concise status.
- Stale reading and dirty buffer are distinct.
- Obstruction state is visible and not conflated with dirty state.

Test plan:

- Add state tests for posture transitions.
- Add footer/view tests for visible status.
- Add obstruction transition tests.

Checklist:

- [x] Add posture model if needed.
- [x] Render concise status.
- [x] Cover posture transitions.
- [x] Cover obstruction distinctions.

### Slice 107 - Source Highlight From Reading Material

User story:

As a user viewing highlighted source, I want highlighting to consume reading
material, not local text authority.

Acceptance criteria:

- Highlight refresh uses reading materialization or render cache input.
- It does not read host files or direct authoritative lines in production mode.
- Highlight failure does not change text authority.
- Stale highlight state is explicit.

Test plan:

- Add source-highlight integration tests for production text.
- Assert highlight input equals reading material.
- Add failure tests preserving text authority.

Checklist:

- [x] Route highlight input through reading material.
- [x] Remove production direct file/text bypass.
- [x] Cover success and failure.
- [x] Update guard if needed.

### Slice 108 - Preview From Reading Material

User story:

As a user opening preview mode, I want preview output to derive from the
bounded reading cache rather than hidden local text authority.

Acceptance criteria:

- Markdown/preview rendering consumes reading material in production mode.
- Missing reading state renders explicit posture.
- Preview does not submit edits or lifecycle controls.
- Preview refresh behavior is deterministic.

Test plan:

- Add preview render tests for production text.
- Assert stale local lines do not feed preview.
- Assert no production session edit calls occur.

Checklist:

- [x] Route preview through reading material.
- [x] Add missing-reading posture.
- [x] Cover no-edit behavior.
- [x] Run render specs.

### Slice 109 - Multi-Buffer Authority Map

User story:

As a user moving between files, I want each open file to have separate
Echo-backed authority and reading cache identity.

Acceptance criteria:

- Workspace state can represent multiple opened buffers or an explicit
  single-buffer limitation.
- Switching files does not lose authority posture for the previous file.
- Buffer id, file path, reading id, and dirty posture stay paired.
- Tests cover two files with different readings.

Test plan:

- Add multi-file open/switch tests.
- Assert per-file cache and authority identity.
- Assert save targets the active buffer only.

Checklist:

- [x] Define multi-buffer or explicit single-buffer policy.
- [x] Implement authority map if in scope.
- [x] Cover file switch behavior.
- [x] Cover active-buffer save behavior.

### Slice 110 - Fixture-Local Fallback Quarantine

User story:

As a maintainer, I want local direct text behavior available only through
focused fake-port tests, so production cannot silently fall back to in-memory
editing or select a non-Echo runtime profile.

Acceptance criteria:

- Non-Echo profile names are not accepted runtime input.
- Production defaults cannot select direct local authority accidentally.
- Static guard catches fallback imports in production modules.
- Fixture docs state fake ports are test scaffolding, not product behavior.

Test plan:

- Add profile parser tests for invalid and legacy non-Echo profiles.
- Add guard sample tests.
- Run the jedit Echo release gate.

Checklist:

- [x] Delete non-Echo runtime profile selection.
- [x] Document fake-port scope.
- [x] Extend guard coverage.
- [x] Cover profile behavior.

### Slice 111 - WSC Durability Scope Document

User story:

As a maintainer, I want a precise WSC durability scope before code changes, so
we do not turn persistence into unbounded storage redesign.

Scope doc: `docs/design/0035-jedit-wsc-durability-scope.md`.

Acceptance criteria:

- The doc defines what WSC must persist for jedit editing history.
- It separates Echo generic causal history from jedit export semantics.
- It defines crash/restart states: not accepted, pending, decided, rejected, or
  obstructed.
- It states that export is a jedit read/materialization, not Echo mutation.

Test plan:

- Add a docs drift spec if the repo pattern supports it.
- Run markdown and dead-link checks where available.
- Review against Echo no-app-noun doctrine.

Checklist:

- [x] Write WSC durability scope.
- [x] Define accepted restart states.
- [x] Define jedit export boundary.
- [x] Link from BEARING.

### Slice 112 - Echo WSC Store Port

User story:

As Echo, I need a generic WSC store port so causal-history persistence is
behind a runtime adapter and not tied to jedit.

Echo commit: `a4ed532f feat: add generic WSC store port`.

Acceptance criteria:

- [Echo] The port names generic causal-history records, not text/editor nouns.
- [Echo] The adapter can write and read deterministic WSC envelopes.
- [Echo] Corruption and missing material return typed obstruction.
- [jedit] jedit depends only on the generic port-facing behavior.

Test plan:

- [Echo] Add port contract tests.
- [Echo] Add deterministic serialization golden tests.
- [jedit] Add compile/integration test using the generic adapter boundary.

Checklist:

- [x] Define generic WSC store port.
- [x] Add deterministic envelope format tests.
- [x] Add typed obstruction path.
- [x] Keep jedit nouns out of Echo.

### Slice 113 - Persist Accepted Submission Events

User story:

As Echo, I want accepted submissions written to WSC before tick decision, so
accepted-but-not-yet-decided jedit edits survive restart.

Echo commit: `98936624 feat: persist accepted submissions in WSC`.

Acceptance criteria:

- [Echo] Accepted submission events serialize with stable identity.
- [Echo] Duplicate canonical submissions do not append duplicate semantic
  events.
- [Echo] Persistence failure returns obstruction before pretending acceptance.
- [jedit] jedit can observe pending accepted submission after restart.

Test plan:

- [Echo] Add accepted-submission WSC tests.
- [Echo] Add duplicate submission tests.
- [jedit] Add restart fixture reading pending posture.

Checklist:

- [x] Serialize accepted submission event.
- [x] Preserve duplicate posture.
- [x] Block half-accepted state.
- [x] Expose pending posture to jedit.

### Slice 114 - Persist Ticket And Receipt Correlation

User story:

As a user, I want a decided edit to recover with its ticket and receipt
correlation after restart.

Echo commit: `68cc77cb feat: persist receipt correlation in WSC`.

Acceptance criteria:

- [Echo] Admission ticket, ticketed ingress, and receipt correlation serialize
  without app nouns.
- [Echo] Recovery reconstructs app-safe outcome handles.
- [Echo] Missing correlation is obstruction, not success.
- [jedit] jedit can display applied/rejected outcome after restart.

Test plan:

- [Echo] Add WSC correlation round-trip tests.
- [Echo] Add missing-correlation obstruction tests.
- [jedit] Add restart outcome observation tests.

Checklist:

- [x] Persist ticket/ingress correlation.
- [x] Persist receipt correlation.
- [x] Recover outcome handles.
- [x] Cover missing correlation.

### Slice 115 - Persist Reading And Retention Refs

User story:

As a user, I want retained readings and payload references to recover after
restart, so jedit can explain what it displays.

Echo commits:

- `1d64cd0b feat: persist retention refs in WSC`
- `c1c21353 test: cover retention WSC obstruction posture`

Acceptance criteria:

- [Echo] Reading envelope refs and payload refs serialize distinctly.
- [Echo] Semantic coordinate is persisted separately from byte identity.
- [Echo] Missing retained material returns typed obstruction.
- [jedit] jedit can restore reading cache posture from recovered refs.

Test plan:

- [Echo] Add reading/ref WSC round-trip tests.
- [Echo] Add semantic-coordinate mismatch tests.
- [jedit] Add reading restoration test.

Checklist:

- [x] Persist reading envelope refs.
- [x] Persist payload refs.
- [x] Persist semantic coordinates.
- [x] Cover missing material.

### Slice 116 - WSC Atomic Commit Markers

User story:

As Echo, I need crash-consistent WSC writes so a restart never sees half-written
causal history as valid.

Echo commit: `8580ac67 feat: add WSC commit markers`.

Acceptance criteria:

- [Echo] WSC writes use a commit marker or equivalent atomic protocol.
- [Echo] Recovery ignores or obstructs incomplete writes.
- [Echo] Successful commits are idempotent.
- [jedit] jedit restart reports typed obstruction for incomplete WSC state.

Test plan:

- [Echo] Add interrupted-write recovery tests.
- [Echo] Add idempotent commit tests.
- [jedit] Add incomplete-store fixture test.

Checklist:

- [x] Add commit marker protocol.
- [x] Reject incomplete writes.
- [x] Prove idempotent recovery.
- [x] Expose obstruction to jedit.

### Slice 117 - Recover Pending Submissions

User story:

As a user restarting jedit after submitting an edit, I want pending accepted
submissions to remain visible and honest.

Echo commit: `7fe747a1 feat: recover pending submissions from WSC`.

Acceptance criteria:

- [Echo] Pending submissions recover from WSC.
- [Echo] Pending state does not imply execution or receipt.
- [jedit] jedit displays pending posture without mutating text.
- [jedit] No hidden retry is triggered on restart.

Test plan:

- [Echo] Add pending recovery tests.
- [jedit] Add restart UI/state tests.
- Assert no automatic edit resubmission occurs.

Checklist:

- [x] Recover pending submission state.
- [x] Keep pending distinct from applied.
- [x] Display jedit pending posture.
- [x] Prove no hidden retry.

### Slice 118 - Recover Decided Submissions

User story:

As a user restarting jedit after an applied or rejected edit, I want the decided
outcome to recover with evidence.

Echo commit: `6b17054d feat: recover decided submissions from WSC`.

Acceptance criteria:

- [Echo] Applied and rejected outcomes recover from WSC.
- [Echo] Receipt evidence is available by submission id.
- [jedit] jedit restores applied text reading or rejected posture.
- [jedit] Rejected outcome does not become a retry.

Test plan:

- [Echo] Add decided recovery tests.
- [jedit] Add applied and rejected restart tests.
- Assert receipt correlation survives restart.

Checklist:

- [x] Recover applied outcome.
- [x] Recover rejected outcome.
- [x] Restore receipt correlation.
- [x] Keep rejection final for that attempt.

### Slice 119 - Reject Half-Accepted WSC State

User story:

As a maintainer, I want corrupt or half-accepted WSC state to fail closed, so
jedit never shows invented history.

Echo commit: `0ae88f5c feat: reject incomplete WSC causal history`.

Acceptance criteria:

- [Echo] Recovery detects missing submission, ticket, receipt, or retained
  material required by a committed state.
- [Echo] The failure is typed and auditable.
- [jedit] jedit surfaces the obstruction without local fallback.
- [jedit] The file is not silently opened from stale host bytes as authority.

Test plan:

- [Echo] Add malformed WSC fixture tests.
- [jedit] Add corrupt recovery tests.
- Assert no fallback text authority is activated.

Checklist:

- [x] Add corrupt WSC fixtures.
- [x] Detect half-accepted states.
- [x] Surface typed obstruction.
- [x] Block local authority fallback.

### Slice 120 - jedit WSC Workspace Store Adapter

User story:

As a jedit host, I want a workspace WSC adapter that connects Echo's generic
WSC store to the project directory without teaching Echo about files.

Implementation: `src/ports/jedit-wsc-workspace-store.ts` defines the
jedit-owned generic WSC envelope store port, and
`src/adapters/jedit-wsc-workspace-store.ts` implements the Node workspace path
policy under `.jedit/echo-wsc/envelopes/`.

Acceptance criteria:

- [jedit] The adapter owns path policy and project-directory placement.
- [jedit] Echo sees generic WSC store operations only.
- [jedit] The adapter is injectable for tests.
- [jedit] Host path errors become typed obstruction.

Test plan:

- Add adapter tests for read/write/list behavior.
- Add path error tests.
- Add integration test wiring adapter into production session.

Checklist:

- [x] Add jedit WSC workspace adapter.
- [x] Keep path policy in jedit.
- [x] Inject adapter into session.
- [x] Cover path failures.

### Slice 121 - Startup Recovery From WSC

User story:

As a user reopening jedit, I want the workspace to recover Echo-backed text
authority from WSC instead of starting from host file bytes only.

Implementation: startup recovery now lists committed WSC workspace envelopes
through the injected store, records no-history as explicit import required,
records found WSC history as Echo-history authority pending materialization, and
stores obstruction posture on the initial workspace model.

Acceptance criteria:

- [jedit] Startup can discover existing WSC history for a workspace.
- [jedit] Recovered WSC history records Echo-history authority posture and
  pending materialization without rebuilding live editor buffers yet.
- [jedit] Host file import remains an explicit import path for new files.
- [jedit] Recovery failures are visible.

Test plan:

- Add startup recovery harness tests.
- Add no-history import tests.
- Add corrupt-history obstruction tests.

Checklist:

- [x] Discover workspace WSC history on startup.
- [x] Record recovered Echo-history authority posture.
- [x] Keep new-file import explicit.
- [x] Cover recovery failure.

### Slice 122 - Persist Edits After Settlement

User story:

As a user editing a file, I want each settled production edit to be written to
WSC history with enough evidence for restart and replay.

Acceptance criteria:

- [jedit] Applied edit settlement triggers WSC persistence through the adapter.
- [jedit] Rejected and obstructed attempts retain honest outcome evidence.
- [jedit] Persistence failure does not pretend the edit is durable.
- [Echo] Generic evidence remains app-noun-free.

Test plan:

- Add edit persistence tests.
- Add persistence failure tests.
- Add rejected/obstructed outcome persistence tests.

Checklist:

- [x] Persist applied edit evidence.
- [x] Persist rejected outcome evidence.
- [x] Persist obstruction posture where appropriate.
- [x] Cover persistence failure.

Proof note:

- `spec/jedit-wsc-edit-settlement.spec.mjs` proves applied edit results write
  their WSC settlement envelope before accepting a receipt, WSC write
  obstruction keeps the UI from claiming durability, and obstructed edit
  results preserve honest outcome evidence without writing settlement bytes.

### Slice 123 - Restart Round Trip Proof

User story:

As a user, I want settled WSC edit evidence to survive quit and restart, so
later materialization can prove the same Echo-backed text history without stale
process memory.

Acceptance criteria:

- [jedit] A test persists WSC edit-settlement evidence, stops the in-memory
  runtime, starts a fresh runtime, and recovers retained WSC evidence.
- [jedit] The restarted state comes from WSC/Echo history posture, not stale
  editor memory.
- [jedit] Receipt, reading, checkpoint, and materialized-text evidence are still
  available in the retained envelope.
- [jedit] Host artifact export/materialization remains a separate read
  operation covered by slice 125.

Test plan:

- Add restart retained-evidence round-trip spec.
- Assert retained materialized-text payload, receipt id, reading id, and
  checkpoint id.
- Assert no direct local authority fallback.

Checklist:

- [x] Build restart retained-evidence fixture.
- [x] Assert retained materialized-text evidence.
- [x] Assert evidence recovery.
- [x] Add to release gate.

Proof note:

- `spec/jedit-wsc-restart-round-trip.spec.mjs` proves a WSC-backed edit
  settlement envelope is written through the real Node workspace store, a fresh
  runtime recovers the envelope id on restart without carrying stale editor
  memory, and the recovered bytes still contain the receipt, reading,
  checkpoint, and materialized-text evidence. Full current-history host export
  remains slice 125.

### Slice 124 - Historical Basis Selection

User story:

As a user inspecting history, I want jedit to select a previous causal basis so
it can materialize earlier file content.

Acceptance criteria:

- [jedit] Historical basis ids are represented in app-safe terms.
- [jedit] Selecting a basis does not mutate current Echo history.
- [jedit] Missing or stale basis returns typed obstruction.
- [Echo] Echo basis lookup remains generic.

Test plan:

- Add basis-list and basis-select tests.
- Add missing basis obstruction tests.
- Assert current buffer authority is unchanged by inspection.

Checklist:

- [x] Add app-safe historical basis model.
- [x] Add basis selection command/port.
- [x] Keep selection read-only.
- [x] Cover missing basis.

Proof note:

- `src/ports/jedit-wsc-history-basis.ts` defines app-safe historical basis
  terms over retained WSC envelope evidence. `src/app/jedit-wsc-history-basis.ts`
  lists deterministic bases and selects one read-only through the workspace
  store. `spec/jedit-wsc-history-basis.spec.mjs` covers deterministic listing,
  selection without workspace mutation, and missing-basis obstruction.

### Slice 125 - Current History Export

User story:

As a user, I want to export the current file artifact from Echo causal history,
so the host filesystem is a materialized output, not the source of truth.

Acceptance criteria:

- [jedit] Current export reads from WSC/Echo history.
- [jedit] Export writes host artifact only after successful materialization.
- [jedit] Export records reading or export evidence.
- [jedit] Export does not mutate Echo state.

Test plan:

- Add current export tests from recovered history.
- Assert host file write uses materialized payload.
- Assert no mutation/session edit is submitted.

Checklist:

- [x] Implement current history export.
- [x] Record export evidence.
- [x] Preserve read-only boundary.
- [x] Cover materialization failure.

Proof note:

- `src/ports/jedit-wsc-current-history-export.ts` defines the app-facing
  current-history export and materialization contract.
  `src/app/jedit-wsc-current-history-export.ts` lists retained WSC envelopes,
  selects the latest basis, materializes the retained envelope through an
  explicit app materializer, and writes the host artifact only after successful
  materialization. `spec/jedit-wsc-current-history-export.spec.mjs` covers
  current export evidence, read-only WSC behavior, missing basis, and
  materialization failure.

### Slice 126 - Point-In-Time Export

User story:

As a user, I want to export the file as it existed at a previous causal point,
so jedit can recover artifacts from any meaningful editing moment.

Acceptance criteria:

- [jedit] Export accepts a historical basis id.
- [jedit] The exported artifact matches that basis, not current state.
- [jedit] Export does not change current workspace state.
- [jedit] Missing retained material returns typed obstruction.

Test plan:

- Add two-edit historical export tests.
- Assert export at basis A and basis B differ correctly.
- Assert current editor state remains unchanged.

Checklist:

- [x] Add historical export command.
- [x] Resolve basis-specific material.
- [x] Cover multiple points in time.
- [x] Cover missing material.

Proof note:

- `src/app/jedit-wsc-current-history-export.ts` now exposes
  `exportJeditWscHistoryAtBasis`, which resolves a requested retained WSC
  envelope id and reuses the same materialize-then-write boundary as current
  export. `spec/jedit-wsc-current-history-export.spec.mjs` covers exporting two
  different historical bases, preserving the active editor state, and returning
  typed obstruction when requested retained material is missing.

### Slice 127 - History Listing And Evidence View

User story:

As a user or agent, I want to list meaningful editing history with evidence ids,
so I can choose what to inspect or export.

Acceptance criteria:

- [jedit] History listing includes submissions, outcomes, receipts, readings,
  checkpoints, and export refs where available.
- [jedit] The listing does not expose trusted Echo internals.
- [jedit] Unsupported or missing evidence is explicit.
- [jedit] The UI/CLI output is deterministic.

Test plan:

- Add history listing tests over a fixture with multiple edits.
- Assert stable ordering and ids.
- Add missing evidence tests.

Checklist:

- [x] Add history listing model.
- [x] Add CLI/UI/port output.
- [x] Keep output app-safe.
- [x] Cover deterministic ordering.

### Slice 128 - Replay Same Edits Same Evidence

User story:

As a maintainer, I want replaying the same jedit edit history to produce the
same semantic evidence, so the powered-by-Echo claim is reproducible.

Acceptance criteria:

- [Echo][jedit] Same inputs and scheduler policy reproduce receipts/readings.
- [jedit] Diagnostic prose and wall-clock cadence are excluded from semantic
  identity.
- [jedit] Replay mismatch reports typed differences.
- [Echo] Echo remains app-noun-free.

Test plan:

- Add local replay proof over WSC-backed jedit edit history.
- Assert semantic identity equality.
- Add mismatch fixture tests.

Checklist:

- [x] Build replay fixture.
- [x] Compare semantic evidence identity.
- [x] Exclude non-semantic diagnostics.
- [x] Cover mismatch report.

### Slice 129 - Host Timing Permutation Proof

User story:

As a maintainer, I want host timing differences to have no effect on causal
editing history, so JS callbacks and wall-clock cadence do not become hidden
semantics.

Acceptance criteria:

- [jedit] Tests run the same edit sequence with different host timings.
- [Echo] Trusted runtime tick ownership remains behind the host adapter.
- [jedit] Semantic receipts/readings remain equal.
- [jedit] Host diagnostics may differ but are excluded.

Test plan:

- Add timing permutation replay tests.
- Assert semantic equality.
- Assert app code does not choose tick boundaries.

Checklist:

- [x] Add deterministic timing variants.
- [x] Compare semantic outcomes.
- [x] Guard app tick authority.
- [x] Document host timing boundary.

### Slice 130 - Conflict And Rejection Retention

User story:

As a user, I want rejected or conflicting edits to remain honest causal
attempts without corrupting successful history.

Acceptance criteria:

- [Echo][jedit] Conflict/rejection outcomes persist and recover.
- [jedit] Rejected attempts do not export as applied text.
- [jedit] Retry remains a new explicit intent.
- [jedit] History listing shows the rejection reason.

Test plan:

- Add conflict/rejection fixture tests.
- Add restart recovery for rejected attempt.
- Add explicit retry tests.

Checklist:

- [x] Persist rejection evidence.
- [x] Keep export applied-only.
- [x] Cover explicit retry.
- [x] Show rejection in history.

### Slice 131 - Multi-File History Recovery

User story:

As a user working across files, I want multiple file histories to recover
independently from WSC-backed Echo history.

Acceptance criteria:

- [jedit] Two or more files recover distinct authority and history posture.
- [jedit] Exporting one file does not alter another file.
- [jedit] Missing history for one file does not poison unrelated files.
- [Echo] Generic history remains file-noun-free.

Test plan:

- Add multi-file edit/restart/export tests.
- Add missing/corrupt one-file history tests.
- Assert unrelated file can still open.

Checklist:

- [x] Recover multiple file histories.
- [x] Isolate export by file.
- [x] Isolate corruption by file where safe.
- [x] Cover unrelated-file continuation.

### Slice 132 - Agent Historical Export

User story:

As an AI agent, I want to request current or historical exports through a stable
CLI/MCP surface, so automated workflows can inspect jedit history.

Acceptance criteria:

- [jedit] The agent surface can list history and export by basis id.
- [jedit] The output includes structured evidence and artifact path/material.
- [jedit] The surface exposes no trusted lifecycle or tick authority.
- [jedit] Errors are typed JSON obstructions.

Test plan:

- Add CLI/MCP historical export tests.
- Assert structured success and obstruction JSON.
- Assert lifecycle controls are absent.

Checklist:

- [x] Add agent historical export command.
- [x] Add history listing command.
- [x] Cover success and obstruction.
- [x] Guard authority boundary.

### Slice 133 - WSC Release Gate Integration

User story:

As a maintainer, I want WSC recovery and historical export in the jedit Echo
gate, so durability regressions block merges.

Acceptance criteria:

- [jedit] The release gate runs WSC restart, current export, historical export,
  and replay witnesses.
- [jedit] The gate remains deterministic and reasonably scoped.
- [jedit] Failures report the exact witness that failed.
- [Echo] Echo-specific WSC tests stay in Echo gates.

Test plan:

- Update the jedit Echo gate.
- Add script tests for included WSC specs.
- Run the full gate.

Checklist:

- [x] Add WSC witnesses to jedit gate.
- [x] Keep Echo core tests in Echo.
- [x] Add script coverage.
- [x] Run full gate.

### Slice 134 - DIND Replay Closeout

User story:

As a maintainer, I want a DIND-style closeout proof for the jedit contract path,
so the local app proof is not just a happy-path fixture.

Acceptance criteria:

- [Echo][jedit] Replay proof covers submission, admission, ticket, execution,
  receipt, reading, retention, and export identity.
- [jedit] The proof includes at least one rejection or obstruction.
- [jedit] The proof is deterministic on clean checkout.
- [jedit] Failure output identifies the divergent evidence coordinate.

Test plan:

- Add DIND/replay witness command or spec.
- Run it in the jedit Echo release gate or a documented heavier gate.
- Add mismatch fixture tests.

Checklist:

- [x] Add closeout replay witness.
- [x] Include non-applied outcome.
- [x] Compare retained evidence coordinates.
- [x] Add to appropriate gate.

### Slice 135 - Portability Template Update

User story:

As a future Graft or Think maintainer, I want the jedit lessons captured in a
portable app-hosting template.

Acceptance criteria:

- [jedit] The template names app-owned semantics and Echo-owned runtime
  responsibilities.
- [jedit] It includes production session, reading cache, retention, recovery,
  and export boundaries.
- [jedit] It forbids app nouns in Echo.
- [jedit] It explains fake-port fixture policy without reopening runtime modes.

Test plan:

- Add docs/spec drift test if available.
- Verify links and commands.
- Cross-check against jedit implementation files.

Checklist:

- [x] Update reusable app-hosting template.
- [x] Include durability lessons.
- [x] Include authority bar.
- [x] Add drift check.

### Slice 136 - Graft/Think Readiness Checklist

User story:

As a maintainer, I want a checklist for applying the pattern to Graft and Think,
so jedit does not become a one-off integration.

Acceptance criteria:

- [jedit] The checklist names required ports, adapters, witnesses, and guards.
- [jedit] It identifies what app teams own versus Echo/Wesley.
- [jedit] It includes a minimum release-gate shape for new apps.
- [jedit] It references jedit examples without requiring jedit nouns.

Test plan:

- Run docs link checks.
- Self-review against Echo generic boundary.
- Add backlog cards if repo method requires them.

Checklist:

- [x] Write portability checklist.
- [x] Define app/Echo/Wesley ownership.
- [x] Define minimum gate.
- [x] Link from BEARING or guide.

### Slice 137 - End-To-End Guide Refresh

User story:

As a new contributor, I want the end-to-end guide to match the real
WSC-backed production path from startup to shutdown.

Acceptance criteria:

- [jedit] The guide covers app startup, trusted host loop, open, edit, read,
  save, checkpoint, WSC persistence, restart, export, and shutdown.
- [jedit] Mermaid diagrams reflect current types and boundaries.
- [jedit] The guide states Echo never knows jedit text semantics.
- [jedit] Commands in the guide are executable.

Test plan:

- Add guide command checks if possible.
- Run markdown and link checks.
- Run relevant release gate.

Checklist:

- [ ] Update lifecycle narrative.
- [ ] Update diagrams.
- [ ] Update command examples.
- [ ] Add or update guide tests.

### Slice 138 - Version And Compatibility Audit

User story:

As a release manager, I want version compatibility between jedit, Echo, and
Wesley to be explicit.

Acceptance criteria:

- [jedit][Echo][Wesley] Required versions are documented.
- [jedit] Generated package identity includes schema, artifact, codec, and
  helper compatibility where available.
- [jedit] Incompatible versions fail before runtime-visible work.
- [jedit] Release notes name supported combinations.

Test plan:

- Add compatibility preflight tests.
- Add generated artifact/version fixture tests.
- Run package install and query observer specs.

Checklist:

- [ ] Document version matrix.
- [ ] Add compatibility preflight.
- [ ] Cover incompatible versions.
- [ ] Update release notes.

### Slice 139 - Authority And Security Audit

User story:

As a maintainer, I want a final authority audit proving app code cannot bypass
Echo's runtime boundaries.

Acceptance criteria:

- [jedit] UI, CLI, MCP, and tests expose no trusted tick/drain authority except
  host-owned adapters.
- [jedit] Query observers remain read-only.
- [jedit] Mutation handlers run only through scheduler-owned execution.
- [Echo] Echo contains no jedit or text-specific nouns.

Test plan:

- Run static authority guards.
- Run no-app-noun checks in Echo if available.
- Run jedit Echo release gate.
- Self-review public ports and adapters.

Checklist:

- [ ] Audit UI authority.
- [ ] Audit CLI/MCP authority.
- [ ] Audit query observer read-only boundary.
- [ ] Audit Echo noun-free boundary.

### Slice 140 - Powered By Echo Release Candidate Gate

User story:

As the project owner, I want one release-candidate gate that justifies saying
"jedit is powered by Echo."

Acceptance criteria:

- [jedit] The gate covers real app open, edit, render, save, checkpoint,
  restart, current export, historical export, and replay.
- [jedit] The gate proves no app tick authority.
- [jedit] Docs state current limitations honestly.
- [Echo][jedit] WSC durability and replay evidence are green on clean checkout.

Test plan:

- Run `npm run release-gate:jedit-echo`.
- Run the WSC/replay closeout gate.
- Run build, quality, and diff checks.
- Perform final Code Lawyer self-review.

Checklist:

- [ ] Assemble release-candidate gate.
- [ ] Run all local witnesses.
- [ ] Update BEARING and release docs.
- [ ] Pause for final human inspection.

## Current Truth

- `TextBufferOptic` is a jedit app capability.
- Text windows, rope/piece-table semantics, panes, commands, cursors, and
  editor policy belong in jedit contracts, generated adapters, or jedit ports.
- Echo owns generic admission, scheduling, ticks, receipts, QueryView routing,
  retained evidence, and obstruction/fault posture.
- `docs/design/echo-identity-doctrine.md` is now the canonical identity rulebook:
  values are content-hashed, things are declared IDs, names are bindings, views
  are Basis.
- Echo must not contain hardcoded jedit or text-buffer behavior.
- The current real Echo witness fails closed with `UNSUPPORTED_QUERY` unless a
  jedit-owned query observer is installed.
- Interactive workspace production text flows now open, edit, render, save,
  export, and checkpoint through the production text session/controller. The
  remaining caveat is legacy line state kept as render/cache/navigation
  mechanics and explicit test-local fixture support, not production authority.
- After interactive workspace cutover, the next durability bar is Echo-native
  WSC causal-history serialization: the full causal history of editing a file
  in jedit should be recoverable across application lifecycles, and jedit
  should materialize file artifacts from any historical point through its own
  export adapter.

## Completed Local Batch

The previous local inspection point was slice 40 of the application-hosting
pattern plan:

1. Slice 31: application hosting contract pattern.
2. Slice 32: `jedit` state authority cutover.
3. Slice 33: read-side state authority cutover.
4. Slice 34: submission ledger port.
5. Slice 35: ticketed work boundary.
6. Slice 36: real receipt correlation.
7. Slice 37: real local retained evidence lookup.
8. Slice 38: restart and recovery witness.
9. Slice 39: second-app template proof.
10. Slice 40: developer app host guide.

Agents can inspect the installed-package witness path with:

```bash
npm run build
node scripts/jedit-echo-powered-session.mjs --json --dry-run
node scripts/jedit-echo-powered-session.mjs --json
```

The current branch now extends that proof through slice 60 of the hardening
plan:

1. Slice 41: trusted runtime lifecycle doctrine closure.
2. Slice 42: runtime host port finalization.
3. Slice 43: Echo adapter lifecycle integration.
4. Slice 44: lifecycle failure posture.
5. Slice 45: agent lifecycle surface.
6. Slice 46: contract package identity audit.
7. Slice 47: no app nouns in Echo gate.
8. Slice 48: jedit contract package install fixture.
9. Slice 49: unsupported operation boundary.
10. Slice 50: package reinstall and duplicate policy.
11. Slice 51: ticketed mutation execution tightening.
12. Slice 52: query observer read-only tightening.
13. Slice 53: receipt correlation happy path closure.
14. Slice 54: retained reading lookup closure.
15. Slice 55: restart persistence adapter boundary.
16. Slice 56: local replay proof hardening.
17. Slice 57: second-app template authority audit.
18. Slice 58: developer guide drift check.
19. Slice 59: PR release gate consolidation.
20. Slice 60: drift reflection and next plan.

Slice-80 reflection is next. Review the remaining drift between the production
session witness and the interactive workspace before starting the next batch.
After the interactive workspace cutover is credible, the next likely plan is
WSC-backed persistence and point-in-time export. Distributed transport,
settlement shells, streaming, and full observer-rights governance remain outside
this batch.

## Non-Negotiables

- Application code cannot tick Echo.
- Application dispatch does not execute synchronously.
- Trusted host lifecycle control stays behind a host adapter.
- Mutation handlers run only during Echo scheduler-owned execution.
- Query observers are read-only.
- Retry is explicit new causal input.
- Unsupported or rejected work is final for that attempt; a retry is a new
  submission, not a hidden runtime loop.
- Echo remains generic.
