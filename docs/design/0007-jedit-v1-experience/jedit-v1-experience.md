---
title: "jedit-v1-experience"
legend: "none"
cycle: "0007-jedit-v1-experience"
source_backlog: "conversation: jedit-v1-feel-and-causal-features"
---

# jedit-v1-experience

Source backlog item: `conversation: jedit-v1-feel-and-causal-features`
Legend: none

## Purpose

Define how `jedit` v1 should feel, what product promises it should make, and
which causal features deserve explicit design work.

This packet is product-facing. It gives the Echo, Optic, rope-worldline, and
Wesley contract work a user-facing reason to exist.

## Design Lineage

This document takes inspiration from the Bijou documentation under
`~/git/bijou/docs`, especially:

- `docs/strategy/bijou-vision.md`
- `docs/strategy/bijou-ux-doctrine.md`
- `docs/strategy/humane-shell.md`
- `docs/strategy/content-guide.md`
- `docs/design-system/foundations.md`
- `docs/design-system/patterns.md`
- `docs/invariants/focus-owns-input.md`
- `docs/invariants/visible-controls-are-a-promise.md`
- `docs/invariants/docs-are-the-demo.md`
- `docs/strategy/ai-explainability-standard.md`

The inheritance is not visual imitation. The important standards are:

- calm over noise
- explicit ownership over hidden magic
- focus as input ownership
- visible controls as operational truth
- shell and chrome as product surfaces
- density with rhythm
- AI as governed assistance
- documentation as a proving surface

## One Sentence

`jedit` v1 should feel like a quiet terminal editor that happens to understand
causality.

## Product Stance

`jedit` is a terminal-native editor for people who want their working surface
to stay calm while the system underneath remains precise, inspectable, and
causal.

It should not become a browser IDE in a terminal.

It should not fill the screen with permanent panels to prove that it is
powerful.

It should make power available as focused views, drawers, lenses, Optics, and
reviewable proposals. The central editor should remain quiet by default.

## What `jedit` Is

`jedit` is:

- a keyboard-first terminal editor
- a calm source-editing workspace
- an Echo-ready causal editing surface
- a proving ground for Optic-backed file interaction
- a humane shell over source, search, diagnostics, tests, suggestions, and
  history
- an editor where the user can understand what owns input and what changed

`jedit` is not:

- a terminal clone of VS Code
- a pile of panes around a text area
- a chat app with an editor attached
- a Git UI pretending to be the source of editor truth
- an AST workbench that only works when code parses
- an editor that hides mutation behind auto-applied suggestions

## Users

The primary user is a developer working inside a real repository.

They want to open files quickly, edit without friction, search and navigate
with confidence, understand diagnostics without being shouted at, preview
suggestions before accepting them, and trust undo, save, and dirty state.

The secondary user is a future agent, plugin, or integration that needs to
interact with editor state without relying on folklore.

They need declared Optics, bounded readings, causal coordinates, Intent-only
mutations, receipts, checkpoints, proposals, and deterministic surfaces that
can be tested.

## The Feeling Promise

`jedit` should feel:

- quiet
- fast
- deliberate
- spatially stable
- honest about focus
- forgiving without being vague
- powerful without visual pressure

It should not feel:

- noisy
- tutorialized all the time
- covered in permanent panels
- clever at the cost of trust
- dependent on hidden background mutation
- afraid to show consequences when the user asks

## Product Principles

### 1. The Text Surface Is Sacred

The main editor is the primary surface. Everything else is a lens, drawer,
pane, rail, or temporary layer over the user's current task.

### 2. Focus Owns Input

The active region owns local controls. Footer hints, help, and visible controls
must follow the same truth.

### 3. Visible Controls Are A Promise

If `jedit` shows a key hint, that key should work right now for the active
layer or region. Missing hints are acceptable. Dead hints are not.

### 4. Power Appears On Demand

Search, help, diagnostics, suggestions, tests, Git context, history, and
settings should appear as focused surfaces with clear entry and exit.

### 5. Density Requires Rhythm

Terminal density is useful. It still needs air. Rows, gutters, panes, and
footer hints should read as intentional, not compressed.

### 6. Causality Should Clarify

The user should not have to learn Echo to edit a file. Causal features should
answer practical questions:

- what changed?
- why is this stale?
- what would happen if I apply this?
- can I preview the earlier state?
- which checkpoint am I ahead of?

### 7. Suggestions Are Proposals

