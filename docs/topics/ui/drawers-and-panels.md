# Drawers And Panels

Drawers and panels are secondary Jim surfaces that appear over or beside the
editor without becoming independent applications. They should preserve context,
use theme tokens, and close predictably.

<img src="./drawers-and-panels.svg" alt="Drawers and panels layout across wide, narrow, and xs terminal profiles." />

## Common Rules

All drawers and panels should:

- have one clear focused row or focused control;
- keep keyboard instructions in the footer or a compact hint row;
- wrap prose at word boundaries;
- clip paths and machine identifiers only when wrapping is impossible;
- avoid hardcoded foreground or background colors;
- leave the editor buffer unchanged unless the user runs an explicit command.

When a panel is meant for reading, it should stay visible until focus changes,
`Esc` closes it, or a related command replaces it. Time-limited toasts are not
enough for detailed explanations.

## Files Drawer

Open the files drawer with `Ctrl+B`. Focus moves into the sticky search input at
its top, with a visible caret. Typing immediately fuzzy-filters the entries in
the currently loaded directory by name or workspace-relative path. Matching is
case-insensitive and accepts characters in order, so `rnt` can match
`render-tree.ts`. It preserves the directory's existing order. The input has a distinct theme
background, and the matched filename characters use the theme accent and bold
weight.

| Key | Action |
| --- | --- |
| `Up` / `Down` | Select a displayed result. |
| `Enter` | Open the selected file or directory. |
| `Left` / `Right`, `Home` / `End` | Move the query caret. |
| `Backspace` / `Delete` | Edit the query. |
| `Ctrl+U` | Clear the query. |
| `Ctrl+R` | Refresh the current directory. |
| `Alt+Up` | Enter the parent directory. |
| `Ctrl+B` / `Esc` | Close the drawer. |
| `Tab` | Cycle visible panes. |

Printable keys such as `j`, `k`, `q`, and Space enter the query while the field
has focus. The input stays pinned as results scroll. Clicking the input places
the caret; clicking a result opens that result. No matches displays an explicit
message and cannot open an excluded file.

Closing and reopening preserves the session query. Entering another directory
clears it. Refreshing preserves it; a failed directory change preserves the
previous query and entries. A restart starts with an empty query.

This search covers loaded directory entries. Workspace-wide discovery, semantic
retrieval, and Graft symbol search are deferred to
[issue #341](https://github.com/flyingrobots/jedit/issues/341). It creates no
SQLite database or persistent search index. The transient projection boundary
is recorded in [component ownership](../../jim-component-ownership.md).

The files drawer is for browsing workspace entries. It should share file-opening
behavior with `:edit`: selecting a file opens it, and selecting a directory
enters that directory.

## Graft Drawer

Open the Graft drawer with `ctrl+g` when structural data is available.

The Graft drawer is a projection surface. It can show symbols, structure, and
projection posture, but it does not own source text. If the projection is stale
or unavailable, the drawer should say so directly.

## Causal History

Jim does not currently expose a history drawer. The previous drawer projected
process-local entries and was deleted. A replacement must consume a bounded,
basis-pinned Echo observation and must not imply that browsing history moved a
canonical head.

## Diagnostics Panel

Diagnostics can be opened from settings when Graft diagnostics are available.
The panel should appear beside settings when space allows. If terminal width is
tight, the layout may choose a stacked or clipped fallback, but it should not
silently replace the settings drawer without a clear focus transition.

## Inline Why Panel

`:why` and range why explanations are durable reading surfaces. They should be
anchored near the line or command they explain when possible. They should stay
visible until the cursor moves away, the user presses `Esc`, or another command
replaces the explanation.

## Implementation Map

| File | Responsibility |
| --- | --- |
| [`src/app/workspace/viewer-overlays.ts`](../../../src/app/workspace/viewer-overlays.ts) | Overlay composition. |
| [`src/ui/drawer-layout.ts`](../../../src/ui/drawer-layout.ts) | Drawer geometry helpers. |
| [`src/ui/graft-drawer.ts`](../../../src/ui/graft-drawer.ts) | Graft drawer rendering. |
| [`src/ui/graft-diagnostics-panel.ts`](../../../src/ui/graft-diagnostics-panel.ts) | Diagnostics panel rendering. |
| [`src/ui/why-inline-panel.ts`](../../../src/ui/why-inline-panel.ts) | Inline why explanation rendering. |
| [`src/app/workspace/file-tree.ts`](../../../src/app/workspace/file-tree.ts) | File tree state and entry behavior. |
