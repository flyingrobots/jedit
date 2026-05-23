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
npm run build
npm test
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
green default check. It still reflects the old model where app-facing dispatch
could carry scheduler control. Current Echo correctly rejects that. The next
iteration must split the witness into:

```text
jedit app adapter: submit intents and observe readings
trusted Echo host adapter: install package, stage ingress, tick until idle
```

Do not fix the witness by granting app code tick authority.

## Current Runtime Truth

The visible TUI editor still uses `EditorState.lines` as editable buffer truth.
Source rendering, Markdown preview, drawers, syntax highlighting, and footer
state are projections over that text.

The structural-history GraphQL schema is the forward authority for product
history facts:

```text
contracts/jedit/structural-history.graphql
```

The first generated-metadata consumer is `replaceTextRange`. Its operation
identity comes from Wesley output, while the existing in-memory TypeScript
runtime remains the transitional executor.
