---
title: filetype-detection-and-language-modes
lane: asap
owner: jedit editor
priority: medium
keywords:
  - filetypes
  - language-modes
  - source
  - preview
  - editor
acceptance_criteria:
  - jedit detects useful filetype/mode information from path and content where reasonable.
  - The editor can route files into the correct local render and interaction mode without hard-coding everything in the main loop.
  - Markdown preview remains explicit rather than accidentally enabled for every text file.
  - The mode system leaves room for future Graft-backed syntax spans and diagnostics.
---

# filetype-detection-and-language-modes

Give the editor a real notion of what kind of file it is showing.

Context:

- `jedit` wants to open markdown, text, TeX, source files, and likely config
  formats without feeling like a single anonymous string viewer.
- Local syntax paint and future Graft surfaces both want a filetype/mode seam.

This note is about the editor’s own language posture, not external tooling.

## Non-Goals

- Full plugin architecture.
- Language-server integration.
