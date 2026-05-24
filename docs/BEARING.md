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
boundary: text runtime terminology is now `echoHosted`/`testLocal`, the default
profile is Echo-hosted, direct text authority paths are inventoried, and the
production text session opens, edits, checkpoints, observes bounded windows,
exports materialized text, reports retained refs, and proves local replay
through `TextBufferSessionPort`. The release gate now runs the production
session witness and static guard.

The interactive workspace still has visible legacy direct `EditorState.lines`
paths; do not mistake the production session witness for full TUI cutover.

The developer-facing recipe lives in
[`docs/echo-application-hosting-guide.md`](echo-application-hosting-guide.md).

## Active Plan: Interactive Workspace Echo Cutover

The next plan is not WSC. WSC waits until the interactive workspace cutover is
credible. The current production text session and witness prove that jedit can
drive its text model through a jedit-owned Echo-hosted session. The interactive
workspace still needs to consume that session as the only production text
authority.

Core claim:

```text
jedit's interactive workspace opens, edits, renders, saves, exports, and
checkpoints text through jedit-owned ports backed by Echo-hosted causal state.
Echo remains generic and contains no text, editor, file, buffer, cursor, or
selection nouns.
```

Remaining drift to close:

- `src/app/file-tree.ts` still opens files through direct editor loading.
- `src/app/viewer-key.ts` still routes key edits through direct editor update
  helpers.
- `src/app/viewer-content.ts` still renders from direct `EditorState.lines`
  authority.
- `src/app/global-key-bindings.ts` still saves through direct editor save
  helpers.
- The legacy line model is not yet fixture-scoped or adapter-private.

The unfinished slices are slices 81-90. Each slice below includes its user
story, acceptance criteria, test plan, and checklist. Check off slice items only
when the executable witness for that item is green.

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

- [ ] Quarantine legacy helper modules.
- [ ] Expand static guard over production workspace paths.
- [ ] Preserve explicit fixture/test-local escape hatches.
- [ ] Update docs naming legacy state as non-production authority.

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

- Add the interactive workspace smoke to `npm run release-gate:echo`.
- Run `npm run release-gate:echo`.
- Run `npm test` or the narrow relevant suites covering workspace command and
  render paths.
- Run `git diff --check`.

Checklist:

- [ ] Add interactive workspace witness to release gate.
- [ ] Prove open/edit/read/save/checkpoint through production session.
- [ ] Prove no UI tick authority.
- [ ] Mark slices 81-90 complete before starting WSC work.

## Current Truth

- `TextBufferOptic` is a jedit app capability.
- Text windows, rope/piece-table semantics, panes, commands, cursors, and
  editor policy belong in jedit contracts, generated adapters, or jedit ports.
- Echo owns generic admission, scheduling, ticks, receipts, QueryView routing,
  retained evidence, and obstruction/fault posture.
- Echo must not contain hardcoded jedit or text-buffer behavior.
- The current real Echo witness fails closed with `UNSUPPORTED_QUERY` unless a
  jedit-owned query observer is installed.
- The remaining production cutover work is wiring interactive workspace
  open/edit/render/save behavior through the production text session/controller
  and then quarantining the legacy direct line-mutation path.
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
