import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FLYINGROBOTS_LOGO_PATH,
  cells,
  fixedTitleRenderOptions,
  isBraille,
  loadTitleModules,
  positionedCells,
} from "./title-screen-helpers.mjs";

const TITLE_WIDTH = 96;
const TITLE_HEIGHT = 28;
const TITLE_WITH_SIDE_PANELS_WIDTH = 56;
const TITLE_LOGO_MIN_DEFAULT_WIDTH = 42;
const TITLE_LOGO_MIN_VERTICAL_CENTER_RATIO = 0.65;
const COMPACT_TITLE_WIDTH = 20;
const COMPACT_TITLE_HEIGHT = 12;
const COMPACT_TITLE_TEXT = "jedit";
const TITLE_LOGO_LETTER_COUNT = 5;
const TITLE_LOGO_MOTION_TIME = 0.7;
const TITLE_SEQUENCE_START_TIME = 0;
const TITLE_LOGO_BEFORE_TIME = 1;
const TITLE_LOGO_VISIBLE_TIME = 2;
const TITLE_LOGO_SHEEN_EARLY_TIME = 2.25;
const SPONSOR_LOGO_FADE_COMPLETE_TIME = 4.25;
const TITLE_LOGO_FADE_COMPLETE_TIME = 6.25;
const INTRO_LOGOS_GONE_TIME = 6.75;
const TITLE_LOGO_SMOOTH_FRAME_TIME = 0.74;
const TITLE_LOGO_NEXT_FRAME_TIME = TITLE_LOGO_SMOOTH_FRAME_TIME + 1 / 60;
const TITLE_LOGO_MAX_FRAME_OFFSET_DELTA = 0.02;
const TITLE_LOGO_ANIMATION_PERF_FRAMES = 1200;
const TITLE_LOGO_ANIMATION_PERF_BUDGET_MS = 240;
const FLYINGROBOTS_LOGO_MIN_VISIBLE_CELLS = 24;
const FLYINGROBOTS_LOGO_MIN_SURFACE_CONTRAST = 24;
const FLYINGROBOTS_LOGO_MAX_VERTICAL_RATIO = 0.5;
const BRAILLE_BLANK = "⠀";
const BRAILLE_DOT_1_CODE = 0x2800 + 0x01;
const FIRST_BRAILLE_SAMPLE_INDEX = 0;
const SINGLE_CELL_SIZE = 1;
const ACTIVE_DOT_FG_RGB = [255, 0, 0];
const ACTIVE_DOT_BG_RGB = [0, 0, 0];
const INACTIVE_DOT_FG_RGB = [0, 0, 0];
const INACTIVE_DOT_BG_RGB = [80, 90, 100];
const SOLID_DOT_BG_RGB = [11, 12, 13];
const PRESENTS_TEXT = "PRESENTS";

test("averaging Braille canvas resamples all eight subpixel colors into the cell style", async () => {
  const { brailleCanvas } = await loadTitleModules();
  const samples = [
    [0, 0, 0],
    [8, 16, 24],
    [16, 32, 48],
    [24, 48, 72],
    [32, 64, 96],
    [40, 80, 120],
    [48, 96, 144],
    [56, 112, 168],
  ];
  let index = 0;

  const surface = brailleCanvas.averagingBrailleCanvas(1, 1, () => {
    const sampleIndex = index;
    index += 1;
    return {
      on: sampleIndex === 0 || sampleIndex === 7,
      fgRGB: samples[sampleIndex],
      bgRGB: [10, 20, 30],
    };
  });
  const cell = surface.get(0, 0);

  assert.equal(cell.char, String.fromCodePoint(0x2800 + 0x01 + 0x80));
  assert.deepEqual(cell.fgRGB, [28, 56, 84]);
  assert.deepEqual(cell.bgRGB, [10, 20, 30]);
});

test("averaging Braille canvas keeps active dot backgrounds out of inactive cell background", async () => {
  const { brailleCanvas } = await loadTitleModules();
  let index = 0;

  const surface = brailleCanvas.averagingBrailleCanvas(
    SINGLE_CELL_SIZE,
    SINGLE_CELL_SIZE,
    () => {
      const sampleIndex = index;
      index += 1;
      return sampleIndex === FIRST_BRAILLE_SAMPLE_INDEX
        ? {
            on: true,
            fgRGB: ACTIVE_DOT_FG_RGB,
            bgRGB: ACTIVE_DOT_BG_RGB,
          }
        : {
            on: false,
            fgRGB: INACTIVE_DOT_FG_RGB,
            bgRGB: INACTIVE_DOT_BG_RGB,
          };
    },
  );
  const cell = surface.get(0, 0);

  assert.equal(cell.char, String.fromCodePoint(BRAILLE_DOT_1_CODE));
  assert.deepEqual(cell.fgRGB, ACTIVE_DOT_FG_RGB);
  assert.deepEqual(cell.bgRGB, INACTIVE_DOT_BG_RGB);

  const solid = brailleCanvas.averagingBrailleCanvas(SINGLE_CELL_SIZE, SINGLE_CELL_SIZE, () => ({
    on: true,
    fgRGB: ACTIVE_DOT_FG_RGB,
    bgRGB: SOLID_DOT_BG_RGB,
  }));

  assert.deepEqual(solid.get(0, 0).bgRGB, SOLID_DOT_BG_RGB);
});

