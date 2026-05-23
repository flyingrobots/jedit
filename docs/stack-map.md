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
createBuffer
-> replaceRange("hello")
-> textWindow(0..5)
-> ReadingEnvelope + QueryBytes("hello")
-> TextWindowReading
```

The current Echo `v0.1.0` release-gate proof starts from the implemented
structural-history contract:

```text
jedit-authored `contracts/jedit/structural-history.graphql`
-> `replaceTextRange` operation identity
-> Wesley generated artifacts
-> Echo package install
-> app-safe edit intent submission
-> trusted-host lifecycle request
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
- The current witness report names inline `ReadingEnvelope` and `QueryBytes`
  evidence, then honestly reports durable retained refs as
  `missing_retention`.
- The current replay surface is a shell: `--replay` returns
  `durable_replay_unavailable` until Echo exposes durable replay evidence
  through the adapter.
- Start/Stop/cadence are trusted host runtime-control history. They are not
  jedit contract intents and they do not create ticks directly.
- `TrustedEchoRuntimeLifecyclePort.requestRunUntilIdle(...)` wraps raw trusted
  Echo control bytes so witness and host code do not talk in external tick
  vocabulary.
- Fixture vars bytes are not the durable Wesley runtime codec.
- `TextBufferOptic` is the target app-facing capability. The current proof uses
  the structural-history SDL and `replaceTextRange` as the first implemented
  operation on that path.
- `createEchoPoweredTextBufferOpticSession(...)` now composes the app-facing
  optic capability with trusted lifecycle requests after mutations while reads
  remain app-safe.
- `ReadBasisHandle` is an opaque supporting token, not the complete optic
  protocol.
- Structural-history SDL is now the product contract authority for text
  revisions, replacement events, edit groups, checkpoints, provenance, command
  status, and evidence-bearing readings.
- `replaceTextRange` operation identity is consumed from build-generated Wesley
  metadata while the old TypeScript runtime remains the transitional executor.
- Continuum remains deferred until the seam is proven enough to publish.

## Operating rule

If a layer needs forbidden knowledge to make progress, the boundary is wrong or
the witness is not ready.