Completions, AI edits, format operations, and refactors are proposed changes.
Small completions may stay lightweight. Larger changes should become
reviewable proposals with basis, scope, and accept or reject paths.

### 8. Save Is A Checkpoint

Save should record a checkpoint. It should not erase editor causality. Dirty
state means the current projection differs from the last save checkpoint or
durable Echo frontier.

### 9. Large Files Are Normal

Opening a large file should not require eager full-file thinking. The normal
read should be a bounded window around the viewport and cursor.

### 10. AI Must Be Governed

AI-mediated output must be marked, explainable, and actionable. It should
present proposals, evidence, and next actions instead of silently mutating
files.

## Shell Anatomy

The shell should be sparse, but not vague.

- **Main editor**
  Shows text, cursor, selection, optional gutter cues, and minimal local
  markers for diagnostics, search, or suggestions. It avoids permanent
  explanatory copy, large inline AI blocks, and noisy diagnostic prose.

- **Footer**
  Carries operational truth: mode, focused region, working controls, dirty or
  checkpoint posture, and short status after meaningful events. It is not a
  command encyclopedia.

- **File drawer**
  Helps navigation and orientation. It is easy to open and dismiss. It is not
  required for normal editing once a file is open.

- **Command palette**
  Acts as the front door for rare actions. It should be fast, searchable, and
  honest about scope.

- **Help**
  Is discoverable, not omnipresent. Short hints teach the next few actions.
  Full help explains the active layer and its controls.

- **Drawers**
  Hold sidecar inspection surfaces: diagnostics, search results, file tree,
  Graft structure, proposal details, test output, and notification history.
  Inactive drawers stop advertising controls.

- **Panes**
  Are focused Optic views, not layout clutter. A pane may show another file
  region, a definition peek, a checkpoint comparison, a proposal preview, test
  output, or generated structure.

- **Modals**
  Are only for decisions that must stop the user: discard work, apply a broad
  proposal, resolve an obstruction, or quit with unsaved checkpoint state.

## Common Feature Stance

- **Buffer switching**
  Avoid permanent tab clutter. Prefer a recent-buffer stack, file switcher, and
  compact footer identity.

- **Search**
  Search is a lens. Matches are navigable, coordinate-aware, and dismissible.
  Project search belongs in a drawer or palette-backed result surface.

- **Replace**
  Replace is a proposed edit group. Replace-all should show scope and
  consequence before committing, and obstruct on stale bases.

- **Completion**
  Completion is quiet by default: a small candidate surface or ghost
  suggestion first, details only on request or dwell.

- **AI assistance**
  AI operates through proposal strands. The user can inspect affected region,
  basis, rationale, evidence, and effect before accepting.

- **Diagnostics**
  Diagnostics use quiet editor markers and a drawer for explanation. Inline
  diagnostic text appears on focus, dwell, or command.

- **Definition and references**
  Peek first. Jump second. A target opens as a temporary pane or drawer view
  that can be pinned, jumped to, or dismissed.

- **Splits**
  Splits are intentional Optic views with clear subjects and coordinates. The
  default remains one editor.

- **Undo and redo**
  Primitive ticks are runtime truth. User-facing undo groups typing bursts,
  paste, format, AI proposals, and refactors into understandable events.

- **Git and diff**
  Git is an ecosystem projection, not editor truth. Diffs compare coordinates:
  current vs save checkpoint, exported Git HEAD, proposal, or earlier tick.

- **Tests and tasks**
  Test results carry a basis. If the user edits after a run, `jedit` knows the
  results may be stale.

- **Multi-cursor**
  Multi-cursor editing is an edit cohort over anchors. The UI shows count and
  scope before broad edits.

- **Macros**
  Macros become replayable Intent sequences. Replay previews or obstructs when
  context changed.

- **Settings**
  Settings are local, inspectable, and calm. Prefer project config and command
  palette changes before a large preferences UI.

## Causal Feature Plan

### 1. Causal Undo And Time Rail

Most editors expose undo as a hidden stack. `jedit` should expose meaningful
events when useful:

- typing burst
- paste
- delete
- format
- proposal accept
- refactor
- save checkpoint

The user should be able to undo the last event, preview a prior coordinate,
unapply a specific tick, or compare now with then.

Design doc to write: `causal-undo-and-time-rail`.

### 2. Suggestion As Proposal Strand

Suggestions and AI edits often mutate attention before they mutate text.
`jedit` should treat non-trivial suggestions as proposed causal strands.

The user should be able to preview, inspect basis and affected range, accept
all, accept part, reject, or keep the proposal as a temporary fork.

