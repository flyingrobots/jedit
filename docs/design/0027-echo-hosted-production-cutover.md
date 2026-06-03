# Echo-Hosted Production Cutover - Next Twenty Slices

Status: active plan after slices 51-60 merge

This plan follows
[`0026-echo-hosting-hardening-first-twenty.md`](0026-echo-hosting-hardening-first-twenty.md).
Slices 51-60 closed the app-hosting witness path: ticketed mutation authority,
read-only query observers, local receipt correlation, retained reading lookup,
restart recovery adapter shape, replay identity, second-app template identity,
guide drift checks, and the release gate are now explicit.

The next goal is not to preserve an optional "Echo mode." That wording was
useful during transition, but the production target is sharper:

```text
jedit's production text model is Echo-hosted.
The legacy in-memory text model is deleted, quarantined as a test fixture, or
kept only as an adapter-local implementation detail behind ports.
Echo remains generic and never learns jedit nouns.
```

## Doctrine

- Identity follows the locked
  [`echo-identity-doctrine.md`](echo-identity-doctrine.md): values are hashed,
  things are declared IDs, names are bindings, and views are Basis.
- `EchoHosted` is jedit host terminology, not Echo terminology.
- Echo must not define `TextBufferOptic`, text buffers, ropes, panes, cursors,
  text windows, filesystem save policy, or editor commands.
- jedit owns the contract semantics, handlers, observers, app-safe capability
  APIs, and artifact export policy.
- Echo owns generic admission, scheduling, trusted ticks, receipts, retention,
  QueryView routing, installed package boundaries, faults, and causal-history
  serialization.
- The local in-memory text model is no longer a production authority target. It
  may remain only while it is explicitly marked as a test/dev fixture or hidden
  behind an adapter port.

## Production Cutover Acceptance Bar

Production cutover is complete only when all of these are true:

- production text editing flows are Echo-hosted by default;
- no product path depends on the legacy in-memory text model as source of
  truth;
- any retained legacy model is quarantined as a test fixture or adapter-local
  implementation detail behind ports;
- jedit text materialization is derived from Echo causal state through jedit
  ports and contract-owned observers;
- Echo contains no jedit nouns, text-buffer nouns, or editor-specific
  semantics;
- export reads from an Echo causal basis and does not mutate Echo state;
- WSC durability work is explicitly deferred until after slice 80 unless a prior
  slice exposes an unavoidable storage dependency;
- the release gate proves the production cutover instead of merely proving a
  headless witness path.

## Current Reflection

The previous branch closed the hardening batch without changing Echo's
authority boundary:

- handler invocation requires scheduler authority and cannot be forged by a
  matching caller string;
- query observers expose no lifecycle, tick, mutation, state-write, or transport
  submission methods;
- applied local witness runs report a real local receipt correlation;
- unsupported mutation witnesses do not fabricate receipt evidence;
- retained material lookup requires byte identity plus semantic coordinate;
- restart recovery has a named adapter boundary;
- replay equality ignores wall-clock cadence and diagnostic prose;
- the counter template now proves package identity and install shape without
  importing jedit modules;
- the hosting guide and release gate include the current hardening witnesses.

Remaining gaps before the phrase "jedit is powered by Echo" is fully honest:

- the production text session/controller surface exists for open, edit,
  obstruction, checkpoint, export, local replay, and bounded read posture;
- the release gate now proves the production text session witness and guard;
- interactive workspace open/edit/render wiring must still move onto that
  production session/controller surface;
- editor save/export UI behavior must still distinguish filesystem persistence
  from Echo causal/evidence posture;
- UI-level obstruction and retry affordances must be explicit;
- production imports must stop depending on legacy direct text-state mutation;
- durable accepted-submission recovery remains future work;
- durable/Continuum replay remains future work;
- the current witness still reports `TICKETED_RUNTIME_INGRESS_MISSING` until
  Echo exposes that concrete runtime evidence to the app-facing report.

## Slice 61-70 Checkpoint

Slices 61-70 close the production session/controller boundary, not the final
interactive UI cutover. That distinction is intentional:

```text
text runtime profile
-> TextBufferSessionPort
-> production text session controller
-> open/edit/read/obstruction posture
```

