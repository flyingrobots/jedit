# Title Screen

The title screen is the first Jim surface when no file has been opened. It
shows the static Jim logo and ordinary workspace chrome.

## How To Open It

Start Jim without a file argument:

```sh
npm run dev
```

In a built checkout, use `npm start`. The no-buffer view remains until a file
is opened and returns when no buffer is displayed.

## What It Shows

The body renders committed logo artwork sized to the available viewport. It
has no live ray tracing, scene selection, camera controls, shader/material
selection, mouse look, or title-scene performance panel. Startup does not load
meshes or a scene loader. Once startup completes, an idle tick preserves the
model reference and does not request another render.

The title row, footer, file drawer, Settings, theme selection, and generic
performance instrumentation retain their existing behavior. The title renderer
has no text authority. File opening uses the production Echo-backed text session.

## Keyboard Use

| Key | Action |
| --- | --- |
| `:` | Open the command line. |
| `Ctrl+B` | Toggle the files drawer. |
| `Ctrl+G` | Toggle the Graft drawer when available. |
| `Ctrl+T` | Cycle theme. |
| `F2` | Toggle Settings. |
| `Esc` or `q` | Open quit confirmation. |

Space, WASD, arrow keys, `1`, `2`, `.`, `m`, and `M` have no camera or shader
meaning on the title screen. `Ctrl+L` no longer opens a scene picker. Pointer
movement does not change the logo. Focused drawers and the command line retain
ownership of their own keys.

## File Opening

`:edit <path>` and file completion use the same workspace file-opening behavior
as the files drawer. Selecting a directory descends into it. Selecting a file
opens it through the production text session.

## Small Terminals

At 60×16, the logo fits the viewer and drawers retain their existing scrolling
behavior. Below the 60×12 minimum, Jim shows its existing size notice.

## Standalone Scene Tools

The ray-tracer engine and scene assets remain available to the explicit
`title:preview`, `title:profile`, and `title:record` tools. They are separate
from the live workspace; no title-screen action loads them. The engine and
assets are frozen (see
[title-scene-freeze.md](../../method/title-scene-freeze.md)). Each tool renders
headlessly, without a terminal UI, and each has a machine-readable output that
agents can consume.

`npm run title:record` (`scripts/title-scene-record.mjs`) exports frames of a
scene. Options: `--format json|text|html|ansi` (default `json`), `--frames`
(default 1), `--width` (default 96), `--height` (default 28), `--start`
(default 0) and `--step` (default 0.5) in seconds, `--scene`, `--theme`,
`--render-mode braille|ascii`, `--camera-angle`, `--camera-radius`, and
`--output <path>`. JSON output has a top-level `recording` object (format,
width, height, frame count, start and step, scene, theme, render mode, and
camera) and a `frames` array whose entries have a stable `index`,
`timeSeconds`, `glyphRows` (one string per terminal row), and `colorRows` (one
row per terminal row, one `{ fgRGB, bgRGB }` object per cell). The same options
produce byte-identical output. Invalid options print usage to stderr and exit
with code 2. `spec/title-scene-record-cli.spec.mjs` pins this.

`npm run title:preview` (`scripts/title-scene-preview.mjs`) renders one frame
for authoring inspection. `--json` emits a deterministic report with a
`preview` object (scene, render mode, time) and an `inspector` object (including
the selected scene object); `--no-frame` omits the rendered frame. Without
`--json` it prints a plain frame with inspector text.
`spec/title-scene-preview-cli.spec.mjs` pins this.

`npm run title:profile` (`scripts/title-scene-profile.mjs`) times rendering
over `--frames` frames after `--warmup` frames. `--json` emits a report with
`scene` (name, object count), `render` (mode, width, height, frames, primary
samples per frame and in total), `timing` (including `minMs`, `avgMs`, and
`maxMs`), and a `checksum` of the rendered output; without `--json` it prints a
plain report. In Braille render mode the report also carries an `allocation`
witness from `scripts/title-scene-allocation-witness.mjs`. Its `posture` is evidence,
not a proof of allocation behavior: it is `unmeasured` when allocation
instrumentation is unavailable (run Node with `--expose-gc`), and also when the
forced-GC retained-heap delta is zero, because a zero retained delta does not
show that no allocation happened. Only a positive retained delta reports
`allocating`. The witness never reports `bounded-after-warmup` or
`zero-hot-loop`. `spec/title-scene-profile-cli.spec.mjs` pins this, including
Braille temporal sampling and these postures.

## Implementation Map

| File | Responsibility |
| --- | --- |
| [`src/ui/jim-logo-screen.ts`](../../../src/ui/jim-logo-screen.ts) | Static logo artwork rendering and viewport fit. |
| [`src/app/workspace/viewer-content.ts`](../../../src/app/workspace/viewer-content.ts) | Select static logo, source, or Markdown preview. |
| [`src/app/workspace/title-screen-key-bindings.ts`](../../../src/app/workspace/title-screen-key-bindings.ts) | No-buffer Escape quit-confirmation routing. |
| [`src/app/workspace/file-tree.ts`](../../../src/app/workspace/file-tree.ts) | Shared file entry opening. |
| [`spec/static-title-screen.spec.mjs`](../../../spec/static-title-screen.spec.mjs) | Input, rendering, stale-message, idle, and module-loading witnesses. |
