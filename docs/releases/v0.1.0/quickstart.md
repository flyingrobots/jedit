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
npm run witness:echo
```

The cutover guard rejects production source that introduces fake, fixture,
in-memory, full-snapshot, local installed-contract, handwritten EINT, or
graph-rope runtime authority.

## Interactive Startup

```bash
npm start
```

Startup launches the trusted native Echo host, registers the GraphQL/Wesley
compatibility package, and admits supported text operations through Echo.
Create/open, single-range replacement, and bounded text reads work. Operations
outside that narrow corridor return typed obstructions. No process-local text
authority is installed.

## Historical Reports

The JSON files in this directory record what the retired witness reported at
the time. They are preserved for audit, not as evidence that Jim was powered by
Echo. In particular, a locally deterministic replay does not prove durable
Echo admission, scheduler execution, receipts, or recovery.

## Current Acceptance Bar

The current native witness demonstrates this complete transitional path:

```text
Jim command
-> typed process adapter
-> Wesley-generated installed package
-> real Echo admission
-> installed Jim operation
-> Echo-owned tick and receipt
-> witnessed Jim facts
-> basis-pinned Echo observation
-> Jim UI
```

Edict will replace the Wesley/Rust compatibility operation. Nothing shorter
than the full path above may be described as Echo-powered. This is not the
target application composition: final production delivers canonical events to
`Jim.edict`, which requests bounded readings, derives Jim-owned operation
intents, handles outcomes, and advances editor state. Generated clients remain
semantic-free transport stubs, and Echo remains unaware of editor or rope
vocabulary.
