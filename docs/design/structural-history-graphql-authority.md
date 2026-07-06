# Structural History GraphQL Authority

Status: schema-authority slice

## Scope

This slice extracts the current in-memory structural history model into a
GraphQL contract without wiring runtime storage. The new authored SDL is
[`contracts/jedit/structural-history.graphql`](../../contracts/jedit/structural-history.graphql).

The TypeScript model was useful evidence. It is not the durable authority for
buffer history, edit admission, edit grouping, checkpoints, or evidence-bearing
readings.

## Source Model Inspected

- `src/adapters/full-snapshot-hot-text-runtime-fixture.ts`
- `src/ports/hot-text-runtime.ts`
- `src/domain/text-edit-contract.ts`
- `src/domain/tick-admission-contract.ts`
- `src/domain/edit-group-contract.ts`
- `src/domain/save-checkpoint-contract.ts`
- `src/app/text-buffer-session.ts`
- `src/ports/jedit-optic-client.ts`

The inspected behavior already separates the app-facing text buffer optic from
the lower causal text runtime. This slice keeps that boundary: structural
history is a product contract, not a storage backend.

## Extraction Map

Old TS concept -> GraphQL concept -> notes

| Old TS concept | GraphQL concept | Notes |
| :--- | :--- | :--- |
| `HotTextBufferState.path` | `TextHistory.bufferKey`, `projectionPath` | A path-like key is metadata/projection context, not storage authority. |
| `BufferRoot` | `TextRevision` | The schema names the meaning: one revision in a text history. It does not preserve the root implementation name. |
| `TextRange` | `TextByteRange` | Half-open UTF-8 byte ranges stay explicit because existing behavior validates byte boundaries. |
| `ReplaceReceipt` | `TextReplacement` plus `TextHistoryEvent.evidence` | Replacement shape and provenance are separate so evidence can evolve without mutating the event fact. |
| `AdmittedTick` | `TextHistoryEvent` | The schema promotes the authorial event rather than the low-level tick name used by the placeholder model. |
| `TickAdmissionReceipt` | `TextHistoryEvent.evidence` | A receipt remains first-class as evidence and can later bind to generated runtime artifacts. |
| `EditGroup` / `OpenEditGroup` | `TextEditGroup.status` | Open and closed groups are one domain concept with explicit status. |
| `SaveCheckpoint` | `TextCheckpoint` | Save is modeled as a revision marker over a projection path, not as a reset of editor truth. |
| `Observed<T>.evidence` | `TextHistoryEvidence` | Readings and command results carry citable evidence instead of anonymous wrapper fields. |
| `TextWindowReading` | `TextHistorySnapshotReading.lines` | Bounded reads stay explicit and budgeted; full history materialization is not the default read. |

## Canonical GraphQL

`contracts/jedit/structural-history.graphql` is now the canonical contract for
these app-owned facts:

- `TextHistory`
- `TextRevision`
- `TextHistoryEvent`
- `TextEditGroup`
- `TextCheckpoint`
- `TextHistoryProvenance`
- `TextHistoryEvidence`
- `TextHistorySnapshotReading`

The contract also names command result status and validation error codes:

- `TextHistoryCommandStatus`
- `TextHistoryErrorCode`
- `TextHistoryError`

This prevents the old TypeScript result shapes from becoming invisible
authority. Commands return explicit `APPLIED`, `NO_OP`, or `REJECTED` status
with structured errors.

## Transitional TypeScript

Transitional TypeScript remains in place until generated replacements exist.
The current in-memory adapter still preserves behavior for local tests and
product development, but it should be read as an adapter/projection over the
GraphQL contract direction.

The following names are transitional evidence, not canonical schema names:

- `HotTextBufferState`
- `BufferRoot`
- `TextFragment`
- `AdmittedTick`
- `OpenEditGroup`
- `SaveCheckpointState`

Future TypeScript should prefer generated contract names or thin adapter
classes that translate to them. New app behavior should not add more
hand-authored authority beside the SDL.

## Wesley Generation

Wesley generation should consume
`contracts/jedit/structural-history.graphql` through the published
`wesley-cli` 0.0.4 crate. The intended flow is:

1. Author the domain contract in GraphQL.
2. Generate TypeScript request, payload, and operation metadata from the SDL.
3. Refactor the current adapter ports to accept generated inputs and return
   generated payload shapes.
4. Keep storage and substrate resolution behind ports.

The first schema-authority slice deliberately did not add a package script
because no generated artifact was consumed yet. The `replaceTextRange` metadata
slice adds the local generation command below because a real adapter boundary
now depends on generated operation identity.

## First Metadata Consumer

The first consumer is deliberately narrow:
`src/app/structural-history-replace-text-range.ts` imports the build-generated
`mutationReplaceTextRangeOperation` descriptor from
`src/generated/jedit/structural-history-replace-text-range.wesley.generated.ts`.
That descriptor carries the generated operation identity for
`replaceTextRange`; the existing in-memory runtime still executes the edit via
the old tick-admission model.

The local generation command is:

```sh
npm run gen:contract:structural-history:wesley
```

It writes the full Wesley TypeScript output to
`.wesley-cache/structural-history.wesley.generated.ts`, extracts the
`mutationReplaceTextRangeOperation` descriptor, and writes the adapter-facing
metadata file under `src/generated/jedit/`. That source file is ignored and is
created by the build/test path rather than committed.

The generator installs `wesley-cli` 0.0.4 into `.wesley-cache/cargo` when the
expected binary is missing. This mirrors Echo's current direction: Echo's
`echo-wesley-gen` consumes the published `wesley-core` 0.0.4 crate, while jedit
uses the published CLI only to produce TypeScript operation metadata for this
schema-authority slice.

## Out Of Scope

Runtime storage is out of scope. This slice does not:

- implement a persistent store
- migrate existing data
- delete the current in-memory adapter
- wire Echo, git-warp, SQLite, or file-cache internals into the schema
- replace `hot-text-runtime.graphql`
- change public editor behavior

The next storage or runtime slice should start from generated contracts rather
than treating the placeholder TypeScript structures as peer authority.

## Validation Assumptions

The current TypeScript code enforces these assumptions, and the schema names
them as contract concepts rather than implementation quirks:

- text replacement uses half-open UTF-8 byte ranges
- no-op replacements produce no authorial event
- admitted events have explicit sequence numbers
- edit groups contain known admitted events only
- checkpoints cite a revision and projection path
- readings may be partial, stale, imported, fallback-translated, or native
- command failures are structured status/error payloads, not thrown strings
