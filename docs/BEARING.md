# BEARING

Current bearing: operate one real Echo-hosted text corridor now, keep every
unsupported feature obstructed, and replace transitional Wesley/Rust operation
glue with generated Edict operations when Edict is ready.

This document records current repository truth. Historical implementation
claims belong in git history and design retrospectives.

## Current Truth

- Production startup launches `jedit-echo-host`, a trusted native Rust process
  linked to Echo. There is no TypeScript text runtime or generic WASM facade in
  the product text path.
- `contracts/jedit/echo-text.graphql` declares buffer creation, single-range
  replacement, and bounded text-window observation.
- Echo's `echo-wesley-gen --contract-host` output supplies canonical EINT
  codecs, operation identities, registry evidence, generated rules, and the
  query observer plan under `native/jedit-echo-host/src/generated/`.
- The native host registers that package, submits EINT envelopes through
  Echo's WAL-acknowledged app capability, asks Echo's trusted host to derive
  installed-operation admission evidence, runs scheduler-owned ticks, and
  returns opaque receipt and reading identities.
- Buffer authority is an immutable graph rope stored in Echo's worldline graph.
  Narrow edits path-copy touched nodes and retain untouched subtree identity.
- Restart reconstructs witnessed submissions, graph state, and receipts from
  Echo's filesystem runtime WAL. The recovered host can continue editing.
- TypeScript owns only the JSONL process adapter, Jim request/result mapping,
  coordinate branding, and disposable UI projections. It does not construct
  Echo identities, admission evidence, receipts, graph patches, or scheduler
  outcomes.
- Buffer open/create, insert, replace, delete, and bounded text-window reads are
  implemented. Multi-range edit, checkpoint, save/export, `:why`, causal
  line-diff, and undo/redo return typed obstructions.
- The current package is explicitly `0.1.0-wesley-compat`. Its authored Rust
  operation law and process invocation seam are transitional until Edict can
  install and invoke the corresponding generated operations.
- The full-snapshot runtime, local graph-rope executor, local admission loop,
  locally manufactured receipts, fake production transports, and optimistic
  text mutation path remain deleted.
- Test doubles are permitted only under test code and only through explicit
  injection. The production cutover guard scans TypeScript, executable scripts,
  and native host Rust for forbidden local authority.

## Authority Boundary

The accepted production mutation corridor is:

```text
Jim command
-> Jim-owned validated request
-> Echo host process port
-> Wesley-generated EINT and installed package
-> Echo WAL-acknowledged submission
-> Echo-owned installed-operation admission
-> Echo scheduler-owned tick
-> Jim graph-rope facts + opaque Echo receipt
-> Echo bounded query observation
-> disposable Jim UI projection
```

The target Edict corridor is:

```text
Jim command
-> generated Edict client
-> Echo-installed verified operation
-> Echo admission and scheduler-owned tick
-> opaque Echo outcome and bounded observation
```

Runtime identity follows
[the Echo identity doctrine](design/echo-identity-doctrine.md). Jim must not
copy Echo identity domains, admission policy, scheduler behavior, WAL evidence,
or support-policy logic.

## Immediate Roadmap

1. Keep the narrow create/replace/read corridor green against Echo-owned WAL,
   admission, scheduling, graph state, receipts, and restart recovery.
2. Avoid restoring broad editor feature parity through transitional APIs.
3. Have Echo and Edict establish one natively installed generated operation.
4. Migrate `ReplaceRange` to the generated Edict client and operation.
5. Make the Wesley/Rust replacement path unreachable, then delete it.
6. Migrate create/open and bounded text-window observation.
7. Add checkpoint declaration and optional causal-anchor association as
   separate propositions.
8. Add save/export through generated operations, then derive undo/redo
   candidates from retained Echo history and invoke generated inverse
   operations through basis-pinned Echo observations.
9. Delete the remaining compatibility host package and JSONL invocation glue.

## Hard Gates

- Do not reintroduce an in-process text authority to make the TUI usable.
- Do not mutate visible text before an Echo-backed observation returns.
- Do not call local file writes a save when no Echo basis was exported.
- Do not manufacture Echo receipts, ticks, admissions, anchors, or identities.
- Do not make the UI claim causal evidence that Echo cannot return.
- Do not treat a cache, WAL mirror, queue, map, or materialization as semantic
  authority beside Echo history.
- Do not widen the handwritten compatibility protocol for feature parity.
- Do not describe the Wesley compatibility package as the final Edict design.

## Verification

Use:

```sh
npm run check
```

For the narrow real Echo corridor:

```sh
npm run echo:test
JEDIT_DIST_PREBUILT=1 node --test spec/workspace-production-echo-wiring.spec.mjs
node scripts/jedit-production-cutover-guard.mjs
npm run witness:echo
```
