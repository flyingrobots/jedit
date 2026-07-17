# BEARING

Current bearing: make Jim an Echo application in fact, even when that means the
editor is temporarily unable to edit text.

This document records current repository truth. Historical implementation
claims belong in git history and design retrospectives.

## Current Truth

- Production startup loads and initializes a real Echo WASM kernel through
  `src/adapters/echo-wasm-kernel.ts`.
- Startup fails closed if `JEDIT_ECHO_WASM_MODULE` and the default
  `@flyingrobots/jedit-echo-wasm` package are unavailable.
- Echo does not yet install or invoke a generated Jim Edict operation package.
- Production text open, edit, read, save, export, checkpoint, `:why`, and causal
  line-diff requests therefore return typed obstructions.
- `EditorState.lines` is disposable presentation state. Proposed edits do not
  mutate it. Only a future basis-pinned Echo observation may replace it.
- The full-snapshot runtime, local graph-rope executor, local admission loop,
  locally manufactured receipts, WSC history store, direct file-save fallback,
  fake production transports, and optimistic text mutation path are deleted.
- The old whole-string `text-edit-contract`, numeric tick-admission contract,
  local edit-group/checkpoint contracts, and local runtime identity helpers are
  deleted.
- Legacy Wesley schemas, generators, generated TypeScript projections, and
  metadata-only operation descriptors are deleted from the build and product.
- Jim retains application-owned graph-rope fact types, UTF-8 coordinate
  semantics, checkpoint declarations, bounded projection types, and disposable
  caches. These are not Echo admission or execution authority.
- Jim graph-rope facts may retain opaque Echo receipt identities. Jim does not
  define, derive, or validate Echo receipt/admission internals.
- Test doubles are permitted only under test code and only through explicit
  injection. The production cutover guard rejects fake, fixture, in-memory,
  snapshot, and locally authoritative product implementations.

## Authority Boundary

The only accepted production mutation corridor is:

```text
Jim command
-> generated Edict client
-> Echo-installed verified operation
-> Echo admission
-> scheduler-owned tick
-> opaque Echo receipt and Jim graph facts
-> basis-pinned bounded observation
-> disposable UI projection
```

No handwritten TypeScript executor, protocol clone, local receipt builder,
snapshot runtime, or metadata-only descriptor may occupy any step in that
corridor.

Runtime identity follows
[the Echo identity doctrine](design/echo-identity-doctrine.md). Jim must not
copy Echo identity domains, admission policy, scheduler behavior, WAL evidence,
or support-policy logic.

## Immediate Roadmap

1. Echo and Edict establish one installed generated operation end to end.
2. Define Jim's `ReplaceRange` operation in the Edict package and generate its
   client without restoring Wesley or handwritten codecs.
3. Route one Jim edit proposal through Echo admission, execution, receipt, and
   a basis-pinned text-window observation.
4. Make all bespoke `ReplaceRange` execution paths unreachable, then delete the
   transitional session methods they replaced.
5. Migrate buffer creation/open and bounded text-window reads.
6. Migrate checkpoint declaration and optional Echo causal-anchor association.
7. Derive undo/redo candidates from retained Echo history and invoke generated
   inverse operations.
8. Delete the remaining transitional handwritten invocation port once generated
   clients cover the product surface.

## Hard Gates

- Do not reintroduce an in-process text authority to make the TUI usable.
- Do not mutate visible text before an Echo-backed observation returns.
- Do not call local file writes a save when no Echo basis was exported.
- Do not manufacture Echo receipts, ticks, admissions, anchors, or identities.
- Do not make the UI claim causal evidence that Echo cannot return.
- Do not treat a cache, WAL mirror, queue, map, or BTR artifact as semantic
  authority beside Echo history.
- Do not deepen handwritten mutation APIs while the Edict corridor is being
  established.

## Verification

Use:

```sh
npm run check
```

For a real kernel smoke test:

```sh
ECHO_WARP_WASM_DIR=/path/to/echo/crates/warp-wasm \
  scripts/run-real-echo-wasm-stack-witness.sh --json
```

That witness proves kernel loading and initialization only. It must not be
reported as proof that a Jim text operation executed.
