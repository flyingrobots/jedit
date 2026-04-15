# jedit

Terminal-first Markdown and text editing, built on Bijou.

The current build is intentionally stripped down. No starter tabs, no extra
chrome, no decorative theme layer. Just a small custom TUI so the editor shape
can emerge from the actual product instead of scaffold baggage.

## Product invariants

`jedit` is aiming for a quiet editing surface with smart edges, not a terminal
IDE clone.

- Zen core, instrumented edges. The main editor area stays visually quiet;
  richer context appears at the edges and only when it earns the space.
- Minimal by default. Panels are hidden until explicitly opened.
- One-line header. The header identifies what the main pane is showing and
  does not turn into a dashboard.
- Two-line footer. The top line belongs to the focused surface and may change
  rapidly. The bottom line carries slower workspace and buffer truth.
- Buffers are not panes. Panes are not panels. Lenses are not extra buffers.
- Panels are tools, not furniture. File browsing, Graft, diagnostics, and
  similar surfaces should open intentionally, close cleanly, and stay out of
  the way when not needed.
- The same chord should open and close the same panel.
- `tab` cycles only across visible interactive panes. Hidden panels do not
  participate in focus order.
- The editor should remain strongly Vim-shaped without trying to become "vim
  2". Familiarity matters; reenactment is not the goal.
- Alternate views of a file are lenses over the active buffer, not separate
  truths. Markdown preview is the first lens; others must justify themselves.
- Truth beats convenience. If a panel is showing saved-on-disk structure while
  the buffer is dirty, the UI should say so explicitly.
- Anything noisy must earn its existence.

Near-term product direction:
- `jedit .` opens the current directory
- file tree plus text buffer editing
- Markdown source mode with richer preview options
- keyboard-first pane layout instead of heavyweight IDE chrome

## Run

```sh
npm run dev
```

## Current state

Right now the app gives you:
- current-directory file drawer
- a Graft drawer backed by a repo-local MCP session for current-file outline and structural change context
- simple directory navigation
- a real editable text buffer
- modal source editing with a growing Vim normal/insert split
- core Vim motions and operators like `w`, `b`, `e`, `dd`, `yy`, `p`, `u`, and `ctrl+r`
- source editing with dirty tracking and save
- Markdown preview rendered from the in-memory buffer

## Next steps

- lock the Echo-backed text runtime design around persistent piece-rope
  worldlines in [TEXT_EDIT_ALGEBRA.md](TEXT_EDIT_ALGEBRA.md)
- lock the event taxonomy in [CAUSAL_EVENT_MODEL.md](CAUSAL_EVENT_MODEL.md) so
  logical history, maintenance, and session traces do not collapse into one
  ledger
- strengthen the Vim layer
- add more motions/operators/text objects and counts
- deepen the Graft drawer beyond outline plus diff summary
- add better preview fidelity
- handle unsaved-buffer flows when switching files
- persist layout and workspace state
