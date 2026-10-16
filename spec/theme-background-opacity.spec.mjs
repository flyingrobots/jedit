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

// Painting cells by hand loses what bijou's stringToSurface does for free:
// terminal control bytes are stripped before they reach a cell. Without that, a
// Markdown file carrying a CSI clear-screen or a BEL has them written verbatim
// into the surface and concatenated into terminal output by the diff writer --
// opening a file becomes enough to drive the terminal.
const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);

test("terminal control bytes in Markdown never reach a cell", async () => {
  const themes = await importDist("ui", "jedit-themes.js");
  const preview = await importDist("ui", "markdown-preview.js");
  const [theme] = themes.availableJeditThemes();
  const surface = await workspacePage(theme);

  preview.paintMarkdownPreview(surface, {
    text: `before ${ESC}[2J ${BEL} ${ESC}]0;title${BEL} after`,
    scrollRow: 0,
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    theme,
  });

  const offenders = [];
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const char = surface.get(x, y).char;
      const code = char.codePointAt(0) ?? 0;
      // C0 controls and DEL. Space and the Braille blank are ordinary content.
      if (code < 0x20 || code === 0x7f) {
        offenders.push(`(${x},${y}) U+${code.toString(16).padStart(4, "0")}`);
      }
    }
  }

  assert.deepEqual(offenders, []);
});
