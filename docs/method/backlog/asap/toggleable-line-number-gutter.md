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
