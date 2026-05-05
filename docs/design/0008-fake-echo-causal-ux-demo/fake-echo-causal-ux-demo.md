---
title: "fake-echo-causal-ux-demo"
legend: "none"
cycle: "0008-fake-echo-causal-ux-demo"
source_backlog: "conversation: fake-echo-causal-ux-demo"
---

# fake-echo-causal-ux-demo

Source backlog item: `conversation: fake-echo-causal-ux-demo`
Legend: none

## Purpose

Define the first fake Echo demo that lets `jedit` test causal editor UX before
the real Echo Optic API is ready.

This packet is not a shortcut around Echo. It is a way to make the app boundary
honest early, so the human can judge the editor's feel while the runtime
substrate catches up.

The demo should let us test:

- bounded source reading
- Intent-shaped editing
- receipt and obstruction posture
- save as checkpoint
- proposal as strand
- causal panes as Optic views
- calm footer and drawer behavior around causal state

The goal is a usable feedback loop, not a polished feature checklist.

## Design Lineage

This packet continues the direction set by:

- [optic-backed-file-model](../0006-optic-backed-file-model/optic-backed-file-model.md)
- [jedit-v1-experience](../0007-jedit-v1-experience/jedit-v1-experience.md)
- [runtime-temperatures](../runtime-temperatures.md)

It also inherits Bijou standards already adopted in the v1 packet:

- focus owns input
- visible controls are a promise
- density requires rhythm
- the shell is a product
- AI surfaces must explain
- docs are a proving surface

The design stance is calm and strict:

- the central editor stays quiet
- causal truth stays inspectable
- advanced state appears only where it helps the user's next decision
- fake runtime machinery does not leak into the product surface

## One Sentence

Build a fake Echo causal editing demo that is fake underneath but Echo-shaped at
the `jedit` boundary.

## Hill

At the end of this cycle, a user should be able to run `jedit`, open a file,
edit it, checkpoint it, receive a proposed edit, preview the proposal in a
causal view, and accept or reject it while every file mutation routes through
an Intent-shaped fake Echo transport.

The demo is successful when the human can give product feedback on the feel of
the causal editor, not only on the implementation architecture.

## Playback Questions

### Human

- [ ] Does the editor still feel zen by default?
- [ ] Does causal state clarify without turning into a debug console?
- [ ] Does the footer say enough about checkpoint and obstruction posture?
- [ ] Does a proposal feel like a governed change instead of a hidden edit?
- [ ] Does previewing a proposal or checkpoint feel spatially stable?
- [ ] Does the user know what owns input in every demo state?
- [ ] Does dismissing a pane, drawer, proposal, or notice feel predictable?

### Agent

- [ ] The app-facing demo path talks to a fake Echo transport, not to a direct
  mutable text runtime.
- [ ] Reads are bounded readings with basis and budget.
- [ ] Writes are Intent submissions with base coordinates.
- [ ] Accepted writes advance from receipts and follow-up readings.
- [ ] Stale writes return obstructions with a calm user-facing path.
- [ ] Save produces checkpoint posture, not Git authority.
- [ ] Proposal preview and admission use strand-like vocabulary.
- [ ] UI tests can exercise the path without needing the real Echo repo.

## Current Starting Point

`jedit` already has three important pieces:

- a calm terminal editor shell
- a large-file fix that removed the old eager-load cap
- a GraphQL-shaped `jedit` Optic client seam

That is enough to begin the demo, but not enough to prove the future model.

The current risk is that we make the editor nicer while leaving the authority
model local and string-shaped. That would make the later Echo cutover harder.

The design pass should pull the opposite way:

```text
real jedit UI
  -> real app ports
  -> TextFileOptic client
  -> EchoWasmKernelTransport-shaped adapter
  -> fake Echo jedit contract host
  -> temporary in-memory causal text runtime
```

Only the last box is fake. The app boundary should already feel like Echo.

## Core Decision

The demo should be fake in implementation and real in architecture.

Fake means:

- the contract host may live inside `jedit`
- the host may materialize full text internally when needed
- ticks, coordinates, strands, and checkpoints may use simple local identity
- persistence may be session-only
- no real Wesley compilation is required for the first pass