test("title logo bounds prefer a readable logo before compressing for side panels", async () => {
  const { title, titleLogo } = await loadTitleModules();
  const bounds = title.titleLogoCellBounds(TITLE_WIDTH, TITLE_HEIGHT);
  const sidePanelBounds = title.titleLogoCellBounds(
    TITLE_WITH_SIDE_PANELS_WIDTH,
    TITLE_HEIGHT,
  );

  assert.ok(bounds.width > Math.ceil(TITLE_WIDTH * 0.32));
  assert.ok(bounds.width >= TITLE_LOGO_MIN_DEFAULT_WIDTH);
  assert.equal(sidePanelBounds.width, bounds.width);
  assert.equal(bounds.renderMode, titleLogo.TITLE_LOGO_RENDER_MODE.Bitmap);
  assert.equal(
    sidePanelBounds.renderMode,
    titleLogo.TITLE_LOGO_RENDER_MODE.Bitmap,
  );
  assert.ok(Math.abs(bounds.x + bounds.width / 2 - TITLE_WIDTH / 2) <= 1);
  assert.ok(
    bounds.y + bounds.height / 2 >=
      TITLE_HEIGHT * TITLE_LOGO_MIN_VERTICAL_CENTER_RATIO,
  );
  assert.ok(bounds.y + bounds.height <= TITLE_HEIGHT);
});

test("title logo source mask splits into independently animated letters", async () => {
  const { title, titleLogo } = await loadTitleModules();
  const bounds = title.titleLogoCellBounds(TITLE_WIDTH, TITLE_HEIGHT);
  const idleLetters = titleLogo.titleLogoAnimatedLetters(bounds, 0);
  const motionLetters = titleLogo.titleLogoAnimatedLetters(
    bounds,
    TITLE_LOGO_MOTION_TIME,
  );

  assert.equal(idleLetters.length, TITLE_LOGO_LETTER_COUNT);
  assert.ok(
    idleLetters.every(
      (letter) => letter.width > 0 && letter.height === bounds.height,
    ),
  );
  assert.ok(
    idleLetters.every(
      (letter, index) => index === 0 || letter.x > idleLetters[index - 1].x,
    ),
  );
  assert.ok(
    motionLetters.some((letter, index) => letter.y !== idleLetters[index].y),
  );
  assert.ok(
    motionLetters.some(
      (letter, index) => letter.colorShift !== idleLetters[index].colorShift,
    ),
  );
});

test("title logo letter motion uses smooth fractional spring offsets", async () => {
  const { title, titleLogo } = await loadTitleModules();
  const bounds = title.titleLogoCellBounds(TITLE_WIDTH, TITLE_HEIGHT);
  const frame = titleLogo.titleLogoAnimatedLetters(
    bounds,
    TITLE_LOGO_SMOOTH_FRAME_TIME,
  );
  const nextFrame = titleLogo.titleLogoAnimatedLetters(
    bounds,
    TITLE_LOGO_NEXT_FRAME_TIME,
  );
  const largestOffsetDelta = Math.max(
    ...frame.map((letter, index) =>
      Math.abs(letter.bounceOffset - nextFrame[index].bounceOffset),
    ),
  );

  assert.ok(
    frame.some(
      (letter) =>
        Math.abs(letter.bounceOffset - Math.round(letter.bounceOffset)) > 0.01,
    ),
  );
  assert.ok(
    frame.some((letter) => letter.targetBounceOffset !== letter.bounceOffset),
  );
  assert.ok(largestOffsetDelta < TITLE_LOGO_MAX_FRAME_OFFSET_DELTA);
});

