import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";

// A theme owns the background of every cell it paints. A style token that
// specifies no background means "inherit the surface underneath", not "erase
// it" -- writing an undefined bg punches a hole through to the terminal's own
// background, which on a dark theme happens to resemble the workspace and on a
// light theme shows up as black blocks behind the text.

const PAGE_WIDTH = 80;
const PAGE_HEIGHT = 24;

const SAMPLE_MARKDOWN = [
  "# Heading",
  "",
  "Body text with `inline code` in it.",
  "",
  "- a list item",
  "> a quote",
  "",
  "```",
  "code fence",
  "```",
  "",
  "---",
].join("\n");

async function workspacePage(theme) {
  const { createSurface } = await import("@flyingrobots/bijou");
  const token = theme.surface.workspace;
  const surface = createSurface(PAGE_WIDTH, PAGE_HEIGHT, { char: " ", empty: false });
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      surface.set(x, y, {
        char: " ",
        opacity: 1,
        fg: token.fg,
        fgRGB: token.fgRGB,
        bg: token.bg,
        bgRGB: token.bgRGB,
        empty: false,
      });
    }
  }
  return surface;
}

function cellsWithoutBackground(surface) {
  const holes = [];
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const cell = surface.get(x, y);
      if (cell.bg == null || cell.bgRGB == null) {
        holes.push({ x, y, char: cell.char });
      }
    }
  }
  return holes;
}

test("the markdown preview never punches a hole in the page background", async () => {
  const themes = await importDist("ui", "jedit-themes.js");
  const preview = await importDist("ui", "markdown-preview.js");
  const offenders = [];

  for (const theme of themes.availableJeditThemes()) {
    const surface = await workspacePage(theme);
    preview.paintMarkdownPreview(surface, {
      text: SAMPLE_MARKDOWN,
      scrollRow: 0,
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      theme,
    });
    const holes = cellsWithoutBackground(surface);
    if (holes.length > 0) {
      const sample = holes.slice(0, 3).map((h) => `(${h.x},${h.y})"${h.char}"`).join(" ");
      offenders.push(`${theme.name} (${theme.mode}): ${holes.length} cells, e.g. ${sample}`);
    }
  }

  assert.deepEqual(offenders, []);
});

test("the source viewer never punches a hole in the page background", async () => {
  const themes = await importDist("ui", "jedit-themes.js");
  const viewer = await importDist("ui", "source-viewer.js");
  const offenders = [];

  const lines = [
    "const answer = 42;",
    "// a comment",
    "function greet(name) {",
    "  return `hello ${name}`;",
    "}",
  ];

  for (const theme of themes.availableJeditThemes()) {
    const surface = await workspacePage(theme);
    viewer.renderSourceViewer(
      surface,
      { lines, cursorRow: 0, cursorCol: 0, scrollRow: 0, mode: "normal" },
      undefined,
      {
        viewport: { width: PAGE_WIDTH - 8, height: PAGE_HEIGHT - 2 },
        leftPad: 0,
        topPad: 0,
        theme,
      },
    );
    const holes = cellsWithoutBackground(surface);
    if (holes.length > 0) {
      const sample = holes.slice(0, 3).map((h) => `(${h.x},${h.y})"${h.char}"`).join(" ");
      offenders.push(`${theme.name} (${theme.mode}): ${holes.length} cells, e.g. ${sample}`);
    }
  }

  assert.deepEqual(offenders, []);
});
