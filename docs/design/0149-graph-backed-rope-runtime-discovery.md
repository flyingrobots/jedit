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

The hard gate is:

```text
Do not begin more UI causal-honesty work until the text runtime has at least one
real graph-backed path for create, read, replace, and checkpoint.
```

Until then, UI labels such as `basis`, `head`, `tick`, `checkpoint`, and
`worldline` must either be backed by graph facts or explicitly marked as
transitional projection posture.

### 1. Rename And Fence The Fixture

The current in-memory full-snapshot runtime must be renamed so accidental
production use is visibly wrong. Acceptable names include:

- `FullSnapshotHotTextRuntimeFixture`
- `InMemoryFullSnapshotTextRuntime`
- `TransitionalSnapshotTextRuntime`

Unacceptable names include:

- `InMemoryHotTextRuntime`
- `HotTextRuntime`
- `DefaultHotTextRuntime`
- `ProductionHotTextRuntime`

The name should make the wrong wiring ugly.

Planned guardrails:

- rename or document the runtime as full-snapshot/transitional;
- add a production guard against implicit default use;
- keep focused tests able to inject it deliberately;
- make release and preflight checks fail if product code starts treating it as
  durable text authority again.

The installed/default transport must not silently instantiate the full-snapshot
runtime. If a temporary escape hatch is required, it should be explicit:

```typescript
if (process.env.JEDIT_ALLOW_FULL_SNAPSHOT_TEXT_AUTHORITY !== "1") {
  throw new Error(
    "FullSnapshotHotTextRuntimeFixture cannot be used as production text authority.",
  );
}
```

Tests may opt in deliberately. Product startup should not.

### 2. Define Coordinates Before Facts

The graph-backed rope design must define its coordinate system before it defines
facts. The current code uses UTF-8 byte ranges, JavaScript strings are UTF-16,
and editor UI needs line/column positions. Those must not blur together.

Authoritative mutation coordinates should be UTF-8 byte offsets. UI coordinates
should be adapters over that storage coordinate.

The design should introduce branded coordinate types:

```typescript
type ByteOffset = number & { readonly __brand: "utf8-byte-offset" };
type Utf16Offset = number & { readonly __brand: "utf16-code-unit-offset" };

interface LineColumn {
  readonly line: number;
  readonly columnUtf16: Utf16Offset;
}
```

Rules:

- rope mutation ranges are half-open UTF-8 byte ranges;
- text blobs store UTF-8 bytes;
- line/column and UTF-16 offsets are UI or protocol projections;
- grapheme-aware movement is a command-planning concern over readings, not the
  authoritative storage coordinate;
- every conversion must cite the basis head or reading it was computed from.

### 3. Define Real Typed Graph Facts

Create a full graph-backed rope runtime design that specifies concrete fact
shapes. The exact names may evolve, but the design must be precise enough for
witnesses to target.

Example fact skeleton:

```typescript
type WorldlineId = string & { readonly __brand: "WorldlineId" };
type RopeHeadId = string & { readonly __brand: "RopeHeadId" };
type RopeNodeId = string & { readonly __brand: "RopeNodeId" };
type TextBlobId = string & { readonly __brand: "TextBlobId" };
type TickId = string & { readonly __brand: "TickId" };
type Hash = string & { readonly __brand: "Hash" };

interface BufferWorldlineFact {
  readonly kind: "jedit.text.BufferWorldline";
  readonly worldlineId: WorldlineId;
  readonly createdAtTick: TickId;
  readonly initialHeadId: RopeHeadId;
}

interface RopeHeadFact {
  readonly kind: "jedit.text.RopeHead";
  readonly headId: RopeHeadId;
  readonly worldlineId: WorldlineId;
  readonly rootNodeId: RopeNodeId;
  readonly basisHeadId?: RopeHeadId;
  readonly createdByTickId: TickId;
  readonly byteLength: number;
  readonly lineCount: number;
  readonly contentHash: Hash;
}

interface RopeBranchFact {
  readonly kind: "jedit.text.RopeBranch";
  readonly nodeId: RopeNodeId;
  readonly left: RopeNodeId;
  readonly right: RopeNodeId;
  readonly byteLength: number;
  readonly lineCount: number;
  readonly height: number;
  readonly contentHash: Hash;
}

interface RopeLeafFact {
  readonly kind: "jedit.text.RopeLeaf";
  readonly nodeId: RopeNodeId;
  readonly blobId: TextBlobId;
  readonly byteStart: ByteOffset;
  readonly byteLength: number;
  readonly lineCount: number;
  readonly contentHash: Hash;
}

interface TextBlobFact {
  readonly kind: "jedit.text.TextBlob";
  readonly blobId: TextBlobId;
  readonly encoding: "utf8";
  readonly byteLength: number;
  readonly contentHash: Hash;
}
```

