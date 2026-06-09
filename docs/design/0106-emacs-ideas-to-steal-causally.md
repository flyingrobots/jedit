---
title: "WF-0106 - Emacs Ideas To Steal Causally"
legend: "WF"
lane: "design"
issue: "TBD"
status: "draft"
owners:
  - "@flyingrobots"
created: "2026-06-09"
updated: "2026-06-09"
---

# WF-0106 - Emacs Ideas To Steal Causally

## Linked Issue

- TBD - open before implementation starts.

## Decision Summary

Jim should keep Vim as the editing grammar, but steal selected Emacs ideas as
causal affordances around that grammar: command discovery, self-documentation,
buffer and mode surfaces, kill-ring-like register history, programmable command
composition, macros, and project tools. Each borrowed idea must become
strand-aware, braid-aware, and evidence-bearing instead of becoming hidden
mutable editor state.

## Sponsored Human

A modal editor user wants the discoverability and programmable workspace power
associated with Emacs so that Jim can grow beyond raw Vim key parity, without
losing Vim's compact command language or Echo's causal truth.

## Sponsored Agent

An agent needs command, buffer, mode, register, macro, and strand facts so it can
inspect and exercise advanced editor behavior through stable JSON and witness
surfaces, without scraping visual-only menus or guessing hidden editor state.

## Hill

By the end of this exploration, Jim has a prioritized idea map for Emacs-like
features, and every accepted idea states its causal representation, proof
surface, failure posture, and relationship to the WF-0105 Vim grammar.

## Current Truth

WF-0105 is the active power-moves plan:

- [0105 Vim Power Moves Causal Parity](0105-vim-power-moves-causal-parity.md)
- [0105 Vim Power Moves Parity Matrix](0105-vim-power-moves-parity-matrix.json)
- [0105 Vim Power Target Usability Fixtures](0105-vim-power-target-usability-fixtures.json)

That plan intentionally centers Vim's modal command grammar. It also names
causal enhancements such as strand preview, braid comparison, receipt-bearing
macros, causal registers, causal marks, and transformed repeat. This document
does not replace that plan. It gives Jim a way to borrow the useful Emacs
surface area without turning Echo into an editor-specific runtime.

## Problem

Vim gives Jim a powerful editing language, but Vim alone does not solve every
editor workflow:

- users need discoverability before grammar fluency forms;
- agents need command metadata rather than terminal-only clues;
- large projects need buffer, mode, diagnostics, and task surfaces;
- repeated transformations need macro and script inspection;
- causal strands need a product surface that is not Git, not worktrees, and not
  a hidden local undo stack.

Emacs is strong in these areas, but classic Emacs also carries a lot of hidden
mutable process state. Jim should steal the product shape, not the mutability
model.

## Scope

This exploration includes:

- Emacs-style command discovery and self-documentation.
- Buffer and mode concepts as jedit-owned app state.
- Kill-ring lessons for causal registers.
- Keyboard macro and command-script lessons.
- Project and diagnostic surfaces inspired by Emacs packages.
- Debugging surfaces inspired by GUD, Edebug, and compilation buffers.
- Causal strand and braid opportunities attached to each idea.

## Non-Goals

This exploration does not include:

- Implementing Emacs keybindings.
- Embedding Emacs Lisp.
- Replacing Vim grammar with Emacs command chords.
- Teaching Echo about editors, Vim, Emacs, buffers, or projects.
- Designing a full plugin runtime.
- Claiming runtime support before witnesses exist.
- Claiming deterministic time-travel debugging for arbitrary non-Echo programs.

## Causal Borrowing Rule

An Emacs idea is eligible only if it can answer:

1. What is the user-facing capability?
2. What is the jedit-owned semantic model?
3. What Echo evidence, receipt, retained material, or basis supports it?
4. How does it preview, fork, braid, admit, obstruct, or replay?
5. What JSON or CLI witness can prove the behavior?

If the answer is "local mutable editor state," the idea is not ready.

## Ideas To Steal

- `M-x` command execution: steal discoverable named commands. In Jim, command
  palette execution emits typed `JimCommandIntent` facts with effect class,
  basis needs, preview policy, and replay posture. First proof: JSON command
  catalog lists effect class and supported lower mode.
