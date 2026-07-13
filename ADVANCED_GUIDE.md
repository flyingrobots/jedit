# Advanced Guide

This guide explains the current runtime shape of `jedit` from the perspective
of someone trying to understand how an opened buffer becomes terminal pixels.

The short version: the visible editor is a full local projection cache in
`EditorState`. Everything on screen is a projection of that state into Bijou
`Surface` cells. Echo/session authority owns causal text in production. Syntax
highlighting, Markdown preview, drawers, footer text, themes, and bounded
Graft/Echo readings are projections or evidence. They do not own buffer truth.

## Buffer Truth

The current visible editor projection lives in
`src/app/workspace/editor/model.ts` as `EditorState`. (`src/main.ts` is a
small CLI dispatcher; the workspace boots from `src/main-workspace.ts` through
`src/adapters/workspace-app.ts`.)

`EditorState` carries:

- `path`
- `lines`
- `cursorRow` and `cursorCol`
- `scrollRow` and `scrollCol`
- `dirty`
- `readOnly`
- editor mode
- pending normal-mode chord state
- register state
- undo and redo snapshots

In production, Echo/session authority owns causal text. `editor.lines` is the
full local visible projection cache used for rendering, cursoring, and
transitional edit planning. It must not be reconstructed from bounded readings.
It is not saved or recovered as authority.

This is still a transitional design. The TUI needs fast local material for
rendering and byte-offset planning while Echo exposes first-class session and
speculative projection APIs. That local material is a full visible/session
projection cache, not canonical causal truth.

## Loading A Buffer

Opening a file eventually calls `loadEditor(filePath)` in
`src/app/workspace/editor-session.ts`.

That function delegates file IO to `loadEditorFile(filePath)` in
`src/adapters/editor-file.ts`. The adapter is the boundary where bytes become
editor text:

- It reads bytes from disk.
- If the file contains a null byte, jedit treats it as binary.
- Binary files become a read-only one-line buffer containing `[binary file]`.
- Text files are decoded as UTF-8.
- Line endings are normalized by `normalizeLines(...)` in
  `src/app/editor-lines.ts`.

The loaded result becomes an `EditorState` with the cursor and scroll position
at the top of the file.

## Mutating A Buffer

Insert mode, normal mode, paste, delete, change, undo, and redo all operate on
`EditorState`.

Most edits go through `commitMutation(...)` in
`src/app/workspace/editor-editing-core.ts`. That creates an
undo snapshot of the previous editor state, clears the redo stack, applies the
patch, and marks the buffer dirty unless the patch says otherwise.

After motions and edits, `ensureEditorVisible(...)` keeps the cursor inside the
visible viewport. It normalizes the cursor row and column, then adjusts
`scrollRow` and `scrollCol` so rendering can draw the correct window over the
buffer.

The important point is that mutations change the plain visible projection.
They do not write ANSI escapes, style tokens, syntax classes, or preview state
into the buffer, and production mutation authority still runs through the
Echo-backed text session.

## Structural History Metadata Path

The visible TUI editor still mutates `EditorState.lines`, but the repo now has
a separate structural-history authority path for the hot-buffer/session seam.
That path is intentionally narrow and does not replace runtime storage.

The current flow is:

```text
contracts/jedit/structural-history.graphql
  -> npm run gen:contract:structural-history:wesley
  -> .wesley-cache/structural-history.wesley.generated.ts
  -> ignored replaceTextRange descriptor under src/generated/jedit
  -> src/app/structural-history-replace-text-range.ts
  -> src/app/hot-buffer-session.ts
  -> src/ports/hot-text-runtime.ts
  -> src/adapters/full-snapshot-hot-text-runtime-fixture.ts
```

The generated descriptor supplies the `replaceTextRange` operation identity.
The existing TypeScript runtime still admits the edit, creates the tick, updates
open edit groups, and materializes text. This keeps the slice small: schema and
generated metadata become authority for one operation boundary while storage,
Echo admission, and generated domain model replacement remain out of scope.

`npm run build` and `npm test` run this generation step before TypeScript
compilation so a clean checkout can compile without a checked-in generated
descriptor. The descriptor path is ignored because it is build output.

## The Frame Loop

Bijou TUI runs the app assembled in `src/adapters/workspace-app.ts` and
started from `src/main-workspace.ts`.

