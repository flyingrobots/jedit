# Echo WASM Host Transport Authority

Status: local transport boundary implemented.

This design packet records the jedit side of the Echo `v0.1.0` authority split.
The matching Echo packet is
`docs/design/wasm-trusted-runtime-host-control-boundary.md` in the Echo
repository.

## Claim

jedit's real Echo WASM path has two transport surfaces:

```text
jedit application adapter
-> submit canonical intent bytes
-> observe bounded readings
-> inspect scheduler status as metadata

trusted Echo host adapter
-> request runtime lifecycle policy
-> dispatch packed Echo control intent bytes below the lifecycle port
```

The application adapter cannot tick Echo and cannot call the raw trusted control
export. The trusted host adapter may call Echo's raw
`dispatch_control_intent_trusted(...)` export so the opt-in release witness can
request Echo's internal run loop until idle without tunneling trusted runtime
lifecycle control through application dispatch.

## Why This Exists

The old real WASM witness sent Echo scheduler `start` / `until_idle` control
through `submitIntentBytes(...)`. Current Echo correctly rejects that as a
forbidden control intent. jedit should not weaken that boundary. It should
model the real product split:

```text
application product capability
-> app-safe intent/observe transport

trusted host/runtime owner
-> trusted runtime lifecycle port
-> raw control transport below the adapter
```

The fake Echo-shaped transport remains useful for default tests. The real WASM
transport is opt-in because it depends on a sibling Echo checkout and generated
WASM package.

## Implemented Surface

`src/ports/echo-kernel-transport.ts` now defines:

- `EchoWasmKernelTransport`, the app-safe surface;
- `EchoTrustedHostControlTransport`, the trusted host-control surface;
- `EchoWasmKernelHostTransport`, which bundles the two without merging their
  authority.
- `TrustedEchoRuntimeLifecyclePort`, the trusted lifecycle vocabulary that wraps
  raw control bytes for host-owned code.

`src/adapters/echo-wasm-kernel.ts` now exports:

- `createEchoWasmKernelTransport(...)`, which returns only the app-safe
  transport for existing callers;
- `createEchoWasmKernelHostTransport(...)`, which returns `{ app, trustedHost }`
  for release witnesses and host-owned integration.

The app-safe object deliberately has no `dispatchControlIntentBytes(...)`
method. The trusted host object deliberately has no submit or observe methods.
The lifecycle port deliberately exposes `requestRunUntilIdle(...)`, not `tick`,
`stepTick`, or any externally injected tick API.

The agent witness runner follows the same port/adapter rule:

- `scripts/ports/echo-witness-runner.mjs` owns orchestration over an abstract
  witness runner adapter;
- `scripts/adapters/node-echo-witness-runner.mjs` owns filesystem paths,
  sibling Echo checkout resolution, process spawning, and witness-report reads;
- `scripts/jedit-echo-witness.mjs` is only CLI argument parsing and summary
  emission.

Echo build paths and host process execution are therefore adapter concerns, not
application or witness-orchestration logic.

## Agent Surface

The immediate agent interface should be a CLI, not an MCP server:

```sh
ECHO_WARP_WASM_DIR=/path/to/echo/crates/warp-wasm \
  node scripts/jedit-echo-witness.mjs --json
```

That command emits a machine-readable summary plus a witness report naming the
app/host authority split, fixture operation ids, generated jedit contract
metadata, observed reading identity, artifact hash, residual posture, observer
basis, product-shaped text, retained-evidence inventory, and replay posture.
With `--replay`, the summary includes the report replay posture. The current
posture is `durable_replay_unavailable`, which is honest obstruction rather
than a durable proof. A later MCP server can wrap the same command once replay
output is strong enough to expose through a protocol. The MCP should not be the
first authority boundary; it would add protocol surface before the shell witness
is trustworthy.

## Evidence

- `echo wasm kernel transport stays byte-oriented and substrate-generic`
- `echo wasm kernel host transport keeps trusted control off the app surface`
- `echo wasm trusted host transport requires the raw trusted control export`
- `trusted Echo lifecycle port requests run-until-idle without exposing tick injection`
- `trusted Echo lifecycle port keeps app transport out of lifecycle authority`
- `jedit Echo witness CLI emits a dry-run JSON plan for agents`
- direct JSON CLI run includes a witness report with `ReadingEnvelope` posture
- direct JSON CLI run cites generated `hot-text-runtime` operation metadata
- direct JSON CLI run names inline retained evidence and missing-retention
  posture
- `--replay` reports the typed replay posture without app tick authority
- `real Echo WASM Stack Witness 0001 transport emits ReadingEnvelope + QueryBytes`

## Non-Goals

- No Echo ticks through app dispatch.
- No externally injected host tick stream.
- No app access to Echo worldline ids or scheduler internals.
- No high-level product API in this slice.
- No MCP server before the shell witness is green and useful.
- No removal of the fake transport harness.