Real means:

- the editor does not mutate canonical text directly
- every user-facing file write is an Intent-shaped submission
- every source paint uses a reading-shaped result
- every result carries basis, receipt, obstruction, or checkpoint posture
- every proposal is modeled as a strand-like candidate, not as a hidden patch
- decoding happens at the adapter boundary
- the future real Echo adapter can replace the fake without redesigning the UI

## Demo Honesty Rules

### 1. The UI Does Not Know The Runtime Is Fake

The UI should not branch on fake runtime details. It should know about product
objects:

- open file
- text window reading
- cursor
- viewport
- receipt
- obstruction
- checkpoint
- proposal
- pane

The fake host can cheat internally. The editor cannot.

### 2. Reads Are Observations

A source read is not "give me the file string."

It is:

```text
observe this optic, from this basis, with this cursor, viewport, and budget
```

The normal paint path should consume a `TextWindowReading`.

### 3. Writes Are Intents

Typing, paste, delete, replace, checkpoint, proposal acceptance, and targeted
unapply all enter the file model as Intents.

The demo may group many keystrokes into one edit event for feel. It must not
turn that group into a direct setter.

### 4. Receipts Drive Confidence

The editor should advance its causal posture from receipts, not from optimism.

After an edit:

```text
Intent submitted
  -> receipt accepted
  -> reading refreshed
  -> footer posture updates
```

If the basis is stale:

```text
Intent submitted
  -> obstruction returned
  -> editor keeps current reading
  -> footer gives one calm recovery path
```

### 5. Git Is Not In The Demo Spine

Git may appear later as export or ecosystem context. It should not define save,
dirty state, undo, proposal state, or history in this demo.

The demo spine is Echo-shaped:

```text
edit = tick or edit group
save = checkpoint
proposal = strand
comparison = reading over two coordinates
acceptance = admission
file = projection
Git commit = export, outside this spine
```

## First Demo Spine

The first demo should prove this path:

```text
Open
  -> Read Window
  -> Edit
  -> Receipt
  -> Checkpoint
  -> Proposal
  -> Preview
  -> Accept
```

This is intentionally narrow. It covers the product concepts that need human
feedback while avoiding a broad feature sweep.

### Open

Opening a file creates a `TextFileOptic` focus.

The UI should receive:

- file identity
- optic identity
- coordinate or named frontier
- capability posture

The first screen should still feel like opening an ordinary editor.

### Read Window

The editor asks for visible lines plus a small margin.

The reading should include:

- basis coordinate
- start line
- line count
- total line count
- line text
- line spans
- before and after continuation flags

Large files should feel normal in this path.

### Edit

A typed burst or paste becomes an Intent with a base coordinate.

For the demo, it is acceptable to coalesce typing into humane edit groups. The
grouping should serve undo and explanation, not runtime convenience alone.

### Receipt

The host returns an accepted receipt or obstruction.

The happy path should feel invisible. The footer may briefly acknowledge the
accepted edit group, then return to ordinary mode and checkpoint posture.

### Checkpoint

Save creates a checkpoint and may materialize the filesystem projection.

The user-facing posture should be:

```text
saved at checkpoint C12
ahead by 0 edits
```

After a later edit:

```text
checkpoint C12
ahead by 1 edit
```

The footer must not imply Git authority.

### Proposal

A larger suggestion appears as a proposal strand.

The first version can be local and deterministic:

- wrap selected text
- rename a repeated local token in a small fixture
- apply a formatting-like text transform
- insert a short suggested block

The proposal should have:

- basis coordinate
- affected range
- summary
- preview reading
- accept action
- reject action

### Preview

Preview should use a causal pane, not a permanent IDE split.

Good first previews:

- current vs proposal
- current vs checkpoint
- affected range only

The preview pane owns input while focused. The footer changes with it.

### Accept

Accepting a proposal submits an admission Intent.

The editor should advance from the resulting receipt and reading.

Rejecting a proposal should dismiss it without mutating the file.

## UX Surface Model

### Main Editor

The editor remains the default surface.

It shows:

