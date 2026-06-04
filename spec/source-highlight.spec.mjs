import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { REPO_ROOT, ensureDistBuilt } from "./dist-helpers.mjs";

const PORT_PATH = path.join(
  REPO_ROOT,
  "dist",
  "ports",
  "source-highlighter.js",
);
const WINDOW_PATH = path.join(REPO_ROOT, "dist", "ui", "source-window.js");
const HIGHLIGHT_PATH = path.join(
  REPO_ROOT,
  "dist",
  "ui",
  "source-highlight.js",
);
const THEME_BUILDER_PATH = path.join(
  REPO_ROOT,
  "dist",
  "ui",
  "theme-builder.js",
);
const JEDIT_THEME_PATH = path.join(REPO_ROOT, "dist", "ui", "jedit-theme.js");

async function loadSourceHighlightModules() {
  await ensureDistBuilt();

  return {
    port: await import(pathToFileURL(PORT_PATH).href),
    sourceWindow: await import(pathToFileURL(WINDOW_PATH).href),
    sourceHighlight: await import(pathToFileURL(HIGHLIGHT_PATH).href),
    themeBuilder: await import(pathToFileURL(THEME_BUILDER_PATH).href),
    jeditTheme: await import(pathToFileURL(JEDIT_THEME_PATH).href),
  };
}

test("source highlight painter applies jedit theme token styles to Graft-derived spans", async () => {
  const { createSurface } = await import("@flyingrobots/bijou");
  const { port, sourceWindow, sourceHighlight, themeBuilder, jeditTheme } =
    await loadSourceHighlightModules();
  const workspaceBackground = themeBuilder.rgb(8, 12, 16);
  const workspaceForeground = themeBuilder.rgb(225, 230, 235);
  const keywordColor = themeBuilder.rgb(18, 42, 201);
  const keywordBackground = themeBuilder.rgb(4, 9, 32);
  const stringColor = themeBuilder.rgb(20, 155, 90);
  const commentColor = themeBuilder.rgb(130, 130, 140);
  const theme = themeBuilder.defineJeditTheme(
    "source-highlight-spec",
    (draft) => {
      draft.surface.workspace.foregroundColor = workspaceForeground;
      draft.surface.workspace.backgroundColor = workspaceBackground;
      draft.source.keyword.foregroundColor = keywordColor;
      draft.source.keyword.backgroundColor = keywordBackground;
      draft.source.keyword.modifiers = [
        jeditTheme.JEDIT_TEXT_MODIFIER.Underline,
      ];
      draft.source.string.foregroundColor = stringColor;
      draft.source.comment.foregroundColor = commentColor;
      draft.source.comment.modifiers = [
        jeditTheme.JEDIT_TEXT_MODIFIER.Strikethrough,
      ];
    },
  );
  const surface = createSurface(24, 2, { char: " ", empty: false });
  const reading = sourceWindow.createSourceWindowReadingFromLines({
    lines: ['const answer = "ok";', "// quiet"],
    startLine: 0,
    lineCount: 2,
  });

  sourceHighlight.paintHighlightedSourceWindow(
    surface,
    reading,
    {
      path: "src/app.ts",
      partial: false,
      spans: [
        {
          role: port.SOURCE_HIGHLIGHT_ROLE.Keyword,
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 5 } },
        },
        {
          role: port.SOURCE_HIGHLIGHT_ROLE.String,
          range: { start: { row: 0, column: 15 }, end: { row: 0, column: 19 } },
        },
        {
          role: port.SOURCE_HIGHLIGHT_ROLE.Comment,
          range: { start: { row: 1, column: 0 }, end: { row: 1, column: 8 } },
        },
      ],
    },
    {
      x: 0,
      y: 0,
      scrollCol: 0,
      width: 24,
      height: 2,
      theme,
    },
  );

  const keywordCell = surface.get(0, 0);
  assert.equal(keywordCell.char, "c");
  assert.equal(keywordCell.fg, keywordColor.hex);
  assert.equal(keywordCell.bg, keywordBackground.hex);
  assert.deepEqual(keywordCell.modifiers, [
    jeditTheme.JEDIT_TEXT_MODIFIER.Underline,
  ]);

  const normalTextCell = surface.get(6, 0);
  assert.equal(normalTextCell.char, "a");
  assert.equal(normalTextCell.bg, workspaceBackground.hex);
  assert.deepEqual(normalTextCell.bgRGB, workspaceBackground.rgb);

  const trailingCell = surface.get(23, 0);
  assert.equal(trailingCell.char, " ");
  assert.equal(trailingCell.bg, workspaceBackground.hex);
  assert.deepEqual(trailingCell.bgRGB, workspaceBackground.rgb);

  const stringCell = surface.get(15, 0);
  assert.equal(stringCell.char, '"');
  assert.equal(stringCell.fg, stringColor.hex);
  assert.equal(stringCell.bg, workspaceBackground.hex);

  const commentCell = surface.get(0, 1);
  assert.equal(commentCell.char, "/");
  assert.equal(commentCell.fg, commentColor.hex);
  assert.equal(commentCell.bg, workspaceBackground.hex);
  assert.deepEqual(commentCell.modifiers, [
    jeditTheme.JEDIT_TEXT_MODIFIER.Strikethrough,
  ]);
});

test("source highlight painter fills blank viewport rows with theme background", async () => {
  const { createSurface } = await import("@flyingrobots/bijou");
  const { sourceWindow, sourceHighlight, themeBuilder } =
    await loadSourceHighlightModules();
  const workspaceBackground = themeBuilder.rgb(32, 11, 42);
  const theme = themeBuilder.defineJeditTheme(
    "source-blank-background-spec",
    (draft) => {
      draft.surface.workspace.backgroundColor = workspaceBackground;
    },
  );
  const surface = createSurface(12, 4, { char: ".", empty: false });
  const reading = sourceWindow.createSourceWindowReadingFromLines({
    lines: ["x"],
    startLine: 0,
    lineCount: 4,
  });

  sourceHighlight.paintHighlightedSourceWindow(surface, reading, undefined, {
    x: 0,
    y: 0,
    scrollCol: 0,
    width: 12,
    height: 4,
    theme,
  });

  const blankRowCell = surface.get(0, 2);
  assert.equal(blankRowCell.char, " ");
  assert.equal(blankRowCell.bg, workspaceBackground.hex);
  assert.deepEqual(blankRowCell.bgRGB, workspaceBackground.rgb);
});
