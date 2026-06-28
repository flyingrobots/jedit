---
title: "WF-0122 - Optimistic Strand Worldline Phases"
legend: "WF"
lane: "design"
issue: "https://github.com/flyingrobots/jedit/issues/158"
status: "superseded"
owners:
  - "@flyingrobots"
created: "2026-06-26"
updated: "2026-06-27"
---

# WF-0122 - Optimistic Strand Worldline Phases

## Linked Issue

- [#158 WF-0122: Optimistic strand worldline phases](https://github.com/flyingrobots/jedit/issues/158) was closed and split after
  [PR #160](https://github.com/flyingrobots/jedit/pull/160) landed the
  JEDIT-side projection posture foundation.

## Outcome

PR #160 landed the JEDIT-side product and architecture slice:

- rapid typing renders through local/session projection without waiting for a
  bounded Echo observation to return;
- bounded Echo readings carry coverage and cannot replace whole editor text;
- local optimistic text remains visible on obstruction;
- speculative edit posture is explicit enough for the UI/history surfaces;
- dependent optimistic edits are blocked when an earlier dependency obstructs;
- worldline/history UI can name canonical, session, speculative, braid, and
  obstructed posture.

The broader WF-0122 cycle is now superseded by focused follow-up issues instead
of remaining open as one umbrella. The remaining native runtime work moved to
[#164 Native Echo speculative intent runtime](https://github.com/flyingrobots/jedit/issues/164).
WF-0108 `:why` will consume this posture when explaining optimistic or
conflicted visible text.

## Decision Summary

Jim should treat fast local typing as an optimistic strand braided with the
current canonical basis, not as dirty text waiting for a filesystem save and
not as a projection that rolls back invisibly when Echo obstructs an intent.

The visible buffer can be a braid:

```text
visible braid = canonical materialized basis + local optimistic intent strand
```

Echo intake, WAL durability, scheduler admission, materialized observation,
retained settlement, and conflict are separate phases. The worldline/history
view should show those phases directly so the user can answer:

- Did Echo receive this intent?
- Is it durable in the WAL?
- Has it been admitted to the canonical causal worldline?
- Has Jim observed/materialized the admitted basis?
- Is replay/settlement evidence retained?
- Am I viewing canonical mainline or an optimistic braid?

## Problem

Classic editor state words like `dirty`, `unsaved`, `failed`, and `rollback`
hide Jim's actual model.

Rapid typing should not wait for Echo scheduler admission, tick
materialization, BTR, or a fresh observed reading before characters appear on
screen. The local UI should draw immediately. Once Echo receives an intent,
the user should be able to see that the local strand is durable even if it is
not yet canonical.

If admission later obstructs, Jim should not erase the local text. The local
optimistic strand remains a causal object the user can inspect, resolve,
braid, admit later, or rewind away explicitly.

## Product Contract

Jim has three different facts that must remain visible:

| Fact | Question | Example |
| --- | --- | --- |
| Display projection | What text am I looking at now? | `braid canonical@104 + local@3` |
| Durability phase | How far did this intent get? | `WAL receipt:r105` |
| Admission phase | Is this canonical worldline data? | `pending`, `admitted`, `conflict` |

The visible editor may show text that is not yet canonical. That is allowed
when the UI names the current projection honestly.

## Phase Vocabulary

These phases should be distinct in lower-mode/statusline text, the history
drawer, `:why`, and future agent surfaces.

| Phase | Meaning | Evidence |
| --- | --- | --- |
| `local` | The UI has projected the edit locally. | Local editor sequence. |
| `unconfirmed` | Submitted from Jim, no Echo receipt yet. | Local request id. |
| `WAL` | Echo intake received and durably recorded intent. | Receipt id. |
| `pending` | WAL-backed intent awaits admission or materialization. | Receipt id. |
| `admitted` | Echo admitted the intent into causal history. | Tick/diff id. |
| `observed` | Jim has read a materialized basis including it. | Reading id. |
| `settled` | Retained witness/checkpoint/hologram exists. | WSC/checkpoint id. |
| `conflicted` | Intent cannot collapse cleanly into canonical. | Obstruction issue. |

`admitted` and `settled` are not synonyms.

```text
admitted = accepted into the causal worldline
settled  = retained replay/materialization evidence exists
```

## Typing Flow

The intended typing path is:

```text
keydown
-> local projection updates immediately
-> optimistic local strand gains an intent node
-> Echo receives the intent
-> intent phase becomes WAL
-> scheduler/admission advances the node
-> materialized observation catches up
-> settlement evidence is retained when available
```

The UI must not require the full path before showing the character.

## Conflict Flow

On obstruction, Jim keeps the local optimistic strand visible and marks the
worldline as conflicted:

```text
canonical: A -- B -- C
                    \
local:               x -- y -- !z

visible braid: C + x + y + z
phase: conflicted at z
```

The user can then choose an explicit action:

- inspect the conflict;
- stay in the optimistic braid;
- fork a named strand from the optimistic projection;
- resolve the conflict into a braid proposal;
- admit the resolved braid;
- rewind the local strand.

No invisible rollback is allowed for a WAL-backed local intent.

## Worldline View

The history drawer should evolve from a flat event list into a compact
worldline rail.

Example:

```text
Worldlines
C  canonical     tick:104     settled      main@104
L  local         intent:107   conflicted   receipt:r107
B  visible       braid        active       canonical@104 + local@3

Graph
C | 101 settled      open notes.md
C | 102 settled      insert "a"
C | 103 settled      insert "b"
C | 104 settled      insert "c"
L \ 105 WAL          insert "X"
L o 106 pending      insert "Y"
L ! 107 conflicted   insert "Z"
B = active braid     canonical@104 + local@105..107
```

The first implementation does not need a full graph renderer. A list with
clear strand labels and phases is enough if it answers the durability and
admission questions.

## Statusline Contract

Lower-mode/statusline text should reveal when the editor is not showing pure
canonical mainline.

Examples:

```text
worldline canonical@104
worldline canonical@104 + local@2 | braid active | WAL:2
worldline canonical@104 + local@3 | conflict intent:107
```

This should sit beside, not replace, filesystem materialization posture.

## `:why` Contract

When the visible text includes optimistic or conflicted local intent, `:why`
should explain the braid rather than pretending the current buffer is pure
canonical text.

Example:

```text
:why
visible buffer: braid canonical@104 + local optimistic strand@3
last intent: insert "Z"
durability: WAL receipt:r107
admission: conflicted
materialization: not observed
next action: inspect, resolve, stay local, braid, admit, or rewind
```

## Small Implementation Slice

The smallest typing-latency improvement should stay aligned with this model:

1. Update local editor projection immediately for insert-mode production keys.
2. Mark the visible projection as optimistic instead of dirty-only.
3. Keep the existing Echo edit command path for receipt/materialization.
4. Do not roll back local text on obstruction.
5. Add history/statusline evidence that the projection is an optimistic braid.
6. Add a regression proving rapid typing updates visible text before Echo
   observe/materialization completes.

This slice can be implemented before the full worldline graph exists.

## Architecture Correction: Speculation Belongs To Echo

Jim/JEDIT must not own a fake pre-Echo predictive strand as durable truth.
JEDIT may render keystrokes immediately, but the causal runtime underneath that
projection must be Echo-owned speculative intent state. The UI should render
projection/status facts; it should not invent an app-local worldline that can
silently diverge from Echo.

The future Echo client runtime should expose speculative causal intents with
receipt/status evidence. Useful intent statuses include:

- `predicted`;
- `submitted`;
- `admitted`;
- `rebased`;
- `blocked`;
- `obstructed`;
- `superseded`;
- `abandoned`.

Useful projection labels include:

- `canonical`;
- `session`;
- `speculative`;
- `braid`;
- `obstructed`.

If one predicted intent obstructs, dependent later intents become blocked,
rebased, superseded, or abandoned through explicit causal records. They must
not disappear through silent rollback. JEDIT can still draw the visible text
quickly, but each rendered speculative edge should have an Echo receipt,
request id, or obstruction status once the runtime can supply it.

Example:

```text
user types: abcdef
a -> admitted as receipt:a
b -> obstructed by footprint check
cdef -> blocked-by-b, rebased, superseded, or abandoned by explicit status
visible text -> remains a named speculative/braid projection until resolved
```

The important rule is that `cdef` cannot later be reported as admitted through
the same dependency chain while `b` remains obstructed. A future Echo
speculative runtime should own the dependency graph and transform/rebase rules.
Until then, JEDIT guardrails must preserve the local projection and mark
dependent local work as blocked rather than silently rolling it back or
claiming it was admitted.

This document records the doctrine and the landed JEDIT-side guardrails. PR #160
does not implement full Echo predictive runtime, full braid resolution, watcher
intake, or conflict UI. It prevents JEDIT from cementing the wrong abstraction
while the projection and save/materialization paths are made safe.

## Non-Goals

- Do not make Git branches or worktrees the live isolation model.
- Do not make filesystem save state the source of truth for local intent.
- Do not hide obstruction by reverting the local projection.
- Do not require every design phase to exist in Echo core before Jim can label
  the UI honestly.

## Relationship To WF-0121

WF-0121 defines the broad strand/braid worldline UX. This document narrows one
critical subproblem: fast local typing and its durability/admission phases.

The design should feed back into:

- the history/worldline drawer;
- lower-mode/statusline posture;
- `:why` provenance;
- agent strand contracts;
- the immediate production typing-latency fix.

## Acceptance Checklist

Closed by PR #160:

- [x] Define typed phase labels for local, unconfirmed, WAL, pending,
      admitted, observed, settled, and conflicted.
- [x] Preserve local visible text on Echo obstruction.
- [x] Surface obstruction as blocked/obstructed projection posture, not silent
      rollback.
- [x] Add rapid typing regression coverage for local projection before bounded
      Echo observations can replace editor text.
- [x] Show canonical, session, speculative, braid, and obstructed posture in
      history/worldline-adjacent surfaces.

Moved to focused follow-ups:

- [ ] Native Echo speculative intent runtime:
      [#164](https://github.com/flyingrobots/jedit/issues/164).
- [ ] Full braid/diff reconciliation UI:
      [#163](https://github.com/flyingrobots/jedit/issues/163).
- [ ] `:why` explanation for optimistic/conflicted visible text:
      [WF-0108 / #131](https://github.com/flyingrobots/jedit/issues/131).
