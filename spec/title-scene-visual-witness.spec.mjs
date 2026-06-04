import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { REPO_ROOT } from "./dist-helpers.mjs";
import {
  cells,
  fixedTitleRenderOptions,
  loadTitleModules,
} from "./title-screen-helpers.mjs";

const FIXTURE_PATH = path.join(
  REPO_ROOT,
  "spec",
  "fixtures",
  "title-scene-visual-witness.json",
);
const WITNESS_COLS = 42;
const WITNESS_ROWS = 14;
const LOGO_VISIBLE_TIME = 2.25;
const LOGO_FADED_TIME = 6.75;
const LATE_ORBIT_TIME = 8.25;
const DIGEST_LENGTH = 16;

test("title scene visual witness matches compact golden fixture", async () => {
  const expected = loadFixture();
  const actual = await titleSceneVisualWitness();

  assert.deepEqual(
    actual.map((entry) => entry.name),
    expected.map((entry) => entry.name),
    "title visual witness case order changed",
  );

  for (const expectedEntry of expected) {
    const actualEntry = actual.find(
      (entry) => entry.name === expectedEntry.name,
    );
    assert.ok(
      actualEntry != null,
      `${expectedEntry.name} witness case is missing`,
    );
    assert.equal(
      actualEntry.cols,
      expectedEntry.cols,
      `${expectedEntry.name} width changed`,
    );
    assert.equal(
      actualEntry.rows,
      expectedEntry.rows,
      `${expectedEntry.name} height changed`,
    );
    assert.deepEqual(
      actualEntry.glyphRows,
      expectedEntry.glyphRows,
      `${expectedEntry.name} glyph rows drifted`,
    );
    assert.equal(
      actualEntry.foregroundDigest,
      expectedEntry.foregroundDigest,
      `${expectedEntry.name} foreground colors drifted`,
    );
    assert.equal(
      actualEntry.backgroundDigest,
      expectedEntry.backgroundDigest,
      `${expectedEntry.name} background colors drifted`,
    );
  }
});

async function titleSceneVisualWitness() {
  const { title, themes } = await loadTitleModules();
  const cases = [
    {
      name: "graphite-braille-logo-visible",
      theme: themeByName(themes, "graphite"),
      time: LOGO_VISIBLE_TIME,
      options: fixedTitleRenderOptions(),
    },
    {
      name: "graphite-braille-logo-faded",
      theme: themeByName(themes, "graphite"),
      time: LOGO_FADED_TIME,
      options: fixedTitleRenderOptions(),
    },
    {
      name: "morning-ascii-logo-faded",
      theme: themeByName(themes, "morning"),
      time: LOGO_FADED_TIME,
      options: fixedTitleRenderOptions({
        renderMode: title.TITLE_RENDER_MODE.Ascii,
        asciiPalette: title.TITLE_ASCII_PALETTE.Dense,
      }),
    },
    {
      name: "solarized-dark-braille-late-orbit",
      theme: themeByName(themes, "solarized-dark"),
      time: LATE_ORBIT_TIME,
      options: fixedTitleRenderOptions(),
    },
  ];

  return cases.map((renderCase) => {
    const surface = title.renderTitleScreen(
      WITNESS_COLS,
      WITNESS_ROWS,
      renderCase.time,
      renderCase.theme,
      renderCase.options,
    );
    return titleSceneVisualWitnessEntry(renderCase.name, surface);
  });
}

function titleSceneVisualWitnessEntry(name, surface) {
  return {
    name,
    cols: surface.width,
    rows: surface.height,
    glyphRows: Array.from({ length: surface.height }, (_, y) =>
      Array.from(
        { length: surface.width },
        (_, x) => surface.get(x, y).char,
      ).join(""),
    ),
    foregroundDigest: colorDigest(surface, "fg"),
    backgroundDigest: colorDigest(surface, "bg"),
  };
}

function colorDigest(surface, colorRole) {
  const payload = cells(surface).map(
    (cell) => cell[`${colorRole}RGB`] ?? cell[colorRole] ?? null,
  );
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, DIGEST_LENGTH);
}

function themeByName(themes, name) {
  const theme = themes
    .availableJeditThemes()
    .find((candidate) => candidate.name === name);
  assert.ok(theme != null, `${name} theme should exist`);
  return theme;
}

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
}
