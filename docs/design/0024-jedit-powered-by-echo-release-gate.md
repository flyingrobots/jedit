# jedit Powered By Echo Release Gate

Status: slices 1-30 closed locally; release-gate evidence recorded.

After slice 30, release pressure was deliberately removed. The active
post-release-pressure continuation lives in
[`0025-echo-application-hosting-pattern.md`](0025-echo-application-hosting-pattern.md)
and supersedes the earlier release-shaped slice 31-40 plan below. Keep this file
as the historical baseline for slices 1-30.

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

- [x] CLI real path uses installed package flow.
- [x] CLI JSON includes install/outcome/reading evidence.
- [x] CLI dry-run stays stable.
- [x] CLI typed errors stay machine-readable.
- [x] Agent-facing docs updated.

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

- [x] MCP adapter exists or is extended.
- [x] Adapter delegates to witness port.
- [x] JSON schema matches CLI evidence.
- [x] No raw lifecycle/tick method leaks.

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

- [x] Non-happy path selected.
- [x] Outcome is typed.
- [x] No hidden retry.
- [x] Docs explain explicit retry doctrine.

## Slice 14 - Echo-Hosted State And Restart Posture

User story: As a host, I can describe what survives restart and what remains
in-memory in the current release gate.

Work:

- Add restart posture to witness report.
- Report the current state owner.
- Report that process-local handler state is transitional when it is still
  present.
- Report Echo-hosted package/evidence posture separately from jedit's text
  state owner.
- If Echo exposes durable accepted-submission recovery, consume it.
- Otherwise report typed durability obstruction.

Test plan:

- Witness reports restart posture.
- No half-accepted submission is claimed.
- Missing persistence is explicit.

Checklist:

- [x] Restart posture exists.
- [x] Current state owner is reported.
- [x] Process-local handler state is called transitional.
- [x] Echo-hosted package/evidence posture is reported.
- [x] Durable support is consumed if available.
- [x] Missing durable support is typed.
- [x] Docs avoid overclaiming persistence.

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

- [x] Replay command path exists.
- [x] Stable identity comparison exists.
- [x] Wall-clock is non-semantic.
- [x] Mismatch is typed.

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

- [x] Opt-in Echo-backed mode exists.
- [x] Narrow interactive edit path uses Echo.
- [x] Fallback mode remains available.
- [x] UI smoke test updated.

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

- [x] Quickstart exists.
- [x] Commands are executable.
- [x] Expected output is current.
- [x] Troubleshooting covers common failures.

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

- [x] Release-gate script exists.
- [x] Script includes relevant focused tests.
- [x] Script is documented.
- [x] Script catches missing contract package path.

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

- [x] Release docs updated.
- [x] Evidence commands linked.
- [x] Non-goals listed.
- [x] Echo generic boundary stated.

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

- [x] Release-gate script passes.
- [x] `npm run check` passes.
- [x] Final witness report recorded.
- [x] Plan final status updated.
- [x] Release notes prepared.

## Continuation Budget

The first twenty slices proved the local jedit/Echo witness path, but they also
made the next truth visible: jedit still has transitional process-local text
state and a synchronous installed-contract adapter. The next twenty slices move
that witness toward a stricter Echo-powered shape without moving text/editor
nouns into Echo.

Continuation target:

```text
jedit submits generic work envelopes
-> Echo/trusted host owns handler invocation timing
-> jedit handlers model text state through jedit-owned Echo graph facts
-> outcomes, readings, retention, restart, and replay stay honest
```

The continuation does not authorize Echo to know about ropes, buffers, windows,
or editor commands. Those remain jedit-owned contract semantics.

Remote posture: this branch was pushed through slice 25 at `2a71650` before
slice 26 began. Later slice groups must check `git status --short --branch`
and PR state directly; do not infer publication from this paragraph.

## Slice 21 - Continuation Plan And Remote Posture

User story: As a contributor, I can see exactly how the second twenty-slice
budget extends the jedit/Echo release gate without mistaking local commits for
remote PR state.

Work:

- Extend this plan with slices 21 through 40.
- Document that branch publication is a separate operator-approved action.
- Update `docs/BEARING.md` to point at the continuation budget.
- Keep the release target focused on jedit being powered by Echo generically,
  not on a full product release.

Test plan:

- `git diff --check`
- Text search for the continuation phrase from `docs/BEARING.md`.