- text
- cursor
- selection
- optional quiet markers
- no permanent causal log

Causal data should not occupy the main text area unless it is directly tied to
the region being edited.

### Footer

The footer carries operational truth.

It can show:

- mode
- focused region
- checkpoint posture
- short receipt or obstruction status
- one or two working controls

It should avoid:

- tick spam
- long coordinate strings
- Git-shaped dirty language
- controls for covered or inactive panes

### Notice

Use a short notice for transient receipt or obstruction feedback.

Examples:

```text
Edit accepted
Checkpoint C12
Edit obstructed: file changed since this reading
```

The notice should not become an activity stream in the first demo.

### Proposal Surface

The proposal surface should be compact.

It should answer:

- what will change?
- where?
- from what basis?
- what are the choices?

It should not read like an AI chat transcript.

### Causal Pane

A causal pane is an Optic view with a subject and basis.

First subjects:

- proposal preview
- checkpoint comparison
- same file, different viewport

The pane is useful when it gives the user a decision surface. It is not a
layout decoration.

### Drawer

The drawer is for inspection, not for proving the demo exists.

It may show:

- proposal details
- checkpoint events
- obstruction explanation
- coordinate details when explicitly requested

The default demo should not open with the drawer.

## GraphQL-Shaped Demo Contract

The fake does not need final Echo bytes yet, but it should be shaped like the
future Wesley-authored contract.

### Query A Text Window

```graphql
query TextWindow($input: TextWindowInput!) {
  textWindow(input: $input) {
    opticId
    readingId
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

### Submit A Text Edit Intent

```graphql
mutation ReplaceTextRange($input: ReplaceTextRangeIntentInput!) {
  replaceTextRange(input: $input) {
    outcome
    receipt {
      tickId
      coordinate {
        worldlineId
        strandId
        braidId
        tickId
      }
      editGroupId
      summary
    }
    obstruction {
      reason
      basisCoordinate {
        worldlineId
        tickId
      }
      currentCoordinate {
        worldlineId
        tickId
      }
      recovery
    }
  }
}
```

### Create A Checkpoint

```graphql
mutation CreateCheckpoint($input: CreateCheckpointIntentInput!) {
  createCheckpoint(input: $input) {
    outcome
    checkpoint {
      checkpointId
      coordinate {
        worldlineId
        braidId
        tickId
      }
      label
    }
    receipt {
      tickId
      summary
    }
  }
}
```

### Create And Preview A Proposal

```graphql
mutation CreateTextProposal($input: CreateTextProposalIntentInput!) {
  createTextProposal(input: $input) {
    outcome
    proposal {
      proposalId
      basisCoordinate {
        worldlineId
        tickId
      }
      proposalCoordinate {
        worldlineId
        strandId
        tickId
      }
      affectedRange {
        startByte
        endByte
      }
      summary
    }
  }
}

