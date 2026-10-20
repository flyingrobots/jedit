# Title Screen

The title screen is the first Jim surface when no file has been opened. It is
both a product identity surface and a usable file-opening surface.

<img src="./title-screen.svg" alt="Title screen layout across wide, narrow, and xs terminal profiles." />

## How To Open It

Start Jim without a file argument:

```sh
npm run dev
```

In an installed build, launch the Jim executable without a path. The title
screen remains active until a file or workspace entry is opened.

## What It Shows

The current title screen renders a ray-traced scene in terminal cells. The
scene is decorative, but it is still a live Jim screen and must obey the same
chrome rules as the editor:

- the active title appears in the top chrome;
- performance and scene details can appear in debug overlays;
- footer hints describe available navigation and command shortcuts;
- file opening should route through the same production text path as later
  editor commands.

The title renderer is intentionally separate from source editing. It must not
own text authority, file authority, or settings authority.

## Keyboard Use

Common title-screen actions:

| Key | Action |
| --- | --- |
| `:` | Open Normal-mode command line. |
| `ctrl+b` | Open the files drawer. |
| `ctrl+g` | Open the Graft drawer when available. |
| `ctrl+t` | Cycle theme. |
| `F2` | Open settings. |

The exact footer text is the runtime hint source. If this page and the footer
disagree, the footer is more likely to match the running build.

## File Opening

From the title screen, `:edit <path>` and file completion should use the same
workspace file-opening behavior as the files drawer. Selecting a directory must
descend into that directory. Selecting a file must open it through the
production Echo-backed text session.

## Developer Tools

The title scene is frozen (see
[title-scene-freeze.md](../../method/title-scene-freeze.md)), but its
developer tools remain. Each renders headlessly, without a terminal UI, and
each has a machine-readable output that agents can consume.

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
plain report. `spec/title-scene-profile-cli.spec.mjs` pins this, including
Braille temporal sampling and the allocation-posture witness.

## Implementation Map

| File | Responsibility |
| --- | --- |
| [`src/ui/title-screen.ts`](../../../src/ui/title-screen.ts) | Title scene surface rendering. |
| [`src/ui/title-scene.ts`](../../../src/ui/title-scene.ts) | Ray-traced title scene rendering. |
| [`src/app/title-camera-session.ts`](../../../src/app/title-camera-session.ts) | Title camera interaction state. |
| [`src/app/workspace/title-screen-key-bindings.ts`](../../../src/app/workspace/title-screen-key-bindings.ts) | Title-screen key routing. |
| [`src/app/workspace/file-tree.ts`](../../../src/app/workspace/file-tree.ts) | Shared file entry open behavior. |
