# Editor Chrome

Editor chrome is the persistent frame around the current buffer: source
viewport, gutter, header title, footer hints, causal markers, and coordinate
readouts.

<img src="./editor-chrome.svg" alt="Editor chrome layout across wide, narrow, and xs terminal profiles." />

## How To Reach It

Open a file from the title screen, files drawer, or command line:

```text
:edit README.md
```

The editor surface becomes active when Jim has a text buffer projection for the
opened file.

## Source Viewport

The source viewport paints the current buffer projection. Jim owns cursoring,
scrolling, text layout, gutter layout, and theme application. Graft can provide
syntax spans, but Graft does not own the buffer.

Expected behavior:

- source text stays aligned when Unicode text is present;
- syntax spans are ignored when stale or unavailable;
- cursor position remains visible in Normal and Insert modes;
- source editing continues even if a projection provider fails.

## Gutter

The gutter is the left-side margin next to source text. It may show absolute
line numbers, relative line numbers, or no line numbers depending on settings.

Line number modes:

| Mode | Meaning |
| --- | --- |
| `Absolute` | Show the source line number from the top of the file. |
| `Relative` | Show line distance from the current cursor line for Vim motions. |
| `Off` | Hide line numbers. |

Future gutter work should add theme-token-controlled dimming and modified-line
markers. Modified and removed line markers should be projections of Echo edit
receipts relative to the current causal basis or checkpoint; they should not be
derived from Git diff, host-file comparison, or a single projection-changed flag.

## Footer

The footer is the main low-friction status surface. It should show:

- current mode;
- `line:col` cursor position when a source cursor is active;
- mode-specific hints;
- causal basis and head posture;
- export or materialization posture;
- worldline, admission, and tick posture when available;
- command-line input when `:` mode is active.

When settings or another non-source overlay owns focus, the footer should show
that surface's focus state instead of leaking the editor cursor coordinate.

The lower-right status segment currently reports workspace and worldline
posture. It is not a Git diff counter; modified and removed line evidence must
come from Echo receipts admitted after the displayed basis.

## Implementation Map

| File | Responsibility |
| --- | --- |
| [`src/ui/workspace-chrome.ts`](../../../src/ui/workspace-chrome.ts) | Header and footer rows. |
| [`src/ui/source-viewer.ts`](../../../src/ui/source-viewer.ts) | Source viewport rendering. |
| [`src/ui/source-highlight.ts`](../../../src/ui/source-highlight.ts) | Highlight span painting. |
| [`src/app/settings-session.ts`](../../../src/app/settings-session.ts) | Line-number setting rows and mode labels. |
| [`src/app/workspace/editor-session.ts`](../../../src/app/workspace/editor-session.ts) | Editor projection and cursor session state. |
