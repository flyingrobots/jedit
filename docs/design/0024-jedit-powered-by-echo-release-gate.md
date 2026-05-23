# jedit Powered By Echo Release Gate

Status: active 20-slice execution plan.

This plan defines the local release gate for the sentence:

```text
jedit is powered by Echo.
```

That sentence is true only when the primary headless jedit text edit/read
workflow uses Echo as the runtime authority for submission, admission,
scheduler-owned execution, receipt production, query observation, and evidence
retention, while all jedit-specific nouns remain in jedit contracts, generated
adapters, or jedit ports.

Echo must not know what a `TextBufferOptic`, rope, pane, cursor, text window, or
editor command is. Echo sees generic package identities, operation ids, query
ids, handlers, observers, receipts, readings, retained evidence, and
obstructions.

## Progress Protocol

Agents must keep this file current. Before committing a slice, check off that
slice's checklist items in this file. Do not mark later slices complete early.
If a slice is split, add the split under the original slice rather than
silently changing the release bar.

## Release Gate Definition

jedit is powered by Echo when this clean-checkout flow exists:

```text
trusted host starts Echo runtime policy
-> jedit installs its generated contract package
-> app creates or opens a TextBufferOptic
-> app submits a replace-range intent through jedit-owned adapter code
-> Echo accepts/adjudicates generic contract work
-> trusted host lets Echo run its scheduler-owned loop
-> app observes the intent outcome
-> app queries textWindow through a jedit-owned query observer
-> app receives TextWindowReading plus evidence
-> host can inspect retained receipt/reading posture
-> trusted host stops Echo cleanly
```

## Authority Bar

- Application code cannot tick Echo.
- Application code cannot call trusted Echo lifecycle control directly.
- Application dispatch does not execute synchronously.
- `TextBufferOptic` is a jedit capability, not an Echo noun.
- jedit text/rope semantics live in jedit contracts, generated adapters, and
  jedit-owned handler/observer code.
- Mutation handlers run only during Echo scheduler-owned execution.
- Query observers are read-only.
- `AdmissionTicket` is not `TickReceipt`.
- Conflict/rejection for one attempt is final for that attempt.
- Retry is a new explicit causal act, not hidden runtime behavior.

## Slice 01 - Plan And Bearing Signposts

User story: As a contributor or agent, I can open one plan and immediately know
the twenty-slice route to proving jedit is powered by Echo without contaminating
Echo with jedit nouns.

Work:

- Create this release-gate plan.
- Reference it from `AGENTS.md`.
- Create/update `docs/BEARING.md` so the current repo gravity points here.
- State the progress protocol that slices are checked off just before their
  commits.

Test plan:

- `git diff --check`
- Text search for this plan path from `AGENTS.md` and `docs/BEARING.md`.

Checklist:

- [x] Plan document exists.
- [x] `AGENTS.md` references the plan.
- [x] `docs/BEARING.md` references the plan.
- [x] Progress protocol is explicit.

## Slice 02 - jedit Contract Package Descriptor

User story: As the trusted host adapter, I can describe the jedit contract
package as an opaque installable artifact without teaching Echo editor nouns.

Work:

- Add a jedit-owned package descriptor module.
- Bind package identity, schema identity, artifact identity, codec identity,
  supported mutation operation names, supported query operation names, and
  observer plan identities.
- Consume existing Wesley-generated operation metadata.
- Keep the descriptor in jedit code, not Echo.

Test plan:

- Unit test descriptor identity and operation membership.
- Assert mutation/query operation sets come from generated Wesley metadata.
- Assert descriptor docs/code do not require Echo to know `TextBufferOptic`.
- `npm run build`
- Focused descriptor test.

Checklist:

- [x] Descriptor module exists.
- [x] Descriptor includes package/schema/artifact/codec identity.
- [x] Descriptor lists supported mutations from generated metadata.
- [x] Descriptor lists supported queries from generated metadata.
- [x] Descriptor has focused tests.

## Slice 03 - Package Install Preflight

User story: As the trusted host adapter, I can preflight a jedit package install
locally and reject unsupported operations before they look runtime-visible.

Work:

- Add a jedit-owned package preflight module.
- Validate duplicate operation/query names.
- Validate required mutations and queries are present.
- Classify unsupported mutation/query requests with typed results.
- Keep this as adapter/package boundary logic, not app-facing text behavior.

