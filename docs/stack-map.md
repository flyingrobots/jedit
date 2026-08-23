# Stack Map

> **Cutover correction (2026-08-18):** References below to Wesley-generated Jim
> operation metadata or local structural-history execution are historical or
> compatibility evidence. The target is not a frontend invoking a collection of
> Echo-installed operations. `Jim.edict` is the application and active observer;
> Jim-owned Edict lawpacks define operations and optics; Edict compiles and
> verifies generic packages; Echo realizes them without learning application
> vocabulary; Jedit/Bijou/native code supplies I/O and rendering.

## Doctrine

Product pressure determines architecture truth.

The stack advances in this order:

```text
product pressure
-> witness
-> boundary
-> contract
-> protocol, if deserved
```

## Layers

| Layer | Job | Sends down | Receives up |
| :--- | :--- | :--- | :--- |
| Jedit/Bijou/native | Jim's I/O body | canonical events, package addresses, raw adapter results | render projections, typed artifacts |
| `Jim.edict` | Editor mind and application state machine | observation requests, operation intents | canonical events, readings, outcomes, obstructions |
| Jim Edict lawpacks | Application operations, optics, facts, and obstructions | authored law and declared closure | typed application values |
| Edict | Language, checking, lowering, packaging, and verification | verified generic packages and semantic-free codecs | Jim-authored source and lawpack closure |
| Echo | Generic runtime substrate truth | admitted effects, readings, receipts, recovery evidence | verified programs, events, observation requests |
| Wesley | Transitional compatibility compiler | generated artifacts, codecs, operation metadata | authored GraphQL contracts |
| Graft | Structural intelligence | spans, outlines, syntax/semantic structure | buffer snapshots or text surfaces |
| Bijou | Terminal UI substrate | input/render events | screen output and interaction state |
| Continuum | Deferred publication/protocol layer | shared protocol families, once earned | proven local seams |

## Must never know

| Layer | Must never know |
| :--- | :--- |
| Jedit/Bijou/native | command meaning, operation choice, Jim state transitions, scheduler internals |
| `Jim.edict` and lawpacks | scheduler internals, WAL identities, direct graph mutation authority |
| Edict | runtime state, transport timing, editor policy |
| Echo | Jim, Buffer, Rope, ReplaceRange, TextWindow, panes, cursors, Vim semantics |
| Wesley | runtime state, transport timing, editor policy |
| Graft | causal truth, mutation authority |
| Bijou | causal semantics |
| Continuum | unproven local seams pretending to be universal protocol |

## Current proof

Stack Witness 0001:

```text
jedit-shaped bytes
-> trusted-host run request
-> textWindow observation request
-> UNSUPPORTED_QUERY without installed observer
```

The old Stack Witness text fixture is historical. Echo no longer contains
hardcoded `createBuffer`, `replaceRange`, or `textWindow` semantics. The next
real proof begins with Jim-owned `ReplaceRange.edict`, built through Edict's
public application boundary and interpreted as a verified generic program by
Echo. The retained Jedit oracle is expectation evidence only.

The current Echo `v0.1.0` release-gate proof starts from the implemented
structural-history contract:

```text
jedit-authored `contracts/jedit/structural-history.graphql`
-> `replaceTextRange` operation identity
-> Wesley generated artifacts
-> Echo package install
-> app-safe edit intent submission
-> trusted-host lifecycle loop
-> scheduler-owned tick receipt
-> observed outcome
-> bounded text reading
-> retained-evidence inventory
-> replay posture
```

The next release-gate slice plan is recorded in
`docs/design/0019-echo-runtime-control-release-slices/echo-runtime-control-release-slices.md`.

## Current scaffolding

- Fake Echo-shaped transport remains valid as a controlled witness posture.
- Real Echo WASM witness remains opt-in and now uses the app/host authority
  split: app intent submission stays on the app transport, while scheduler
  lifecycle requests use the trusted-host lifecycle port.
- The current real Echo witness fails closed with `UNSUPPORTED_QUERY` unless a
  jedit-owned generated query observer is installed. The local report fixture
  can still name inline reading posture, but that is not Echo kernel text
  semantics.
- The current replay surface is a shell: `--replay` returns
  `durable_replay_unavailable` until Echo exposes durable replay evidence
  through the adapter.
- Start/Stop/cadence are trusted host runtime-control history. They are not
  jedit contract intents and they do not create ticks directly.
- `TrustedEchoRuntimeLifecyclePort.requestRunUntilIdle(...)` wraps raw trusted
  Echo control bytes so witness and host code do not talk in external tick
  vocabulary.
- `TrustedEchoRuntimeLifecyclePort.requestStop()` wraps trusted Stop control
  without exposing app-controlled cancellation or half-tick interruption.
- `scripts/jedit-echo-powered-session.mjs --json --dry-run` gives agents a fast
  installed-package plan over the `TextBufferOptic` and trusted lifecycle
  wrapper. The explicit `--allow-full-snapshot-fixture` command remains a
  transitional compatibility witness; the default TUI and release-gate path do
  not silently construct fixture text authority, and the opt-in real Echo WASM
  witness remains the substrate proof.
- `stopTrustedEchoRuntime(...)` is the deterministic host shutdown primitive
  for Echo lifecycle control. It is not app-facing stop/cancel behavior.
- Fixture vars bytes are not the durable Wesley runtime codec.
- `TextBufferSessionPort` is the jedit app-facing session port. It returns
  `TextBufferOptic` buffer capabilities while keeping the backing runtime
  behind adapters.
- `createEchoBackedTextBufferSession(...)` is the Echo-backed adapter. It
  composes the app-facing session port without exposing trusted lifecycle
  control. Host loops drain Echo separately.
- `ReadBasisHandle` is an opaque supporting token, not the complete optic
  protocol.
- Structural-history SDL is now the product contract authority for text
  revisions, replacement events, edit groups, checkpoints, provenance, command
  status, and evidence-bearing readings.
- `replaceTextRange` operation identity is consumed from build-generated Wesley
  metadata while the old TypeScript runtime remains the transitional executor.
- `scripts/jedit-echo-powered-session.mjs --json --allow-full-snapshot-fixture`
  reports the structural `replaceTextRange` edit intent in the compatibility
  witness summary. The structural-history generated-package descriptor now
  installs through the generic Echo package port. The fixture witness also
  reports a mutation/query round trip where structural-history owns the
  mutation/receipt coordinate and the transitional hot-text package still owns
  the bounded `textWindow` observer.
- `scripts/jedit-echo-release-gate.mjs --json-report` is the current
  consolidated jedit/Echo proof report. It joins the happy path, unsupported
  mutation path, local replay posture, retained evidence refs, and authority
  checks into one JSON artifact.
- Continuum remains deferred until the seam is proven enough to publish.

## Operating rule

If a layer needs forbidden knowledge to make progress, the boundary is wrong or
the witness is not ready.
