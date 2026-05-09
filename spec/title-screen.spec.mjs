import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const TITLE_SCREEN_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'title-screen.js');
const BRAILLE_CANVAS_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'averaging-braille-canvas.js');
const THEMES_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'jedit-themes.js');
const STYLE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'jedit-theme.js');
const FIXED_TITLE_SEED = 0.417;
const TITLE_WIDTH = 96;
const TITLE_HEIGHT = 28;

async function loadTitleModules() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return {
    title: await import(pathToFileURL(TITLE_SCREEN_PATH).href),
    brailleCanvas: await import(pathToFileURL(BRAILLE_CANVAS_PATH).href),
    themes: await import(pathToFileURL(THEMES_PATH).href),
    style: await import(pathToFileURL(STYLE_PATH).href),
  };
}

function cells(surface) {
  return Array.from({ length: surface.height }, (_, y) => (
    Array.from({ length: surface.width }, (_, x) => surface.get(x, y))
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

test('title screen renders the logo as a themed Braille foreground layer', async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const surface = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, 0, theme, FIXED_TITLE_SEED);
  const logoCells = cells(surface).filter((cell) => cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold));

  assert.ok(logoCells.length > 40);
  assert.ok(logoCells.every((cell) => isBraille(cell.char)));
  assert.ok(new Set(logoCells.map(cellColorKey)).size > 1);
  assert.ok(logoCells.every((cell) => cell.bgRGB != null));
});

test('title scene uses Braille subpixels with averaged material colors', async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const surface = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, 0, theme, FIXED_TITLE_SEED);
  const sceneCells = cells(surface).filter((cell) => !cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold));
  const visibleSceneChars = new Set(sceneCells.map((cell) => cell.char).filter((char) => char !== ' '));

  assert.ok(visibleSceneChars.size >= 4);
  assert.ok([...visibleSceneChars].every((char) => isBraille(char)));
  assert.ok(new Set(sceneCells.map(cellColorKey)).size > 3);
});

test('title scene keeps reflective highlights on sphere materials', async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const surface = title.renderTitleScreen(TITLE_WIDTH, TITLE_HEIGHT, 0, theme, FIXED_TITLE_SEED);
  const sceneCells = cells(surface).filter((cell) => (
    !cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold)
    && isBraille(cell.char)
    && cell.char !== String.fromCodePoint(0x2800)
  ));
  const highlightCells = sceneCells.filter((cell) => luminance(cell.fgRGB) > 220);

  assert.ok(highlightCells.length > 0);
});

test('title screen is deterministic for a fixed scene seed and frame time', async () => {
  const { title, themes } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const first = title.renderTitleScreen(72, 22, 3, theme, FIXED_TITLE_SEED);
  const second = title.renderTitleScreen(72, 22, 3, theme, FIXED_TITLE_SEED);

  assert.deepEqual(cells(first), cells(second));
});

function cellColorKey(cell) {
  return cell.fg ?? cell.fgRGB?.join(',') ?? '';
}

function luminance(rgb) {
  if (rgb == null) {
    return 0;
  }
  return (rgb[0] * 0.2126) + (rgb[1] * 0.7152) + (rgb[2] * 0.0722);
}
