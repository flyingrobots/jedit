import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const TITLE_SCREEN_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'title-screen.js');
const TITLE_LOGO_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'title-logo.js');
const ASCII_CANVAS_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'averaging-ascii-canvas.js');
const BRAILLE_CANVAS_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'averaging-braille-canvas.js');
const THEMES_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'jedit-themes.js');
const STYLE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'jedit-theme.js');
const FLYINGROBOTS_LOGO_PATH = path.join(REPO_ROOT, 'src', 'ui', 'flyingrobotslogo.txt');
const FIXED_TITLE_SEED = 0.417;
const TITLE_WIDTH = 96;
const TITLE_HEIGHT = 28;
const TITLE_WITH_SIDE_PANELS_WIDTH = 56;
const TITLE_LOGO_MIN_DEFAULT_WIDTH = 42;
const TITLE_LOGO_MIN_VERTICAL_CENTER_RATIO = 0.65;
const COMPACT_TITLE_WIDTH = 20;
const COMPACT_TITLE_HEIGHT = 12;
const COMPACT_TITLE_TEXT = 'jedit';
const TITLE_LOGO_LETTER_COUNT = 5;
const TITLE_LOGO_MOTION_TIME = 0.7;
const TITLE_LOGO_SMOOTH_FRAME_TIME = 0.74;
const TITLE_LOGO_NEXT_FRAME_TIME = TITLE_LOGO_SMOOTH_FRAME_TIME + (1 / 60);
const TITLE_LOGO_MAX_FRAME_OFFSET_DELTA = 0.02;
const TITLE_LOGO_ANIMATION_PERF_FRAMES = 1200;
const TITLE_LOGO_ANIMATION_PERF_BUDGET_MS = 240;
const FLYINGROBOTS_LOGO_MIN_VISIBLE_CELLS = 24;
const FLYINGROBOTS_LOGO_MIN_SURFACE_CONTRAST = 24;
const FLYINGROBOTS_LOGO_MAX_VERTICAL_RATIO = 0.5;
const BRAILLE_BLANK = '⠀';
const REFLECTIVE_HIGHLIGHT_LUMINANCE = 190;
const FIXED_TITLE_CAMERA_ANGLE = 0.25;
let titleModulesPromise;

function fixedTitleRenderOptions(extra = {}) {
  return {
    camAngle: FIXED_TITLE_CAMERA_ANGLE,
    sceneSeed: FIXED_TITLE_SEED,
    ...extra,
  };
}

async function loadTitleModules() {
  if (titleModulesPromise != null) {
    return titleModulesPromise;
  }

  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  titleModulesPromise = Promise.resolve({
    title: await import(pathToFileURL(TITLE_SCREEN_PATH).href),
    titleLogo: await import(pathToFileURL(TITLE_LOGO_PATH).href),
    asciiCanvas: await import(pathToFileURL(ASCII_CANVAS_PATH).href),
    brailleCanvas: await import(pathToFileURL(BRAILLE_CANVAS_PATH).href),
    themes: await import(pathToFileURL(THEMES_PATH).href),
    style: await import(pathToFileURL(STYLE_PATH).href),
  });
  return titleModulesPromise;
}

function cells(surface) {
  return Array.from({ length: surface.height }, (_, y) => (
    Array.from({ length: surface.width }, (_, x) => surface.get(x, y))
  )).flat();
}

function positionedCells(surface) {
  return Array.from({ length: surface.height }, (_, y) => (
    Array.from({ length: surface.width }, (_, x) => ({ x, y, cell: surface.get(x, y) }))
  )).flat();
}

function isBraille(char) {
  const code = char.codePointAt(0) ?? 0;
  return code >= 0x2800 && code <= 0x28ff;
}

