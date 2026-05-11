# Optic Session Bootstrap Contract

## Status

Draft contract slice for Stack Witness follow-up work.

## Purpose

jedit must request bounded readings through an opaque read-basis handle, not by
carrying Echo substrate coordinates through app-facing code.

This document defines the first anti-leak boundary only. It does not define the
full optic protocol, Echo bootstrap API, Continuum schema, or publishing flow.

## Contract shape

```ts
type ReadBasisHandle = {
  readonly kind: 'read-basis-handle';
  readonly id: string;
};
```

The handle is opaque to jedit app-facing code. Its `id` is deterministic,
diagnostic, and session-local, but it is not authority by itself. Authority is
the registered handle object held below the adapter boundary; cloned objects
with the same `id` must not resolve.

The `id` is not a substrate coordinate, buffer key, file path, head id, or
application semantic identifier.

## App-facing flow

```text
client.openTextBuffer(...)
  -> nextSession + ReadBasisHandle

client.textWindow(nextSession, frontierRef, readBasisHandle, range)
  -> TextWindowReading
```

`frontierRef` remains app-visible read identity and correlation material. It is
not a license for app code to construct substrate coordinates.

App-facing text-window input names editor range information only:

```text
cursorLine
viewportLineCount
beforeLines
afterLines
maxBytes
```

App-facing code must not construct read requests with:

```text
worldlineId
basisRef
headId
tick
root
strand
```

Those coordinates belong below the optic/session adapter boundary.

## Adapter responsibility

The session or transport adapter owns the mapping:

```text
ReadBasisHandle -> runtime read coordinates
```

For the current jedit-only slice, the fake/session-local resolver maps the
registered handle object back to the session worldline before encoding the
existing fake Echo transport request. Handle IDs are deterministic process-local
diagnostic tokens such as `read-basis:0`; they must not encode buffer keys,
paths, worldlines, heads, ticks, roots, strands, or other meaningful
coordinates.

The current handle is a same-worldline read-target capability, not a
head-pinned historical-basis proof. It may be reused after a local edit advances
the same session worldline. Exact stale-basis obstruction belongs in a later
head-pinned basis capability, not this first anti-leak contract slice.

That preserves current behavior while proving the app-facing contract no longer
needs raw substrate coordinates for `textWindow`.

## Non-goals

- No Echo change.
- No Wesley change.
- No Continuum change.
- No production optic/session bootstrap protocol.
- No publishing workflow.
- No claim that the current local handle resolver is the durable runtime
  implementation.

## Acceptance

jedit can request `textWindow` through an opaque `ReadBasisHandle`, while only
the transport/session adapter knows how that handle maps to Echo coordinates.
