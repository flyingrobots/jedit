---
title: graft-drawer-precision-panels-using-current-graft-surfaces
lane: asap
owner: jedit editor
priority: medium
keywords:
  - graft
  - drawer
  - code-show
  - code-refs
  - changed-since
acceptance_criteria:
  - The Graft drawer can expose more than the current outline-only view using surfaces that already exist today.
  - The drawer can present at least one additional precision panel such as references, changed-since, or focused-symbol context.
  - The UI keeps panel switching keyboard-driven and bounded.
  - Dirty-buffer honesty remains visible whenever a panel is based on saved-file state rather than buffer truth.
---

# graft-drawer-precision-panels-using-current-graft-surfaces

Extract more value from the Graft APIs that already exist before waiting on new
buffer-aware parser surfaces.

Context:

- `jedit` already uses Graft for outline/context.
- Graft already exposes `code_show`, `code_find`, `code_refs`,
  `changed_since`, and structural diff surfaces.
- There is editor value available right now in richer drawer modes even before
  syntax spans or buffer-aware outline exist.

This note is about broadening the drawer from "outline only" into a small set
of precise, navigable panels.

## Projection posture

Every drawer panel must name the projection source it is showing and whether
that source is stale or obstructed. The current production drawer often uses
saved-file Graft surfaces while the editor may display dirty, unmaterialized,
or Echo-local buffer text. That is valid enrichment, but it is not live buffer
truth.

Required posture labels:

- `saved-file`: structural data came from the host file on disk.
- `live-buffer`: structural data came from current visible buffer text.
- `current-Echo-frontier`: structural data came from a selected Echo frontier.
- `colorful-prose`: prose projection is active, but not structural outline.
- `unavailable`: no projection source is currently usable.
- `stale`: the projection source does not include visible buffer edits.
- `obstructed`: Graft could not answer the requested projection.

Dirty-buffer honesty is mandatory. If a panel is based on saved-file state, the
drawer must visibly say that unsaved buffer edits are not included. Source
highlighting and structural drawer projection are related Graft-backed
surfaces, but they are separate receipts and may have different freshness.

## Non-Goals

- Replacing the editor with an IDE dashboard.
- Shipping fake buffer-aware structure where Graft does not yet support it.
