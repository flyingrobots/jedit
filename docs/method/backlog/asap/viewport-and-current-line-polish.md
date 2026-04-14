---
title: viewport-and-current-line-polish
lane: asap
owner: jedit editor
priority: medium
keywords:
  - viewport
  - scroll
  - cursor
  - highlight
  - polish
acceptance_criteria:
  - Cursor visibility, scrolling, paging, and viewport math stay stable across drawer combinations and footer states.
  - The active source line can be visually distinguished without drowning the screen in chrome.
  - The editor feels spatially steady during movement rather than jittery or over-compensated.
  - Preview and source modes keep their viewport responsibilities separate and explicit.
---

# viewport-and-current-line-polish

Polish the physical feel of the editor surface.

Context:

- We already fixed one real viewport bug after the pane refactor.
- The next tranche should make source-mode movement feel intentional rather
  than merely correct.
- Current-line emphasis belongs in the same conversation because it changes
  how the user reads and locates themselves on the screen.

## Non-Goals

- Fancy animation.
- Multi-cursor or minimap work.