Test plan:

- Unit test happy preflight.
- Unit test missing required mutation.
- Unit test missing required query.
- Unit test unsupported mutation request.
- Unit test unsupported query request.
- `npm run build`
- Focused preflight test.

Checklist:

- [x] Preflight module exists.
- [x] Required mutations are validated.
- [x] Required queries are validated.
- [x] Unsupported mutations are rejected before runtime work.
- [x] Unsupported queries are rejected before observer execution.
- [x] Preflight has focused tests.

## Slice 04 - Echo Package Install Adapter

User story: As a trusted host adapter, I can translate the jedit package
descriptor into Echo's generic package-install API without app code seeing
runtime internals.

Work:

- Add the first jedit adapter that targets Echo's generic installed package
  boundary shape.
- Pass only generic package/operation/query/observer identity to Echo.
- Preserve app/host split: package install is trusted host work.
- Return typed install posture to jedit-side code.

Test plan:

- Adapter test with fake generic Echo package port.
- Unsupported operation remains preflighted before runtime-visible work.
- App-facing session has no install method.
- `npm run build`

Checklist:

- [x] Generic Echo package port shape exists in jedit.
- [x] Trusted adapter installs descriptor through that port.
- [x] App-facing API cannot install packages.
- [x] Install posture is typed.
- [x] Tests prove no app install authority.

## Slice 05 - Mutation Handler Registration

User story: As the trusted host adapter, I can register jedit-owned mutation
handlers so Echo can call them during scheduler-owned execution.

Work:

- Add jedit-owned handler registration for `createBufferWorldline`,
  `replaceRangeAsTick`, and `createCheckpoint`.
- Decode vars through generated/jedit-owned surfaces.
- Run existing jedit contract runtime logic behind the handler boundary.
- Keep handlers unavailable from app dispatch.

Test plan:

- Handler registration test with fake Echo contract host port.
- Mutation handler cannot be called through app-facing `TextBufferOptic`.
- Handler receives decoded generated vars.
- Handler returns typed generic result bytes/posture.

Checklist:

- [x] Mutation handler registry exists in jedit adapter layer.
- [x] `createBufferWorldline` handler registered.
- [x] `replaceRangeAsTick` handler registered.
- [x] `createCheckpoint` handler registered.
- [x] App dispatch cannot call handlers directly.

## Slice 06 - Query Observer Registration

User story: As the trusted host adapter, I can register jedit-owned query
observers so Echo can materialize bounded readings through generic QueryView.

Work:

- Register `worldlineSnapshot` and `textWindow` query observers.
- Decode query vars through generated/jedit-owned surfaces.
- Return generic query payload bytes and observer plan identity.
- Keep observer context read-only.

Test plan:

- No observer means unsupported query.
- Registered observer returns payload bytes.
- Observer cannot mutate runtime.
- Observer cannot request lifecycle/ticks.
- jedit adapter decodes `TextWindowReading`.

Checklist:

- [x] Query observer registry exists in jedit adapter layer.
- [x] `worldlineSnapshot` observer registered.
- [x] `textWindow` observer registered.
- [x] Observer context is read-only.
- [x] Unsupported query remains unsupported without registration.

## Slice 07 - Installed Package TextBufferOptic Headless Flow

User story: As an app caller, I can create a text buffer, apply an edit, and read
a text window through `TextBufferOptic`, while Echo remains the generic runtime.

Work:

- Wire `TextBufferOptic` to the installed package/handler/observer transport
  path for one headless flow.
- Keep trusted host lifecycle outside app-facing API.
- Replace the fake transport in this witness only. This slice proves the
  jedit-owned package boundary path; later slices bind that path to the real
  Echo WASM package install surface when it is available.

Test plan:

- Create buffer.
- Apply `replaceRange`.
- Trusted host drains/runs Echo.
- Query `textWindow`.
- Assert resulting `TextWindowReading` contains edited text.
- Assert app-facing objects expose no tick/lifecycle/install methods.

Checklist:

- [x] Headless flow uses installed jedit package transport path.
- [x] `TextBufferOptic` creates/opens buffer.
- [x] `replaceRange` goes through the installed mutation handler path.
- [x] `textWindow` goes through the installed query observer path.
- [x] App surface has no runtime authority.

## Slice 08 - Trusted Host Runtime Loop