The full design must also define facts for:

- `RopeRewrite`;
- `RopeDiff`;
- `TickReceipt`;
- `RopeCheckpoint`;
- anchors;
- strands, braids, and admissions when their implementation slice begins.

Echo remains generic. jedit owns these fact shapes and text-specific witnesses.

### 4. Separate Text Authority From Observations

No-op behavior needs causal precision. A no-op replacement should not mint a new
text head or rewrite evidence claiming text changed. The system may still record
an admitted no-op intent, rejected edit, idempotent command, observation, or
receipt.

The design should distinguish:

- `ReplaceRangeIntent`;
- `ReplaceRangeAdmission`;
- `RopeRewrite | null`;
- `RopeDiff | null`;
- `WorldlineAdvance | null`;
- `TickReceipt`.

Rules:

- no text change means no new `RopeHead`;
- no changed range means no `RopeRewrite`;
- optional admission or receipt evidence may still exist;
- no-op evidence must not pollute the rope graph as if bytes changed.

### 5. Make Untouched Subtree Identity A Contract

Untouched subtree identity is the central rope property. If a narrow replacement
rebuilds the whole tree, it is not the intended runtime.

Witness shape:

```typescript
const before = await runtime.debugRopeShape(headA);
const result = await runtime.replaceRangeAsTick({
  worldlineId,
  basisHeadId: headA,
  range,
  replacement,
});
const after = await runtime.debugRopeShape(result.nextHeadId);

expect(after.untouchedLeftSubtreeId).toEqual(before.untouchedLeftSubtreeId);
expect(after.untouchedRightSubtreeId).toEqual(before.untouchedRightSubtreeId);
```

This should be part of the contract, not an incidental optimization.

### 6. Make Retention Measurable

Do not rely on qualitative claims. Add an explicit witness around retained
authoritative bytes.

Example target:

```text
largeBufferSize = 10_000_000 bytes
edits = 1_000 single-byte edits
```

The full-snapshot runtime retains roughly 10 GB of authoritative text snapshots.
The graph-backed runtime should retain approximately:

- initial text blobs;
- changed leaves;
- path-copied branch nodes;
- rewrite and diff facts;
- receipts;
- indexes and checkpoints.

The exact byte count may vary, but the witness must assert retained
authoritative text is not O(buffer_size * edit_count).

### 7. Define Materialization Boundaries

Materialized strings are allowed only as readings or projections. Every
materialized string must answer:

- which `RopeHead` was read;
- which UTF-8 byte range was read;
- whether the materialization came from cache;
- how the cache was validated against the head.

Good:

```typescript
const text = await runtime.textWindow({
  basisHeadId,
  byteRange,
});
```

Bad:

```typescript
const text = state.roots[state.roots.length - 1].text;
```

This boundary is what makes `:why`, historical preview, save/export, and UI
evidence trustworthy.

### 8. Write Witnesses Before Most Implementation

The better implementation order is:

1. minimal design skeleton;
2. failing witnesses;
3. tiny graph-backed runtime;
4. refined design;
5. more witnesses;
6. production cutover.

The witnesses are architectural teeth, not after-the-fact documentation.

Required first witnesses:

- snapshot fixture cannot be constructed as default production authority;
- repeated edits do not retain one full text snapshot per edit;
- untouched subtree identity survives a narrow replacement;
- no-op intent can produce admission evidence without a new head or rewrite;
- text-window reads cite a basis head and byte range;
- save/export reads from a causal basis without mutating text authority;
- `:why` can cite rewrite, diff, tick, head, leaf, and blob evidence for a byte
  range.

### 9. Build The Smallest Real Runtime First

Do not start by solving compaction, braids, collaborative merge, source
highlighting, and `:why` all at once. The first implementation win should be:

```text
create buffer
-> read window
-> replace small range
-> read window
-> prove untouched identity survived
-> checkpoint
```

Initial scope:

- immutable rope nodes;
- content-addressed blobs;
- binary branch tree;
- append-only graph fact store;
- single-range replacement;
- text-window read;
- checkpoint fact;
- debug-only shape inspection.

### 10. Mark Evidence Versus Indexes

The design must distinguish durable semantic facts from rebuildable acceleration
indexes.

Durable truth:

- `RopeHead`;
- `RopeBranch`;
- `RopeLeaf`;
- `TextBlob`;
- `RopeRewrite`;
- `RopeDiff`;
- `TickReceipt`;
- `RopeCheckpoint`.

