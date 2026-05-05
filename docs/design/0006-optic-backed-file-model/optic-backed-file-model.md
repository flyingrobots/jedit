---
title: "optic-backed-file-model"
legend: "none"
cycle: "0006-optic-backed-file-model"
source_backlog: "conversation: echo-optic-read-write-planning"
---

# optic-backed-file-model

Source backlog item: `conversation: echo-optic-read-write-planning`
Legend: none

## Sponsors

- Human: Backlog operator
- Agent: Implementation agent

These labels are abstract roles. In this design, `user` means the served
perspective, like in a user story, not a literal named person or specific
agent instance.

## Hill

Turn the emerging Echo Optic idea into a concrete `jedit` planning packet and
backlog cut. At the end of this cycle, `jedit` should have a design that makes
six claims explicit:

1. an open file is a focused causal view, not a whole string in memory
2. an Optic read is a bounded observation at an Echo coordinate
3. an Optic write is an Intent submission, never a direct setter
4. text windows, inverse ticks, and braid projections are contract-owned
   `jedit` semantics compiled through Wesley
5. Echo owns the generic Optic, coordinate, dispatch, admission, and reading
   substrate
6. `jedit` can prepare now with a fake Echo Optic harness while waiting for the
   real Echo API

This cycle is complete when those claims are visible in repo docs and broken
into backlog items that can be executed independently.

## Playback Questions

### Human

- [ ] The packet clearly states that all file mutations happen by submitting
  Intents through Echo.
- [ ] The packet makes `read` and `write` optic behavior concrete without
  implying direct substrate mutation.
- [ ] The packet explains how bounded viewport reads replace full-file editor
  loading.
- [ ] The packet keeps `jedit` text semantics app-owned and Echo substrate
  semantics generic.
- [ ] The packet cuts the plan into backlog tasks with acceptance criteria.

### Agent

- [ ] The packet names the current repo seam in
  `src/ports/jedit-optic-client.ts` and the future seam through
  `EchoWasmKernelTransport`.
- [ ] The packet gives enough GraphQL-shaped examples for future Wesley schema
  work.
- [ ] The packet specifies how inverse-tick undo appends history rather than
  deleting history.
- [ ] The packet specifies how sequential braid edits project current file
  state.
- [ ] The packet leaves an executable first slice: fake Echo Optic tests over
  bounded text-window reads and Intent-only writes.

## Accessibility and Assistive Reading

- Linear truth / reduced-complexity posture: this packet should be readable as
  direct prose plus small GraphQL examples. No argument should depend on a
  diagram.
- Non-visual or alternate-reading expectations: all examples use named
  coordinates, ranges, and receipts rather than visual screen positions.

## Localization and Directionality

- Locale / wording / formatting assumptions: the packet uses stable nouns such
  as `Optic`, `Intent`, `Reading`, `Coordinate`, `Braid`, `Tick`, and
  `Receipt`.
- Logical direction / layout assumptions: `before`, `after`, `start`, and
  `end` refer to logical text order, not visual left/right screen layout.

## Agent Inspectability and Explainability

- What must be explicit and deterministic for agents: the read/write boundary
  must be documented so future agents do not reintroduce whole-file strings as
  the editor's canonical model.
- What must be attributable, evidenced, or governed: the plan must tie back to
  the authored GraphQL contract, the existing optic client seam, and the Echo
  doctrine that app nouns stay out of Echo core.

## Core Decision

`jedit` should treat an open editable file as an Echo-backed Text File Optic:

```text
TextFileOptic = focus + coordinate + bounded read family + write Intent family
```

The Optic is not the file itself. The file is a causal projection over
witnessed history. The Optic is the capability-scoped way the editor focuses on
that history and emits bounded readings from it.

This means:

- `read` means observe a bounded projection at a causal coordinate
- `write` means submit an Intent against the focused projection
- the returned result is a tick, receipt, reading, obstruction, or later
  settlement signal
- direct setters are not part of the model

## Non-Goals