- `describe-key`: steal key explanation. In Jim, a chord inspector parses the
  active key prefix and reports possible Vim grammar continuations plus causal
  consequences. First proof: `di"` reports operator, text object, register,
  basis, and obstruction policy.
- `describe-function`: steal command contract docs. In Jim, command docs are
  generated from command metadata, including Echo boundary and proof commands.
  First proof: static spec checks every public command has metadata.
- Which-key-like prefix help: steal legal-next-key guidance. In Jim, prefix help
  reads the same grammar table as execution and never invents UI-only shortcuts.
  First proof: `d` prefix lists motions/text objects without mutating text.
- Buffers: steal multiple work surfaces. In Jim, buffer identity is jedit state
  over Echo-backed text heads, readings, and export targets. First proof: agent
  lists buffers with basis, dirty posture, and retained reading refs.
- Major modes: steal file/domain behavior. In Jim, modes are app-owned command,
  filter, and highlight packs over readings, not Echo behavior. First proof:
  mode report says which commands are enabled and why.
- Minor modes: steal optional behavior toggles. In Jim, minor modes are explicit
  capability toggles with command metadata deltas and receipt-visible effects
  when they mutate. First proof: toggle witness records mode transition and
  affected command catalog rows.
- Kill ring: steal killed/yanked text history. In Jim, registers gain ring
  posture: each entry carries shape, source basis, range set, digest, retained
  material ref, and producing receipt. First proof: register witness cycles
  entries and proves provenance.
- Keyboard macros: steal record and replay culture. In Jim, macros are causal
  scripts of parsed semantic commands plus bounded raw insert spans, and replay
  stops on typed obstruction. First proof: replay witness reports applied count,
  receipts, and obstruction entry.
- Undo tree: steal edit alternative navigation. In Jim, undo/redo are explicit
  inverse causal inputs; alternate edits are strands, not hidden snapshots.
  First proof: witness previews two heads and braids selected intent.
- Dired: steal file operations as an editor surface. In Jim, file browser
  commands emit explicit filesystem intents with preview, confirmation, and
  host-bound proof. First proof: dry-run file command witness shows planned host
  operations.
- Magit: steal structured VCS control. In Jim, future VCS UI should be a causal
  strand/braid dashboard, not a shell wrapper. First proof is deferred until Jim
  has local strand views.
- Org mode: steal structured documents and tasks. In Jim, Graft-backed
  structural text objects expose headings, blocks, TODO states, and ranges as
  causal anchors. First proof: structural text-object witness resolves heading
  range on a reading basis.
- Compilation buffer: steal navigable build/test diagnostics. In Jim, command
  output becomes a diagnostic buffer with links to command, workspace basis, and
  file anchors. First proof: witness stores diagnostics and jumps by anchor.
- GUD and Edebug: steal debugger-in-editor ergonomics. In Jim, debugger events
  become causal trace entries with source anchors, process facts, breakpoints,
  and command receipts. First proof: debug trace witness can step through a
  recorded session and jump to source anchors.
- REPL integration: steal interactive process transcripts. In Jim, REPL
  sessions are external process facts with input/output transcripts, not Echo
  execution authority. First proof: transcript witness records command, output,
  and linked buffer basis.

## Product Shape

Jim should feel like:

```text
Vim for editing grammar.
Emacs for discoverability and programmable workspace surfaces.
Echo for strands, braids, receipts, and durable causality.
```

The user does not need to think in Git branches or worktrees. Broad edits,
macros, search replacements, and agent suggestions become previewable strands.
The user can compare alternatives as braids and admit the useful slices into the
current worldline.

## Debugging DX

Jim can become a strong debugging surface because Echo already makes causality a
first-class product concept. The near-term goal is a small warp-time-travel-like
debugger for Echo-backed behavior: browse submissions, readings, receipts,
obstructions, retained evidence, and basis changes from inside the editor.

The broader opportunity is debugging non-Echo systems with causal recording.
That must be honest about replay levels:

| Level | Name | Contract |
| --- | --- | --- |
| 0 | Trace inspection | Jim records events, output, logs, anchors, and commands for navigation only. |
| 1 | Deterministic rerun | Jim reruns a command under a recorded environment and compares outputs. |
| 2 | Adapter replay | Jim replays recorded IO through explicit mocks or adapters. |
| 3 | Runtime TTD | Jim controls checkpoints, stepping, and reversal only when the runtime supports it. |

