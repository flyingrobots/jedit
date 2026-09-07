import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";

// The startup logo is the first thing Jim shows, so its size is a property of
// the viewport, not a constant. These lock the fit behaviour: it grows with the
// terminal, stays square, respects whichever axis runs out first, and steps
// aside entirely when there is no room to be legible.

const BLANK_CHARS = new Set([" ", "⠀"]);

async function renderAt(width, height) {
  const screen = await importDist("ui", "jim-logo-screen.js");
  const themes = await importDist("ui", "jedit-themes.js");
  const [theme] = themes.availableJeditThemes();
  return screen.renderJimLogoScreen(width, height, theme);
}

function inkBounds(surface) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      if (BLANK_CHARS.has(surface.get(x, y).char)) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX) {
    return undefined;
  }
  return { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

test("the logo grows to fill a larger terminal", async () => {
  const small = inkBounds(await renderAt(60, 20));
  const large = inkBounds(await renderAt(190, 50));

  assert.ok(small !== undefined, "expected ink at 60x20");
  assert.ok(large !== undefined, "expected ink at 190x50");
  assert.ok(
    large.height > small.height * 2,
    `expected the logo to scale up; got ${small.height} -> ${large.height} rows`,
  );
});

test("a tall narrow terminal is bounded by its width, not its height", async () => {
  const bounds = inkBounds(await renderAt(40, 90));

  assert.ok(bounds !== undefined);
  assert.ok(
    bounds.width <= 40,
    `logo overflowed a 40-column terminal at ${bounds.width} columns`,
  );
  assert.ok(
    bounds.height < 40,
    `width-bounded logo should stay well under 90 rows; got ${bounds.height}`,
  );
});

test("a wide short terminal is bounded by its height", async () => {
  const bounds = inkBounds(await renderAt(200, 24));

  assert.ok(bounds !== undefined);
  assert.ok(
    bounds.height <= 24 - 4,
    `logo ignored the vertical margin; got ${bounds.height} of 24 rows`,
  );
});

test("the logo never paints outside the viewport", async () => {
  for (const [width, height] of [[60, 20], [190, 50], [40, 90], [200, 24]]) {
    const bounds = inkBounds(await renderAt(width, height));
    assert.ok(bounds !== undefined, `expected ink at ${width}x${height}`);
    assert.ok(bounds.minX >= 0 && bounds.minY >= 0);
    assert.ok(
      bounds.minX + bounds.width <= width && bounds.minY + bounds.height <= height,
      `logo escaped a ${width}x${height} viewport`,
    );
  }
});

test("a viewport too small for a legible logo renders none", async () => {
  assert.equal(inkBounds(await renderAt(10, 6)), undefined);
});

test("the logo keeps its own colours rather than one flat token", async () => {
  const surface = await renderAt(120, 40);
  const inkColours = new Set();
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const cell = surface.get(x, y);
      if (BLANK_CHARS.has(cell.char)) {
        continue;
      }
      inkColours.add(JSON.stringify(cell.fgRGB));
    }
  }
  assert.ok(
    inkColours.size > 1,
    `expected multi-colour artwork, got ${inkColours.size} colour(s)`,
  );
});