Design doc to write: `suggestion-as-proposal-strand`.

### 3. Save Checkpoints And Dirty Truth

Dirty state is often vague. `jedit` should say exactly what changed relative to
the last save checkpoint or durable Echo frontier.

The user should be able to save as checkpoint, compare current to last save,
inspect unsaved causal events, and understand whether save wrote to disk,
created a checkpoint, or both.

Design doc to write: `save-checkpoints-and-dirty-truth`.

### 4. Causal Panes And Optic Views

Most split panes are layout mechanics, not semantic views. `jedit` should model
panes as Optics over causal subjects:

- same file, different viewport
- same file, earlier checkpoint
- definition peek
- proposal preview
- test output tied to a coordinate

Design doc to write: `causal-panes-and-optic-views`.

### 5. Causal Anchors In The Editor

Cursors, selections, diagnostics, search hits, and AI target ranges drift when
text changes. `jedit` should model them as anchors with lawful transform
behavior.

Design doc to write: `causal-anchors-editor-integration`.

### 6. Causal Search And Replace

Replace-all often applies to a stale or poorly understood basis. `jedit` should
make search results coordinate-aware and replace operations previewable as
causal edit groups.

Design doc to write: `causal-search-and-replace`.

### 7. Causal Diagnostics And Tasks

Diagnostics and test output age quickly while the editor keeps moving. `jedit`
should carry the coordinate that produced each result and show stale posture
calmly.

Design doc to write: `causal-diagnostics-and-tasks`.

## Recommended First Design Docs

The first three documents should be:

1. `causal-undo-and-time-rail`
2. `suggestion-as-proposal-strand`
3. `causal-panes-and-optic-views`

They define the clearest product differences:

- time is inspectable
- suggestions are governed
- panes are causal views, not layout clutter

## v1 User Story

A user opens `jedit` in a repository.

The screen is quiet. The file drawer may be visible, but the editor owns the
center. The footer shows the mode, the focused region, and only the controls
that work now.

The user opens a large file. The editor paints visible text quickly because the
normal read path is a bounded window, not a full-file demand. The file remains
a causal object underneath, but the user does not have to think about that to
type.

They edit. Typing feels ordinary. Underneath, meaningful changes become ticks
and edit groups. The footer can acknowledge important events without becoming
a log.

They search. Search opens as a lens. Matches are navigable. Replace shows what
will change before it commits.

They peek a definition. A temporary pane opens with the target. They can pin
it, jump to it, or dismiss it.

They receive a suggestion. A small completion may appear near the cursor. A
larger AI or refactor suggestion appears as a proposal with scope, basis, and
actions. It does not silently rewrite the file.

They see diagnostics. The editor marks them quietly. The drawer explains them
when asked. If the file changes after diagnostics were produced, `jedit` knows
they are stale.

They save. Save records a checkpoint. The editor can explain what is ahead of
that checkpoint and what has been written to disk.

They undo. Undo steps through meaningful events. Later, the time rail can show
the sequence, preview earlier coordinates, and unapply targeted ticks.

They leave and return. The editor remembers useful working context, but the
first feeling is still quiet text and honest controls.

## v1 Feature Bar

v1 should support:

- calm terminal-native editor shell
- file drawer and fast file switching
- large-file-friendly read path
- normal editing with keyboard-first ergonomics
- contextual footer and help
- search and replace lens
- basic diagnostics drawer
- definition peek or pinned pane model
- save checkpoint and dirty-state semantics
- grouped undo foundation
- proposal UX for larger suggestions
- Graft-backed structure where available
- graceful absence where structure is unavailable

v1 may defer:

- full multi-user collaboration
- full visual time rail
- complete braid UI
- full AI assistant chat
- complete settings surface
- full macro recorder
- rich Git workbench

## Acceptance Bar

This direction is working when:

- the editor feels calmer after features are added, not busier
- every visible hint works for the active layer
- the user can recover from search, drawers, proposals, and panes with clear
  dismiss behavior
- suggestions and AI edits are reviewable before broad mutation
- save, dirty state, and undo can be explained in causal terms
- large files do not force eager full-file thinking into the main interaction
- docs, tests, and UI vocabulary use the same product nouns

## Non-Goals

- Designing the final Echo API.
- Replacing the Optic-backed file model packet.
- Specifying exact keybindings for every feature.
- Turning the v1 story into a marketing page.
- Making every advanced causal feature mandatory for v1.
