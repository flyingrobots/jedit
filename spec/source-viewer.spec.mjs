import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { REPO_ROOT, ensureDistBuilt } from "./dist-helpers.mjs";

const SOURCE_VIEWER_PATH = path.join(REPO_ROOT, "dist", "ui", "source-viewer.js");

async function loadSourceViewerModule() {
  await ensureDistBuilt();
  return import(pathToFileURL(SOURCE_VIEWER_PATH).href);
}

test("source viewer paints a stable line-number gutter before source text", async () => {
  const { createSurface } = await import("@flyingrobots/bijou");
  const sourceViewer = await loadSourceViewerModule();
  const surface = createSurface(24, 3, { char: ".", empty: false });

  sourceViewer.renderSourceViewer(
    surface,
    {
      lines: Array.from({ length: 12 }, (_, index) => `line-${index + 1}`),
      cursorRow: 9,
      cursorCol: 0,
      scrollRow: 8,
      scrollCol: 0,
      mode: "normal",
    },
    undefined,
    {
      viewport: { width: 24, height: 3 },
      leftPad: 0,
      topPad: 0,
      theme: sourceViewerTheme(),
    },
  );

  assert.equal(sourceViewer.sourceViewerGutterWidth(12), 4);
  assert.equal(rowText(surface, 0).startsWith(" 9│ line-9"), true);
  assert.equal(rowText(surface, 1).startsWith("10│ line-10"), true);
  assert.equal(rowText(surface, 2).startsWith("11│ line-11"), true);
});

test("source viewer can paint cursor-relative line numbers", async () => {
  const { createSurface } = await import("@flyingrobots/bijou");
  const sourceViewer = await loadSourceViewerModule();
  const surface = createSurface(24, 5, { char: ".", empty: false });

  sourceViewer.renderSourceViewer(
    surface,
    {
      lines: Array.from({ length: 5 }, (_, index) => `line-${index + 1}`),
      cursorRow: 2,
      cursorCol: 0,
      scrollRow: 0,
      scrollCol: 0,
      mode: "normal",
    },
    undefined,
    {
      viewport: { width: 24, height: 5 },
      leftPad: 0,
      topPad: 0,
      theme: sourceViewerTheme(),
      lineNumberMode: "relative",
    },
  );

  assert.equal(sourceViewer.sourceViewerGutterWidth(5, 2, "relative"), 4);
  assert.equal(rowText(surface, 0).startsWith("-2│ line-1"), true);
  assert.equal(rowText(surface, 1).startsWith("-1│ line-2"), true);
  assert.equal(rowText(surface, 2).startsWith(" 0│ line-3"), true);
  assert.equal(rowText(surface, 3).startsWith("+1│ line-4"), true);
  assert.equal(rowText(surface, 4).startsWith("+2│ line-5"), true);
});

function sourceViewerTheme() {
  const workspace = token("#f0f6fc", "#0d1117");
  const gutter = token("#8b949e", "#0d1117");
  const edge = { ...token("#58a6ff", "#0d1117"), char: "│" };
  return {
    surface: {
      workspace,
    },
    cursor: {
      normal: token("#0d1117", "#58a6ff"),
      insert: token("#0d1117", "#7ee787"),
    },
    chrome: {
      activeEdge: edge,
      titleLogoShadow: gutter,
    },
    source: new Map(),
    sourceRoleMap: new Map(),
  };
}

function token(fg, bg) {
  return {
    fg,
    bg,
    foregroundVariables: [],
    backgroundVariables: [],
  };
}

function rowText(surface, row) {
  let text = "";
  for (let col = 0; col < surface.width; col += 1) {
    text += surface.get(col, row).char;
  }
  return text;
}
