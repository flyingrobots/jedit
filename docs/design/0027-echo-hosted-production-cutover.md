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

- interactive editor commands must route through `TextBufferSessionPort`;
- rendering must consume bounded readings from the app-owned session port;
- editor save/checkpoint behavior must distinguish filesystem persistence from
  Echo causal/evidence posture;
- UI-level obstruction and retry affordances must be explicit;
- production imports must stop depending on legacy direct text-state mutation;
- durable accepted-submission recovery remains future work;
- durable/Continuum replay remains future work;
- the current witness still reports `TICKETED_RUNTIME_INGRESS_MISSING` until
  Echo exposes that concrete runtime evidence to the app-facing report.

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

- [ ] Docs use `Echo-hosted` terminology.
- [ ] Public jedit names do not imply Echo-owned text semantics.
- [ ] Transitional wording is bounded.

### Slice 62 - Production Runtime Authority Inventory

User story: As a maintainer, I can see every interactive editor path that reads
or writes text state and whether it already goes through `TextBufferSessionPort`.

Test plan:

- Static inventory lists direct editor-state text mutation/read paths.
- Inventory distinguishes app-owned session ports from direct in-memory helpers.
- No Echo or text semantics are added to Echo core.

Checklist:

- [ ] Inventory document exists.
- [ ] Direct read/write paths are listed.
- [ ] Next cutover targets are explicit.

### Slice 63 - Runtime Profile Port

User story: As a host operator, I can construct the production
`TextBufferSessionPort` through a jedit-owned runtime profile port, while
legacy local state remains explicitly test/dev-only.

Test plan:

- Runtime profile accepts explicit `echoHosted` and `testLocal` profiles.
- Unknown profile returns typed configuration obstruction.
- Selected app session exposes no tick, lifecycle, package install, handler, or
  state-port authority.

Checklist:

- [ ] Runtime profile port exists.
- [ ] `echoHosted` creates a `TextBufferSessionPort`.
- [ ] `testLocal` is marked test/dev-only.
- [ ] Invalid profile is typed.
- [ ] App session authority remains narrow.

### Slice 64 - Echo-Hosted Default Behind Host Configuration

User story: As a host operator, the configured production runtime profile is
Echo-hosted, while the local in-memory profile remains an explicit development
escape hatch.

Test plan:

- Default production configuration selects Echo-hosted session creation.
- Development/test override can select local fixture profile.
- Product UI does not expose runtime selection as a normal user feature.

Checklist:

- [ ] Production default is Echo-hosted.
- [ ] Local fixture override is explicit.
- [ ] User-facing mode switch is absent.

### Slice 65 - Buffer Open Cutover

User story: As a user in the production Echo-hosted profile, opening a buffer
creates the editor buffer through `TextBufferSessionPort.createBuffer(...)`.

Test plan:

- Production open calls `TextBufferSessionPort.createBuffer`.
- Local fixture path still preserves existing test behavior.
- Open does not request lifecycle drain or direct tick.

Checklist:

- [ ] Production open uses the session port.
- [ ] Local fixture path remains available for tests.
- [ ] Open has no tick authority.

### Slice 66 - Edit Command Cutover I

User story: As a user, insert and replace commands submit canonical app intents
through the session port.

Test plan:

- Insert command calls `applyIntent` on the app capability.
- Replace command calls `applyIntent` on the app capability.
- The command records obstruction instead of mutating UI state on failed apply.

Checklist:

- [ ] Insert path uses `applyIntent`.
- [ ] Replace path uses `applyIntent`.
- [ ] Failure posture is typed.

### Slice 67 - Edit Command Cutover II

User story: As a user, delete, backspace, and multi-range edits use the same
Echo-hosted intent path as insert and replace.

Test plan:

- Delete/backspace commands submit app intents.
- Multi-range or grouped edit commands submit app intents or typed obstruction.
- No direct text mutation bypass remains in production edit commands.

Checklist:

- [ ] Delete/backspace paths use `applyIntent`.
- [ ] Multi-range path is app-intent-backed or obstructed.
- [ ] Production bypasses are removed.

### Slice 68 - Read Model Cutover

User story: As a user, rendered editor text comes from bounded `textWindow`
readings instead of direct mutable snapshots in the production profile.

Test plan:

- Render model requests `textWindow` through the app capability.
- Reading envelope identity is retained in the UI model.
- Query observer remains read-only.

Checklist:

- [ ] Render path uses bounded reading.
- [ ] Reading identity reaches UI state.
- [ ] No query observer write/tick authority appears.

### Slice 69 - Cursor And Viewport Reading Basis

User story: As a user, cursor and viewport state select the bounded reading
aperture without becoming Echo semantics.

Test plan:

- Cursor/viewport state feeds the jedit query input.
- Echo basis and reading identity remain separate from UI cursor policy.
- Scroll/cursor changes do not mutate Echo causal history by themselves.

Checklist:

- [ ] Cursor state feeds query input.
- [ ] Viewport state feeds query input.
- [ ] Cursor/scroll-only moves do not submit edit intents.

### Slice 70 - UI Runtime Issue Posture

User story: As a user, an Echo obstruction appears as explicit UI/runtime
posture instead of silent retry or direct state mutation.

Test plan:

