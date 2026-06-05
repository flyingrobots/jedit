import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";
import { cells, fixedTitleRenderOptions } from "./title-screen-helpers.mjs";
import { mockI18n, mockJeditTheme, REPO_ROOT } from "./workspace-helpers.mjs";

const NEON_DISPERSION_SCENE = "neon-dispersion.jedit-scene";
const DRAGON_OBJECT_LABEL = "stanford-dragon";
const TITLE_WIDTH = 92;
const TITLE_HEIGHT = 28;
const TITLE_TIME = 6.75;
const MIN_RENDER_COLOR_VARIETY = 6;
const MIN_DRAGON_REFRACTIVE_INDEX = 1.5;
const MIN_DRAGON_TRANSPARENCY = 0.55;
const MIN_DRAGON_TRIANGLES = 11000;
const CAMERA_ORBIT_SAMPLE_COUNT = 16;
const FULL_CAMERA_ORBIT_RADIANS = Math.PI * 2;
const MIN_ORBIT_RENDER_COLOR_VARIETY = 20;
const CHECKER_FLOOR_DARK = [3, 4, 7];
const CHECKER_FLOOR_LIGHT = [58, 68, 76];
const CHECKER_FLOOR_GRID_SCALE = 0.95;
const MAX_DEFAULT_DRAGON_CAMERA_RADIUS = 3.2;
const THEME_STABILITY_VARIABLE_NAMES = [
  "accent",
  "info",
  "success",
  "ink",
  "muted",
  "surface",
];
const THEME_STABILITY_RGB = [244, 246, 248];
const THEME_STABILITY_HEX = "#f4f6f8";

test("neon dispersion is the registered default title scene", async () => {
  const modules = await loadNeonDispersionModules();
  const scene = await loadNeonDispersionScene(modules);
  const dragon = scene.objects[0];

  assert.equal(
    modules.port.DEFAULT_BUILT_IN_TITLE_SCENE_NAME,
    NEON_DISPERSION_SCENE,
  );
  assert.equal(
    modules.port.BUILT_IN_TITLE_SCENE_NAMES[0],
    NEON_DISPERSION_SCENE,
  );
  assert.equal(scene.objects.length, 1);
  assert.ok(scene.camera.radius <= MAX_DEFAULT_DRAGON_CAMERA_RADIUS);
  assert.equal(dragon.label, DRAGON_OBJECT_LABEL);
  assert.equal(dragon.kind, "mesh");
  assert.ok(scene.environment?.floor != null);
  assert.equal(scene.environment?.floor?.kind, "grid");
  assert.deepEqual(scene.environment?.floor?.dark, CHECKER_FLOOR_DARK);
  assert.deepEqual(scene.environment?.floor?.light, CHECKER_FLOOR_LIGHT);
  assert.equal(scene.environment?.floor?.gridScale, CHECKER_FLOOR_GRID_SCALE);
  assert.ok(scene.environment?.light != null);
  assert.equal(scene.environment?.walls, undefined);
  assert.ok(dragon.mesh.triangles.length >= MIN_DRAGON_TRIANGLES);
  assert.ok(dragon.transparency >= MIN_DRAGON_TRANSPARENCY);
  assert.ok(dragon.refractiveIndex >= MIN_DRAGON_REFRACTIVE_INDEX);
});

test("startup snapshot preloads neon dispersion as the initial scene", async () => {
  const [adapter, init, port] = await Promise.all([
    importDist("adapters", "workspace-initial-model-snapshot.js"),
    importDist("app", "workspace", "init.js"),
    importDist("ports", "title-scene-loader.js"),
  ]);
  const snapshot = adapter.createInitialModelSnapshot(0, REPO_ROOT, () => 0.5);
  const model = init.createInitialModel(REPO_ROOT, 120, 24, {
    ...snapshot,
    i18n: mockI18n(),
    jeditTheme: mockJeditTheme(),
  });

  assert.ok(snapshot.sceneOverride != null);
  assert.equal(snapshot.sceneOverride.objects[0].label, DRAGON_OBJECT_LABEL);
  assert.equal(
    model.availableScenes[0],
    port.DEFAULT_BUILT_IN_TITLE_SCENE_NAME,
  );
  assert.equal(model.sceneOverride, snapshot.sceneOverride);
  assert.equal(model.titleCamera.angle, snapshot.sceneOverride.camera.angle);
  assert.equal(model.titleCamera.radius, snapshot.sceneOverride.camera.radius);
});

