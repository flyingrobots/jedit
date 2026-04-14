---
title: toggleable line-number gutter
lane: asap
owner: jedit editor
priority: medium
keywords:
  - tui
  - editor
  - gutter
  - line-numbers
  - ux
acceptance_criteria:
  - The editor can render a left-side gutter alongside the text buffer.
  - The gutter can be toggled on and off without disturbing core editing behavior.
  - The gutter supports absolute line numbers.
  - The gutter supports relative line numbers based on the current cursor position.
  - The user can switch between absolute and relative numbering modes.
  - Rendering remains stable in source mode when the cursor moves, scrolls, or edits occur.
---

# toggleable line-number gutter

Add an editor gutter that can display line numbers and can be toggled on or off. The gutter should support both absolute numbering and numbering relative to the current cursor line.

Context:

- `jedit` now has a quieter source pane and footer, which makes a purposeful gutter more useful than permanent chrome.
- This work is part of the "get the editor surface right before deeper Graft/Echo integration" tranche.
- The gutter should stay small, lawful, and source-mode focused rather than becoming a dumping ground for IDE widgets.

## Acceptance Criteria
- The editor can render a left-side gutter alongside the text buffer.
- The gutter can be toggled on and off without disturbing core editing behavior.
- The gutter supports absolute line numbers.
- The gutter supports relative line numbers based on the current cursor position.
- The user can switch between absolute and relative numbering modes.
- Rendering remains stable in source mode when the cursor moves, scrolls, or edits occur.

## Non-Goals
- Diagnostics, breakpoints, blame, or other IDE-style gutter decorations.
- Preview-mode gutter behavior unless the editor surface explicitly needs it.
- Full visual redesign of the editor chrome.

## Notes

- This should compose cleanly with future current-line highlighting and viewport polish work.
- Relative numbers should be computed from the visible cursor line, not from file start or stale scroll state.
