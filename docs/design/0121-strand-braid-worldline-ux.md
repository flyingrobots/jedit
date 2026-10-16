---
title: "WF-0121 - Strand/Braid Worldline UX"
legend: "WF"
lane: "design"
issue: "https://github.com/flyingrobots/jedit/issues/153"
status: "active"
owners:
  - "@flyingrobots"
created: "2026-06-26"
updated: "2026-09-07"
---

# WF-0121 - Strand/Braid Worldline UX

## Linked Issue

- [#153 WF-0121: Strand/Braid Worldline UX](https://github.com/flyingrobots/jedit/issues/153)

## Decision Summary

Jim should make strands and braids visible as the native editing model.

```text
strand = copy-on-write fork of a file/buffer worldline
braid = witnessed reconciliation across two or more worldlines
```

Every writer, including humans and agents, works on an isolated strand forked
from the canonical worldline. Submission is a braid/admission act. Git and saved
files are on/off ramps, not live truth.

## Product Contract

Jim has three coordinates that must not collapse into one another:

| Coordinate | Question |
| --- | --- |
| Text cursor | Where is the caret in the projected buffer? |
| Observer basis | Which causal moment or strand is being inspected? |
| Admission target | Where would a braid land if admitted? |

The UI must distinguish these states:

| State | Meaning |
| --- | --- |
| `main` | Canonical admitted document worldline. |
| `observe:tNNN` | Historical observation; current head is unchanged. |
| `strand:<name>` | Durable noncanonical fork. |
| `agent:<name>` | Capability-scoped proposal strand. |
| `braid:<name> preview` | Reconciliation candidate, not yet admitted. |

Strand state is not dirty state. A strand can be WAL-backed and recoverable
without being canonical. Dirty/materialization posture only says whether a
chosen worldline projection has been written to the host filesystem.

## Sponsored Human

A writer wants to explore a change in a cheap copy-on-write fork, see that they
are not on canonical mainline, compare the fork against main, and submit it only
when they intentionally braid the strand into the main worldline.

## Sponsored Agent

An agent needs its CLI, MCP, or API edits to land in an isolated proposal
strand with explicit basis, capability, rationale, affected ranges, and
admission path, without creating a Git branch, extra worktree, or direct
canonical edit.

## Hill

By the end of this product lane, Jim can show and report whether the current
view is canonical, historical, strand-backed, agent-proposed, or braid-preview
state, and can route proposal work toward braid/admission instead of Git branch
isolation.

## Scope

This lane includes:

- lower-mode/statusline worldline posture;
- strand/braid graph or list view;
- ahead/behind and fork-basis posture;
- TTD observer command grammar;
- fork-from-history flow;
- CLI/MCP/API agent strand contract;
- braid preview/admission readiness facts;
- explicit separation of dirty/materialization posture from causal ownership.

## Slices

| Slice | Issue | Role |
| --- | --- | --- |
| S1 | [#154](https://github.com/flyingrobots/jedit/issues/154) | Show canonical, strand, historical, and braid posture in the UI. |
| S2 | [#155](https://github.com/flyingrobots/jedit/issues/155) | Add strand and braid graph view with ahead/behind and conflict posture. |
| S3 | [#156](https://github.com/flyingrobots/jedit/issues/156) | Define TTD observer commands and fork-from-history flow. |
| S4 | [#157](https://github.com/flyingrobots/jedit/issues/157) | Define CLI/MCP/API agent strand contracts. |

## Command Grammar

Start explicit before adding terse Normal-mode chords:

```vim
:ttd -1
:ttd +1
:ttd 1842
:ttd head
:ttd here
:strand new <name>
:strand new from here
:strand switch <name>
:strand list
:braid view
:braid preview <strand>
:braid admit <strand>
```

### Implementation status

This grammar was implemented once against the local text authority and removed
with it in `a05cb427` (2026-07-16, "Refactor: remove local text authority",
-50,419 lines). `worldline-state.ts` and `jedit-agent-strand-contract.ts` no
longer exist. The commands survive in the catalog and dispatch to
`dispatchCausalCommandUnavailable`, which reports "Echo operation unavailable"
rather than pretending to work.

Slices S1-S4 (#154-#157) were closed against that removed implementation, so
the closed issues do not describe the current tree.

What remains standing:

- `src/app/workspace/command-line-dispatch.ts` still routes `:ttd`, `:strand`
  and `:braid`; only the handler behind them is gone.
- `src/app/workspace/workspace-command-catalog.ts` still carries the grammar,
  help text and completions.
- `src/ui/workspace-chrome.ts` keeps causal posture and filesystem
  materialization visible as distinct footer facts, now via
  `workspace-buffer-durability.ts`.

What re-implementation needs, against the real Echo host rather than a local
simulation:

- **`:ttd`** is closest. `EchoTextHostObserveRequest` already takes a
  `basisHeadId` and `EchoTextHostObserved` already returns
  `resolvedWorldlineTick`, so observing an arbitrary point is supported today.
  The gap is enumeration: nothing maps a tick back to a head id, so `-1` and
  `1842` cannot be resolved to a basis. That needs one new host operation.
- **`:strand list` / `:braid view`** need a topology query. The host port
  exposes four operations -- `openBuffer`, `replaceRange`, `declareCheckpoint`,
  `observeWindow` -- and none of them enumerate strands or braids.
- **`:strand new` / `:strand switch` / `:braid preview` / `:braid admit`** need
  topology mutation. What is verified: flyingrobots/echo#604, "GP6: Treat
  strand, braid, and suffix topology as WAL-backed intents", was closed as
  COMPLETED on 2026-06-26, and its stated contract is that topology-changing
  operations become admitted causal history rather than side-channel runtime
  state. What is not verified from this repo: the concrete intent and receipt
  definitions in Echo's current tree, and whether jedit's Echo host can reach
  them. Confirm both against Echo before planning against this.

Normal-mode shortcuts can follow after the command semantics are proven:

```vim
g-    observe previous causal tick
g+    observe next causal tick
gS    create strand from current observer basis
gb    open strand/braid view
gB    preview braid for current strand
```

## Agent Contract Sketch

Agent interfaces should make the private strand explicit:

```json
{
  "agentId": "codex",
  "sessionId": "agent-session-42",
  "basis": "main@t1904",
  "strand": "agent/codex/session-42",
  "admissionTarget": "main",
  "intent": {
    "kind": "replaceRange",
    "path": "src/foo.ts"
  }
}
```

Required operations:

- `jim.agent.openSession`
- `jim.agent.submitIntent`
- `jim.agent.readProjection`
- `jim.agent.diffStrand`
- `jim.agent.explainIntent`
- `jim.agent.previewBraid`
- `jim.agent.requestAdmission`

Agents may propose into isolated durable strands. Only braid/admission changes
canonical mainline.

Anchor status:

- `src/ports/jedit-agent-strand-contract.ts` defined this contract and was
  removed in `a05cb427`. No agent strand port exists in the current tree.

## Echo Dependency

This product lane depends on Echo treating topology changes as causal history.
The Echo-side owner issue is
[flyingrobots/echo#604](https://github.com/flyingrobots/echo/issues/604), which
was closed as COMPLETED on 2026-06-26. That the goalpost closed is verified;
that the substrate is reachable from jedit is not, and is the first thing to
check before planning against it.

## Follow-On Design

- [WF-0122 - Optimistic Strand Worldline Phases](0146-optimistic-strand-worldline-phases.md)
  narrows the local typing case: rapid user input should render as an
  optimistic strand braided with the canonical basis, with WAL, pending,
  admitted, observed, settled, and conflicted phases surfaced in the
  worldline view.

Jim can prototype UI affordances before the full substrate lands, but it must
label any missing Echo recovery posture honestly.

## Non-Goals

- Do not implement this inside WF-0108 except for wording corrections in the
  trust preflight.
- Do not use Git branches or worktrees as Jim's native writer isolation.
- Do not label durable noncanonical strands as dirty/unsafe.
- Do not bypass Echo receipts, WAL recovery posture, or braid admission.
