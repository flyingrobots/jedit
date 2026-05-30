---
title: partial-surface-region-caching
lane: cool-ideas
owner: jedit ui
priority: low
keywords:
  - rendering
  - performance
  - Surface
  - bijou
  - caching
acceptance_criteria:
  - The idea describes which Surface regions are candidates for caching and under what model conditions they are invalidated.
  - The trade-off between cache complexity and allocation reduction is acknowledged.
---

# partial-surface-region-caching

`renderWorkspace` currently recomputes every region on every frame — header,
file drawer, graft drawer, editor body, footer, overlays. Most of these regions
are unchanged on a typical keystroke.

## Candidate regions and their invalidation conditions

| Region | Changes when... |
|--------|-----------------|
| File drawer | `entries`, `selectedIndex`, `fileDrawerProgress`, `graftDrawerProgress`, or `focusPane` changes |
| Graft drawer | `graftInfo`, `graftDrawerProgress`, `graftSelectedIndex`, or `focusPane` changes |
| Header | `editor.path`, `editor.dirty`, `cwd`, or `entries[selectedIndex]` changes |
| Footer | `editor.mode`, `editor.dirty`, `textRuntimeProfile`, `focusPane` changes |
| Editor body | `editor.lines`, `editor.cursorRow`, `editor.scrollRow`, `sourceHighlight`, `viewMode` change |

On a typical Insert-mode keystroke, only the editor body and footer change.
The drawers and header could be blitted from a cached `Surface` rather than
recomputed.

## Why it is interesting

- The editor body is the region that changes most and is the most expensive to
  compute (syntax highlighting, viewport clipping, cursor rendering). Caching
  everything *except* the editor body flips the cost model — the expensive
  region is always recomputed, but the cheap regions stop contributing.
- For large terminals (wide drawers, tall graft panels), the saving could be
  meaningful in terms of object allocation per frame.
- The cache invalidation logic is straightforward — it is just a structural
  equality check on the relevant model fields (or a generation counter bump).

## Trade-off

Adding a cache layer to `renderWorkspace` introduces state (the cached
`Surface` values) into what is currently a pure function. The cache would need
to live somewhere — either in the `WorkspaceModel` (making it explicit but
adding size) or in a mutable closure in the adapter (hiding it from the model
but breaking purity).

A generation-counter approach is probably the cleanest: each cacheable region
has a `number` in the model that increments when relevant fields change. The
renderer checks the counter; if it matches the cached surface's counter, it
blits the cache. If not, it recomputes and updates. This keeps the cache
invalidation logic in `update` (where model mutations happen) and keeps
`renderWorkspace` referentially transparent given the same model.

This is an optimization, not a correctness concern — defer until profiling
shows it is needed.