- Implementing the real Echo Optic API inside `jedit`.
- Making Echo core know about files, text ranges, Graft, or `jedit`.
- Removing `worldlineSnapshot` before a bounded read family exists.
- Solving every strand, braid, and wormhole retention rule in this packet.
- Replacing the current editor UI in one cycle.

## Current Repo Starting Point

The repo already has a useful first seam:

- [src/ports/jedit-optic-client.ts](../../../src/ports/jedit-optic-client.ts)
- [src/app/jedit-optic-client.ts](../../../src/app/jedit-optic-client.ts)
- [spec/jedit-optic-client.spec.mjs](../../../spec/jedit-optic-client.spec.mjs)

That seam is GraphQL-shaped, but it is not Echo-shaped yet. The current
implementation directly maps generated operation names to the legacy in-memory
`HotTextRuntimePort`. That is acceptable as a proving slice, but the next step
should make the seam transport-shaped:

```text
jedit UI
  -> TextFileOptic client
  -> encoded contract query or mutation
  -> EchoWasmKernelTransport
  -> fake or real Echo contract host
  -> reading, tick receipt, or obstruction
```

The fake host may use the in-memory runtime internally. The public app seam
must still look like Echo: bytes in, bytes out, with decoding only at the
adapter boundary.

## Optic Law

An Echo Optic should obey four rules.

### 1. Coordinate-Anchored Reads

Every read is tied to an Echo coordinate or a named frontier. A reading is not
just "current text"; it is "this projection as observed from this causal
position."

### 2. Bounded Projections

Reads must have explicit budgets. For source painting, the normal read is a
text window around the viewport and cursor, not the whole file.

### 3. Intent-Only Writes

All writes submit Intents. The Optic can help construct the Intent, but it does
not bypass admission.

### 4. Receipts Over Mutation Return Values

The editor should advance from receipts and readings, not from local mutation
assumptions. A write may be accepted, rejected, obstructed, transformed, or
settled later.

## App Model

The editor-facing open file model should become:

```ts
type OpenTextFile = {
  opticId: string;
  cursor: TextCursor;
  viewport: TextViewport;
  lastReadingCoordinate: EchoCoordinate;
};
```

The editor owns cursor, viewport, panels, selection presentation, and keyboard
mode. Echo owns causal history, coordinates, admission, and receipt identity.
The `jedit` contract owns text semantics such as ranges, line
windows, anchors, inverse text operations, and braid projection rules.

## Ideal GraphQL Shape

This is a planning target, not a claim that the current generated schema
already supports it.

```graphql
type TextFileOptic {
    opticId: ID!
    worldlineId: ID!
    braidId: ID
    coordinate: EchoCoordinate!
    capabilities: [OpticCapability!]!
}

type EchoCoordinate {
    worldlineId: ID!
    strandId: ID
    braidId: ID
    tickId: ID
}

type TextCursor {
    line: Int!
    column: Int!
}

type TextLineReading {
    lineNumber: Int!
    text: String!
    startByte: Int!
    endByte: Int!
}

type TextWindowReading {
    opticId: ID!
    readingId: ID!
    coordinate: EchoCoordinate!
    startLine: Int!
    lineCount: Int!
    totalLineCount: Int!
    lines: [TextLineReading!]!
    hasMoreBefore: Boolean!
    hasMoreAfter: Boolean!
}

input OpenTextFileOpticInput {
    worldlineId: ID!
    braidId: ID
    coordinate: EchoCoordinateInput
}

input TextWindowInput {
    opticId: ID!
    cursor: TextCursorInput!
    beforeLines: Int!
    afterLines: Int!
    maxBytes: Int!
}

type Query {
    textWindow(input: TextWindowInput!): TextWindowReading!
}

type Mutation {
    openTextFileOptic(input: OpenTextFileOpticInput!): TextFileOptic!
}
```

The read example for the editor is:

```graphql
query ReadViewport($input: TextWindowInput!) {
    textWindow(input: $input) {
        opticId
        coordinate {
            worldlineId
            strandId
            braidId
            tickId
        }
        startLine
        lineCount
        totalLineCount
        hasMoreBefore
        hasMoreAfter
        lines {
            lineNumber
            text
            startByte
            endByte
        }
    }
}
```

