import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { REPO_ROOT, ensureDistBuilt } from "./dist-helpers.mjs";

const WHY_INLINE_PANEL_PATH = path.join(REPO_ROOT, "dist", "ui", "why-inline-panel.js");

async function loadWhyInlinePanelModule() {
  await ensureDistBuilt();
  return import(pathToFileURL(WHY_INLINE_PANEL_PATH).href);
}

test("inline panel wrapping does not spend a capped row on blanks before long words", async () => {
  const panel = await loadWhyInlinePanelModule();
  const surface = panel.renderWhyInlinePanel({
    title: "Why",
    message: "supercalifragilisticexpialidocious obstruction",
    tone: panel.WHY_INLINE_PANEL_TONE.Info,
    theme: panelTheme(),
    width: 10,
    maxRows: 3,
  });
  const rows = surfaceRows(surface);

  assert.equal(rows[0].includes("i Why"), true);
  assert.notEqual(rows[1].trim(), "");
  assert.match(rows[1], /super/);
});

function panelTheme() {
  const workspace = token("#f0f6fc", "#0d1117");
  const drawer = token("#f0f6fc", "#161b22");
  const accent = { ...token("#58a6ff", "#161b22"), char: "│" };
  return {
    variables: new Map(),
    surface: {
      workspace,
      drawer,
    },
    chrome: {
      activeEdge: accent,
    },
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

function surfaceRows(surface) {
  const rows = [];
  for (let y = 0; y < surface.height; y += 1) {
    let row = "";
    for (let x = 0; x < surface.width; x += 1) {
      row += surface.get(x, y).char;
    }
    rows.push(row);
  }
  return rows;
}