The remaining interactive workspace imports are still visible in the authority
inventory and become the target for the next slices. Do not hide that drift by
calling the legacy `EditorState.lines` path production-complete.

## Slice 71-80 Checkpoint

Slices 71-80 close the production text session witness and release-gate layer:

```text
production text session
-> open/edit/checkpoint/read/export
-> retained refs
-> local replay
-> static guard
-> release gate
```

This is still not the final interactive TUI cutover. The remaining direct
`EditorState.lines` paths stay visible in the authority inventory. The next
batch must make the workspace event loop consume the production text session as
its only product text authority, then delete or fixture-scope the direct line
model.

## Post-Slice-80 Requirement: WSC Causal History And Export

After the production cutover, the next product bar is durable causal-history
recovery through Echo's WSC file format:

```text
Echo natively serializes its generic causal history into WSC.
The entire causal history of editing a file in jedit is recoverable between
application lifecycles.
jedit can materialize file artifacts from any point in time through an export
flow.
```

Ownership remains strict:

- Echo owns WSC serialization of generic causal history, receipts, witnesses,
  frontiers, retained artifact coordinates, and replayable runtime evidence.
- jedit owns the interpretation of that history as editor buffers, text
  materializations, file artifacts, and export formats.
- A WSC file is not a jedit file format. It is Echo causal-history storage.
- A jedit export is not Echo state mutation. It is a jedit-owned reading and
  materialization over an Echo causal basis.

This requirement is intentionally post-slice-80 unless a prior slice exposes an
unavoidable storage dependency. The production cutover should not fake durable
WSC recovery with process-local memory.

## Slice Budget

### Slice 61 - Runtime Terminology Cleanup

User story: As a maintainer, I can read docs and public jedit names without
mistaking transitional "Echo mode" for an Echo-owned runtime concept.

Test plan:

- Docs use `Echo-hosted` for jedit host posture.
- App-facing names avoid implying Echo owns text semantics.
- Legacy "Echo mode" wording is either removed or marked transitional.

Checklist:

- [x] Docs use `Echo-hosted` terminology.
- [x] Public jedit names do not imply Echo-owned text semantics.
- [x] Transitional wording is bounded.

### Slice 62 - Production Runtime Authority Inventory

User story: As a maintainer, I can see every interactive editor path that reads
or writes text state and whether it already goes through `TextBufferSessionPort`.

Test plan:

- Static inventory lists direct editor-state text mutation/read paths.
- Inventory distinguishes app-owned session ports from direct in-memory helpers.
- No Echo or text semantics are added to Echo core.

Checklist:

- [x] Inventory document exists.
- [x] Direct read/write paths are listed.
- [x] Next cutover targets are explicit.

### Slice 63 - Runtime Profile Port

User story: As a host operator, I can construct the production
`TextBufferSessionPort` through a jedit-owned runtime profile port, while
legacy local state remains outside production runtime selection.

Test plan:

- Runtime profile accepts `echoHosted` as the only production profile.
- Unknown profile returns typed configuration obstruction.
- Selected app session exposes no tick, lifecycle, package install, handler, or
  state-port authority.

Checklist:

- [x] Runtime profile port exists.
- [x] `echoHosted` creates a `TextBufferSessionPort`.
- [x] Non-Echo profile input is rejected.
- [x] Invalid profile is typed.
- [x] App session authority remains narrow.

### Slice 64 - Echo-Hosted Default Behind Host Configuration

User story: As a host operator, the configured production runtime profile is
Echo-hosted, while local in-memory helpers remain focused test scaffolding.

Test plan:

- Default production configuration selects Echo-hosted session creation.
- Development/test fixtures inject fake ports directly.
- Product UI does not expose runtime selection as a normal user feature.

Checklist:

- [x] Production default is Echo-hosted.
- [x] Non-Echo runtime profile selection is absent.
- [x] User-facing mode switch is absent.

### Slice 65 - Buffer Open Cutover

User story: As a user in the production Echo-hosted profile, opening a buffer
creates the editor buffer through `TextBufferSessionPort.createBuffer(...)`.

Test plan:

- Production open calls `TextBufferSessionPort.createBuffer`.
- Local fixture path still preserves existing test behavior.
- Open does not request lifecycle drain or direct tick.