On each frame, the app calls:

```ts
view: (model) => renderWorkspace(model)
```

`renderWorkspace(model)` creates the root Bijou `Surface` at the terminal size.
It fills that surface with the active jedit theme's workspace token, then
composes the frame:

1. Header title.
2. Main viewer.
3. File drawer if open.
4. Graft drawer if open.
5. Echo History drawer if open.
6. Active pane edge marker.
7. Two-line footer if enabled.
8. Notification overlay.

Each child renderer returns its own `Surface`. The root workspace blits those
child surfaces into the correct positions.

This means renderers do not print directly to stdout. They paint cells into
surfaces. Bijou handles terminal output after the final composed surface exists.

## Layout And Viewport

The render path separates terminal layout from buffer projection.

`renderWorkspace(...)` asks `resolveWorkspaceLayout(...)` for the current file
drawer, viewer, Graft drawer, and Echo History drawer rectangles. It then
computes the viewer body height from the terminal rows and footer visibility.

`viewerViewport(width, height)` subtracts the viewer padding from that layout
rectangle. The resulting viewport tells source and preview renderers how many
buffer rows and columns they may paint.

There are two related but different concepts:

- Layout rectangle: where the viewer surface sits in the whole terminal.
- Buffer viewport: which rows and columns inside the active buffer are visible.

`scrollRow` and `scrollCol` select the buffer window. The layout selects where
that window appears on screen.

## Source Mode Rendering

When the active editor is in source mode, `renderViewer(...)` calls
`renderSourceViewer(...)` from `src/ui/source-viewer.ts`.

That function performs three jobs.

First, it turns the current visible editor projection into a bounded
`SourceWindowReading`:

```ts
createSourceWindowReadingFromLines({
  lines: editor.lines,
  startLine: editor.scrollRow,
  lineCount: options.viewport.height,
})
```

This reading has line numbers, visible line text, total line count, and before
or after flags. Today it is derived from `editor.lines`. The shape is deliberate
because it can later be backed by a bounded observer or optic reading instead
of local array slicing. A `SourceWindowReading` is not a whole-document buffer.
It is viewport material for paint-time work.

Second, `renderSourceViewer(...)` calls `paintHighlightedSourceWindow(...)` in
`src/ui/source-highlight.ts`.

That painter loops over the visible rows and columns. For each visible cell:

1. It maps screen row and column back to source row and source column.
2. It reads the character from the source window, using a space when the line
   is shorter than the viewport.
3. It asks whether a syntax highlight span covers that source position.
4. If a span applies, it maps the span role through the active `JeditTheme`.
5. It writes the character and style into the Bijou surface cell.

Third, after text and highlighting are painted, `renderSourceViewer(...)`
paints the cursor. Normal mode and insert mode use different cursor tokens from
the active theme:

- `theme.cursor.normal`
- `theme.cursor.insert`

The cursor is painted last so it wins over underlying source text and syntax
paint.

## Graft Syntax Highlighting

Syntax highlighting is asynchronous and optional. Rendering does not block on
it.

When jedit opens, saves, edits, scrolls, or otherwise changes the active source
projection, `beginSourceHighlightRefresh(...)` in
`src/app/source-highlight-session.ts` may start a new request.

The request sends a `SourceHighlightInput` to the configured `SourceHighlighter`
port:

- file path
- current visible editor projection from `joinLines(editor.lines)`
- start line
- visible line count
- synthetic head id
- synthetic tick

The current adapter is `createGraftSourceHighlighter(...)` in
`src/adapters/graft-source-highlighter.ts`. It loads the Graft runtime, asks it
for a projection bundle over the current editor text, and converts Graft syntax
classes into jedit source highlight roles.

When the result returns, jedit stores a `SourceHighlightReading` in the model if
the request id still matches the current request. This prevents old async
highlight results from overwriting newer ones.

During rendering, source highlights are used only when the reading path matches
the active editor path:

```ts
model.sourceHighlight?.path === model.editor.path
```

If there is no highlight reading, or if Graft fails, source mode still renders
plain text. The syntax layer is a paint-time enhancement, not a buffer
requirement.

## Theme Tokens In Source Rendering

The source painter does not hardcode colors.