test("neon dispersion renders neon glass against the authored light stage", async () => {
  const modules = await loadNeonDispersionModules();
  const scene = await loadNeonDispersionScene(modules);
  const floorEffects = modules.title.titleFloorLightEffectsAt(
    [0, 0, 0],
    scene.objects,
    TITLE_TIME,
  );
  const surface = modules.title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    TITLE_TIME,
    modules.themes.resolveInitialJeditTheme("graphite"),
    fixedTitleRenderOptions({
      camAngle: scene.camera.angle,
      camRadius: scene.camera.radius,
      sceneOverride: scene,
    }),
  );

  assert.ok(visibleColorKeys(surface).size >= MIN_RENDER_COLOR_VARIETY);
  assert.ok(floorEffects.causticStrength > 0);
});

test("neon dispersion authored colors remain stable across general themes", async () => {
  const modules = await loadNeonDispersionModules();
  const scene = await loadNeonDispersionScene(modules);
  const theme = modules.themes.resolveInitialJeditTheme("graphite");
  const washedTheme = themeWithWashedGeneralColors(theme);
  const renderOptions = fixedTitleRenderOptions({
    camAngle: scene.camera.angle,
    camRadius: scene.camera.radius,
    sceneOverride: scene,
  });

  const baseSurface = modules.title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    TITLE_TIME,
    theme,
    renderOptions,
  );
  const washedSurface = modules.title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    TITLE_TIME,
    washedTheme,
    renderOptions,
  );

  assert.equal(
    sceneCellSignature(washedSurface),
    sceneCellSignature(baseSurface),
  );
});

test("neon dispersion keeps visible detail around the camera orbit", async () => {
  const modules = await loadNeonDispersionModules();
  const scene = await loadNeonDispersionScene(modules);
  const theme = modules.themes.resolveInitialJeditTheme("graphite");

  for (let index = 0; index < CAMERA_ORBIT_SAMPLE_COUNT; index += 1) {
    const angle =
      (index / CAMERA_ORBIT_SAMPLE_COUNT) * FULL_CAMERA_ORBIT_RADIANS;
    const surface = modules.title.renderTitleScreen(
      TITLE_WIDTH,
      TITLE_HEIGHT,
      TITLE_TIME,
      theme,
      fixedTitleRenderOptions({
        camAngle: angle,
        camRadius: scene.camera.radius,
        sceneOverride: scene,
      }),
    );

    assert.ok(
      visibleColorKeys(surface).size >= MIN_ORBIT_RENDER_COLOR_VARIETY,
      `camera sample ${index} collapsed to a flat wall/background`,
    );
  }
});

async function loadNeonDispersionModules() {
  return {
    adapter: await importDist("adapters", "title-scene-loader.js"),
    meshes: await importDist("adapters", "workspace-title-meshes.js"),
    port: await importDist("ports", "title-scene-loader.js"),
    themes: await importDist("ui", "jedit-themes.js"),
    title: await importDist("ui", "title-screen.js"),
  };
}

function loadNeonDispersionScene(modules) {
  return modules.adapter.loadBuiltInTitleScene(
    NEON_DISPERSION_SCENE,
    modules.meshes.loadStartupTitleMeshes(),
  );
}

function visibleColorKeys(surface) {
  return new Set(
    cells(surface)
      .filter((cell) => cell.char !== " ")
      .map((cell) => `${cell.fgRGB.join(",")}:${cell.bgRGB.join(",")}`),
  );
}

function sceneCellSignature(surface) {
  return cells(surface)
    .map((cell) =>
      [cell.char, cell.fgRGB.join(","), cell.bgRGB.join(",")].join("|"),
    )
    .join("\n");
}

function themeWithWashedGeneralColors(theme) {
  const variables = new Map(theme.variables);
  for (const variableName of THEME_STABILITY_VARIABLE_NAMES) {
    variables.set(variableName, {
      red: THEME_STABILITY_RGB[0],
      green: THEME_STABILITY_RGB[1],
      blue: THEME_STABILITY_RGB[2],
      hex: THEME_STABILITY_HEX,
      rgb: THEME_STABILITY_RGB,
      variableName,
    });
  }

  return {
    ...theme,
    variables,
  };
}