test('averaging Braille canvas resamples all eight subpixel colors into the cell style', async () => {
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

test('title logo bounds prefer a readable logo before compressing for side panels', async () => {
  const { title, titleLogo } = await loadTitleModules();
  const bounds = title.titleLogoCellBounds(TITLE_WIDTH, TITLE_HEIGHT);
  const sidePanelBounds = title.titleLogoCellBounds(TITLE_WITH_SIDE_PANELS_WIDTH, TITLE_HEIGHT);

  assert.ok(bounds.width > Math.ceil(TITLE_WIDTH * 0.32));
  assert.ok(bounds.width >= TITLE_LOGO_MIN_DEFAULT_WIDTH);
  assert.equal(sidePanelBounds.width, bounds.width);
  assert.equal(bounds.renderMode, titleLogo.TITLE_LOGO_RENDER_MODE.Bitmap);
  assert.equal(sidePanelBounds.renderMode, titleLogo.TITLE_LOGO_RENDER_MODE.Bitmap);
  assert.ok(Math.abs((bounds.x + (bounds.width / 2)) - (TITLE_WIDTH / 2)) <= 1);
  assert.ok(bounds.y + (bounds.height / 2) >= TITLE_HEIGHT * TITLE_LOGO_MIN_VERTICAL_CENTER_RATIO);
  assert.ok(bounds.y + bounds.height <= TITLE_HEIGHT);
});

test('title logo source mask splits into independently animated letters', async () => {
  const { title, titleLogo } = await loadTitleModules();
  const bounds = title.titleLogoCellBounds(TITLE_WIDTH, TITLE_HEIGHT);
  const idleLetters = titleLogo.titleLogoAnimatedLetters(bounds, 0);
  const motionLetters = titleLogo.titleLogoAnimatedLetters(bounds, TITLE_LOGO_MOTION_TIME);

  assert.equal(idleLetters.length, TITLE_LOGO_LETTER_COUNT);
  assert.ok(idleLetters.every((letter) => letter.width > 0 && letter.height === bounds.height));
  assert.ok(idleLetters.every((letter, index) => index === 0 || letter.x > idleLetters[index - 1].x));
  assert.ok(motionLetters.some((letter, index) => letter.y !== idleLetters[index].y));
  assert.ok(motionLetters.some((letter, index) => letter.colorShift !== idleLetters[index].colorShift));
});

test('title logo letter motion uses smooth fractional spring offsets', async () => {
  const { title, titleLogo } = await loadTitleModules();
  const bounds = title.titleLogoCellBounds(TITLE_WIDTH, TITLE_HEIGHT);
  const frame = titleLogo.titleLogoAnimatedLetters(bounds, TITLE_LOGO_SMOOTH_FRAME_TIME);
  const nextFrame = titleLogo.titleLogoAnimatedLetters(bounds, TITLE_LOGO_NEXT_FRAME_TIME);
  const largestOffsetDelta = Math.max(
    ...frame.map((letter, index) => Math.abs(letter.bounceOffset - nextFrame[index].bounceOffset)),
  );

  assert.ok(frame.some((letter) => Math.abs(letter.bounceOffset - Math.round(letter.bounceOffset)) > 0.01));
  assert.ok(frame.some((letter) => letter.targetBounceOffset !== letter.bounceOffset));
  assert.ok(largestOffsetDelta < TITLE_LOGO_MAX_FRAME_OFFSET_DELTA);
});

test('title logo animation evaluates a long frame sequence within a bounded budget', async () => {
  const { title, titleLogo } = await loadTitleModules();
  const bounds = title.titleLogoCellBounds(TITLE_WIDTH, TITLE_HEIGHT);
  const start = performance.now();
  let offsetSum = 0;

  for (let frame = 0; frame < TITLE_LOGO_ANIMATION_PERF_FRAMES; frame += 1) {
    offsetSum += titleLogo.titleLogoAnimatedLetters(bounds, frame / 60)[0].bounceOffset;
  }

  const elapsedMs = performance.now() - start;
  assert.ok(Number.isFinite(offsetSum));
  assert.ok(elapsedMs < TITLE_LOGO_ANIMATION_PERF_BUDGET_MS, `logo animation took ${elapsedMs.toFixed(2)}ms`);
});

test('title logo falls back to compact text when bitmap compression would become illegible', async () => {
  const { title, titleLogo, themes, style } = await loadTitleModules();
  const bounds = title.titleLogoCellBounds(COMPACT_TITLE_WIDTH, COMPACT_TITLE_HEIGHT);
  const theme = themes.availableJeditThemes()[0];
  const surface = title.renderTitleScreen(COMPACT_TITLE_WIDTH, COMPACT_TITLE_HEIGHT, 0, theme, fixedTitleRenderOptions());
  const logoCells = cells(surface).filter((cell) => cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold));

  assert.equal(bounds.renderMode, titleLogo.TITLE_LOGO_RENDER_MODE.CompactText);
  assert.equal(bounds.width, COMPACT_TITLE_TEXT.length);
  assert.equal(logoCells.length, bounds.width);
  assert.ok(logoCells.every((cell) => !isBraille(cell.char)));
});

test('title screen renders the logo as a non-Braille themed glyph layer', async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const surface = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, 0, theme, fixedTitleRenderOptions());
  const logoCells = cells(surface).filter((cell) => (
    cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold)
    && !isBraille(cell.char)
  ));

  assert.ok(logoCells.length > 12);
  assert.ok(logoCells.every((cell) => !isBraille(cell.char)));
  assert.ok(new Set(logoCells.map((cell) => cell.char)).size > 1);
  assert.ok(logoCells.every((cell) => cell.bgRGB != null));
});

