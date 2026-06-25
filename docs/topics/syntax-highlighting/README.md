# Syntax highlighting

Syntax highlighting in `jedit` is a derived projection over the current editor
buffer. It is not buffer truth, edit truth, or a second parser-owned document
model.

`jedit` owns the editor session, text lifecycle, cursoring, panels, rendering,
and theme application. Graft owns structural projections such as syntax spans.
The source pane combines those two pieces by asking a `SourceHighlighter` port
for spans, then painting the visible cells with the active `JeditTheme`.

## Runtime path

The production path is:

1. The workspace opens, edits, scrolls, or returns from Markdown preview to
   source view.
2. `beginSourceHighlightRefresh()` creates a source-highlight request for the
   current editor.
3. The request includes the file path, the full in-memory buffer text, the
   visible line window, and a request-basis pair: `headId` and `tick`.
4. `createGraftSourceHighlighter()` loads the Graft runtime and waits for
   `ensureParserReady()`.
5. Graft creates a projection bundle over `path + content` with an
   `editor_head` basis and viewport.
6. `jedit` maps supported Graft syntax classes into `SourceHighlightRole`
   symbols.
7. The source renderer paints visible cells by mapping each role through the
   active theme's `sourceRoleMap`.

The important ownership rule is that Graft returns facts about a snapshot.
`jedit` decides whether those facts are still relevant to the active editor and
how to render them.

## Why `ensureParserReady()` exists

Graft uses parser runtime state before it can create parser-backed structural
projections. `ensureParserReady()` is the readiness boundary for that runtime.

`jedit` calls it immediately before asking Graft for a projection bundle. That
keeps the editor adapter honest: a highlight request is not considered complete
until Graft's parser runtime can answer it.

This is a readiness wait, not an editor mutation. While it is pending, the
editor can continue to change. When the result returns, `jedit` compares the
message request ID with the current source-highlight request ID and ignores
stale results.

## Span roles

Graft currently emits class names. `jedit` accepts only the classes it knows how
to theme:

| Graft class | `jedit` role |
| --- | --- |
| `comment` | `Comment` |
| `function` | `Function` |
| `keyword` | `Keyword` |
| `number` | `Number` |
| `operator` | `Operator` |
| `property` | `Property` |
| `punctuation` | `Punctuation` |
| `string` | `String` |
| `type` | `Type` |
| `variable` | `Variable` |

Unknown classes are dropped instead of being guessed. A theme may also omit a
role style; in that case the renderer keeps the normal workspace style for that
cell.

## Plain-text prose and Colorful

Graft can project plain-text prose spans when the Colorful CLI is available.
`jedit` wires this by giving Graft a Colorful CLI prose projector.

The production adapter invokes the `colorful` command through a process
runner. Graft checks the installed CLI version and only enables prose projection
when `colorful >= 0.2.1` is available on the `PATH` inherited by the running
`jedit` process.

If Colorful is missing, too old, or returns invalid data, source editing still
works. Prose highlighting is simply inactive for that projection.

From a local Colorful checkout, the project-provided installer places the CLI
under `~/.colorful-language/bin`:

```sh
scripts/install-local.sh
```

After installing it, make sure the directory is on `PATH` before launching
`jedit`:

```sh
export PATH="$HOME/.colorful-language/bin:$PATH"
```

Restart `jedit` after changing `PATH`; an already-running process does not pick
up shell configuration changes made later.

## Why Colorful is not loaded as a library today

The current released integration boundary is:

- `jedit` depends on the Graft npm package.
- Graft owns syntax and prose projection behavior.
- Colorful is consumed by Graft as an external CLI projector.

That shape lets `jedit` stay out of Colorful's Rust implementation details and
keeps prose projection behind the same Graft-owned structural-intelligence
boundary as language syntax spans.

Loading Colorful as a library would require a different released boundary. For
example, Graft could expose a prose-projector provider API backed by a native
module, WebAssembly package, or direct Rust crate bridge. Until that exists,
the CLI boundary is the real contract.

## Causality and staleness

Highlighting is basis-bound, but it is not causal editor truth.

The `headId` and `tick` sent to Graft describe the projection basis for a
request. They let `jedit` bind a returned projection to the request that
created it and reject stale responses. They do not create Echo history, change
undo state, or mutate the buffer.

A future richer integration should treat highlighter output as a projection
receipt:

- the file path and content basis it observed;
- the highlighter adapter name and version;
- the parser or prose engine version;
- whether the result was complete or partial;
- any warning or failure posture.

That receipt can explain why the user saw a highlight at a moment in time. It
must not become authority over the editor buffer.

## Extension posture

`jedit` does not currently expose a public third-party syntax-highlighter plugin
API.

The internal seam that would support one is the `SourceHighlighter` port. A
future plugin system should formalize adapters around that seam rather than
letting plugins paint terminal cells directly.

A highlighter plugin should return spans or projection receipts, not UI
commands. It should declare:

- supported path patterns or file types;
- output roles and role vocabulary;
- required external tools or runtimes;
- version and capability information;
- resource limits and timeout behavior;
- failure posture for partial, stale, or unavailable projections.

For causal safety, a plugin must not mutate editor state directly. Any
plugin-suggested edit should enter through an explicit proposal or command path
that `jedit` can validate, execute, and record.

## Troubleshooting

### Plain text has no prose highlighting

Check that `colorful` is available on the same `PATH` used to launch `jedit`:

```sh
colorful --version
```

If the command is missing, install Colorful and restart `jedit`.

If the command exists but the version is lower than `0.2.1`, upgrade Colorful.
Graft deliberately requires a version new enough to provide the prose projection
contract `jedit` expects.

### Source highlighting disappears while editing

This usually means the most recent projection failed, returned no known spans,
or was still pending while the editor rendered. The renderer falls back to the
workspace style instead of blocking editing.

If this persists for a language Graft should support, inspect the Graft
projection path first. `jedit` only consumes spans Graft returns through the
`SourceHighlighter` adapter.

### A span class renders like normal text

Either the Graft class is not mapped to a `jedit` source role, or the active
theme does not define a style for that role. Unknown classes are ignored by
design so that a new Graft class cannot silently pick an incorrect visual
meaning.

## Code map

| File | Responsibility |
| --- | --- |
| [`src/ports/source-highlighter.ts`](../../../src/ports/source-highlighter.ts) | Port contract for highlight requests and span readings. |
| [`src/app/source-highlight-session.ts`](../../../src/app/source-highlight-session.ts) | Request lifecycle, stale-result rejection, and error-to-reading conversion. |
| [`src/adapters/graft-source-highlighter.ts`](../../../src/adapters/graft-source-highlighter.ts) | Production Graft adapter and Colorful CLI projector wiring. |
| [`src/app/workspace/editor-session.ts`](../../../src/app/workspace/editor-session.ts) | Workspace projection refresh orchestration. |
| [`src/app/workspace/viewer-content.ts`](../../../src/app/workspace/viewer-content.ts) | Selection of highlighted source rendering versus other viewer modes. |
| [`src/ui/source-highlight.ts`](../../../src/ui/source-highlight.ts) | Cell-level rendering of source text with highlight spans. |
| [`src/ui/theme-builder.ts`](../../../src/ui/theme-builder.ts) | Default mapping from source roles to theme tokens. |
| [`src/ui/jedit-theme.ts`](../../../src/ui/jedit-theme.ts) | Theme data model for source-token styles. |