test("title logo animation evaluates a long frame sequence within a bounded budget", async () => {
  const { title, titleLogo } = await loadTitleModules();
  const bounds = title.titleLogoCellBounds(TITLE_WIDTH, TITLE_HEIGHT);
  const start = performance.now();
  let offsetSum = 0;

  for (let frame = 0; frame < TITLE_LOGO_ANIMATION_PERF_FRAMES; frame += 1) {
    offsetSum += titleLogo.titleLogoAnimatedLetters(bounds, frame / 60)[0]
      .bounceOffset;
  }

  const elapsedMs = performance.now() - start;
  assert.ok(Number.isFinite(offsetSum));
  assert.ok(
    elapsedMs < TITLE_LOGO_ANIMATION_PERF_BUDGET_MS,
    `logo animation took ${elapsedMs.toFixed(2)}ms`,
  );
});

test("title logo falls back to compact text when bitmap compression would become illegible", async () => {
  const { title, titleLogo, themes, style } = await loadTitleModules();
  const bounds = title.titleLogoCellBounds(
    COMPACT_TITLE_WIDTH,
    COMPACT_TITLE_HEIGHT,
  );
  const theme = themes.availableJeditThemes()[0];
  const surface = title.renderTitleScreen(
    COMPACT_TITLE_WIDTH,
    COMPACT_TITLE_HEIGHT,
    TITLE_LOGO_VISIBLE_TIME,
    theme,
    fixedTitleRenderOptions(),
  );
  const logoCells = cells(surface).filter((cell) =>
    cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold),
  );

  assert.equal(bounds.renderMode, titleLogo.TITLE_LOGO_RENDER_MODE.CompactText);
  assert.equal(bounds.width, COMPACT_TITLE_TEXT.length);
  assert.equal(logoCells.length, bounds.width);
  assert.ok(logoCells.every((cell) => !isBraille(cell.char)));
});

test("title screen renders the logo as a non-Braille themed glyph layer", async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const surface = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    TITLE_LOGO_VISIBLE_TIME,
    theme,
    fixedTitleRenderOptions(),
  );
  const logoCells = cells(surface).filter(
    (cell) =>
      cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold) &&
      !isBraille(cell.char),
  );

  assert.ok(logoCells.length > 12);
  assert.ok(logoCells.every((cell) => !isBraille(cell.char)));
  assert.ok(new Set(logoCells.map((cell) => cell.char)).size > 1);
  assert.ok(logoCells.every((cell) => cell.bgRGB != null));
});

test("title screen animates logo glyph positions and color over time", async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const first = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    TITLE_LOGO_VISIBLE_TIME,
    theme,
    fixedTitleRenderOptions(),
  );
  const later = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    TITLE_LOGO_VISIBLE_TIME + TITLE_LOGO_MOTION_TIME,
    theme,
    fixedTitleRenderOptions(),
  );
  const firstLogo = logoCellKeys(first, style);
  const laterLogo = logoCellKeys(later, style);

  assert.ok(firstLogo.length > 12);
  assert.ok(laterLogo.length > 12);
  assert.notDeepEqual(laterLogo, firstLogo);
});

test("title screen incorporates the Flying Robots source logo as a bright Braille band", async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const surface = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    TITLE_SEQUENCE_START_TIME,
    theme,
    fixedTitleRenderOptions(),
  );
  const bounds = title.flyingRobotsLogoCellBounds(TITLE_WIDTH, TITLE_HEIGHT);
  const sourceChars = flyingRobotsLogoInkChars();
  assert.ok(bounds != null);

  const logoCells = positionedCells(surface).filter(
    ({ x, y, cell }) =>
      x >= bounds.x &&
      x < bounds.x + bounds.width &&
      y >= bounds.y &&
      y < bounds.y + bounds.height &&
      cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold) &&
      !cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Dim) &&
      isBraille(cell.char),
  );

  assert.ok(logoCells.length > FLYINGROBOTS_LOGO_MIN_VISIBLE_CELLS);
  assert.ok(logoCells.some(({ cell }) => sourceChars.has(cell.char)));
  assert.ok(
    Math.max(
      ...logoCells.map(({ cell }) => colorContrast(cell.fgRGB, cell.bgRGB)),
    ) > FLYINGROBOTS_LOGO_MIN_SURFACE_CONTRAST,
  );
  assert.ok(
    Math.max(...logoCells.map(({ y }) => y)) <
      TITLE_HEIGHT * FLYINGROBOTS_LOGO_MAX_VERTICAL_RATIO,
  );
});