Rebuildable indexes and caches:

- line offset index;
- syntax highlighting cache;
- materialized window cache;
- source map cache;
- render layout cache;
- search index.

Rule:

```text
If deleting it changes history, it is evidence.
If deleting it only makes reads slower, it is an index.
```

### 11. Define Balance And Checkpoint Policy

A rope that path-copies forever without balance policy eventually becomes a
linked list with better names. The design must define:

- target leaf size;
- maximum and minimum leaf size;
- branch weight rules;
- balance invariant;
- when replacement triggers rebalance;
- whether rebalance creates causal facts;
- whether rebalance is visible to `:why`.

Recommended posture:

- edits create semantic rewrite evidence;
- rebalancing creates structural maintenance evidence;
- both can be retained;
- normal UI hides structural maintenance unless debugging.

Checkpoint semantics also need precision. A checkpoint is not new text truth. It
is a durable named basis for efficient future reads, retention, or export.

```typescript
interface RopeCheckpointFact {
  readonly kind: "jedit.text.RopeCheckpoint";
  readonly checkpointId: string;
  readonly worldlineId: WorldlineId;
  readonly headId: RopeHeadId;
  readonly createdByTickId: TickId;
  readonly reason:
    | "manual-save"
    | "autosave"
    | "retention-boundary"
    | "import"
    | "test-fixture";
}
```

Save/export should read from a head or checkpoint. It should not mutate text
authority unless the product explicitly records a checkpoint.

### 12. Make `:why` An Acceptance Target

Do not let `:why` become a bolt-on archaeology tool. For a byte range, the
runtime should be able to answer:

- this range is present in head H;
- it descends from leaf L and blob B;
- it was introduced or last touched by rewrite R;
- rewrite R was admitted by tick T;
- tick T had basis head H0;
- here is the diff evidence;
- here are related checkpoints.

This is the runtime acceptance demo.

### 13. Implement The Cutover In Slices

The likely implementation sequence is:

1. rename the snapshot runtime and add the production guard;
2. add the fixture quarantine witness;
3. define coordinate and fact skeletons;
4. add retention, subtree identity, materialization, no-op, and `:why` witnesses;
5. implement graph-backed `createBufferWorldline`;
6. implement graph-backed `textWindow` over a `RopeHead`;
7. implement graph-backed single-range `replaceRangeAsTick`;
8. implement graph-backed `createCheckpoint`;
9. cut the production session over to the graph-backed runtime;
10. quarantine or delete full-root production authority paths;
11. update `:why`, gutter evidence, worldline drawers, and save/export posture to
    consume graph facts directly;
12. define compaction and cold-retention rules.

### 14. Useful Later Ideas

These are not first-slice requirements, but they should stay visible:

- content-addressed `TextBlob` storage where `blobId = hash(encoding + bytes)`;
- internal-only `debugRopeShape` for witnesses and developer tools;
- transitional `textAuthorityKind` such as `full-snapshot-fixture` or
  `graph-backed-rope`;
- explicit import from old snapshot roots into one graph-backed import
  checkpoint;
- queryable retention policy that explains why evidence, blobs, projections, or
  indexes were retained or compacted;
- a rope fact inspector drawer;
- a causal heatmap over edit ancestry;
- a retention budget dashboard;
- basis-pinned save/export receipts.

### 15. Things Not To Do

- Do not optimize the full-snapshot runtime as a substitute for graph-backed
  authority.
- Do not let names outrun facts. A `RopeHead` must point to an actual rope.
- Do not make UI truthier than storage truth.
- Do not mix cache invalidation with authority mutation.
- Do not make compaction destroy explainability by accident.

### 16. Treat UI Work As Dependent On Runtime Honesty

UI posture work, including the causal footer and gutter evidence work, should be
checked against the runtime truth. If the UI says "basis", "head", "tick",
"checkpoint", or "worldline", the source underneath should be graph-backed
causal evidence or explicitly marked as a transitional projection.

## Immediate Decision

Do not treat the current full-snapshot hot text runtime as an acceptable
production implementation. It can remain only as a bounded fixture while the
graph-backed runtime is designed and cut over.

The next work item is not implementation of the final runtime. It is:

1. rename and fence the snapshot fixture;
2. add the production guard;
3. define concrete coordinate and graph fact shapes;
4. write failing witnesses for retention, subtree identity, no-op admission,
   materialization basis, save/export basis, and `:why` evidence;
5. implement the smallest real graph-backed create/read/replace/checkpoint path.

The core principle is:

```text
A rope runtime is defined by what survives an edit.
Materialization is a reading, not reality.
Causal honesty is an end-to-end property.
```