## Intent Writes

The write shape should keep the base coordinate visible:

```graphql
input ReplaceTextRangeInput {
    opticId: ID!
    baseCoordinate: EchoCoordinateInput!
    range: TextRangeInput!
    replacement: TextFragmentInput!
    author: String
}

type TextEditResult {
    accepted: Boolean!
    coordinate: EchoCoordinate
    tick: Tick
    receipt: TickReceipt
    obstruction: TextEditObstruction
}

type Mutation {
    replaceTextRange(input: ReplaceTextRangeInput!): TextEditResult!
}
```

That operation is still an Intent. If the editor has a stale base coordinate,
the result should be an obstruction rather than a silent local overwrite.

## Inverse Tick Undo

Undo should append inverse history. It should not delete old ticks.

Example:

```text
C0 = add "h"
C1 = add "e"
C2 = add "l"
C3 = add "l"
C4 = add "o"

projection = "hello"
```

Unapplying `C2` should admit a new inverse operation:

```text
C5 = inverse(C2)

projection = "helo"
history = [C0, C1, C2, C3, C4, C5]
```

The GraphQL-shaped operation should make that explicit:

```graphql
input UnapplyTickInput {
    opticId: ID!
    baseCoordinate: EchoCoordinateInput!
    targetTickId: ID!
    author: String
}

input UnapplyTickSequenceInput {
    opticId: ID!
    baseCoordinate: EchoCoordinateInput!
    targetTickIds: [ID!]!
    author: String
}

type Mutation {
    unapplyTick(input: UnapplyTickInput!): TextEditResult!
    unapplyTickSequence(input: UnapplyTickSequenceInput!): TextEditResult!
}
```

## Braid Projection

The initial braid model for normal editing should be sequential:

```text
baseline + S0 = projection 1
(baseline + S0) + S1 = projection 2
((baseline + S0) + S1) + S2 = projection 3
```

Each next strand forks from the current projection frontier, not from a
separate local patch list. The braid projection is the current file state.

The first useful `jedit` contract should support:

- opening an optic over a worldline alone
- opening an optic over a worldline plus active braid
- reading a bounded text window from the projected braid
- submitting the next edit Intent against the braid frontier
- rejecting or obstructing edits whose base coordinate is no longer admissible

## Preparation Plan

The plan splits into seven executable slices:

1. define the Text File Optic contract surface in GraphQL
2. add a fake Echo Optic transport harness for tests
3. add bounded `textWindow` readings before changing editor rendering
4. route editor mutations through Intent-shaped optic writes
5. add inverse tick and inverse sequence operations
6. model braid-backed file projections
7. cut over from fake/direct clients to generated Wesley/Echo clients later

## Backlog Cut

The backlog cards for this packet are:

- [text-file-optic-contract-surface](../../method/backlog/asap/text-file-optic-contract-surface.md)
- [fake-echo-optic-transport-harness](../../method/backlog/asap/fake-echo-optic-transport-harness.md)
- [bounded-text-window-optic-reader](../../method/backlog/asap/bounded-text-window-optic-reader.md)
- [intent-only-editor-mutation-routing](../../method/backlog/asap/intent-only-editor-mutation-routing.md)
- [inverse-tick-unapply-intents](../../method/backlog/asap/inverse-tick-unapply-intents.md)
- [braid-backed-file-projection-optic](../../method/backlog/asap/braid-backed-file-projection-optic.md)
- [optic-client-generation-cutover](../../method/backlog/asap/optic-client-generation-cutover.md)

## Open Questions

- Is an Optic persistent causal metadata, a session-scoped capability handle,
  or both?
- Which coordinate fields are Echo substrate fields versus contract projection
  fields?
- How should Wesley declare bounded reading budgets so Echo can enforce them
  generically?
- Which inverse operations can be generated from receipts, and which require
  contract-authored inverse logic?
- How much braid projection admission belongs in Echo generic substrate versus
  the `jedit` text contract?