test('title screen animates logo glyph positions and color over time', async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const first = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, 0, theme, fixedTitleRenderOptions());
  const later = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, TITLE_LOGO_MOTION_TIME, theme, fixedTitleRenderOptions());
  const firstLogo = logoCellKeys(first, style);
  const laterLogo = logoCellKeys(later, style);

  assert.ok(firstLogo.length > 12);
  assert.ok(laterLogo.length > 12);
  assert.notDeepEqual(laterLogo, firstLogo);
});

test('title screen incorporates the Flying Robots source logo as a bright Braille band', async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const surface = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, 0, theme, fixedTitleRenderOptions());
  const bounds = title.flyingRobotsLogoCellBounds(TITLE_WIDTH, TITLE_HEIGHT);
  const sourceChars = flyingRobotsLogoInkChars();
  assert.ok(bounds != null);

  const logoCells = flyingRobotsLogoCells(surface, bounds, style);

  assert.ok(logoCells.length > FLYINGROBOTS_LOGO_MIN_VISIBLE_CELLS);
  assert.ok(logoCells.some(({ cell }) => sourceChars.has(cell.char)));
  assert.ok(Math.max(...logoCells.map(({ cell }) => colorContrast(cell.fgRGB, cell.bgRGB))) > FLYINGROBOTS_LOGO_MIN_SURFACE_CONTRAST);
  assert.ok(Math.max(...logoCells.map(({ y }) => y)) < TITLE_HEIGHT * FLYINGROBOTS_LOGO_MAX_VERTICAL_RATIO);
});

test('title scene uses Braille subpixels with averaged material colors', async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const surface = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, 0, theme, fixedTitleRenderOptions());
  const sceneCells = cells(surface).filter((cell) => !cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold));
  const visibleSceneChars = new Set(sceneCells.map((cell) => cell.char).filter((char) => char !== ' '));

  assert.ok(visibleSceneChars.size >= 4);
  assert.ok([...visibleSceneChars].every((char) => isBraille(char)));
  assert.ok(new Set(sceneCells.map(cellColorKey)).size > 3);
});

test('title scene can render as density-mapped ASCII instead of Braille', async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const surface = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, 0, theme, fixedTitleRenderOptions({
    renderMode: title.TITLE_RENDER_MODE.Ascii,
    asciiPalette: title.TITLE_ASCII_PALETTE.Dense,
  }));
  const sceneCells = cells(surface).filter((cell) => !cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold));
  const visibleSceneChars = new Set(sceneCells.map((cell) => cell.char).filter((char) => char !== ' '));

  assert.ok(visibleSceneChars.size >= 3);
  assert.ok([...visibleSceneChars].every((char) => !isBraille(char)));
  assert.ok([...visibleSceneChars].every((char) => ' .,:;irsXA253hMHGS#9B&@'.includes(char)));
  assert.ok(new Set(sceneCells.map(cellColorKey)).size > 3);
});

test('title scene ASCII palettes produce distinct glyph vocabularies', async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const dense = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, 0, theme, fixedTitleRenderOptions({
    renderMode: title.TITLE_RENDER_MODE.Ascii,
    asciiPalette: title.TITLE_ASCII_PALETTE.Dense,
  }));
  const blocks = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, 0, theme, fixedTitleRenderOptions({
    renderMode: title.TITLE_RENDER_MODE.Ascii,
    asciiPalette: title.TITLE_ASCII_PALETTE.Blocks,
  }));
  const dither = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, 0, theme, fixedTitleRenderOptions({
    renderMode: title.TITLE_RENDER_MODE.Ascii,
    asciiPalette: title.TITLE_ASCII_PALETTE.Dither,
  }));

  assert.notDeepEqual(sceneGlyphs(dense, style), sceneGlyphs(blocks, style));
  assert.ok(sceneGlyphs(blocks, style).some((char) => '▁▂▃▄▅▆▇█'.includes(char)));
  assert.notDeepEqual(sceneCellKeys(dense, style), sceneCellKeys(dither, style));
  assert.ok(sceneGlyphs(dither, style).every((char) => ' .:-=+*#%@'.includes(char)));
});

