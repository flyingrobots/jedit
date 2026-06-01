import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const TITLE_SCREEN_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'title-screen.js');
const THEMES_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'jedit-themes.js');
const STYLE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'jedit-theme.js');
const FIXED_TITLE_SEED = 0.417;
const TITLE_WIDTH = 96;
const TITLE_HEIGHT = 28;
const FLYINGROBOTS_LOGO_MIN_VISIBLE_CELLS = 24;
const FLYINGROBOTS_LOGO_FADE_START_SECONDS = 15;
const JEDIT_LOGO_FADE_START_SECONDS = 30;
const TITLE_LOGO_FADE_DURATION_SECONDS = 3;
const LOGO_FADE_MIDPOINT_RATIO = 0.5;
const LOGO_FADE_END_OFFSET_SECONDS = 0.01;
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
    themes: await import(pathToFileURL(THEMES_PATH).href),
    style: await import(pathToFileURL(STYLE_PATH).href),
  });
  return titleModulesPromise;
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

test('Flying Robots logo fades out after fifteen seconds', async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const bounds = title.flyingRobotsLogoCellBounds(TITLE_WIDTH, TITLE_HEIGHT);
  assert.ok(bounds != null);
  assert.equal(title.FLYINGROBOTS_LOGO_FADE_START_SECONDS, FLYINGROBOTS_LOGO_FADE_START_SECONDS);
  assert.equal(title.TITLE_LOGO_FADE_DURATION_SECONDS, TITLE_LOGO_FADE_DURATION_SECONDS);

  const before = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, 0, theme, fixedTitleRenderOptions());
  const during = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, logoFadeMidpoint(title.FLYINGROBOTS_LOGO_FADE_START_SECONDS), theme, fixedTitleRenderOptions());
  const after = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, logoFadeEnd(title.FLYINGROBOTS_LOGO_FADE_START_SECONDS), theme, fixedTitleRenderOptions());
  const beforeCells = flyingRobotsLogoCells(before, bounds, style);
  const duringCells = flyingRobotsLogoCells(during, bounds, style);
  const afterCells = flyingRobotsLogoCells(after, bounds, style);

  assert.ok(beforeCells.length > FLYINGROBOTS_LOGO_MIN_VISIBLE_CELLS);
  assert.ok(duringCells.length > 0);
  assert.ok(maxCellContrast(duringCells) < maxCellContrast(beforeCells));
  assert.ok(duringCells.every(({ cell }) => cell.opacity < title.TITLE_LOGO_OPACITY.Visible));
  assert.ok(duringCells.every(({ cell }) => cell.opacity > title.TITLE_LOGO_OPACITY.Hidden));
  assert.equal(afterCells.length, 0);
});

test('jedit title logo fades out after thirty seconds', async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  assert.equal(title.JEDIT_LOGO_FADE_START_SECONDS, JEDIT_LOGO_FADE_START_SECONDS);
  assert.equal(title.TITLE_LOGO_FADE_DURATION_SECONDS, TITLE_LOGO_FADE_DURATION_SECONDS);

  const before = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, 0, theme, fixedTitleRenderOptions());
  const during = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, logoFadeMidpoint(title.JEDIT_LOGO_FADE_START_SECONDS), theme, fixedTitleRenderOptions());
  const after = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, logoFadeEnd(title.JEDIT_LOGO_FADE_START_SECONDS), theme, fixedTitleRenderOptions());
  const beforeCells = titleLogoCells(before, style);
  const duringCells = titleLogoCells(during, style);
  const afterCells = titleLogoCells(after, style);

  assert.ok(beforeCells.length > 12);
  assert.ok(duringCells.length > 0);
  assert.ok(duringCells.every(({ cell }) => cell.opacity < title.TITLE_LOGO_OPACITY.Visible));
  assert.ok(duringCells.every(({ cell }) => cell.opacity > title.TITLE_LOGO_OPACITY.Hidden));
  assert.equal(afterCells.length, 0);
});

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

function logoFadeMidpoint(fadeStartSeconds) {
  return fadeStartSeconds + (TITLE_LOGO_FADE_DURATION_SECONDS * LOGO_FADE_MIDPOINT_RATIO);
}

function logoFadeEnd(fadeStartSeconds) {
  return fadeStartSeconds + TITLE_LOGO_FADE_DURATION_SECONDS + LOGO_FADE_END_OFFSET_SECONDS;
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

function maxCellContrast(logoCells) {
  return Math.max(...logoCells.map(({ cell }) => colorContrast(cell.fgRGB, cell.bgRGB)));
}