Highlight spans carry semantic source roles such as keyword, comment, string,
or function. The active `JeditTheme` maps those roles to source token identities
through `theme.sourceRoleMap`. Then the painter looks up the actual style token
in `theme.source`.

The token controls the cell style:

- foreground color
- background color
- numeric RGB cache fields
- text modifiers
- future effect metadata such as transitions, gradients, and springs

The source renderer only consumes the token. Theme files decide what that token
means visually.

## Markdown Preview Rendering

Markdown preview is another projection over the same active buffer.

When the editor is in preview mode and the file is Markdown, `renderViewer(...)`
calls `renderPreview(...)`, which calls `paintMarkdownPreview(...)` in
`src/ui/markdown-preview.ts`.

Preview rendering starts by joining the visible projection in `editor.lines`
into text. The preview classifier then converts Markdown into preview lines and
segments:

- headings
- list markers
- quote markers and quote text
- code fence lines
- inline code
- horizontal rules
- body text

Those preview segments are not written back to the buffer. They are a render
projection.

Painting then walks the visible preview rows starting at `editor.scrollRow`.
Each segment tone maps through the active `JeditTheme` markdown tokens:

- body
- heading
- list marker
- quote marker
- quote text
- code
- inline code
- rule

Code fence rows also receive a themed background before segment text is blitted
over the row.

## Drawers And Footer

The file drawer, Graft drawer, Echo History drawer, and footer are not buffers.

They are independent projections over workspace state:

- The file drawer projects directory entries.
- The Graft drawer projects current-file Graft info.
- The Echo History drawer projects visible Echo evidence entries.
- The footer projects focus, mode, pending chord, active file, and selection
  context.

They render to their own surfaces and are blitted into the root workspace
surface. Their backgrounds also come from the active jedit theme.

When no editor is open, the viewer renders a themed title scene instead of a
buffer. That title scene is still just a projection: a deterministic procedural
surface for the current frame, plus a foreground ASCII logo layer. The scene
uses chrome title tokens for its tonal range and logo styling rather than
embedding renderer-owned colors.

## Mouse Scroll

The terminal is started with jedit mouse options from
`src/ui/terminal-mouse.ts`. That enables mouse reporting so wheel events go to
jedit instead of the terminal scrollback.

The update loop maps wheel input through `mouseScrollDeltaRows(...)`, then
routes the scroll to the focused surface:

- file drawer selection
- Graft drawer selection
- Echo History drawer selection
- source editor viewport
- Markdown preview viewport

For source buffers, scrolling changes `editor.scrollRow`. That can trigger a
new source highlight refresh for the newly visible window.

## Render Invariants

The current rendering pipeline is built around a few invariants:

- Visible projection text stays plain. No ANSI escapes or style metadata are
  stored in `editor.lines`.
- Renderers consume projections. Source windows, syntax spans, preview
  segments, drawers, and footer lines are all derived views.
- Styling is theme data. Renderers map roles and tones to tokens; theme files
  define visual decisions.
- Rendering is bounded by the viewport. The source renderer paints only the
  visible window, not the entire file.
- Graft is a projection engine. It can classify current text for rendering, but
  it does not own editable buffer truth.
- Bounded Echo readings are observation evidence. Only full projections may
  replace the whole visible editor projection.
- Bijou surfaces are the paint target. jedit composes surfaces first; terminal
  output happens after composition.

## Current Data Flow

The end-to-end source mode path is:

```text
host basis or Echo/session projection
  -> full local visible projection cache
  -> EditorState.lines
  -> bounded SourceWindowReading for the viewport
  -> optional SourceHighlightReading from Graft
  -> theme source tokens
  -> paintHighlightedSourceWindow
  -> renderSourceViewer cursor pass
  -> renderViewer surface
  -> renderWorkspace root surface
  -> Bijou terminal renderer
```

The end-to-end Markdown preview path is:

```text
EditorState.lines full visible projection
  -> join lines into Markdown text
  -> previewMarkdownLines
  -> theme markdown tokens
  -> paintMarkdownPreview
  -> renderViewer surface
  -> renderWorkspace root surface
  -> Bijou terminal renderer
```

These paths are intentionally boring. Echo/session authority can become richer
and projections can become smarter, but the render loop should remain a clear
conversion from a full visible projection to bounded projections to themed
cells.

