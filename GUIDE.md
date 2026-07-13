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
JEDIT_ALLOW_FULL_SNAPSHOT_TEXT_AUTHORITY=1 npm run dev
```

The environment flag is temporary. It acknowledges that the current text
authority is the quarantined full-snapshot fixture until the graph-backed rope
runtime replaces it.

Build the app:

```sh
npm run build
```

`npm run build` first generates the structural-history `replaceTextRange`
Wesley metadata, then runs TypeScript compilation and asset copying.

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

Default tests use the fake Echo-shaped transport. They do not require a sibling
Echo checkout and do not build Echo WASM.

## Contract Generation

There are two current generation postures.

Structural history is build-local and does not need `JEDIT_WESLEY_ROOT`:

```sh
npm run gen:contract:structural-history:wesley
```

That command installs `wesley-cli` 0.0.4 into `.wesley-cache/cargo` when needed,
emits the full TypeScript artifact to
`.wesley-cache/structural-history.wesley.generated.ts`, and extracts the ignored
adapter descriptor:

```text
src/generated/jedit/structural-history-replace-text-range.wesley.generated.ts
```

The descriptor is generated output. Do not edit it and do not commit it.

Full legacy contract generation still requires a Wesley checkout because the
hot-text runtime, legacy TypeScript/Zod output, and observer plan use the local
Wesley host and Cargo manifest:

```sh
JEDIT_WESLEY_ROOT=/path/to/wesley npm run gen:contract
```

## Echo Witnesses

The default local posture is fake Echo-shaped transport coverage. It proves the
consumer contract without depending on a sibling Echo build.

The real Echo WASM witness is opt-in:

```sh
ECHO_WARP_WASM_DIR=/path/to/echo/crates/warp-wasm \
  scripts/run-real-echo-wasm-stack-witness.sh
```

That script asks Echo to build its own WASM package boundary and then runs the
jedit witness with `JEDIT_ECHO_WASM_MODULE` pointed at the resulting module.

Current status: the real Echo WASM witness is a release-gate work item, not a
green default check. It uses the current Echo authority model:

```text
jedit app adapter: submit intents and observe readings
trusted Echo host adapter: install package, stage ingress, tick until idle
```

Do not fix the witness by granting app code tick authority.

For agent use, prefer the shell witness above. A future MCP surface can wrap the
same command after retained evidence and replay output are strong enough to be
worth exposing through a protocol.

Agents that need machine-readable output should call the Node CLI directly:

```sh
ECHO_WARP_WASM_DIR=/path/to/echo/crates/warp-wasm \
  node scripts/jedit-echo-witness.mjs --json
```

The JSON output includes command status and, on success, a witness report with
generated contract metadata, reading identity, artifact hash, residual posture,
observer basis, and the product-shaped text result.

## Current Runtime Truth

In production, Echo/session authority owns causal text. `EditorState.lines` is
the full local visible projection cache used for rendering, cursoring, and
transitional edit planning. It must not be reconstructed from bounded readings.
It is not saved or recovered as authority.

Source rendering, Markdown preview, drawers, syntax highlighting, and footer
state are projections over that visible/session projection.

The structural-history GraphQL schema is the forward authority for product
history facts:

```text
contracts/jedit/structural-history.graphql
```

The first generated-metadata consumer is `replaceTextRange`. Its operation
identity comes from Wesley output, while the existing in-memory TypeScript
runtime remains the transitional executor.
