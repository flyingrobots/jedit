# Agent Echo-Powered Session Witness

## Claim

Agents can exercise the jedit `TextBufferOptic` product path through a
command-line witness without receiving Echo tick authority or raw runtime
coordinates.

This is a host-owned smoke path. It proves the product-facing capability shape:

```text
agent command
-> host constructs Echo-shaped transport
-> host constructs trusted lifecycle port
-> host constructs Echo-backed TextBufferSessionPort
-> create buffer
-> apply replace-range intent
-> observe text window
-> trusted stop request
-> JSON witness report
```

## Boundary

The command is:

```sh
npm run witness:echo:session
```

or directly:

```sh
node scripts/jedit-echo-powered-session.mjs --json
```

The emitted report names:

- the app-facing session port (`TextBufferSessionPort`);
- the app-facing buffer capability (`TextBufferOptic`);
- the transport posture (`fake-echo-shaped`);
- the fact that app code cannot tick;
- the fact that app-facing dispatch does not request lifecycle drain;
- trusted stop requested by the host command;
- the resulting receipt id, reading id, text window lines, and truncation
  posture.

## Authority

The CLI is not an app API. It is a host/agent witness command.

The app-facing object remains `TextBufferOptic`. It exposes:

- `applyIntent(...)`;
- `textWindow(...)`;
- `currentReadBasis()`.

It does not expose:

- `requestRunUntilIdle`;
- `tick`;
- `dispatchControlIntentBytes`;
- raw worldline coordinates.

## Why Fake Echo-Shaped Transport Remains Here

The real Echo WASM witness remains the opt-in substrate proof:

```sh
ECHO_WARP_WASM_DIR=/path/to/echo/crates/warp-wasm \
  node scripts/jedit-echo-witness.mjs --json --replay
```

This slice adds the product-session command around the same app-facing
capability boundary. It is intentionally fast, deterministic, and local to
jedit's default test suite. It does not replace the real Echo WASM witness.

## Witnesses

- `Echo-powered session CLI reports app capability, lifecycle, and reading evidence`
- `Echo-powered session CLI rejects invalid cycle limits as JSON failures`
- `Echo-backed TextBufferSession port does not request lifecycle during app-facing dispatch`

## Not In This Slice

- Real Echo WASM package publishing.
- Durable retained evidence lookup.
- Durable replay.
- Interactive TUI cutover.
- MCP server wrapping the product command.
- Application-controlled runtime lifecycle.
