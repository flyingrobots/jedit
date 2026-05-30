---
title: symbol-capability-handle
lane: cool-ideas
owner: jedit app
priority: low
keywords:
  - capability
  - ReadBasisHandle
  - symbol
  - security
  - optic
acceptance_criteria:
  - The idea describes how Symbol replaces WeakMap for ReadBasisHandle identity.
  - The tradeoffs versus the current WeakMap approach are documented.
---

# symbol-capability-handle

The current `ReadBasisHandle` uses a `WeakMap<ReadBasisHandle, { worldlineId }>` to
store the binding between a handle object and a worldline. Object identity makes
the handle unforgeable — you can't construct a fake handle that passes the
registry lookup.

A simpler mechanism exists: `Symbol()`.

```typescript
// Each call to Symbol() produces a value that is unique in the universe.
// It cannot be serialized, cloned, or fabricated.
const handle = Symbol('read-basis');
const binding = new Map<symbol, { worldlineId: string }>();
binding.set(handle, { worldlineId: session.worldline.worldlineId });
```

## Why it is interesting

- A `Symbol` is its own identity — no wrapper object needed.
- Symbols are non-enumerable and cannot appear in JSON. Serializing one
  produces `undefined`. There is no accidental leakage through `JSON.stringify`.
- `Object.freeze` becomes unnecessary — you cannot assign properties to a Symbol.
- A regular `Map<symbol, Binding>` replaces the `WeakMap`. The binding is
  explicitly owned by the registry and released when the optic closes the
  session.
- The handle type would change from `{ kind, id }` to a branded `symbol`, which
  is arguably more honest — it *is* an opaque token, not a data record.

## Trade-off vs current design

The current `WeakMap` approach has one advantage: GC automatically reclaims the
binding when the handle object is GC'd. A `Map<symbol, ...>` requires explicit
cleanup (call `registry.release(handle)` when the session ends). For the
current usage this is not a problem — sessions are explicitly opened and closed
— but it is a maintenance consideration.

The `{ kind, id }` shape of the current handle is also useful for diagnostics:
the `id` string appears in logs and witness reports. A raw Symbol is opaque even
in debug output (it serializes as nothing). A hybrid — keep the `{ kind, id }`
data record for diagnostics, but bind authority to a Symbol field on the record
— might be the best of both.