Checklist:

- [x] Production open uses the session port.
- [x] Local fixture path remains available for tests.
- [x] Open has no tick authority.

### Slice 66 - Edit Command Cutover I

User story: As a user, insert and replace commands submit canonical app intents
through the session port.

Test plan:

- Insert command calls `applyIntent` on the app capability.
- Replace command calls `applyIntent` on the app capability.
- The command records obstruction instead of mutating UI state on failed apply.

Checklist:

- [x] Insert path uses `applyIntent`.
- [x] Replace path uses `applyIntent`.
- [x] Failure posture is typed.

### Slice 67 - Edit Command Cutover II

User story: As a user, delete, backspace, and multi-range edits use the same
Echo-hosted intent path as insert and replace.

Test plan:

- Delete/backspace commands submit app intents.
- Multi-range or grouped edit commands submit app intents or typed obstruction.
- No direct text mutation bypass remains in production edit commands.

Checklist:

- [x] Delete/backspace paths use `applyIntent`.
- [x] Multi-range path is app-intent-backed or obstructed.
- [x] Production bypasses are inventoried for removal.

### Slice 68 - Read Model Cutover

User story: As a user, rendered editor text comes from bounded `textWindow`
readings instead of direct mutable snapshots in the production profile.

Test plan:

- Render model requests `textWindow` through the app capability.
- Reading envelope identity is retained in the UI model.
- Query observer remains read-only.

Checklist:

- [x] Production session render path uses bounded reading.
- [x] Reading identity reaches production session outcome.
- [x] No query observer write/tick authority appears.

### Slice 69 - Cursor And Viewport Reading Basis

User story: As a user, cursor and viewport state select the bounded reading
aperture without becoming Echo semantics.

Test plan:

- Cursor/viewport state feeds the jedit query input.
- Echo basis and reading identity remain separate from UI cursor policy.
- Scroll/cursor changes do not mutate Echo causal history by themselves.

Checklist:

- [x] Cursor state feeds query input.
- [x] Viewport state feeds query input.
- [x] Cursor/scroll-only moves do not submit edit intents.

### Slice 70 - UI Runtime Issue Posture

User story: As a user, an Echo obstruction appears as explicit UI/runtime
posture instead of silent retry or direct state mutation.

Test plan:

- Unsupported operation, query obstruction, and lifecycle obstruction map to
  typed UI runtime issues.
- Retry requires a new explicit user/agent action.
- UI state is not mutated by obstructed work.

Checklist:

- [x] Obstructions map to runtime issues.
- [x] Hidden retry remains absent.
- [x] Obstructed work does not mutate editor state.

### Slice 71 - Filesystem Save Boundary

User story: As a user, saving a file is separated from Echo's causal
checkpoint/evidence posture.

Test plan:

- Save-to-filesystem remains a jedit adapter action.
- Echo checkpoint mutation remains a contract operation.
- Documentation distinguishes filesystem save from Echo causal history.

Checklist:

- [x] Filesystem save/export stays behind a jedit materialization boundary.
- [x] Checkpoint intent path is explicit.
- [x] Docs distinguish the two.

### Slice 72 - Checkpoint Command Cutover

User story: As a user, checkpoint/save-intent semantics route through the jedit
contract operation path, not direct runtime mutation.

Test plan:

- Checkpoint command submits a contract operation.
- Checkpoint result carries receipt/evidence posture.
- Failed checkpoint does not mutate UI state as if committed.

Checklist:

- [x] Checkpoint command uses contract operation.
- [x] Checkpoint result carries evidence.
- [x] Failure posture is typed.

### Slice 73 - Agent Editing Surface

User story: As an agent, I can perform a small edit through the same production
`TextBufferSessionPort` used by the interactive editor.

Test plan:

- CLI/MCP witness opens a buffer, applies an edit, observes a text window, and
  reports receipt/reading identity.
- The agent surface exposes no trusted lifecycle or tick method.
- The same command works after an unsupported mutation witness.

Checklist:

- [x] Agent Echo-hosted edit command exists.
- [x] Agent authority remains app-safe.
- [x] Healthy work proceeds through a fresh explicit command.

### Slice 74 - UI Retention Evidence