The structural-history replace/tick witness path is separate from the render
loop:

```text
ReplaceTextRangeInput shape in GraphQL SDL
  -> generated replaceTextRange operation metadata
  -> executeReplaceTextRange
  -> admitReplaceRangeTick
  -> optional includeTickInOpenGroup
  -> ApplyBufferEditResult with operationName, nextState, and optional tickId
```

This path is about operation identity and causal admission. It should not leak
theme state, syntax classes, terminal surfaces, or filesystem projection
details into the structural-history contract.

## Appendix: Theme Token Glossary

<!-- markdownlint-disable MD013 -->

The default theme is `graphite`. jedit uses it when `JEDIT_THEME` is unset or
when the requested theme name does not match a built-in theme.

Foreground and background values below show the theme variable first and the
default `graphite` hex value second. Effects describe metadata carried by the
token. The current terminal renderer paints the token's starting color; richer
animation and gradient behavior can use the same metadata later.

### Color Variables

| Variable | Default `graphite` value | Used for |
| --- | --- | --- |
| `ink` | `rgb(226, 231, 236)` / `#e2e7ec` | Primary readable text. |
| `muted` | `rgb(126, 137, 148)` / `#7e8994` | Comments, quiet chrome, rule text. |
| `accent` | `rgb(216, 151, 255)` / `#d897ff` | Keywords, headings, active cursor background. |
| `info` | `rgb(101, 194, 255)` / `#65c2ff` | Informational text, headings, insert cursor. |
| `warning` | `rgb(245, 184, 92)` / `#f5b85c` | Operators, punctuation, soft headings, inline code. |
| `success` | `rgb(124, 213, 156)` / `#7cd59c` | Strings and success-toned source text. |
| `surface` | `rgb(14, 17, 22)` / `#0e1116` | Main workspace background. |
| `surface.raised` | `rgb(28, 32, 40)` / `#1c2028` | Code block and inline-code background. |
| `surface.muted` | `rgb(22, 26, 33)` / `#161a21` | Drawers and footer background. |

### Surface Tokens

| Token | Foreground | Background | Modifiers | Effects |
| --- | --- | --- | --- | --- |
| `surface.workspace` | `ink` / `#e2e7ec` | `surface` / `#0e1116` | none | none |
| `surface.drawer` | `ink` / `#e2e7ec` | `surface.muted` / `#161a21` | none | none |
| `surface.footer` | `ink` / `#e2e7ec` | `surface.muted` / `#161a21` | none | none |

### Chrome Tokens

| Token | Glyph | Foreground | Background | Modifiers | Effects |
| --- | --- | --- | --- | --- | --- |
| `chrome.activeEdge` | `░` | `accent` / `#d897ff` | preserve existing cell background | none | none |
| `chrome.titleLogo` | ASCII `jedit` logo | `accent` / `#d897ff` to `info` / `#65c2ff` | `surface` / `#0e1116` | `bold` | Foreground transition `easeInOut(6)`; gradient `accent -> info`. |
| `chrome.titleLogoShadow` | ASCII logo shadow | `muted` / `#7e8994` | `surface` / `#0e1116` | `dim` | none |
| `chrome.titleSceneNear` | Tonal ASCII scene cells | `ink` / `#e2e7ec` | `surface` / `#0e1116` | none | none |
| `chrome.titleSceneFar` | Tonal ASCII scene cells | `muted` / `#7e8994` | `surface` / `#0e1116` | none | none |

### Cursor Tokens

| Token | Foreground | Background | Modifiers | Effects |
| --- | --- | --- | --- | --- |
| `cursor.normal` | `ink` / `#e2e7ec` | `accent` / `#d897ff` | `inverse` | Spring `mass=1`, `stiffness=180`, `damping=24`. |
| `cursor.insert` | `info` / `#65c2ff` | none | `underline` | none |

### Source Tokens

These are the tokens used by source rendering after Graft syntax classes are
mapped into jedit source roles.

