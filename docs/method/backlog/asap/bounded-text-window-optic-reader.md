---
title: bounded-text-window-optic-reader
lane: asap
owner: jedit editor
priority: high
keywords:
  - optic
  - viewport
  - text-window
  - large-files
  - observer
acceptance_criteria:
  - The editor-facing read path can request a bounded text window from an optic by cursor, viewport, and byte budget.
  - The returned reading includes line numbers, text, byte spans, total line count, and before/after continuation flags.
  - Source painting no longer requires a full-file string as the normal read result.
  - Tests cover a file larger than the old eager-load cap and assert that the public reading is window-bounded.
  - Any temporary internal materialization in the fake is documented as fake-only and not part of the app contract.
---

# bounded-text-window-optic-reader

Replace the normal source-read model with bounded Text File Optic readings.

Context:

- The current large-file fix removed a bad cap, but it still leaves the editor
  conceptually close to whole-file loading.
- The future editor should ask for the visible window plus a small margin.
- The optic read should be a reading envelope, not a mutable buffer handle.

This task should make source rendering depend on `TextWindowReading` style data
before the real Echo API exists.

## Non-Goals

- Solving every scroll-cache and line-index performance detail.
- Removing all full materialization paths used by explicit snapshot or save
  operations.
- Implementing Graft structural projection streaming.

