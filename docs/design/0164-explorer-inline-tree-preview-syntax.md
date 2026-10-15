---
title: "DX-0164 - Inline explorer tree and preview syntax"
legend: "DX"
lane: "design"
issue: "https://github.com/flyingrobots/jedit/issues/348"
status: "active"
owners: ["@flyingrobots"]
created: "2026-10-15"
updated: "2026-10-15"
---

# DX-0164 - Inline explorer tree and preview syntax

## Linked Issue

https://github.com/flyingrobots/jedit/issues/348

## Decision Summary

The workspace Files explorer expands directories inline on click or Enter,
with indentation and disclosure markers. File click remains selection/preview;
file Enter remains an explicit open. Bounded read-only previews receive Graft
syntax spans without creating a buffer or claiming an Echo head.

## Sponsored Human

A Jim user wants to browse several open folders and read colored source previews
without repeatedly changing the explorer root or opening unwanted buffers.

## Sponsored Agent

An agent needs inspectable expansion state, selected entry identity, bounded
preview text and stale-result rejection to prove input and authority boundaries.

## Hill

Click and Enter reveal/hide folder children in place. Selecting a source file
renders syntax colors in the main preview while buffer authority remains intact.

## Current Truth

The fetched base is
[af1fad8ab3356fa6d96548c8793aa6f2afea8c6b](https://github.com/flyingrobots/jedit/commit/af1fad8ab3356fa6d96548c8793aa6f2afea8c6b),
footer PR #344. `file-tree.ts` changes cwd for a directory. `mouse.ts` only selects
rows. `file-explorer-preview-view.ts` builds an uncolored text Surface.
`file-explorer-preview.ts` already bounds reads and rejects stale results.
The Graft adapter currently accepts an editor-head basis; Graft itself allows
basis-free projections for disposable content.

## Problem

Entering a directory loses sibling context, clicking cannot expand it, and source
previews lose the syntax information available in the editor.

## Scope

Lazy inline expansion/collapse, nested indentation, directory pointer/keyboard
actions, filtered ancestry, refresh behavior, and read-only preview syntax.

## Non-Goals

Recursive filesystem indexing, watchers, persisted expansion, symbol search,
preview editing, new Echo buffer authorities, or changes to the startup picker.

## User Experience / Product Shape

Folders show ▸ when closed and ▾ when open; each child is indented two cells.
Clicking any part of a folder row selects and toggles it. Enter toggles it too.
Right/l expands a closed folder or enters its first child; Left/h collapses an
open folder or selects its parent. Backspace and Alt+Up retain root-parent
navigation. Refresh reloads the current root and collapses expanded branches.
An empty folder still shows its open disclosure. An unreadable folder shows the
existing directory error toast and keeps the current tree intact.

The filter searches the currently known visible rows. Matching children retain
their directory ancestors. Filtering never recursively loads closed directories.
Hover remains distinct from selection; a file click only previews, while Enter
opens it. Folder actions do not modify cwd, editor text or Echo authority.

Source previews load/highlight asynchronously. Parser errors or unsupported
languages retain readable text. The existing loading/binary/unavailable/truncated
labels remain. Header and truncation notice receive no source syntax colors.

### User Journey

Open Files with Ctrl+B, expand src and a nested folder, select a file to inspect
its highlighted preview, then Enter to open it or collapse the folder to keep
browsing. Closing Files reveals the existing editor unchanged.

### Wide UI Mockup

100x32, current theme:

```text
Files  / filter             Preview · main.ts
  ▾ src/
    ▸ components/           export const answer = 42;
  ›   main.ts               ^ keyword       ^ number
  ▸ tests/
    README.md
```

### Narrow UI Mockup

60x12: the same pinned header and indented rows use the existing list viewport.
The selected row remains visible through collapse/expand and scrolling. The
preview occupies the existing main viewer, with clipped lines and syntax tokens.

### Accessibility Considerations

Disclosure characters communicate state without color; selection keeps the
existing filled token and hover keeps its separate token. Keyboard-only and
pointer flows share the same visible row projection and directory operation.

## Runtime / API Contract

Files entries remain the visible ordered list; optional tree metadata records
per-path depth, parent and expanded state. Loading is lazy through FileSystemPort.
The startup picker and command-path directory opens retain their existing API.

A basis-free PreviewHighlighter port accepts only preview path/text and bounded
line coordinates. The Graft adapter shares syntax-span conversion with editor
highlighting but omits the editor-head basis for previews. Preview text is
sanitized once before both parsing and rendering. The existing preview request
identity gates the combined text/syntax result. Open-buffer text remains preferred.

## Lower Modes

Unsupported syntax and parser failures produce plain text; no new required
service. Unicode, tabs and stripped controls must keep text/color alignment.
Existing minimum terminal dimensions and no-color text state remain valid.

## Data / State Model

UI-only tree metadata and preview spans are ephemeral. Collapse drops the
visible descendants and their expansion metadata. Refresh/root changes clear
metadata. Expansion loads immediate children only and excludes parent rows.
No filesystem content cache, serialization, buffer import or Echo Tick is added.

## Accessibility Posture

Folder disclosure, nesting and error state are visible without accent colors.
Active input ownership stays with Files. The main document remains a preview
until an explicit file open; hover performs no filesystem read.

## Localization / Directionality Posture

Reuse localized preview and directory-error copy. Keep literal path order in
RTL locales and reuse the existing Files indentation convention. Update the
existing Enter hint to communicate toggle/open in all 20 authored locales.

## Agent Inspectability / Explainability Posture

Tests can inspect tree metadata, selected indexes, preview result/spans and
rendered token colors. Native witnesses must show nested expansion and a colored
preview rather than infer either feature from source strings.

## Linked Invariants

Hover is not selection. Selection is not open. A preview is disposable and
read-only. Filesystem/Graft work belongs behind ports. Echo owns buffer authority.

## Design Alternatives Considered

Recursively walking the repository would delay the requested interaction and
increase read scope. Replacing cwd preserves the current defect. Lazy visible
rows with small per-path metadata fit existing selection/filter geometry.
Reusing a made-up editor head for preview syntax would misrepresent provenance;
a basis-free Graft projection is the appropriate read-only boundary.

## Decision

Implement the lazy tree and basis-free syntax projection. Preserve the existing
startup-picker and explicit file-opening behaviors.

## Implementation Slices

- [ ] Slice 1: Inline directory state, rendering, keyboard and pointer behavior.
- [ ] Slice 2: Basis-free Graft preview highlighting and stale/failure protection.
- [ ] Slice 3: Native witnesses, full checks and review handoff.

## Tests To Write First

- [ ] Enter/click expand and collapse nested directories without changing root.
- [ ] Sibling branches, selection, indentation and filter ancestors stay coherent.
- [ ] Empty/unreadable directories and root refresh preserve safe navigation.
- [ ] Real Graft syntax colors reach the preview, including unsaved buffer text.
- [ ] Stale results, parser failure, tabs, Unicode and truncation remain safe.

## Acceptance Criteria

Both actions work through the real runtime; selected previews display theme
syntax tokens. Focus/filter and explicit-open behavior remain intact. Native
terminal witnesses and focused/full checks pass. No new buffer authority exists.

## Validation Plan

TypeScript compile, focused explorer/preview/Graft tests, quality, full npm run
check, shard coverage, native wide/narrow dark/light/RTL witnesses and hosted CI.

## Playback / Witness

Ctrl+B; click or Enter on a folder; expand another level; select a TypeScript
file; verify keyword/number colors; collapse/reopen; explicitly open a file.

## Risks

A flat visible list must keep stable entry identity while indexes shift. Metadata
and rendering share one projection; mouse uses the renderer's exact rows. Syntax
must parse the same sanitized text it paints, without coloring the notice row.

## Follow-On Debt

None introduced by this scope. Global recursive search remains outside this cycle.

## Retrospective

Pending implementation and validation.
