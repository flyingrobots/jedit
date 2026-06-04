import assert from "node:assert/strict";
import test from "node:test";
import {
  cells,
  fixedTitleRenderOptions,
  isBraille,
  loadTitleModules,
} from "./title-screen-helpers.mjs";

const TITLE_WIDTH = 96;
const TITLE_HEIGHT = 28;
const POST_INTRO_SCENE_TIME = 6.75;
const MIN_READABLE_CAMERA_DRIFT_RATE = 0.02;
const REFLECTIVE_HIGHLIGHT_LUMINANCE = 190;

test("title camera ambient drift is fast enough to read as orbiting", async () => {
  const { title } = await loadTitleModules();

  assert.ok(title.TITLE_CAMERA_DRIFT_RATE >= MIN_READABLE_CAMERA_DRIFT_RATE);
});

test("title scene uses Braille subpixels with averaged material colors", async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const surface = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    POST_INTRO_SCENE_TIME,
    theme,
    fixedTitleRenderOptions(),
  );
  const sceneCells = cells(surface).filter(
    (cell) => !cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold),
  );
  const visibleSceneChars = new Set(
    sceneCells.map((cell) => cell.char).filter((char) => char !== " "),
  );

  assert.ok(visibleSceneChars.size >= 4);
  assert.ok([...visibleSceneChars].every((char) => isBraille(char)));
  assert.ok(new Set(sceneCells.map(cellColorKey)).size > 3);
});

test("title scene can render as density-mapped ASCII instead of Braille", async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const surface = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    POST_INTRO_SCENE_TIME,
    theme,
    fixedTitleRenderOptions({
      renderMode: title.TITLE_RENDER_MODE.Ascii,
      asciiPalette: title.TITLE_ASCII_PALETTE.Dense,
    }),
  );
  const sceneCells = cells(surface).filter(
    (cell) => !cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold),
  );
  const visibleSceneChars = new Set(
    sceneCells.map((cell) => cell.char).filter((char) => char !== " "),
  );

  assert.ok(visibleSceneChars.size >= 3);
  assert.ok([...visibleSceneChars].every((char) => !isBraille(char)));
  assert.ok(
    [...visibleSceneChars].every((char) =>
      " .,:;irsXA253hMHGS#9B&@".includes(char),
    ),
  );
  assert.ok(new Set(sceneCells.map(cellColorKey)).size > 3);
});

test("title scene ASCII palettes produce distinct glyph vocabularies", async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const dense = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    POST_INTRO_SCENE_TIME,
    theme,
    fixedTitleRenderOptions({
      renderMode: title.TITLE_RENDER_MODE.Ascii,
      asciiPalette: title.TITLE_ASCII_PALETTE.Dense,
    }),
  );
  const blocks = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    POST_INTRO_SCENE_TIME,
    theme,
    fixedTitleRenderOptions({
      renderMode: title.TITLE_RENDER_MODE.Ascii,
      asciiPalette: title.TITLE_ASCII_PALETTE.Blocks,
    }),
  );
  const dither = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    POST_INTRO_SCENE_TIME,
    theme,
    fixedTitleRenderOptions({
      renderMode: title.TITLE_RENDER_MODE.Ascii,
      asciiPalette: title.TITLE_ASCII_PALETTE.Dither,
    }),
  );

  assert.notDeepEqual(sceneGlyphs(dense, style), sceneGlyphs(blocks, style));
  assert.ok(
    sceneGlyphs(blocks, style).some((char) => "▁▂▃▄▅▆▇█".includes(char)),
  );
  assert.notDeepEqual(
    sceneCellKeys(dense, style),
    sceneCellKeys(dither, style),
  );
  assert.ok(
    sceneGlyphs(dither, style).every((char) => " .:-=+*#%@".includes(char)),
  );
});

test("ASCII canvas colors inactive samples as background instead of inactive foreground", async () => {
  const { asciiCanvas } = await loadTitleModules();
  const surface = asciiCanvas.averagingAsciiCanvas(
    1,
    1,
    ({ u, v }) => {
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
    },
    0,
    { palette: asciiCanvas.TITLE_ASCII_PALETTE.Dense },
  );
  const cell = surface.get(0, 0);

  assert.deepEqual(cell.fgRGB, [64, 0, 0]);
  assert.deepEqual(cell.bgRGB, [0, 0, 0]);
});

test("title scene keeps reflective highlights on sphere materials", async () => {
  const { title, themes, style } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const surface = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    POST_INTRO_SCENE_TIME,
    theme,
    fixedTitleRenderOptions(),
  );
  const sceneCells = cells(surface).filter(
    (cell) =>
      !cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold) &&
      isBraille(cell.char) &&
      cell.char !== String.fromCodePoint(0x2800),
  );
  const highlightCells = sceneCells.filter(
    (cell) => luminance(cell.fgRGB) > REFLECTIVE_HIGHLIGHT_LUMINANCE,
  );

  assert.ok(highlightCells.length > 0);
});

test("title scene keeps checker floor material contrast stable across built-in themes", async () => {
  const { title, themes } = await loadTitleModules();

  for (const theme of themes.availableJeditThemes()) {
    const colors = title.titleSceneMaterialColors(theme);

    assert.ok(
      luminance(colors.floorLight) > luminance(colors.floorDark),
      `${theme.name} floorLight should be lighter than floorDark`,
    );
  }
});

test("title screen is deterministic for a fixed scene seed and frame time", async () => {
  const { title, themes } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const first = title.renderTitleScreen(
    72,
    22,
    3,
    theme,
    fixedTitleRenderOptions(),
  );
  const second = title.renderTitleScreen(
    72,
    22,
    3,
    theme,
    fixedTitleRenderOptions(),
  );

  assert.deepEqual(cells(first), cells(second));
});

test("title screen render options keep scene seed separate from camera angle", async () => {
  const { title, themes } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const fixedCamera = { camAngle: 0.25, sceneSeed: 0.125 };
  const sameSeed = title.renderTitleScreen(72, 22, 3, theme, fixedCamera);
  const sameSeedAgain = title.renderTitleScreen(72, 22, 3, theme, fixedCamera);
  const otherSeed = title.renderTitleScreen(72, 22, 3, theme, {
    ...fixedCamera,
    sceneSeed: 0.875,
  });

  assert.deepEqual(cells(sameSeed), cells(sameSeedAgain));
  assert.notDeepEqual(cells(otherSeed), cells(sameSeed));
});

function cellColorKey(cell) {
  return cell.fg ?? cell.fgRGB?.join(",") ?? "";
}

function sceneGlyphs(surface, style) {
  return [
    ...new Set(
      cells(surface)
        .filter(
          (cell) => !cell.modifiers?.includes(style.JEDIT_TEXT_MODIFIER.Bold),
        )
        .map((cell) => cell.char)
        .filter((char) => char !== " "),
    ),
  ];
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
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
