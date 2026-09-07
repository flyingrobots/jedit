import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";

// The startup logo is the first thing Jim shows, so its size is a property of
// the viewport, not a constant. These lock the fit behaviour: it grows with the
// terminal, stays square, respects whichever axis runs out first, and steps
// aside entirely when there is no room to be legible.

const BLANK_CHARS = new Set([" ", "⠀"]);

async function renderAt(width, height, theme) {
  const screen = await importDist("ui", "jim-logo-screen.js");
  const themes = await importDist("ui", "jedit-themes.js");
  return screen.renderJimLogoScreen(width, height, theme ?? themes.availableJeditThemes()[0]);
}

function channelLuminance(channel) {
  const ratio = channel / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : Math.pow((ratio + 0.055) / 1.055, 2.4);
}

function contrastRatio(foreground, background) {
  const first = 0.2126 * channelLuminance(foreground[0])
    + 0.7152 * channelLuminance(foreground[1])
    + 0.0722 * channelLuminance(foreground[2]);
  const second = 0.2126 * channelLuminance(background[0])
    + 0.7152 * channelLuminance(background[1])
    + 0.0722 * channelLuminance(background[2]);
  const high = Math.max(first, second);
  const low = Math.min(first, second);
  return (high + 0.05) / (low + 0.05);
}

function inkCells(surface) {
  const cells = [];
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const cell = surface.get(x, y);
      if (!BLANK_CHARS.has(cell.char)) {
        cells.push({ x, y, cell });
      }
    }
  }
  return cells;
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

// WCAG 1.4.11 puts non-text graphics at 3:1, the same floor the rest of jedit's
// chrome is held to.
const MIN_LOGO_CONTRAST = 3;

test("the logo is legible against every theme's workspace background", async () => {
  const themes = await importDist("ui", "jedit-themes.js");
  const offenders = [];

  for (const theme of themes.availableJeditThemes()) {
    const surface = await renderAt(120, 40, theme);
    let worst = Infinity;
    for (const { cell } of inkCells(surface)) {
      worst = Math.min(worst, contrastRatio(cell.fgRGB, theme.surface.workspace.bgRGB));
    }
    if (worst < MIN_LOGO_CONTRAST) {
      offenders.push(`${theme.name} (${theme.mode}) worst ${worst.toFixed(2)}`);
    }
  }

  assert.deepEqual(offenders, []);
});

test("the logo's shape does not depend on the theme", async () => {
  const themes = await importDist("ui", "jedit-themes.js");
  const available = themes.availableJeditThemes();
  const reference = inkCells(await renderAt(120, 40, available[0]))
    .map(({ x, y, cell }) => `${x},${y},${cell.char}`)
    .join(" ");

  for (const theme of available.slice(1)) {
    const shape = inkCells(await renderAt(120, 40, theme))
      .map(({ x, y, cell }) => `${x},${y},${cell.char}`)
      .join(" ");
    assert.equal(shape, reference, `${theme.name} drew a different mask`);
  }
});

test("the logo takes its colours from the theme, not from the artwork", async () => {
  const themes = await importDist("ui", "jedit-themes.js");
  const available = themes.availableJeditThemes();

  const paletteFor = async (theme) => new Set(
    inkCells(await renderAt(120, 40, theme)).map(({ cell }) => String(cell.fgRGB)),
  );

  const first = await paletteFor(available[0]);
  const second = await paletteFor(available[1]);
  const shared = [...first].filter((colour) => second.has(colour));

  assert.ok(
    shared.length * 2 < Math.min(first.size, second.size),
    `themes should mostly disagree on colour; ${shared.length} shared of ${first.size}/${second.size}`,
  );
});

test("the logo keeps more than one hue so the diamond stays distinct", async () => {
  const themes = await importDist("ui", "jedit-themes.js");
  const { rgbToOklch } = await importDist("ui", "oklch.js");
  const offenders = [];

  for (const theme of themes.availableJeditThemes()) {
    const hues = new Set();
    for (const { cell } of inkCells(await renderAt(120, 40, theme))) {
      const { chroma, hue } = rgbToOklch(cell.fgRGB);
      if (chroma > 0.02) {
        hues.add(Math.round(hue / 10));
      }
    }
    if (hues.size < 2) {
      offenders.push(`${theme.name} collapsed to ${hues.size} hue band(s)`);
    }
  }

  assert.deepEqual(offenders, []);
});

test("resizing the terminal re-renders the logo at the new size", async () => {
  const [init, viewerContent, themes] = await Promise.all([
    importDist("app", "workspace", "init.js"),
    importDist("app", "workspace", "viewer-content.js"),
    importDist("ui", "jedit-themes.js"),
  ]);
  const { mockI18n, mockJeditTheme } = await import("./workspace-helpers.mjs");
  const { discoverRepoRoot } = await import("./dist-helpers.mjs");
  const root = discoverRepoRoot();

  const small = init.createInitialModel(root, 80, 24, {
    entries: [],
    jeditTheme: mockJeditTheme(),
    i18n: mockI18n(),
    nowMs: 0,
  });

  // The runtime rebuilds the model on a resize message; the renderer only
  // repaints when the model identity changes, so a resize that mutated in
  // place would silently leave the old logo on screen.
  const grown = { ...small, columns: 190, rows: 50 };
  assert.notEqual(grown, small, "resize must produce a new model reference");

  const before = viewerContent.renderViewer(small, 80, 24);
  const after = viewerContent.renderViewer(grown, 190, 50);

  const inkHeight = (surface, width, height) => {
    let min = Infinity;
    let max = -Infinity;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const char = surface.get(x, y)?.char ?? " ";
        if (char >= "⠁" && char <= "⣿") {
          min = Math.min(min, y);
          max = Math.max(max, y);
        }
      }
    }
    return max < min ? 0 : max - min + 1;
  };

  const smallRows = inkHeight(before, 80, 24);
  const largeRows = inkHeight(after, 190, 50);

  assert.ok(smallRows > 0 && largeRows > 0, `expected ink in both, got ${smallRows}/${largeRows}`);
  assert.ok(
    largeRows > smallRows,
    `logo should grow with the terminal; ${smallRows} -> ${largeRows} rows`,
  );
});
