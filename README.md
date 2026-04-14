# jedit

Terminal-first Markdown and text editing, built on Bijou.

The current build is intentionally stripped down. No starter tabs, no extra
chrome, no decorative theme layer. Just a small custom TUI so the editor shape
can emerge from the actual product instead of scaffold baggage.

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