Checklist:

- [x] Slices 21 through 40 are recorded.
- [x] Remote publication posture is explicit.
- [x] `docs/BEARING.md` references the continuation budget.
- [x] The continuation keeps Echo generic.

## Slice 22 - Runtime Work Envelope Boundary

User story: As the jedit/Echo adapter, I can represent submitted work as a
generic runtime work envelope before any handler executes.

Work:

- Add a jedit-owned runtime work envelope port.
- Bind package id, operation name, operation kind, canonical request bytes, and
  deterministic submission identity.
- Keep the envelope free of text/editor runtime nouns.
- Make envelope identity content-addressed through the existing hash port.

Test plan:

- Same package, operation, kind, and bytes produce the same submission id.
- Different bytes produce a different submission id.
- Operation kind is typed.
- Envelope source contains no editor semantic nouns beyond jedit ownership.

Checklist:

- [x] Runtime work envelope type exists.
- [x] Submission id is deterministic.
- [x] Operation kind is typed.
- [x] Envelope is free of text/editor semantic fields.
- [x] Focused envelope tests pass.

## Slice 23 - Installed Transport Work Envelope Staging

User story: As the installed transport, I stage a runtime work envelope for a
submitted mutation before the jedit handler path executes.

Work:

- Add an optional runtime work sink to the installed transport.
- Record the runtime work envelope before mutation execution.
- Preserve existing response behavior while exposing the staging witness for
  tests and diagnostics.
- Do not stage query observations as mutation work.

Test plan:

- Installed transport records a work envelope before mutation execution.
- The envelope uses the canonical request bytes passed to `submitIntentBytes`.
- Query observation does not record mutation work.
- Existing installed transport headless flow still passes.

Checklist:

- [x] Installed transport accepts a work sink.
- [x] Mutation submission records a work envelope.
- [x] Envelope is recorded before handler execution.
- [x] Query observation does not stage mutation work.
- [x] Focused installed transport tests pass.

## Slice 24 - Handler Invocation Boundary

User story: As jedit, I can distinguish raw mutation handler registration from
Echo scheduler-owned handler invocation.

Work:

- Add a jedit-owned handler invocation boundary.
- Require scheduler authority for mutation handler invocation.
- Return typed blocked posture for non-scheduler invocation attempts.
- Keep the boundary outside app-facing `TextBufferOptic`.

Test plan:

- Scheduler authority invokes a registered mutation handler.
- Application authority is blocked before handler execution.
- Blocked invocation has typed posture.
- No app-facing object exposes the invocation authority.

Checklist:

- [x] Handler invocation boundary exists.
- [x] Scheduler authority is required.
- [x] Non-scheduler authority is blocked.
- [x] Blocked invocation does not call handlers.
- [x] Focused invocation tests pass.

## Slice 25 - Scheduler-Owned Installed Handler Guard

User story: As the installed transport, I execute jedit mutation handlers only
through the scheduler-owned invocation boundary.

Work:

- Route installed transport mutation execution through the handler invocation
  boundary.
- Record scheduler invocation source for focused tests.
- Preserve app-facing submit/read behavior.
- Keep lifecycle/tick authority behind trusted host ports.

Test plan:

- Installed transport invokes handlers with scheduler authority.
- App-facing session still exposes no tick, lifecycle, install, or invocation
  authority.
- Existing headless installed flow still passes.
- Quality gate remains clean.

Checklist:

- [x] Installed transport uses the invocation boundary.
- [x] Scheduler source is observable in tests.
- [x] App-facing authority remains absent.
- [x] Headless flow still passes.
- [x] Quality gate passes.

## Slice 26 - Ticketed Runtime Ingress Shape

User story: As the adapter boundary, I can model the difference between a
submitted work envelope and ticketed runtime ingress.

Work:

- Add ticketed ingress posture types.
- Keep admission ticket identity distinct from submission identity.
- Do not claim real Echo tickets until the Echo port supplies them.
- Report missing ticketed ingress as typed posture.

Test plan:

- Submission identity is not ticket identity.
- Missing ticket posture is typed.
- Existing witness reports do not overclaim ticketed ingress.

Checklist:

- [x] Ticketed ingress type exists.
- [x] Submission and ticket identity are distinct.
- [x] Missing ticket posture is typed.
- [x] Witness report uses the posture.

