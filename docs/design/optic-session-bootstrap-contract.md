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

The handle is opaque to jedit app-facing code. Its `id` is a local capability
token, not a substrate coordinate.

## App-facing flow

```text
session.openTextBuffer(...)
  -> session + ReadBasisHandle

textWindow(session, readBasisHandle, range)
  -> TextWindowReading
```

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
opaque handle back to the session worldline before encoding the existing fake
Echo transport request. That preserves current behavior while proving the
app-facing contract no longer needs raw substrate coordinates for `textWindow`.

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
