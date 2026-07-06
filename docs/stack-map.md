# Stack Map

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
| jedit | Product/editor pressure | intent, observation requests, product constraints | readings, receipts, product-shaped evidence |
| Echo | Runtime substrate truth | admitted runtime effects, observed readings | contract intent, observation requests |
| Wesley | Contract/compiler authority | generated artifacts, codecs, operation metadata | authored contracts |
| Graft | Structural intelligence | spans, outlines, syntax/semantic structure | buffer snapshots or text surfaces |
| Bijou | Terminal UI substrate | input/render events | screen output and interaction state |
| Continuum | Deferred publication/protocol layer | shared protocol families, once earned | proven local seams |

## Must never know

| Layer | Must never know |
| :--- | :--- |
| jedit | worldline ids, scheduler internals, runtime substrate lore |
| Echo | panes, cursors, Vim semantics, editor UX |
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
hardcoded `createBuffer`, `replaceRange`, or `textWindow` semantics; the next
real proof must install jedit-owned generated mutation handlers and query
observers through Echo's generic contract-host boundary.

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