User story: As a maintainer, the interactive Echo-hosted path can emit the same
retention evidence refs as the headless witness.

Test plan:

- UI-path command reports retained evidence refs.
- Retained evidence includes receipt, reading envelope, and payload roles.
- Durable retention remains honestly scoped to what Echo exposes.

Checklist:

- [x] Production-session retention report exists.
- [x] Receipt/checkpoint/reading/export refs are present.
- [x] Durable claims are not overclaimed.

### Slice 75 - UI Local Replay Witness

User story: As a maintainer, the interactive Echo-hosted path can be locally
replayed by semantic identity.

Test plan:

- Same inputs produce same package identity, receipt identity, reading identity,
  and text result.
- Replay equality ignores wall-clock cadence.
- Durable/Continuum replay remains honestly unavailable.

Checklist:

- [x] Production-session local replay report exists.
- [x] Semantic identity matches.
- [x] Durable replay is not overclaimed.

### Slice 76 - Legacy Model Quarantine

User story: As a maintainer, the old in-memory text model is no longer a
production authority path.

Test plan:

- Legacy local model lives under a focused test fixture or adapter-internal name.
- Production app code cannot import legacy direct mutation modules.
- Existing tests either use production ports or explicitly opt into fixtures.

Checklist:

- [x] Legacy runtime-choice files are removed.
- [ ] Full direct `EditorState.lines` model quarantine remains open.
- [x] Non-Echo runtime profile selection is removed.

### Slice 77 - Legacy Bypass Static Guard

User story: As a reviewer, a static guard fails if production UI/editor code
imports legacy direct text-state mutation modules instead of ports.

Test plan:

- Guard scans production source.
- Guard allows explicit test/dev fixtures.
- Guard catches a sample forbidden import.

Checklist:

- [x] Production source guard exists.
- [x] Test/dev fixture allowlist exists.
- [x] Sample forbidden import is covered.

### Slice 78 - Remove Runtime Choice From Product UX

User story: As a user, jedit no longer presents Echo hosting as an optional
mode; it is the production runtime posture.

Test plan:

- User-facing labels do not expose local-vs-Echo mode selection.
- Host/test configuration still allows explicit fixture override.
- Documentation describes Echo-hosted production posture.

Checklist:

- [x] Product mode wording is removed.
- [x] Host/test override remains.
- [x] Docs describe production posture.

### Slice 79 - Delete Or Demote Legacy Code

User story: As a maintainer, dead in-memory production paths are deleted where
possible and demoted where deletion is not yet safe.

Test plan:

- Dead paths are removed.
- Remaining paths are fixture/adapter-internal only.
- Release gate still passes.

Checklist:

- [x] Dead transitional runtime-mode paths are removed.
- [ ] Remaining local line-model paths are still scheduled for fixture-scoping.
- [x] Release gate passes.

### Slice 80 - Echo-Hosted jedit Release Gate

User story: As a reviewer, one focused command proves the interactive
Echo-hosted production path.

Test plan:

- Release gate proves interactive open, edit, read, save/checkpoint posture,
  retention refs, local replay, no tick authority, and no legacy bypass.
- Failure output names the failed witness.
- BEARING points at the WSC persistence/export plan.

Checklist:

- [x] Release gate includes production Echo-hosted smoke.
- [x] Release gate includes no-legacy-bypass guard.
- [x] Failure output is actionable.
- [x] BEARING points at the WSC persistence/export plan.

## Post-80 Candidate Plan: WSC Persistence And Export

The post-80 plan should start only after the production cutover is credible.
Likely slices:

1. Echo WSC capability map and jedit adapter requirements.
2. WSC-backed accepted submission recovery witness.
3. WSC-backed causal history reload between jedit lifecycles.
4. Point-in-time materialization query for jedit file artifacts.
5. Export adapter that writes materialized artifacts to the filesystem.
6. Export obstruction taxonomy for missing basis, missing retained material, and
   unsupported historical coordinate.
7. CLI/MCP export flow for agents.
8. Release gate that proves edit, restart, recover, materialize, and export.

The WSC plan belongs partly in Echo and partly in jedit. Echo must implement
generic WSC causal-history serialization. jedit must consume it through ports
and materialize editor/file artifacts without adding app nouns to Echo.