| Token | Foreground | Background | Modifiers | Effects |
| --- | --- | --- | --- | --- |
| `source.comment` | `muted` / `#7e8994` | none | `dim`, `italic` | none |
| `source.function` | `accent` / `#d897ff` | none | none | none |
| `source.keyword` | `accent` / `#d897ff` to `info` / `#65c2ff` | none | `bold` | Foreground transition `easeIn(0.2)`; gradient `accent -> info`; spring `mass=1`, `stiffness=160`, `damping=20`. |
| `source.number` | `info` / `#65c2ff` | none | none | none |
| `source.operator` | `warning` / `#f5b85c` | none | none | none |
| `source.property` | `ink` / `#e2e7ec` | none | none | none |
| `source.punctuation` | `warning` / `#f5b85c` | none | none | none |
| `source.string` | `success` / `#7cd59c` | none | none | none |
| `source.type` | `accent` / `#d897ff` | none | none | none |
| `source.variable` | `ink` / `#e2e7ec` | none | none | none |

### Markdown Tokens

These are the tokens used by Markdown preview after preview classification turns
Markdown lines into segment tones.

| Token | Foreground | Background | Modifiers | Effects |
| --- | --- | --- | --- | --- |
| `markdown.body` | `ink` / `#e2e7ec` | none | none | none |
| `markdown.headingStrong` | `accent` / `#d897ff` | none | `bold` | Gradient `accent -> info`. |
| `markdown.heading` | `info` / `#65c2ff` | none | `bold` | none |
| `markdown.headingSoft` | `warning` / `#f5b85c` | none | `bold` | none |
| `markdown.listMarker` | `accent` / `#d897ff` | none | none | none |
| `markdown.quoteMarker` | `muted` / `#7e8994` | none | none | none |
| `markdown.quoteText` | `info` / `#65c2ff` | none | none | none |
| `markdown.code` | `ink` / `#e2e7ec` | `surface.raised` / `#1c2028` | none | none |
| `markdown.inlineCode` | `warning` / `#f5b85c` | `surface.raised` / `#1c2028` | none | none |
| `markdown.rule` | `muted` / `#7e8994` | none | none | none |

### Modifier Vocabulary

Theme files may attach any of these modifier values to a token through
`draft.<group>.<token>.modifiers`.

| Modifier | Runtime string | Used by `graphite` default |
| --- | --- | --- |
| `JEDIT_TEXT_MODIFIER.Bold` | `bold` | `source.keyword`, `markdown.headingStrong`, `markdown.heading`, `markdown.headingSoft` |
| `JEDIT_TEXT_MODIFIER.Dim` | `dim` | `source.comment` |
| `JEDIT_TEXT_MODIFIER.Italic` | `italic` | `source.comment` |
| `JEDIT_TEXT_MODIFIER.Inverse` | `inverse` | `cursor.normal` |
| `JEDIT_TEXT_MODIFIER.Underline` | `underline` | `cursor.insert` |
| `JEDIT_TEXT_MODIFIER.CurlyUnderline` | `curly-underline` | not used by `graphite` |
| `JEDIT_TEXT_MODIFIER.DottedUnderline` | `dotted-underline` | not used by `graphite` |
| `JEDIT_TEXT_MODIFIER.DashedUnderline` | `dashed-underline` | not used by `graphite` |
| `JEDIT_TEXT_MODIFIER.Strikethrough` | `strikethrough` | not used by `graphite` |

### Effect Vocabulary

Theme files can declare solid colors, color transitions, gradients, and springs.
The token stores these as data even when the current renderer only paints the
starting foreground or background color.

| Effect type      | Theme API                                                     | Default usage                               |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------- |
| Solid color      | `draft.rgb(r, g, b)` or a variable from `draft.variable(...)` | Most foreground and background tokens.      |
| Color transition | `from.to(to).linear(seconds)`                                 | Available; not used by `graphite`.          |
| Color transition | `from.to(to).easeIn(seconds)`                                 | `source.keyword.foregroundColor`.           |
| Color transition | `from.to(to).easeOut(seconds)`                                | Available; not used by `graphite`.          |
| Color transition | `from.to(to).easeInOut(seconds)`                              | Available; not used by `graphite`.          |
| Gradient         | `draft.gradient(first, second)`                               | `source.keyword`, `markdown.headingStrong`. |
| Spring           | `draft.spring({ mass, stiffness, damping })`                  | `cursor.normal`, `source.keyword`.          |

<!-- markdownlint-enable MD013 -->