- Unsupported operation, query obstruction, and lifecycle obstruction map to
  typed UI runtime issues.
- Retry requires a new explicit user/agent action.
- UI state is not mutated by obstructed work.

Checklist:

- [ ] Obstructions map to runtime issues.
- [ ] Hidden retry remains absent.
- [ ] Obstructed work does not mutate editor state.

### Slice 71 - Filesystem Save Boundary

User story: As a user, saving a file is separated from Echo's causal
checkpoint/evidence posture.

Test plan:

- Save-to-filesystem remains a jedit adapter action.
- Echo checkpoint mutation remains a contract operation.
- Documentation distinguishes filesystem save from Echo causal history.

Checklist:

- [ ] Filesystem save stays behind an adapter.
- [ ] Checkpoint intent path is explicit.
- [ ] Docs distinguish the two.

### Slice 72 - Checkpoint Command Cutover

User story: As a user, checkpoint/save-intent semantics route through the jedit
contract operation path, not direct runtime mutation.

Test plan:

- Checkpoint command submits a contract operation.
- Checkpoint result carries receipt/evidence posture.
- Failed checkpoint does not mutate UI state as if committed.

Checklist:

- [ ] Checkpoint command uses contract operation.
- [ ] Checkpoint result carries evidence.
- [ ] Failure posture is typed.

### Slice 73 - Agent Editing Surface

User story: As an agent, I can perform a small edit through the same production
`TextBufferSessionPort` used by the interactive editor.

Test plan:

- CLI/MCP witness opens a buffer, applies an edit, observes a text window, and
  reports receipt/reading identity.
- The agent surface exposes no trusted lifecycle or tick method.
- The same command works after an unsupported mutation witness.

Checklist:

- [ ] Agent Echo-hosted edit command exists.
- [ ] Agent authority remains app-safe.
- [ ] Healthy work proceeds after a prior obstruction.

### Slice 74 - UI Retention Evidence

User story: As a maintainer, the interactive Echo-hosted path can emit the same
retention evidence refs as the headless witness.

Test plan:

- UI-path command reports retained evidence refs.
- Retained evidence includes receipt, reading envelope, and payload roles.
- Durable retention remains honestly scoped to what Echo exposes.

Checklist:

- [ ] UI-path retention report exists.
- [ ] Receipt/envelope/payload refs are present.
- [ ] Durable claims are not overclaimed.

### Slice 75 - UI Local Replay Witness

User story: As a maintainer, the interactive Echo-hosted path can be locally
replayed by semantic identity.

Test plan:

- Same inputs produce same package identity, receipt identity, reading identity,
  and text result.
- Replay equality ignores wall-clock cadence.
- Durable/Continuum replay remains honestly unavailable.

Checklist:

- [ ] UI-path local replay report exists.
- [ ] Semantic identity matches.
- [ ] Durable replay is not overclaimed.

### Slice 76 - Legacy Model Quarantine

User story: As a maintainer, the old in-memory text model is no longer a
production authority path.

Test plan:

- Legacy local model lives under a test/dev fixture or adapter-internal name.
- Production app code cannot import legacy direct mutation modules.
- Existing tests either use production ports or explicitly opt into fixtures.

Checklist:

- [ ] Legacy model is renamed or relocated.
- [ ] Production imports are removed.
- [ ] Test/dev fixture use is explicit.

### Slice 77 - Legacy Bypass Static Guard

User story: As a reviewer, a static guard fails if production UI/editor code
imports legacy direct text-state mutation modules instead of ports.

Test plan:

- Guard scans production source.
- Guard allows explicit test/dev fixtures.
- Guard catches a sample forbidden import.

Checklist:

- [ ] Production source guard exists.
- [ ] Test/dev fixture allowlist exists.
- [ ] Sample forbidden import is covered.

### Slice 78 - Remove Runtime Choice From Product UX

User story: As a user, jedit no longer presents Echo hosting as an optional
mode; it is the production runtime posture.

Test plan:

- User-facing labels do not expose local-vs-Echo mode selection.
- Host/test configuration still allows explicit fixture override.
- Documentation describes Echo-hosted production posture.

Checklist:

- [ ] Product mode wording is removed.
- [ ] Host/test override remains.
- [ ] Docs describe production posture.

### Slice 79 - Delete Or Demote Legacy Code

User story: As a maintainer, dead in-memory production paths are deleted where
possible and demoted where deletion is not yet safe.

Test plan:

- Dead paths are removed.
- Remaining paths are fixture/adapter-internal only.
- Release gate still passes.

Checklist:

- [ ] Dead production paths are removed.
- [ ] Remaining local paths are fixture-scoped.
- [ ] Release gate passes.

### Slice 80 - Echo-Hosted jedit Release Gate

User story: As a reviewer, one focused command proves the interactive
Echo-hosted production path.

Test plan:

- Release gate proves interactive open, edit, read, save/checkpoint posture,
  retention refs, local replay, no tick authority, and no legacy bypass.
- Failure output names the failed witness.
- BEARING points at the WSC persistence/export plan.

Checklist:

- [ ] Release gate includes interactive Echo-hosted smoke.
- [ ] Release gate includes no-legacy-bypass guard.
- [ ] Failure output is actionable.
- [ ] BEARING points at the WSC persistence/export plan.

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