query ProposalPreview($input: ProposalPreviewInput!) {
  proposalPreview(input: $input) {
    proposalId
    basisReadingId
    previewReadingId
    diffReadingId
    affectedStartLine
    affectedLineCount
  }
}
```

### Admit A Proposal

```graphql
mutation AdmitProposal($input: AdmitProposalIntentInput!) {
  admitProposal(input: $input) {
    outcome
    receipt {
      tickId
      coordinate {
        worldlineId
        braidId
        tickId
      }
      summary
    }
    obstruction {
      reason
      recovery
    }
  }
}
```

These examples are planning targets. The fake host can implement only the
fields required by the first demo, but the names should keep the future shape
visible.

## Demo Scenarios

### Scenario 1: Large File Opens Calmly

The user opens a large file.

Expected feel:

- first paint is quick
- scrolling requests more windows
- the footer remains ordinary
- there is no "loading whole file" anxiety

Implementation proof:

- the public read result is bounded
- tests assert that source paint does not need a full-file string

### Scenario 2: Edit Accepted

The user types into the file.

Expected feel:

- typing feels normal
- footer does not chatter for every keystroke
- after a grouped event, checkpoint posture updates

Implementation proof:

- edit submits an Intent with a base coordinate
- receipt advances editor posture
- follow-up reading paints the changed window

### Scenario 3: Stale Edit Obstructed

The fake host advances a file behind the current reading.

The user submits an edit against the old basis.

Expected feel:

- the edit is not silently lost
- the editor explains the obstruction in one calm line
- the user has a clear recovery path

Implementation proof:

- stale basis returns an obstruction
- UI keeps its current reading until a recovery action refreshes or reapplies

### Scenario 4: Save Creates Checkpoint

The user saves.

Expected feel:

- save feels familiar
- the footer says checkpoint truth
- disk write is a projection detail, not the whole story

Implementation proof:

- save submits checkpoint Intent
- checkpoint identity is returned
- dirty posture compares current coordinate to checkpoint coordinate

### Scenario 5: Proposal As Strand

The user asks for or receives a larger suggestion.

Expected feel:

- the text is not rewritten without consent
- proposal scope is obvious
- preview is focused
- accept and reject are both cheap

Implementation proof:

- proposal has a basis coordinate
- proposal preview is a reading
- accept submits an admission Intent
- reject only dismisses the proposal

### Scenario 6: Causal Pane

The user previews current vs checkpoint or current vs proposal.

Expected feel:

- the pane appears only when useful
- focus ownership is obvious
- dismissing returns to the editor cleanly

Implementation proof:

- pane content is an Optic reading
- footer hints change while the pane owns input
- no inactive pane advertises controls

## Build Sequence

1. Fake Echo Optic transport harness
2. Bounded text-window reader
3. Intent-only editor mutation routing
4. Fake causal demo spine
5. Checkpoint footer posture
6. Proposal strand demo
7. Causal Optic pane demo

This sequence keeps the implementation honest. The early tasks prove the
boundary. The later tasks create the surfaces the human can judge.

## Backlog Cut

Existing foundation cards:

- [fake-echo-optic-transport-harness](../../method/backlog/asap/fake-echo-optic-transport-harness.md)
- [bounded-text-window-optic-reader](../../method/backlog/asap/bounded-text-window-optic-reader.md)
- [intent-only-editor-mutation-routing](../../method/backlog/asap/intent-only-editor-mutation-routing.md)
- [inverse-tick-unapply-intents](../../method/backlog/asap/inverse-tick-unapply-intents.md)
- [braid-backed-file-projection-optic](../../method/backlog/asap/braid-backed-file-projection-optic.md)

New demo cards from this pass:

- [fake-echo-causal-ux-demo-spine](../../method/backlog/asap/fake-echo-causal-ux-demo-spine.md)
- [checkpoint-footer-posture](../../method/backlog/asap/checkpoint-footer-posture.md)
- [proposal-strand-demo](../../method/backlog/asap/proposal-strand-demo.md)
- [causal-optic-pane-demo](../../method/backlog/asap/causal-optic-pane-demo.md)

## Human Feedback Targets

This demo should make it easy to answer product questions:

- Is the causal footer too quiet, too loud, or just right?
- Should checkpoints appear as labels, counts, or short status text?
- Does obstruction recovery feel helpful or accusatory?
- Does proposal preview need a pane, drawer, inline marker, or palette action?
- How much proposal basis should be visible by default?
- Does accepting a proposal feel like editing or like approving a patch?
- Do causal panes feel like editor power or layout clutter?
- Does the editor preserve the current zen feeling after these features exist?

The first pass should favor less chrome. If the human asks "where did it go?"
we can reveal more. If the human asks "why is the editor yelling?" we already
added too much.

## Acceptance Bar

This design is working when:

- the demo can be built before real Echo lands
- the app boundary is already Echo-shaped
- the central editor remains calm
- every file mutation in the demo submits an Intent-shaped request
- every visible state has a user-facing reason
- proposal and checkpoint flows can be judged by feel
- the fake can be deleted later without changing the product model
- tests describe the boundary, not fake runtime internals

## Non-Goals

- Implementing real Echo persistence.
- Implementing real Wesley compilation inside this repo.
- Designing the full causal time rail.
- Designing complete multi-strand merge UI.
- Making Git part of the demo's source of truth.
- Turning the demo into a debug inspector.
- Solving every large-file caching policy.
