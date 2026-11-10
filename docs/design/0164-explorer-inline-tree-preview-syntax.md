---
title: "DX-0164 - Inline explorer tree and preview syntax"
legend: "DX"
lane: "design"
issue: "https://github.com/flyingrobots/jedit/issues/348"
status: "active"
owners: ["@flyingrobots"]
created: "2026-10-15"
updated: "2026-11-08"
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

Before this cycle (kept as the starting point; see the Retrospective for the
result): the fetched base is
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
Right/l expands a closed folder or enters its first child; on a file it opens
the file like Enter. Left/h collapses an open folder or selects its parent and
is inert on a top-level row. Collapsing a folder that a filter only matched
through its descendants clears the filter so the folder stays selected.
Backspace and Alt+Up move the explorer root upward from any row. Enter or Right/l
do so only on `..`; clicking `..` only selects it. Left/h no longer move the root (before this
cycle they matched the workspace back key alongside Backspace). Refresh reloads
the current root and collapses expanded branches.
An empty folder still shows its open disclosure. An unreadable folder shows the
existing directory error toast and keeps the current tree intact.

The filter searches the currently known visible rows. Matching children retain
their directory ancestors. Filtering never recursively loads closed directories.
Hover remains distinct from selection; a file click only previews, while Enter
opens it. Folder actions do not modify cwd, editor text or Echo authority.

Source previews load/highlight asynchronously. Parser errors or unsupported
languages retain readable text. The existing loading/binary/unavailable/truncated
labels remain, and a new unsaved-changes label covers a modified buffer whose
text is not loaded from the file head. A dirty editor projection over a clean
authority or a pending edit also shows this notice, even at the file head.
Header and notices receive no source
syntax colors.

### User Journey

Open Files with Ctrl+B, expand src and a nested folder, select a file to inspect
its highlighted preview, then Enter to open it or collapse the folder to keep
browsing. Closing Files reveals the existing editor unchanged.

### Wide UI Mockup

Illustrative 100x32 layout, not a transcription of the
[native capture](0164-explorer-witness/nested-syntax-dark-100x32.png), which selects panel.ts:

```text
files  / filter             Preview · main.ts
  ▾ src/
    ▸ components/           export const answer = 42;
  ›   main.ts               ^ keyword       ^ number
  ▸ tests/
    README.md
```

### Narrow UI Mockup

60x12, [native capture](0164-explorer-witness/nested-syntax-dark-60x12.png): the same pinned header and indented rows use the existing list viewport.
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

A basis-free `PreviewHighlighter` port (`src/ports/source-highlighter.ts`)
accepts only preview path/text and bounded line coordinates. The Graft adapter
shares syntax-span conversion with editor highlighting but omits the editor-head
basis for previews. One pure function, `filePreviewSourceLines` in
`src/app/workspace/file-preview-syntax.ts`, sanitizes preview text; the
highlighter parses those lines and the preview view passes the same lines to the
painter in `src/ui/file-preview-syntax.ts`. The existing preview request identity
gates the combined text/syntax result. Open-buffer text remains preferred; a
modified authority whose reading window is not at the file head reports its
unsaved state instead of silently previewing the saved file. A dirty editor
projection over a clean authority or a pending edit also reports unsaved
state even when the reading starts at the file head.