test('ASCII canvas colors inactive samples as background instead of inactive foreground', async () => {
  const { asciiCanvas } = await loadTitleModules();
  const surface = asciiCanvas.averagingAsciiCanvas(1, 1, ({ u, v }) => {
    if (u === 0 && v === 0) {
      return {
        on: true,
        fgRGB: [255, 0, 0],
        bgRGB: [0, 0, 0],
      };
    }
    return {
      on: false,
      fgRGB: [0, 0, 255],
      bgRGB: [0, 0, 0],
    };
  }, 0, { palette: asciiCanvas.TITLE_ASCII_PALETTE.Dense });
  const cell = surface.get(0, 0);

  assert.deepEqual(cell.fgRGB, [64, 0, 0]);
  assert.deepEqual(cell.bgRGB, [0, 0, 0]);
});

test('title scene keeps reflective highlights on sphere materials', async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const surface = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, 0, theme, fixedTitleRenderOptions());
  const sceneCells = cells(surface).filter((cell) => (
    !cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold)
    && isBraille(cell.char)
    && cell.char !== String.fromCodePoint(0x2800)
  ));
  const highlightCells = sceneCells.filter((cell) => luminance(cell.fgRGB) > REFLECTIVE_HIGHLIGHT_LUMINANCE);

  assert.ok(highlightCells.length > 0);
});

test('title scene keeps checker floor material contrast stable across built-in themes', async () => {
  const { title, themes } = await loadTitleModules();

  for (const theme of themes.availableJeditThemes()) {
    const colors = title.titleSceneMaterialColors(theme);

    assert.ok(
      luminance(colors.floorLight) > luminance(colors.floorDark),
      `${theme.name} floorLight should be lighter than floorDark`,
    );
  }
});

test('title screen is deterministic for a fixed scene seed and frame time', async () => {
  const { title, themes } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const first = title.renderTitleScreen(72, 22, 3, theme, fixedTitleRenderOptions());
  const second = title.renderTitleScreen(72, 22, 3, theme, fixedTitleRenderOptions());

  assert.deepEqual(cells(first), cells(second));
});

test('title screen render options keep scene seed separate from camera angle', async () => {
  const { title, themes } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const fixedCamera = { camAngle: 0.25, sceneSeed: 0.125 };
  const sameSeed = title.renderTitleScreen(72, 22, 3, theme, fixedCamera);
  const sameSeedAgain = title.renderTitleScreen(72, 22, 3, theme, fixedCamera);
  const otherSeed = title.renderTitleScreen(72, 22, 3, theme, { ...fixedCamera, sceneSeed: 0.875 });

  assert.deepEqual(cells(sameSeed), cells(sameSeedAgain));
  assert.notDeepEqual(cells(otherSeed), cells(sameSeed));
});

function cellColorKey(cell) {
  return cell.fg ?? cell.fgRGB?.join(',') ?? '';
}

function logoCellKeys(surface, style) {
  return titleLogoCells(surface, style)
    .map(({ x, y, cell }) => `${x}:${y}:${cell.char}:${cellColorKey(cell)}`);
}

function titleLogoCells(surface, style) {
  return positionedCells(surface).filter(({ cell }) => (
    cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold)
    && !isBraille(cell.char)
  ));
}

function flyingRobotsLogoCells(surface, bounds, style) {
  return positionedCells(surface).filter(({ x, y, cell }) => (
    x >= bounds.x
    && x < bounds.x + bounds.width
    && y >= bounds.y
    && y < bounds.y + bounds.height
    && cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold)
    && !cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Dim)
    && isBraille(cell.char)
  ));
}

function flyingRobotsLogoInkChars() {
  return new Set(
    Array.from(readFileSync(FLYINGROBOTS_LOGO_PATH, 'utf8'))
      .filter((char) => char !== BRAILLE_BLANK && char.trim().length > 0),
  );
}

function sceneGlyphs(surface, style) {
  return [...new Set(cells(surface)
    .filter((cell) => !cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold))
    .map((cell) => cell.char)
    .filter((char) => char !== ' '))];
}

function sceneCellKeys(surface, style) {
  return cells(surface)
    .filter((cell) => !cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold))
    .map((cell) => `${cell.char}:${cellColorKey(cell)}`);
}

function luminance(rgb) {
  if (rgb == null) {
    return 0;
  }
  return (rgb[0] * 0.2126) + (rgb[1] * 0.7152) + (rgb[2] * 0.0722);
}

function colorContrast(fg, bg) {
  return Math.abs(luminance(fg) - luminance(bg));
}
