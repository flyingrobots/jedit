# Trusted Echo Host Shutdown Witness

## Claim

jedit host code can request Echo shutdown through the trusted lifecycle port
after an Echo-powered product session runs, without turning shutdown into an
application intent or app-visible tick control.

## Implemented Shape

The host helper is:

```text
src/app/trusted-echo-runtime-host.ts
```

It exposes:

```text
stopTrustedEchoRuntime(lifecycle)
```

which calls:

```text
TrustedEchoRuntimeLifecyclePort.requestStop()
```

and returns a small shutdown report that explicitly carries:

- `accepted`;
- `lastRunCompletion`;
- `appCanTick: false`.

The agent session witness now runs:

```text
create buffer
-> apply replace-range
-> trusted run-until-idle requests
-> observe text window
-> trusted stop request
-> JSON witness report
```

## Authority

Stop is trusted host lifecycle control. It is not:

- a jedit application intent;
- a generated Wesley mutation;
- an app-facing `TextBufferOptic` method;
- an external tick interruption;
- user undo.

`Stop` suspends future scheduler opportunities at a safe Echo boundary. It must
not imply half-tick interruption or hidden rollback.

## Why This Is Not SIGTERM Yet

This slice adds the deterministic primitive that a future process-signal
adapter should call. It does not install Node signal handlers yet because the
current interactive workspace still needs a broader host lifecycle owner for:

- Echo startup policy;
- Echo package location;
- real WASM package loading;
- process shutdown ordering;
- final retained evidence flush.

## Witnesses

- `Echo-powered session CLI reports app capability, lifecycle, and reading evidence`
- `trusted Echo lifecycle port requests stop through trusted control only`

## Not In This Slice

- Node `SIGTERM` or `SIGINT` signal handlers.
- Long-running fixed-cadence host loop.
- App-facing stop controls.
- Durable runtime-control history.
- Durable retained evidence flush.
