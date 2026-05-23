# Echo Runtime Control And Release-Gate Slices

Status: design plan for the next jedit/Echo release-gate batch.

This packet records the jedit-side consequence of Echo's trusted
runtime-control doctrine:

```text
Start/Stop are trusted runtime-control history.
Start/Stop are not jedit contract intents.
Start/Stop authorize scheduler opportunities; they do not create ticks.
TickReceipt remains Echo scheduler-owned execution evidence.
```

jedit may expose Start/Stop/cadence controls in a product shell or local host
CLI. Those controls must flow through a trusted Echo host adapter. They must not
be encoded as `replaceTextRange`, structural-history mutations, or any other
jedit-authored domain operation.

## Authority Split

| Surface | Allowed | Forbidden |
| :--- | :--- | :--- |
| jedit app/product adapter | Submit edit intents, observe outcomes, request bounded readings, render product evidence. | Tick Echo, start/stop Echo, drain Echo, inspect worldline/head/scheduler internals. |
| jedit trusted Echo host adapter | Install packages, call trusted Echo control, choose cadence/drain policy, run witness loops. | Expose raw trusted control to app code or mutate jedit product state directly. |
| Echo scheduler | Select work, attempt ticks, emit receipts, roll back failed attempts. | Treat jedit product commands as scheduler control. |

`Start(tickFrequency = 1/60)` is a trusted host policy command. It starts
scheduler opportunities under host cadence. It is not a request from the editor
contract to run one tick now.

## Design Consequences

- The release witness may record Start/Stop/cadence evidence in its report.
- The app-facing witness summary must keep runtime-control evidence separate
  from edit intent evidence.
- Replay may use runtime-control history to explain pending gaps or running
  posture.
- Replay must not sleep to reproduce wall-clock cadence. It should replay
  logical control epochs and scheduler receipts.
- Stopping the host must not interrupt a half-committed tick.

## Next Ten Slices From jedit's Side

The matching Echo plan is
`docs/design/v0.1.0-jedit-next-ten-slices.md` in the Echo repository.

### 1. Release-Gate Doctrine Cleanup

Update jedit docs so the current proof starts from
`contracts/jedit/structural-history.graphql` and `replaceTextRange`.
`TextBufferOptic`, if retained, is a jedit product capability, not an Echo noun.
Start/Stop belong to the trusted host adapter.

Witness: docs grep shows no claim that Echo owns editor/text-buffer concepts.

### 2. Witness Retained-Evidence Inventory

Extend the real Echo witness report with receipt refs, reading refs, package
identity, reading identity, artifact hash, and missing-retention posture.

Witness: `node scripts/jedit-echo-witness.mjs --json` reports retained evidence
without leaking scheduler internals.

Current implementation note: the report now records inline `QueryBytes` and
`ReadingEnvelope` evidence and names durable receipt/payload/envelope refs as
`missing_retention`. Real Echo retained refs remain a later replacement for
that posture.

### 3. Echo Retained Evidence Ref Surface Check

Coordinate with Echo if the WASM/API surface does not expose enough generic
retained evidence refs. jedit should consume generic refs only through its
adapter.

Witness: jedit can report evidence refs without private Echo runtime access.

Current implementation note: the current Echo WASM witness exposes enough
inline observation evidence to report the gap, but not enough durable retained
refs to satisfy the release gate. No jedit code should fabricate those refs.

### 4. Adapter Consumes Echo Retained Refs

Map Echo retained refs into jedit's product witness report below the adapter
boundary.

Witness: product-facing report stays about edits, readings, receipts, and
evidence.

### 5. Replay Witness Shell

Add a replay phase to the witness CLI. Replay should compare outcome or reading
identity, or return a typed replay obstruction when durable replay is not yet
available.

Witness: CLI replay does not require app-facing tick authority.

Current implementation note: `--replay` now returns the report replay posture.
Until durable replay exists, the posture is `durable_replay_unavailable`.

### 6. Product-Facing Intent Outcome Consumption

Consume Echo's app-safe outcome API once polished: unknown, pending, applied,
rejected, obstructed.

Witness: jedit observes outcome without trusted control.

### 7. Generated Structural-History Request Path

Use generated structural-history operation metadata and codecs for
`replaceTextRange` instead of the old stack-witness fixture shape.

Witness: the real Echo mutation path is generated-contract backed.

### 8. Generated Package Install Path

Install the jedit-generated package through Echo's generic installed-package
boundary.

Witness: unsupported op/query is rejected at package boundary and no jedit noun
enters Echo.

### 9. Real Mutation And Query Round Trip

Submit `replaceTextRange`, let the trusted host enable/drain scheduler
opportunities, observe the outcome, and query a bounded text reading.

Witness: real report includes non-trivial vars, scheduler-owned receipt,
bounded reading, retained refs, and app/host split.

### 10. Non-Happy Path And Release-Gate Report

Add one honest failure path: unsupported op/query, missing retention, residual
reading, lawful rejection, or obstruction.

Witness: one documented command emits the happy path, non-happy path, retained
evidence, replay result, and authority-boundary checks.

## Non-Goals

- Do not make Start/Stop jedit contract mutations.
- Do not expose Echo trusted control on the app transport.
- Do not make app dispatch synchronous with Echo execution.
- Do not make wall-clock cadence semantic history.
- Do not move jedit product nouns into Echo.
- Do not remove the fake transport until the real witness is stable.