## Slice 27 - Real Echo Receipt Correlation Adapter

User story: As jedit, I can correlate app-safe outcome handles to Echo receipt
identity when the transport provides receipt evidence.

Work:

- Add a receipt correlation port.
- Preserve current transitional correlation posture when real Echo receipts are
  unavailable.
- Keep unsupported/missing correlation typed.

Test plan:

- Real receipt evidence maps to app outcome handle.
- Missing receipt evidence remains obstruction/posture, not success.
- Unsupported operations do not fabricate receipts.

Checklist:

- [x] Receipt correlation port exists.
- [x] Real receipt mapping path exists.
- [x] Missing receipt posture is typed.
- [x] Tests cover unsupported operations.

## Slice 28 - Retained Evidence Adapter Against Echo Retention

User story: As a diagnostic host, I can ask jedit for retained evidence through
an Echo retention-shaped adapter instead of process-local summaries only.

Work:

- Add Echo retention lookup port for receipt, reading envelope, and payload
  refs.
- Keep semantic coordinate distinct from byte hash.
- Preserve typed missing-material posture.

Test plan:

- Retention lookup succeeds through fake Echo retention port.
- Missing material is typed.
- Query identity is not treated as payload retention identity.

Checklist:

- [x] Echo retention lookup port exists.
- [x] Receipt lookup path exists.
- [x] Reading lookup path exists.
- [x] Missing material is typed.

## Slice 29 - Echo-Hosted Contract Entity Model

User story: As jedit, I can describe text runtime entities as jedit-owned graph
facts suitable for Echo hosting without requiring Echo editor semantics.

Work:

- Add jedit-owned entity/fact model for worldline, head, root, tick, and
  checkpoint.
- Keep fact names in jedit code.
- Provide conversion from current process-local session to facts.

Test plan:

- Session converts to stable fact set.
- Historical tick and checkpoint roots have corresponding root facts.
- Fact set contains no Echo-specific editor APIs.
- Same session produces same fact identities.

Checklist:

- [x] Entity/fact model exists.
- [x] Session conversion exists.
- [x] Historical root references have matching root facts.
- [x] Fact identities are stable.
- [x] Tests prove deterministic conversion.

## Slice 30 - Echo-Backed State Port

User story: As jedit, I can read and write jedit text contract facts through a
state port that can later be backed by Echo instead of process memory.

Work:

- Add state port for jedit contract facts.
- Provide in-memory adapter as the current implementation.
- Route contract runtime through the port without exposing it to app code.

Test plan:

- Runtime can create/read/write through the state port.
- Existing contract runtime tests still pass.
- App-facing API does not expose the state port.

Checklist:

- [x] State port exists.
- [x] In-memory adapter exists.
- [x] Runtime can use the port.
- [x] App-facing API remains clean.

## Slice 31 - Text Runtime Port Cutover

User story: As jedit, the installed handler path no longer owns text state as a
private process-local implementation detail.

Work:

- Route installed handlers through the Echo-backed state port abstraction.
- Keep the current in-memory adapter as a test/local implementation.
- Report state owner more precisely in witness output.

Test plan:

- Installed flow still edits and reads text.
- Witness reports state port owner.
- Restart posture remains honest.

Checklist:

- [ ] Installed handlers use the state port.
- [ ] Witness reports state owner.
- [ ] Existing installed flow passes.

## Slice 32 - Worldline Snapshot From State Port

User story: As an observer, `worldlineSnapshot` reads from the jedit state port
instead of directly trusting session-local state.

Work:

- Route snapshot observer through state port where feasible.
- Preserve observer read-only authority.
- Keep current session input as compatibility until Echo supplies basis lookup.

Test plan:

- Snapshot observer returns state-port-backed reading.
- Observer cannot mutate state.
- Missing state basis returns typed obstruction.

Checklist:

- [ ] Snapshot observer uses state port.
- [ ] Read-only authority holds.
- [ ] Missing state is typed.

## Slice 33 - Text Window From State Port

User story: As an observer, `textWindow` reads through the same jedit state port
used by mutation handlers.

Work:

- Route text-window reading through state port.
- Preserve bounded aperture and byte budget.
- Keep query identity distinct from retained payload identity.

Test plan:

- Text window returns state-port-backed text.
- Bounds are honored.
- Missing state returns typed obstruction.

Checklist:

- [ ] Text-window observer uses state port.
- [ ] Bounds are honored.
- [ ] Missing state is typed.

## Slice 34 - Durable Accepted Submission Persistence

User story: As a trusted local host, an accepted but not yet decided jedit
submission is recoverable after restart.

Work:

- Add durable submission ledger port.
- Persist accepted submission identity and envelope before execution.
- Recover pending submissions without executing them during recovery.

Test plan:

- Accepted pending submission survives restart.
- Recovery does not execute handlers.
- Half-accepted state is impossible or obstructed.

Checklist:

- [ ] Durable submission ledger port exists.
- [ ] Accepted pending submission is persisted.
- [ ] Recovery is non-executing.
- [ ] Half-accepted state is rejected.

## Slice 35 - Crash Restart Witness

User story: As a release reviewer, I can see crash/restart behavior for
accepted, pending, decided, and missing jedit submissions.

Work:

- Add crash/restart witness script or test fixture.
- Cover accepted-pending, accepted-applied, rejected, and unknown submission
  postures.
- Keep evidence local and deterministic.

Test plan:

- Restart fixture passes.
- Unknown submission is typed.
- Decided receipt correlation survives.

Checklist:

- [ ] Restart witness exists.
- [ ] Pending posture covered.
- [ ] Decided posture covered.
- [ ] Unknown posture covered.

## Slice 36 - Interactive Real Runtime Path

User story: As a user, the opt-in interactive Echo mode uses the same runtime
work envelope and state-port path as the headless witness.

Work:

- Remove interactive-only shortcuts around submission or state.
- Keep local fallback mode.
- Add interactive smoke evidence.

Test plan:

- Interactive Echo mode uses installed transport path.
- Interactive fallback mode still works.
- Smoke test covers edit/read path.

Checklist:

- [ ] Interactive mode uses real envelope path.
- [ ] Interactive mode uses state-port path.
- [ ] Fallback remains available.

## Slice 37 - Conflict Or Rejection With Echo Evidence

User story: As app code, I can observe a real conflict/rejection outcome with
Echo-shaped evidence rather than a synthetic unsupported-operation placeholder.

Work:

- Add deterministic conflict/rejection witness when the Echo boundary exposes
  enough evidence.
- Keep retry explicit.
- Preserve healthy later work.

Test plan:

- Conflict/rejection outcome is typed.
- No hidden retry occurs.
- Later unrelated work proceeds.

Checklist:

- [ ] Real conflict/rejection witness exists.
- [ ] Retry remains explicit.
- [ ] Healthy later work proceeds.

## Slice 38 - Release Gate Upgrade

User story: As a maintainer, the release-gate script proves the stricter
runtime-envelope, scheduler-invocation, state-port, persistence, and replay
truths.

Work:

- Add slices 21-37 focused tests to `release-gate:echo`.
- Keep the script reasonably fast.
- Report which phase failed.

Test plan:

- Release-gate script passes.
- Removing envelope staging fails the gate.
- Removing state-port path fails the gate.

Checklist:

- [ ] Release gate includes continuation tests.
- [ ] Script remains focused.
- [ ] Failure reporting is clear.

## Slice 39 - v0.1.0 Release Docs Upgrade

User story: As a release reader, I can distinguish the stricter powered-by-Echo
claim from the earlier transitional process-local witness.

Work:

- Update v0.1.0 release docs with continuation evidence.
- Name remaining post-v0.1 limits.
- Keep Echo generic boundary prominent.

Test plan:

- Release docs reference current evidence commands.
- Non-goals remain explicit.
- No docs claim Echo knows jedit semantics.

Checklist:

- [ ] Release docs updated.
- [ ] Evidence commands current.
- [ ] Non-goals current.
- [ ] Echo generic boundary stated.

## Slice 40 - Continuation Closeout

User story: As the project owner, I can decide whether the stricter local
jedit-powered-by-Echo gate is ready for PR or release-candidate inspection.

Work:

- Run release-gate script.
- Run full `npm run check`.
- Record continuation witness.
- Update this plan status.
- Prepare PR/release notes.

Test plan:

- Release-gate script passes.
- Full check passes.
- Continuation witness is committed or linked.

Checklist:

- [ ] Release-gate script passes.
- [ ] `npm run check` passes.
- [ ] Continuation witness recorded.
- [ ] Plan status updated.
- [ ] PR/release notes prepared.
