# Guide

This guide is the short operational entry point for running and validating
`jedit`. For architecture doctrine, read [ARCHITECTURE.md](ARCHITECTURE.md).
For the render path and runtime details, read
[ADVANCED_GUIDE.md](ADVANCED_GUIDE.md).

## Run The App

Install dependencies once:

```sh
npm install
```

Start the TUI:

```sh
npm run dev
```

`npm run dev` first compiles `native/jedit-echo-host`, then starts the TUI. The
workspace launches that trusted Rust host as a child process. Set
`JEDIT_ECHO_HOST_BIN` only to select another compatible host binary and
`JEDIT_ECHO_WAL_DIR` only to select its filesystem runtime-WAL directory. If the
host is missing or exits, text operations fail closed. Jim does not fall back to
a local text runtime.

Build the app:

```sh
npm run build
```

`npm run build` compiles the native Echo host, compiles TypeScript, and copies
runtime assets. The generated Rust contract bindings are checked in so normal
builds do not require a sibling Echo checkout or generator invocation.

## Validate The Workspace

Use the normal local gate:

```sh
npm run check
```

That runs:

```text
npm run test:all   (which builds first, then runs spec/ and tests/)
npm run quality
```

Tests may explicitly inject test-only Echo doubles. Product source contains no
fake, fixture, in-memory, or snapshot text authority.

## Generated Operation Corridor

The former Node-host Wesley generators and generated TypeScript projections
remain deleted. The current compatibility corridor instead uses a small GraphQL
contract compiled by Echo's Wesley contract-host extension into Rust:

```text
Jim command
-> typed process adapter
-> trusted native Echo host
-> Wesley-generated EINT binding and registered package
-> Echo-owned WAL admission and scheduler tick
-> Jim graph-rope facts and opaque Echo receipt
-> basis-pinned bounded observation
```

The implemented surface is intentionally narrow: create/open a buffer,
single-range replace/insert/delete, and bounded text-window observation. Other
operations return typed obstructions. Edict will replace the transitional Rust
operation law and invocation seam operation by operation; do not widen this
compatibility path merely to regain feature parity.

## Echo Witnesses

The product startup path runs Echo directly in the trusted native host. Unit
tests use explicit test-only doubles where isolation is required.

The primary product witness is:

```sh
npm run echo:test
JEDIT_DIST_PREBUILT=1 node --test spec/workspace-production-echo-wiring.spec.mjs
```

It proves generated package registration, WAL-acknowledged submission,
Echo-owned admission and ticks, graph-rope mutation, bounded observation,
restart recovery, and continued editing after recovery.

The machine-readable end-to-end witness is:

```sh
npm run witness:echo
```

Its JSON output includes the Echo receipt, admitted tick, package artifact,
basis-pinned reading, commit hash, rope support count, and observed text. It
uses the same native host process as the product; it does not substitute a
test runtime or a raw kernel facade.

## Current Runtime Truth

In production, Echo/session authority owns causal text. `EditorState.lines` is
a disposable visible projection populated from Echo observations. Proposed
edits do not mutate it; an admitted operation must return a new basis-pinned
reading before changed text becomes visible. It is never saved or recovered as
authority.

Source rendering, Markdown preview, drawers, syntax highlighting, and footer
state are projections over that visible/session projection.

There is no transitional in-memory executor and no generated-metadata-only
consumer. The current `ReplaceRange` operation is registered and executed by
Echo through the Wesley compatibility package. Its eventual replacement must
be a real installed Edict operation, not another local executor.
