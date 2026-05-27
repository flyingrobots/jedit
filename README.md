# jedit

![jedit title screen](https://github.com/user-attachments/assets/c15575ba-b680-4880-baed-2bfa55c84b10)

A terminal-first text and Markdown editor. Keyboard-driven, Vim-shaped, minimal chrome.

## Features

- Vim normal/insert mode with core motions (`w`, `b`, `e`, `dd`, `yy`, `p`, `u`, `ctrl+r`, and more)
- Real editable text buffer with dirty tracking and save
- Markdown preview rendered from the in-memory buffer
- File drawer with directory navigation
- Graft drawer for current-file outline and structural context
- Syntax highlighting
- Modal source editing
- Two-pane layout: editor + optional panels

## Quick start

```sh
npm install
npm run dev
```

Open a file from the file drawer or pass a path directly. The editor stays out of your way until you need it.

## Design principles

- **Zen core, instrumented edges.** The main editor area stays visually quiet; richer context appears at the edges and only when it earns the space.
- **Minimal by default.** Panels are hidden until explicitly opened. The same chord opens and closes the same panel.
- **One-line header.** Identifies what the main pane is showing. Not a dashboard.
- **Two-line footer.** Top line belongs to the focused surface. Bottom line carries workspace and buffer truth.
- **Buffers are not panes. Panes are not panels.**
- **Vim-shaped without trying to be Vim 2.** Familiarity matters; reenactment is not the goal.
- **Alternate views are lenses, not separate truths.** Markdown preview is a lens over the active buffer.
- **Truth beats convenience.** If a panel shows saved-on-disk state while the buffer is dirty, the UI says so.
- **Anything noisy must earn its existence.**

## Docs

- [GUIDE.md](GUIDE.md) — running, building, and validating the workspace
- [ADVANCED_GUIDE.md](ADVANCED_GUIDE.md) — buffer rendering path and runtime details
- [ARCHITECTURE.md](ARCHITECTURE.md) — layer rules, boundaries, and non-negotiables
- [VISION.md](VISION.md) — long-term product direction
- [AGENTS.md](AGENTS.md) — agent-specific guidance and witness commands
- [docs/design/project-invariants.md](docs/design/project-invariants.md) — full product invariant set
