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

test("inline panel renders structured causal details after its summary", async () => {
  const panel = await loadWhyInlinePanelModule();
  const surface = panel.renderWhyInlinePanel({
    title: "Why range",
    message: "6..9 at head:2",
    detailRows: ["leaf leaf:2", "rewrite rewrite:4", "receipt tick:4"],
    tone: panel.WHY_INLINE_PANEL_TONE.Info,
    theme: panelTheme(),
    width: 32,
    maxRows: 6,
  });
  const text = surfaceRows(surface).join("\n");

  assert.match(text, /leaf leaf:2/);
  assert.match(text, /rewrite rewrite:4/);
  assert.match(text, /receipt tick:4/);
});

test("inline panel wraps long causal identities instead of truncating their tail", async () => {
  const panel = await loadWhyInlinePanelModule();
  const surface = panel.renderWhyInlinePanel({
    title: "Why range",
    message: "evidence",
    detailRows: [`receipt=${"a".repeat(24)}tail`],
    tone: panel.WHY_INLINE_PANEL_TONE.Info,
    theme: panelTheme(),
    width: 14,
    maxRows: 8,
  });

  assert.match(surfaceRows(surface).join("\n"), /tail/);
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
