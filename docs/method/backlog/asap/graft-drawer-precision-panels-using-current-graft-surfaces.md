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

## Non-Goals

- Replacing the editor with an IDE dashboard.
- Shipping fake buffer-aware structure where Graft does not yet support it.
