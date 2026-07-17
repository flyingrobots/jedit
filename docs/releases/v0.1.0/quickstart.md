# jedit + Echo v0.1.0 Historical Quickstart

> **Status:** Retired. The original release-gate claim was invalidated because
> its edit/read path executed inside process-local TypeScript rather than Echo.

The commands that used full-snapshot fixtures, local installed-contract
transports, and local replay have been removed. They are not supported
compatibility modes.

## Current Verification

Build the repository and verify that production cannot recover a local
authority path:

```bash
npm run build
node scripts/jedit-production-cutover-guard.mjs
JEDIT_ECHO_WASM_MODULE=/path/to/echo-wasm.js npm run witness:echo
```

The cutover guard rejects production source that introduces fake, fixture,
in-memory, full-snapshot, local installed-contract, handwritten EINT, or
graph-rope runtime authority.

## Interactive Startup

```bash
npm start
```

Startup loads a real Echo WASM module. Set `JEDIT_ECHO_WASM_MODULE` when the
module is not available as `@flyingrobots/jedit-echo-wasm`.

Until Echo can install and invoke the generated Jim Edict package, one of two
honest outcomes is expected:

- startup fails because the real Echo module is unavailable; or
- Echo initializes and text operations return typed obstructions because the
  generated operation corridor is unavailable.

No process-local text authority is installed in either case.

## Historical Reports

The JSON files in this directory record what the retired witness reported at
the time. They are preserved for audit, not as evidence that Jim was powered by
Echo. In particular, a locally deterministic replay does not prove durable
Echo admission, scheduler execution, receipts, or recovery.

## Current Acceptance Bar

The next valid quickstart must demonstrate this complete path:

```text
Jim command
-> generated Edict client
-> real Echo admission
-> installed Jim operation
-> Echo-owned tick and receipt
-> witnessed Jim facts
-> basis-pinned Echo observation
-> Jim UI
```

Nothing shorter may be described as Echo-powered.
