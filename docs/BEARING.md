# BEARING

Current bearing: keep the real Wesley compatibility corridor honest, author
Jim's first operation as real Edict source, and converge on `Jim.edict` as an
Echo-realized active observer. Do not add editor vocabulary to Echo or move
Jim's semantic state machine into a generated TypeScript client.

This document records current repository truth. Historical implementation
claims belong in git history and design retrospectives.

## Current Truth

- Production startup launches `jedit-echo-host`, a trusted native Rust process
  linked to Echo. There is no TypeScript text runtime or generic WASM facade in
  the product text path.
- `contracts/jedit/echo-text.graphql` declares buffer creation, single-range
  replacement, checkpoint declaration, and bounded text-window observation.
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
- TypeScript currently owns the JSONL process adapter, request/result mapping,
  coordinate branding, and disposable UI projections. Its request mapping is
  explicit migration debt: in the target corridor TypeScript normalizes
  canonical events and transports artifacts, but has zero semantic authority
  to interpret commands, choose operations, derive ranges, advance Jim state,
  or optimistically mutate visible text.
- Buffer open/create, insert, replace, delete, checkpoint declaration, and
  bounded text-window reads are implemented. Multi-range edit, save/export,
  `:why`, causal line-diff, and undo/redo return typed obstructions.
- Jim owns `RopeCheckpointDeclared` semantics. Echo admits and schedules the
  generated declaration, persists its Jim fact in the graph/WAL history, and
  returns the opaque receipt and tick identities. Declaration validates that
  its basis head belongs to the stated Jim buffer worldline and does not mint a
  text head, rewrite, diff, or causal anchor.
- A Jim checkpoint declaration and an Echo causal anchor remain separate
  propositions. No anchor association is created automatically.
- The current package is explicitly `0.1.0-wesley-compat`. Its authored Rust
  operation law and process invocation seam are transitional until Edict can
  install and invoke the corresponding generated operations.
- Checkpoint reason remains a transitional GraphQL `String` because the pinned
  Wesley contract-host enum emitter produces Rust that does not compile for
  this enum shape. The installed native Jim contract still admits exactly
  `manual-save`, `autosave`, `retention-boundary`, `export`, and `import`; an
  arbitrary string is not an admitted checkpoint proposition.
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

Jedit normalizes physical input into one canonical event envelope with stable
event, source, ordering, normalized-input, and admission coordinates. Echo
admits and transports the envelope without inspecting Jim or Jedit fields.
Only `jim.core`, authored from `Jim.edict`, interprets editor meaning. See
[Jim: Components, Responsibilities, and Ownership](jim-component-ownership.md)
for the frozen ownership and causal-settlement contract.

```text
terminal bytes
-> Jedit adapter emits one canonical event envelope
-> Echo realm admits and delivers it opaquely under an exact JimRelease
-> jim.core interprets the event and durably retains any command attempt
-> jim.core requests jedit.text TextWindow.edict
-> Echo returns a basis-bound Reading
-> jim.core composes jedit.text ReplaceRange.edict
-> Echo privately evaluates one combined Jim-and-buffer candidate
-> one realm and epoch atomically settles Jim, Buffer, result, and evidence
   or retains a distinct CandidateSettlementRejected outcome
-> Jedit renders one declared causal view basis
```

A generated client may encode events, install or address verified packages,
transport readings/outcomes/receipts, and decode typed projections. It is a
syscall stub, not Jim. A direct generated-client invocation of `ReplaceRange`
is permitted only in an explicitly test-only operation conformance harness.

## Artifact Boundaries

These artifacts are intentionally not interchangeable:

| Artifact | Role |
| --- | --- |
| `jedit.text.schema@1` | Application fact shapes, codecs, and identity rules |
| `jedit.text.ReplaceRange.oracle@1` | Independent expected-behavior evidence |
| `ReplaceRange.edict` | `jedit.text`-authored operation semantics composed by `jim.core` |
| Echo Target IR and verified package | Compiler-produced generic executable meaning |
| Echo receipt | Evidence of one admitted execution against one basis |

The oracle is never a program. Echo must not synthesize an evaluator or package
from the schema or oracle.

Runtime identity follows
[the Echo identity doctrine](design/echo-identity-doctrine.md). Jim must not
copy Echo identity domains, admission policy, scheduler behavior, WAL evidence,
or support-policy logic.

## Immediate Roadmap

1. Keep the narrow create/replace/checkpoint/read corridor green against
   Echo-owned WAL, admission, scheduling, graph state, receipts, and restart
   recovery.
2. Avoid restoring broad editor feature parity through transitional APIs.
3. Check in Jim-owned `ReplaceRange.edict` with its complete lawpack closure.
4. Build it through Edict's public application-build boundary and let the first
   honest compiler or target-profile failure route work to its owning repo.
5. Extend Echo only for generic bounded-program capabilities proven necessary
   by the compiler-produced package; prove the result against the independent
   Jedit oracle.
6. Author `TextWindow.edict`, then the smallest `Jim.edict` active observer.
7. Move production Jedit to canonical event submission and disposable
   rendering; make frontend operation orchestration and the Wesley/native
   planner route unreachable, then delete them.
8. Migrate create/open and checkpoint lawpacks under the same ownership model.
9. Add optional causal-anchor association as a proposition separate from
   checkpoint declaration only when a concrete consumer requires it.
10. Add save/export through Jim-authored operations, then derive undo/redo
   candidates from retained Echo history and invoke generated inverse
   operations through basis-pinned Echo observations.
11. Delete the remaining compatibility host package and semantic JSONL glue;
    retain only raw event/artifact transport required by the final membrane.

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
- Do not put `ReplaceRange`, rope operations, `Buffer`, or `TextWindow`
  semantics in Echo production code.
- Do not let TypeScript map commands to operations in final production
  composition.

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