The preview view and the Files pointer import `ui/file-preview-syntax` and
`ui/workspace-file-filter-prompt`. These app→ui imports join the existing
reversed edges whose removal is tracked in
[#398](https://github.com/flyingrobots/jedit/issues/398).

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
That hint currently renders only through the legacy footer path (#393); its
`enter_open` key name is tracked in #394.

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

- [x] Slice 1: Inline directory state, rendering, keyboard and pointer behavior.
- [x] Slice 2: Basis-free Graft preview highlighting and stale/failure protection.
- [x] Slice 3: Native witnesses, full checks and review handoff.

## Tests To Write First

- [x] Enter/click expand and collapse nested directories without changing root.
- [x] Sibling branches, selection, indentation and filter ancestors stay coherent.
- [x] Empty/unreadable directories and root refresh preserve safe navigation.
- [x] Real Graft syntax colors reach saved-file previews; sanitized unsaved text
  reaches the highlighter and remains readable when parsing fails.
- [x] Stale results, parser failure, tabs, Unicode and truncation remain safe.

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

Review of this cycle filed its deferred findings as issues:
[#391](https://github.com/flyingrobots/jedit/issues/391) (one `~/.jimrc` writer),
[#392](https://github.com/flyingrobots/jedit/issues/392) (CI for stacked PRs),
[#393](https://github.com/flyingrobots/jedit/issues/393) (dead legacy footer path),
[#394](https://github.com/flyingrobots/jedit/issues/394) (naming),
[#395](https://github.com/flyingrobots/jedit/issues/395) (explorer edge policy:
dotfiles, symlinked directories, duplicate paths dropped on expansion),
[#396](https://github.com/flyingrobots/jedit/issues/396) (footer-view cleanups),
[#397](https://github.com/flyingrobots/jedit/issues/397) (witness scripts writing to
system `/tmp`), [#398](https://github.com/flyingrobots/jedit/issues/398) (app→ui
imports), [#399](https://github.com/flyingrobots/jedit/issues/399) (post-landing doc
lifecycle) and [#400](https://github.com/flyingrobots/jedit/issues/400) (spec
readability). Global recursive search remains outside this cycle.

## Retrospective

Inline expansion, collapse, filtered ancestry and read-only syntax are implemented.
File clicks remain previews; Enter remains an explicit open for files. Directory
clicks and Enter share one lazy filesystem operation. The preview port omits an
editor-head basis, and parser failures preserve readable text.

Tests exposed one interaction refinement: filter ancestry must not steal the
initial selection from the actual match. A later full check found that row
identity needed to remain index-based rather than path-based. Both have focused
regressions. At `26bba006` the full check passed 907 tests (895 passed, 12
existing skips, zero failures) with 140 specs assigned to CI shards.

After merging `origin/main` (`5451c27`), two evidence-bounded review rounds
added fixes with focused regressions. Round one (`f18cc09`..`9f39fcf`): Left/h
never leave the tree, a filtered collapse keeps the folder selected, a modified
buffer reports unsaved state instead of previewing disk, `~/.jimrc` saves keep
special mode bits and line endings (the port's layout methods became
`loadLayout`/`saveLayout`), Ctrl+G releases the filter prompt, and the
leader-capture hint renders through the live footer. Narrow footer layouts and
the Settings drawer can clip the hint; fitting it is tracked in #401. Commit
`c7916e5` added the
Ctrl+G spec one commit before its fix in `9e79b4e`. Round two
(`ce82d0d`..`287415c`): closing an open Graft drawer also releases the prompt,
the footer adapter's lock file is removed in favour of its re-read before
rename, the preserved mode is applied after writing so setuid survives, a dirty
editor projection also reports unsaved changes, the `..` row behaviour is
pinned, several literals are named, and the footer specs are formatted one
statement per line. Round three (after `af506b5`): the unsaved notice fits the
36 text cells of a 60-column terminal's preview with Graft closed, in every locale (a spec renders
each locale at that width), a dirty projection over a clean head reading also
reports unsaved changes, every focus change away from Files ends filter
editing, the footer observation and explorer header name their copy keys, the
leader-key writer applies the preserved mode after writing, and the explorer
and preview specs are formatted one statement per line.

The merge changed the spec inventory: `origin/main` deleted 12 specs that read
documentation or audited deleted documents (`c508964`, `9ee2435`; they included
`graph-rope-runtime-red-matrix.spec.mjs` and its skipped cases) and added 8.
Validation records on PR #349 must name the tested head. Historical full checks
and captures do not validate the later review repairs. A fresh full local check
and hosted run remain gates before merge; CI does not automatically trigger for
this PR's non-main base. Deferred findings are listed under Follow-On Debt.

[Native evidence](0164-explorer-witness/README.md) covers mouse and Enter toggles,
root preservation, nested/filtered rows, dark 100x32 and minimum 60x12, and Arabic
light 60x16. The original observation reported 13 syntax spans, no preview
authority and textRequestId 0; the retained receipt records dimensions and cell
digests, not those runtime values. Only explicit file Enter opened a buffer in
that observation.
Arabic rasterization proves alignment, not terminal-specific shaping. The
captures were taken at `26bba006` and were not re-captured after the main merge
or the review fixes. `f18cc09` rewrote the filtered-collapse path shown in the
filtered-hierarchy capture; that path, the root-level Left, the `..` row, the
unsaved-buffer notice and Ctrl+G are proven by specs, not by capture.

PR: https://github.com/flyingrobots/jedit/pull/349. The change is stacked on footer
PR #344 and merges into its branch before #344 lands on `main`.