test("title presentation sequence gates both logo layers on the requested timeline", async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const start = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    TITLE_SEQUENCE_START_TIME,
    theme,
    fixedTitleRenderOptions(),
  );
  const beforeTitle = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    TITLE_LOGO_BEFORE_TIME,
    theme,
    fixedTitleRenderOptions(),
  );
  const titleVisible = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    TITLE_LOGO_VISIBLE_TIME,
    theme,
    fixedTitleRenderOptions(),
  );
  const sponsorGone = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    SPONSOR_LOGO_FADE_COMPLETE_TIME,
    theme,
    fixedTitleRenderOptions(),
  );
  const titleGone = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    TITLE_LOGO_FADE_COMPLETE_TIME,
    theme,
    fixedTitleRenderOptions(),
  );
  const gone = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    INTRO_LOGOS_GONE_TIME,
    theme,
    fixedTitleRenderOptions(),
  );

  assert.ok(
    flyingRobotsLogoCells(start, title, style).length >
      FLYINGROBOTS_LOGO_MIN_VISIBLE_CELLS,
  );
  assert.equal(surfaceContainsText(start, PRESENTS_TEXT), true);
  assert.equal(titleLogoCells(start, style).length, 0);
  assert.equal(titleLogoCells(beforeTitle, style).length, 0);
  assert.ok(
    flyingRobotsLogoCells(beforeTitle, title, style).length >
      FLYINGROBOTS_LOGO_MIN_VISIBLE_CELLS,
  );
  assert.ok(titleLogoCells(titleVisible, style).length > 12);
  assert.ok(
    flyingRobotsLogoCells(titleVisible, title, style).length >
      FLYINGROBOTS_LOGO_MIN_VISIBLE_CELLS,
  );
  assert.ok(titleLogoCells(sponsorGone, style).length > 12);
  assert.equal(flyingRobotsLogoCells(sponsorGone, title, style).length, 0);
  assert.equal(surfaceContainsText(sponsorGone, PRESENTS_TEXT), false);
  assert.equal(titleLogoCells(titleGone, style).length, 0);
  assert.equal(flyingRobotsLogoCells(gone, title, style).length, 0);
  assert.equal(surfaceContainsText(gone, PRESENTS_TEXT), false);
  assert.equal(titleLogoCells(gone, style).length, 0);
});

test("title logo sheen sweep follows the local text direction", async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const ltr = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    TITLE_LOGO_SHEEN_EARLY_TIME,
    theme,
    fixedTitleRenderOptions({
      textDirection: "ltr",
    }),
  );
  const rtl = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    TITLE_LOGO_SHEEN_EARLY_TIME,
    theme,
    fixedTitleRenderOptions({
      textDirection: "rtl",
    }),
  );

  assert.ok(brightestTitleLogoColumn(ltr, style) < TITLE_WIDTH / 2);
  assert.ok(brightestTitleLogoColumn(rtl, style) > TITLE_WIDTH / 2);
  assert.notDeepEqual(logoCellKeys(ltr, style), logoCellKeys(rtl, style));
});

function cellColorKey(cell) {
  return cell.fg ?? cell.fgRGB?.join(",") ?? "";
}

function titleLogoCells(surface, style) {
  return positionedCells(surface).filter(
    ({ cell }) =>
      cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold) &&
      !isBraille(cell.char),
  );
}

function logoCellKeys(surface, style) {
  return titleLogoCells(surface, style).map(
    ({ x, y, cell }) => `${x}:${y}:${cell.char}:${cellColorKey(cell)}`,
  );
}

function flyingRobotsLogoCells(surface, title, style) {
  const bounds = title.flyingRobotsLogoCellBounds(
    surface.width,
    surface.height,
  );
  assert.ok(bounds != null);
  return positionedCells(surface).filter(
    ({ x, y, cell }) =>
      x >= bounds.x &&
      x < bounds.x + bounds.width &&
      y >= bounds.y &&
      y < bounds.y + bounds.height &&
      cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold) &&
      isBraille(cell.char),
  );
}

function surfaceContainsText(surface, text) {
  for (let y = 0; y < surface.height; y += 1) {
    const row = Array.from(
      { length: surface.width },
      (_, x) => surface.get(x, y).char,
    ).join("");
    if (row.includes(text)) {
      return true;
    }
  }
  return false;
}

function brightestTitleLogoColumn(surface, style) {
  const titleCells = titleLogoCells(surface, style);
  assert.ok(titleCells.length > 0);
  return titleCells
    .map(({ x, cell }) => ({ x, luminance: luminance(cell.fgRGB) }))
    .reduce((brightest, candidate) =>
      candidate.luminance > brightest.luminance ? candidate : brightest,
    ).x;
}

function flyingRobotsLogoInkChars() {
  return new Set(
    Array.from(readFileSync(FLYINGROBOTS_LOGO_PATH, "utf8")).filter(
      (char) => char !== BRAILLE_BLANK && char.trim().length > 0,
    ),
  );
}

function luminance(rgb) {
  if (rgb == null) {
    return 0;
  }
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function colorContrast(fg, bg) {
  return Math.abs(luminance(fg) - luminance(bg));
}
