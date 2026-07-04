# Graph-Backed Rope Runtime Discovery

Status: discovery summary and design gate

Date: 2026-07-04

## Summary

An external audit called out a real architectural drift in jedit's current text
runtime. The blunt version is correct: the code currently named around
`RopeHead`, `BufferRoot`, `replaceRangeAsTick`, and `HotTextBufferState` does not
implement a graph-backed rope runtime.

The current hot text runtime still uses full text snapshots:

- [`src/domain/text-edit-contract.ts`](../../src/domain/text-edit-contract.ts)
  encodes the entire buffer into UTF-8 bytes, splices the requested range,
  decodes a new full string, and wraps that string in a new `BufferRoot`.
- [`src/ports/hot-text-runtime.ts`](../../src/ports/hot-text-runtime.ts)
  defines `HotTextBufferState.roots` as an array of retained roots.
- [`src/adapters/in-memory-hot-text-runtime.ts`](../../src/adapters/in-memory-hot-text-runtime.ts)
  appends the new full root to that retained array after an admitted edit.
- [`src/adapters/installed-jedit-contract-echo-transport.ts`](../../src/adapters/installed-jedit-contract-echo-transport.ts)
  still defaults the installed jedit contract transport to that in-memory
  runtime.

That means the current implementation has O(N) edit cost and O(N) retained text
per edit for buffer size N. For repeated small edits on a large file, retained
memory grows with file size times edit count. That is not the intended jedit
architecture.

## What Was Intended

The original design intent is stronger than "a text runtime behind an Echo-shaped
API." The rope should be modeled with Echo graph primitives through the jedit
contract layer. Echo intents should evolve that graph by rewriting rope facts and
producing a new rope model in the Echo-hosted causal history.

In that model:

- `BufferWorldline` is the logical editable object.
- `RopeHead` identifies one graph-backed text state.
- `RopeBranch`, `RopeLeaf`, and `TextBlob` are graph facts, not names for a full
  JavaScript string.
- `replaceRangeAsTick` is an Echo intent that reads a base head, range-closes
  over touched rope nodes, creates the new local rope facts, emits rewrite and
  diff evidence, and advances the worldline head.
- `RopeRewrite`, `RopeDiff`, tick receipts, checkpoints, anchors, strands, and
  admissions are retained causal evidence.
- Materialized strings are readings or projections. They are allowed for UI
  rendering, export, save, tests, and caches, but they are not the source of
  editor truth.

Echo still remains generic. jedit owns the text and rope contract vocabulary;
Echo hosts generic admission, scheduling, receipts, retention, and causal
storage. The important correction is that the jedit contract vocabulary must be
real graph-backed state, not labels over full string snapshots.

## Why This Matters

This is not a minor performance issue.

The current runtime breaks the product's intended causal posture in several
ways:

- It makes the authoritative retained state a list of full materialized strings
  rather than compact causal graph evidence.
- It makes the rope vocabulary misleading because no rope graph is actually
  being evolved.
- It makes `:why`, historical basis preview, strands, braids, gutter evidence,
  and retention policy harder to make honest because they must recover history
  from full roots instead of reading graph facts.
- It can make dogfooding painful on larger files because every edit copies and
  retains the whole buffer.
- It risks making UI language more causally honest than the storage model below
  it.

The existing docs already point in the right direction. In particular:

- [`0003-echo-backed-rope-worldline-contract.md`](0003-echo-backed-rope-worldline-contract/echo-backed-rope-worldline-contract.md)
  says witnessed causal history is canonical and materialized projections are
  not editor truth.
- [`jedit-echo-graph-model.md`](jedit-echo-graph-model.md) describes the desired
  `BufferWorldline -> RopeHead -> Rope DAG` shape and states that
  `ReplaceRangeAsTick` should reuse untouched subtrees.
- [`0027-echo-hosted-production-cutover.md`](0027-echo-hosted-production-cutover.md)
  says the local in-memory text model is no longer a production authority target.
- [`structural-history-graphql-authority.md`](structural-history-graphql-authority.md)
  says the TypeScript model is transitional evidence, not durable authority.

The problem is that implementation reality has not caught up to those design
claims.

## Planned Response

We should not patch this by making full-string replacement faster. That would
preserve the wrong architecture. The response needs to be a graph-backed runtime
cutover.

### 1. Fence The Fixture

The current in-memory full-snapshot runtime must be renamed, documented, or
otherwise fenced as a fixture or transitional adapter. It should not silently be
the default production text authority for daily-driver jedit.

Planned guardrails:

- rename or document the runtime as full-snapshot/transitional;
- add a production guard against implicit default use where possible;
- keep focused tests able to inject it deliberately;
- make release and preflight checks fail if product code starts treating it as
  durable text authority again.

### 2. Write The Runtime Design

Create a full graph-backed rope runtime design that specifies:

- graph facts and relations for worldlines, heads, branches, leaves, blobs,
  rewrites, diffs, ticks, checkpoints, anchors, strands, and admissions;
- intent semantics for `createBufferWorldline`, `replaceRangeAsTick`, and
  `createCheckpoint`;
- reading semantics for `textWindow`, `worldlineSnapshot`, save/export, source
  highlighting, Graft, and `:why`;
- retention and compaction policy for graph facts, text blobs, receipts,
  checkpoints, and materialized projections;
- cutover strategy from the current full-root fixture to the graph-backed
  implementation.

### 3. Add Witnesses That Fail The Current Architecture

Before implementation, add explicit witnesses for the non-negotiable properties:

- repeated small edits to a large buffer must not retain one full text snapshot
  per edit as authoritative history;
- `replaceRangeAsTick` must preserve identity for untouched subtrees;
- no-op replacement must not mint a tick;
- text-window reads must materialize from a rope head, not from a retained full
  root list;
- save/export must read from a causal basis and must not mutate text authority;
- `:why` for a byte range must be able to cite graph-backed rewrite/diff
  evidence.

### 4. Implement The Cutover In Slices

The likely implementation sequence is:

1. graph-backed `createBufferWorldline`;
2. graph-backed `textWindow` over a `RopeHead`;
3. graph-backed single-range `replaceRangeAsTick`;
4. graph-backed `createCheckpoint`;
5. production session cutover to the graph-backed runtime;
6. quarantine or delete full-root production authority paths;
7. update `:why`, gutter evidence, worldline drawers, and save/export posture to
   consume graph facts directly;
8. define compaction and cold-retention rules.

### 5. Treat UI Work As Dependent On Runtime Honesty

UI posture work, including the causal footer and gutter evidence work, should be
checked against the runtime truth. If the UI says "basis", "head", "tick",
"checkpoint", or "worldline", the source underneath should be graph-backed
causal evidence or explicitly marked as a transitional projection.

## Immediate Decision

Do not treat the current full-snapshot hot text runtime as an acceptable
production implementation. It can remain only as a bounded fixture while the
graph-backed runtime is designed and cut over.

The next work item is a careful design document for the graph-backed rope
runtime, followed by failing witnesses that make the current architecture's
retention and rewrite behavior unacceptable for production.