For non-Echo programs, Jim should start at levels 0 and 1. Transcript replay is
not the same as deterministic time travel. A non-Echo debug trace should carry:

- command line and working directory;
- environment digest and selected materialized environment fields;
- input stream chunks and output stream chunks;
- process exit facts;
- source anchors for diagnostics, stack frames, and breakpoints;
- wall-clock timing as diagnostic metadata only;
- content hashes for artifacts read or produced during the run;
- a replay posture: inspect-only, rerunnable, adapter-replayable, or TTD.

The editor payoff is high: a user can jump from a failing test to source, inspect
the causal trace that produced the failure, run a patch as a strand, compare the
new trace as a braid, and admit only the useful edit slices. For Echo-backed
systems, Jim can go deeper by showing actual Echo receipts and bases. For
non-Echo systems, Jim still provides an honest causal wrapper around what was
observed and what can be replayed.

## Runtime / API Contract Sketch

```text
JimCommandCatalog = {
  commands: JimCommandDescriptor[]
}

JimCommandDescriptor = {
  id: string,
  names: string[],
  keyForms: string[],
  effect: "readOnly" | "navigation" | "textMutation" | "appState" | "hostEffect",
  vimGrammar?: VimGrammarShape,
  modeScope: string[],
  basisPolicy: "none" | "readingRequired" | "transactionRequired",
  previewPolicy: "none" | "available" | "required",
  replayPolicy: "notReplayable" | "semanticReplay" | "rawSpanReplay",
  proof: string[]
}
```

Command discovery and prefix help must consume this catalog. Runtime execution
must still go through the WF-0105 Vim grammar and jedit-owned command ports.

## Strand And Braid Opportunities

| Workflow | Strand opportunity | Braid opportunity |
| --- | --- | --- |
| `:%s/foo/bar/g` | Preview all replacements before admission. | Admit only selected replacement rows. |
| Macro replay | Run replay as a provisional strand. | Compare replay over old basis and transformed basis. |
| Register paste | Paste retained material as a causal insertion intent. | Compare multiple register entries before admission. |
| Project rename | Model rename as broad preview strand. | Braid accepted file/range slices into current work. |
| Agent suggestion | Treat suggestion as external strand with evidence. | Compare human and agent edits without checkout. |
| Format buffer | Preview formatter output as one strand. | Admit chunks rather than the whole formatter result. |
| Build fix loop | Diagnostics become causal anchors. | Braid fixes that satisfy diagnostics into current head. |
| Debug trace | Record observed execution as a causal trace. | Compare failing and fixed traces as a braid. |

## Brainstorm Slices

### Slice 1: Command Discovery And Self-Documentation

- Define the command catalog shape.
- Map Vim grammar entries and command-line commands into descriptors.
- Add describe-key and describe-command target witness examples.
- Keep execution unchanged.

### Slice 2: Buffers, Modes, And Register History

- Define buffer and mode facts as jedit-owned app state over Echo-backed text
  evidence.
- Extend register doctrine with kill-ring-style history without replacing Vim
  register names.
- Add target fixtures for register cycling and mode report output.

### Slice 3: Causal Scripts, Diagnostics, And Strand Workflows

- Define macros as semantic causal scripts.
- Define diagnostic buffers as external command transcripts with anchors.
- Define debug traces with honest replay levels for Echo and non-Echo systems.
- Add target fixtures for macro replay, substitution preview, and project-wide
  braid admission.

## Acceptance Criteria

- Emacs-inspired features do not alter the WF-0105 commitment to Vim grammar.
- Every accepted idea has a causal representation and first proof surface.
- Echo remains generic and receives no editor-specific nouns.
- Ideas that require host effects, plugins, or external processes are explicitly
  lower-priority until local command catalog and register/macro proof exists.

## Validation Plan

```bash
npx --yes markdownlint-cli2 \
  docs/design/0106-emacs-ideas-to-steal-causally.md \
  docs/design/0105-vim-power-moves-causal-parity.md
node --test --test-concurrency=1 spec/design-cycle-policy.spec.mjs
npm run --silent quality
git diff --check
```

## Retrospective

To fill when this design lands or is superseded.