User story: As a trusted local host, I can start and stop Echo runtime policy
without giving app code per-tick control.

Work:

- Add a trusted host lifecycle runner with start/stop posture.
- Treat cadence as host policy, not application semantic history.
- Prevent stop from interrupting half-committed work.
- Keep run-until-idle as a trusted testing/drain primitive.

Test plan:

- App-facing code cannot call start/stop.
- Trusted host can start with cadence policy.
- Trusted host can stop cleanly.
- Submitted work is eventually decided under host loop.
- Stop never exposes half-tick state.

Checklist:

- [x] Trusted host start posture exists.
- [x] Trusted host stop posture exists.
- [x] App-facing API has no start/stop/tick authority.
- [x] Cadence is host policy.
- [x] Stop is clean and typed.

## Slice 09 - Intent Outcome Observation

User story: As app code, I can distinguish accepted, pending, applied,
rejected, obstructed, and unknown intent outcomes.

Work:

- Add jedit-side outcome observation types.
- Correlate jedit app operations to Echo generic intent/submission/ticket/receipt
  evidence where available.
- Stop treating dispatch acceptance as application.

Test plan:

- Accepted but not ticked is not applied.
- Applied mutation maps to receipt.
- Unsupported operation maps to obstruction.
- Conflict/rejection remains final for that attempt.

Checklist:

- [x] Outcome type exists.
- [x] Accepted/pending/applied distinction exists.
- [x] Rejection/obstruction are represented.
- [x] Receipt correlation is exposed through app-safe handles.
- [x] Tests cover non-applied accepted submission.

## Slice 10 - Retained Evidence Lookup

User story: As a host or diagnostic tool, I can inspect retained evidence for a
jedit edit/read flow without raw Echo internals.

Work:

- Add jedit-side retained evidence refs for receipt, reading envelope, payload,
  package identity, and replay posture.
- Keep CAS byte identity separate from semantic reading identity.
- Return missing retention as typed obstruction.

Test plan:

- Reading payload hash is not query identity.
- Missing material returns obstruction.
- Retained refs include semantic coordinate.
- Host can produce evidence inventory.

Checklist:

- [x] Retained evidence ref type exists.
- [x] Receipt ref posture exists.
- [x] Reading envelope/payload posture exists.
- [x] Missing retention is typed.
- [x] Semantic and byte identities are distinct.

## Slice 11 - Agent CLI Real Echo Path

User story: As an agent, I can run one command that exercises the real
Echo-backed jedit path and returns JSON evidence.

Work:

- Extend the existing witness CLI to use the real package path.
- Report package install, submitted intent, lifecycle posture, outcome, reading,
  retention posture, and replay posture.
- Keep dry-run mode.

Test plan:

- CLI dry-run reports plan.
- CLI real mode reports structured evidence.
- CLI errors are typed JSON.
- CLI does not require app tick authority.

Checklist:

- [ ] CLI real path uses installed package flow.
- [ ] CLI JSON includes install/outcome/reading evidence.
- [ ] CLI dry-run stays stable.
- [ ] CLI typed errors stay machine-readable.
- [ ] Agent-facing docs updated.

## Slice 12 - MCP Adapter For Agents

User story: As an MCP agent, I can invoke the jedit Echo witness without shell
parsing and receive structured evidence.

Work:

- Add or extend MCP-facing adapter for the witness.
- Keep filesystem/process operations behind adapters.
- Return typed payloads matching CLI JSON.

Test plan:

- MCP adapter dry-run works.
- MCP adapter real witness call works when configured.
- Adapter cannot expose trusted lifecycle to app code.

Checklist:

- [ ] MCP adapter exists or is extended.
- [ ] Adapter delegates to witness port.
- [ ] JSON schema matches CLI evidence.
- [ ] No raw lifecycle/tick method leaks.

## Slice 13 - Conflict And Rejection Path

User story: As app code, I can see a lawful rejection or obstruction as an
honest outcome, not as a retry or internal fault.

Work:

- Add one deterministic non-happy path to the real Echo-backed jedit flow.
- Prefer unsupported operation/query first, then conflict when Echo exposes the
  needed blocker evidence.
- Document retry as new causal input.

Test plan:

- Non-happy path returns typed outcome.
- No hidden retry occurs.
- Healthy later work can still proceed.

Checklist:

- [ ] Non-happy path selected.
- [ ] Outcome is typed.
- [ ] No hidden retry.
- [ ] Docs explain explicit retry doctrine.

## Slice 14 - Restart/Persistence Posture

User story: As a host, I can describe what survives restart and what remains
in-memory in the current release gate.

Work:

- Add restart posture to witness report.
- If Echo exposes durable accepted-submission recovery, consume it.
- Otherwise report typed durability obstruction.

Test plan:

- Witness reports restart posture.
- No half-accepted submission is claimed.
- Missing persistence is explicit.

Checklist:

- [ ] Restart posture exists.
- [ ] Durable support is consumed if available.
- [ ] Missing durable support is typed.
- [ ] Docs avoid overclaiming persistence.

## Slice 15 - Local Replay Proof

User story: As a developer, I can rerun the same local jedit/Echo scenario and
compare receipts/readings deterministically.

Work:

- Add replay/compare command path.
- Compare stable evidence identity, not wall-clock timing.
- Keep replay local; no Continuum transport claim.

Test plan:

- Same inputs reproduce same outcome/reading identity.
- Wall-clock cadence is ignored.
- Mismatch reports typed replay failure.

Checklist:

- [ ] Replay command path exists.
- [ ] Stable identity comparison exists.
- [ ] Wall-clock is non-semantic.
- [ ] Mismatch is typed.

## Slice 16 - Interactive TUI Adapter Cutover

User story: As a jedit user, I can run the interactive editor with the
Echo-backed text path enabled for a narrow scenario.

Work:

- Add opt-in interactive mode that uses the Echo-backed session.
- Keep fallback local mode available.
- Preserve UI responsiveness.

Test plan:

- Interactive smoke starts.
- Narrow edit/read path uses Echo-backed session.
- Fallback mode remains available.

Checklist:

- [ ] Opt-in Echo-backed mode exists.
- [ ] Narrow interactive edit path uses Echo.
- [ ] Fallback mode remains available.
- [ ] UI smoke test updated.

## Slice 17 - Release Quickstart

User story: As a new developer, I can follow one quickstart and see jedit use
Echo for a real edit/read flow.

Work:

- Add quickstart commands.
- Include expected JSON snippets.
- Include troubleshooting for missing Echo WASM, missing observer, and replay
  unavailability.

Test plan:

- Quickstart commands execute on clean checkout.
- Docs snippets match current JSON.
- Missing dependency errors are actionable.

Checklist:

- [ ] Quickstart exists.
- [ ] Commands are executable.
- [ ] Expected output is current.
- [ ] Troubleshooting covers common failures.

## Slice 18 - Release Gate Quality Ratchet

User story: As a maintainer, I can run one release-gate check that proves the
jedit/Echo path remains intact.

Work:

- Add `npm` script for the release gate.
- Run build, quality, focused package/handler/observer/witness tests.
- Keep it faster than full exhaustive CI where possible.

Test plan:

- Script passes locally.
- Script fails on missing package descriptor.
- Script fails on missing observer witness.

Checklist:

- [ ] Release-gate script exists.
- [ ] Script includes relevant focused tests.
- [ ] Script is documented.
- [ ] Script catches missing contract package path.

## Slice 19 - v0.1.0 Release Documentation

User story: As a release reader, I can see exactly what "jedit powered by Echo"
means and what remains post-release.

Work:

- Update release docs.
- Name non-goals clearly.
- Link evidence commands.
- Keep Echo generic boundary front and center.

Test plan:

- Docs links resolve.
- Release checklist references release-gate script.
- Non-goals include no Continuum transport and no full observer-rights lattice.

Checklist:

- [ ] Release docs updated.
- [ ] Evidence commands linked.
- [ ] Non-goals listed.
- [ ] Echo generic boundary stated.

## Slice 20 - Release Gate Closeout

User story: As the project owner, I can decide whether v0.1.0 is honest based
on executable evidence, not vibes.

Work:

- Run the release-gate script.
- Run full `npm run check`.
- Record final witness report.
- Update this plan with final status.
- Prepare release/PR notes.

Test plan:

- Release-gate script passes.
- Full check passes.
- Final witness report is committed or linked as appropriate.

Checklist:

- [ ] Release-gate script passes.
- [ ] `npm run check` passes.
- [ ] Final witness report recorded.
- [ ] Plan final status updated.
- [ ] Release notes prepared.
