# Echo-Powered UI Adoption - Next Ten Slices

Status: proposed next active plan after slices 51-60 merge

This plan follows
[`0026-echo-hosting-hardening-first-twenty.md`](0026-echo-hosting-hardening-first-twenty.md).
Slices 51-60 closed the app-hosting witness path: ticketed mutation authority,
read-only query observers, local receipt correlation, retained reading lookup,
restart recovery adapter shape, replay identity, second-app template identity,
guide drift checks, and the release gate are now explicit.

The next goal is to move from a strong headless witness to a stronger product
claim:

```text
jedit's interactive editor can run through the same app-owned Echo ports that
the witness uses, while Echo remains generic and never learns jedit nouns.
```

## Current Reflection

The branch closes the previous hardening batch without changing Echo's
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

- interactive editor commands must route through `TextBufferSessionPort` in Echo
  mode instead of depending only on the headless witness;
- rendering must consume bounded readings from the app-owned session port;
- editor save/checkpoint behavior must distinguish filesystem persistence from
  Echo causal/evidence posture;
- UI-level obstruction and retry affordances must be explicit;
- durable accepted-submission recovery remains future work;
- durable/Continuum replay remains future work;
- the current witness still reports `TICKETED_RUNTIME_INGRESS_MISSING` until
  Echo exposes that concrete runtime evidence to the app-facing report.

## Slice Budget

### Slice 61 - Interactive Session Port Inventory

User story: As a maintainer, I can see every interactive editor path that reads
or writes text state and whether it already goes through `TextBufferSessionPort`.

Guardrail: this slice is blocked unless behavior remains aligned with
[`echo-identity-doctrine.md`](echo-identity-doctrine.md):
values are hashed, things are declared IDs, names are bindings, and import
policy is explicit.

Test plan:

- Static inventory lists direct editor-state text mutation/read paths.
- Inventory distinguishes app-owned session ports from direct in-memory helpers.
- No Echo or text semantics are added to Echo core.

Checklist:

- [ ] Inventory document exists.
- [ ] Direct read/write paths are listed.
- [ ] Next cutover targets are explicit.
- [ ] `docs/design/echo-identity-doctrine.md` is linked before acceptance close.

### Slice 62 - Runtime Selection Port

User story: As a host operator, I can choose the local in-memory path or the
Echo-backed path through a configuration port, without leaking Echo controls to
application code.

Test plan:

- Runtime selection accepts explicit `local` and `echo` modes.
- Unknown mode returns typed configuration obstruction.
- Selected app session exposes no tick, lifecycle, package install, handler, or
  state-port authority.

Checklist:

- [ ] Runtime selection port exists.
- [ ] `echo` mode creates a `TextBufferSessionPort`.
- [ ] Invalid mode is typed.
- [ ] App session authority remains narrow.

### Slice 63 - Echo Mode Buffer Open

User story: As a user in Echo mode, opening a buffer creates the editor buffer
through the Echo-backed session port.

Test plan:

- Echo mode open calls `TextBufferSessionPort.createBuffer`.
- Local mode still preserves existing behavior.
- Open does not request lifecycle drain or direct tick.

Checklist:

- [ ] Echo mode open uses the session port.
- [ ] Local mode remains available.
- [ ] Open has no tick authority.

### Slice 64 - Echo Mode Editing Commands

User story: As a user in Echo mode, insert/delete/replace commands submit
canonical app intents through the session port.

Test plan:

- Editing command calls `applyIntent` on the app capability.
- The command records obstruction instead of mutating UI state on failed apply.
- No direct text mutation bypass remains in Echo mode.

Checklist:

- [ ] Insert path uses `applyIntent`.
- [ ] Delete/replace path uses `applyIntent`.
- [ ] Failure posture is typed.

### Slice 65 - Echo Mode Rendering Reads

User story: As a user in Echo mode, rendered lines come from bounded
`textWindow` readings instead of direct mutable buffer snapshots.

Test plan:

- Render model requests `textWindow` through the app capability.
- Reading envelope identity is retained in the UI model.
- Query observer remains read-only.

Checklist:

- [ ] Render path uses bounded reading.
- [ ] Reading identity reaches UI state.
- [ ] No query observer write/tick authority appears.

### Slice 66 - Echo Mode Save And Checkpoint Boundary

User story: As a user in Echo mode, saving a file is separated from Echo's
causal checkpoint/evidence posture.

Test plan:

- Save-to-filesystem remains a jedit adapter action.
- Echo checkpoint mutation remains a contract operation.
- Documentation distinguishes filesystem save from Echo causal history.

Checklist:

- [ ] Filesystem save stays behind an adapter.
- [ ] Checkpoint intent path is explicit.
- [ ] Docs distinguish the two.

### Slice 67 - Agent Editing Through Echo Mode

User story: As an agent, I can perform a small edit through the same Echo-mode
session path used by the interactive editor.

Test plan:

- CLI/MCP witness opens a buffer, applies an edit, observes a text window, and
  reports receipt/reading identity.
- The agent surface exposes no trusted lifecycle or tick method.
- The same command works after an unsupported mutation witness.

Checklist:

- [ ] Agent Echo-mode edit command exists.
- [ ] Agent authority remains app-safe.
- [ ] Healthy work proceeds after a prior obstruction.

### Slice 68 - UI Obstruction And Retry Posture

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

### Slice 69 - UI Retention And Replay Command

User story: As a maintainer, the interactive Echo-mode path can emit the same
retention and local replay evidence as the headless witness.

Test plan:

- UI-mode command reports retained evidence refs.
- UI-mode command reports local replay match/mismatch.
- Durable replay remains honestly unavailable.

Checklist:

- [ ] UI-mode retention report exists.
- [ ] UI-mode local replay report exists.
- [ ] Durable replay is not overclaimed.

### Slice 70 - Interactive Echo Release Gate

User story: As a reviewer, one focused command proves the interactive Echo-mode
path in addition to the headless witness path.

Test plan:

- Release gate runs the interactive Echo-mode smoke.
- Failure output names the failed witness.
- BEARING points at the next active plan.

Checklist:

- [ ] Release gate includes interactive Echo-mode smoke.
- [ ] Failure output is actionable.
- [ ] BEARING is current.
