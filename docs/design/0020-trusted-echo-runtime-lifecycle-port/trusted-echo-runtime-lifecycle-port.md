# Trusted Echo Runtime Lifecycle Port

Status: implemented local boundary.

## Claim

jedit trusted host code may request Echo runtime lifecycle policy, but Echo
owns the internal run loop, every logical tick boundary, and every
`TickReceipt`.

The lifecycle port exists so product code and witness code stop talking in raw
trusted-control bytes. It is still a host-only surface. It is not a jedit
contract operation and not an application capability.

## Authority Boundary

| Surface | Allowed | Forbidden |
| :--- | :--- | :--- |
| jedit app/product code | Submit canonical intent bytes, observe bounded readings, render product evidence. | Start Echo, stop Echo, request run-until-idle, inject ticks, inspect scheduler internals. |
| jedit trusted Echo host adapter | Request run-until-idle, request stop, later request cadence policy, decode trusted lifecycle responses. | Expose raw trusted control to app code, choose individual tick boundaries, mutate product state. |
| Echo runtime | Own the run loop, choose scheduler work, emit tick receipts, report lifecycle status. | Treat jedit product operations as trusted runtime control. |

## Implemented Shape

The source boundary is:

```text
src/ports/echo-runtime-lifecycle.ts
src/adapters/echo-runtime-lifecycle.ts
```

The current port exposes:

```text
TrustedEchoRuntimeLifecyclePort.requestStart({ tickIntervalSeconds })
TrustedEchoRuntimeLifecyclePort.requestRunUntilIdle({ cycleLimit })
TrustedEchoRuntimeLifecyclePort.requestStop()
```

The adapter requires:

```text
EchoTrustedHostControlTransport
+ EchoRuntimeLifecycleCodec
-> TrustedEchoRuntimeLifecyclePort
```

That split is deliberate. The lifecycle port owns host authority vocabulary.
The codec owns the current Echo control-byte representation. The witness can
continue using its current CBOR fixture codec without making that fixture a
product API.

## Tick Authority Rule

The lifecycle port must not grow methods named or shaped like:

- `tick`;
- `stepTick`;
- `nextTick`;
- `advanceTick`;
- `runOneTick`.

`requestStart` means:

```text
trusted host asks Echo to begin its own internal run loop using host cadence
policy
```

It does not mean:

```text
trusted host supplies a discrete tick
trusted host chooses individual tick boundaries
wall-clock cadence becomes semantic history
```

`requestRunUntilIdle` means:

```text
trusted host asks Echo to run its own scheduler loop until idle, bounded by a
cycle-limit guardrail
```

It does not mean:

```text
trusted host supplies a tick stream
trusted host chooses Tick N
application callback timing becomes causal history
```

`requestStop` means:

```text
trusted host asks Echo to suspend future scheduler opportunities at a safe
boundary
```

It does not mean:

```text
trusted host interrupts a half-committed tick
application code cancels execution
```

## Witness Integration

The real Echo WASM stack witness now routes its until-idle control through the
trusted lifecycle port:

```text
createEchoWasmKernelHostTransport(...)
-> { app, trustedHost }
-> createTrustedEchoRuntimeLifecyclePort({ trustedHost, codec })
-> lifecycle.requestRunUntilIdle({ cycleLimit })
-> lifecycle.requestStop(), when the host is shutting down or suspending the
   scheduler
```

The app transport remains separate:

```text
app.submitIntentBytes(...)
app.observeBytes(...)
```

No app-facing jedit optic client receives the lifecycle port.

## Evidence

- `trusted Echo lifecycle port requests run-until-idle without exposing tick injection`
- `trusted Echo lifecycle port requests stop through trusted control only`
- `trusted Echo lifecycle port keeps app transport out of lifecycle authority`
- `real Echo WASM witness control intent honors configured cycle limit`
- `real Echo WASM witness stop control stays on trusted lifecycle vocabulary`
- `real Echo WASM requires an installed observer before jedit textWindow can materialize`

## Non-Goals

- No app-controlled tick.
- No host-injected discrete tick.
- No product-facing Start/Stop UI in this slice.
- No durable replay in this slice.
- No retained evidence implementation in this slice.
- No jedit nouns in Echo.

## Next Work

This boundary is the prerequisite for making the interactive jedit product path
Echo-backed. The next implementation should use this lifecycle port while
routing a real product edit/read path through Echo:

```text
jedit edit intent
-> app-safe Echo transport
-> trusted lifecycle request
-> Echo-owned tick receipt
-> bounded text reading
```
