---
title: global-next-root-id-counter
lane: bad-code
owner: jedit domain
priority: low
keywords:
  - domain
  - text-edit-contract
  - purity
  - testing
  - mutable-state
---

# global-next-root-id-counter

`src/domain/text-edit-contract.ts` contains a module-level mutable counter:

```typescript
let nextRootId = 1;
```

This counter is incremented inside `createBufferRoot` every time a new root is
allocated. It is the only piece of mutable state in the otherwise pure domain
layer.

## Why this is a smell

The domain layer is meant to be pure — no external deps, no side effects, pure
functions in and out. This counter violates that contract. Specifically:

- Two tests that both exercise `createBufferRoot` share this counter across
  calls. Root IDs bleed between tests.
- In practice tests probably do not assert on specific root ID values, so this
  hasn't caused failures yet. But it is a time bomb: if any test ever pins a
  root ID expectation, test ordering becomes load-bearing.
- The domain cannot be instantiated fresh per-test without reloading the module.

## Fix

Pass an ID allocator explicitly. Two options:

**Option A — pass an opaque ID in:**
```typescript
export function createBufferRoot(id: number, text: string): BufferRoot
```
Callers (the adapter layer) own the counter. The domain is now purely
functional.

**Option B — pass an allocator function:**
```typescript
export function createBufferRoot(allocateId: () => number, text: string): BufferRoot
```
Slightly more flexible; callers can inject a mock counter in tests.

Either option removes all mutable state from `src/domain/` and makes the
counter's ownership explicit at the layer that should own it (adapters).
