---
title: search-and-buffer-switching-surface
lane: asap
owner: jedit editor
priority: medium
keywords:
  - search
  - quick-open
  - buffers
  - switching
  - ux
acceptance_criteria:
  - jedit has an in-buffer search flow with clear next/previous navigation.
  - jedit has a quick-open or fuzzy-open path for files.
  - jedit has a coherent open-buffer switching surface instead of overloading pane focus controls.
  - Recent or open buffers remain visible enough that switching does not require rediscovering file paths every time.
---

# search-and-buffer-switching-surface

Turn file movement and text movement into first-class editor flows instead of
making the user rely on the tree for everything.

Context:

- `tab` is now reserved for pane focus, not opening drawers.
- The editor still needs a lawful way to move between matches, files, and open
  buffers without collapsing back into noisy shell chrome.
- This note groups search, quick-open, recent buffers, and smarter buffer
  switching because they are one navigation surface from the user’s point of
  view.

## Non-Goals

- Full project indexing or language-aware search.
- A graphical tab bar that dominates the editor chrome.
