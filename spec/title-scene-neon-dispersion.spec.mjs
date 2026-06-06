import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";
import { cells, fixedTitleRenderOptions } from "./title-screen-helpers.mjs";
import { mockI18n, mockJeditTheme, REPO_ROOT } from "./workspace-helpers.mjs";

const DEFAULT_BUNNY_SCENE = "bunny.jedit-scene";
const BUNNY_OBJECT_LABEL = "stanford-bunny";
const TITLE_WIDTH = 92;
const TITLE_HEIGHT = 28;
const TITLE_TIME = 6.75;
const MIN_RENDER_COLOR_VARIETY = 6;
const MIN_BUNNY_REFRACTIVE_INDEX = 1.5;
const MIN_BUNNY_TRANSPARENCY = 0.5;
const MIN_BUNNY_TRIANGLES = 1000;
const MIN_DRESSING_OBJECT_COUNT = 7;
const MIN_DRESSING_MATERIAL_COUNT = 6;
const CAMERA_ORBIT_SAMPLE_COUNT = 16;
const FULL_CAMERA_ORBIT_RADIANS = Math.PI * 2;
const MIN_ORBIT_RENDER_COLOR_VARIETY = 20;
const CHECKER_FLOOR_DARK = [3, 4, 7];
const CHECKER_FLOOR_LIGHT = [58, 68, 76];
const CHECKER_FLOOR_GRID_SCALE = 0.95;
const MAX_DEFAULT_BUNNY_CAMERA_RADIUS = 2.8;
const MAX_DEFAULT_BUNNY_CAMERA_Y = 1.45;
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

test("bunny is the registered default title scene", async () => {
  const modules = await loadDefaultBunnyModules();
  const scene = await loadDefaultBunnyScene(modules);
  const bunny = scene.objects[0];

  assert.equal(
    modules.port.DEFAULT_BUILT_IN_TITLE_SCENE_NAME,
    DEFAULT_BUNNY_SCENE,
  );
  assert.equal(modules.port.BUILT_IN_TITLE_SCENE_NAMES[0], DEFAULT_BUNNY_SCENE);
  assert.ok(scene.objects.length >= MIN_DRESSING_OBJECT_COUNT);
  assert.ok(scene.camera.radius <= MAX_DEFAULT_BUNNY_CAMERA_RADIUS);
  assert.ok(scene.camera.position[1] <= MAX_DEFAULT_BUNNY_CAMERA_Y);
  assert.deepEqual(
    scene.camera.target,
    modules.titleScene.titleSceneObjectFootprintCenter(bunny),
  );
  assert.equal(bunny.label, BUNNY_OBJECT_LABEL);
  assert.equal(bunny.kind, "mesh");
  assert.ok(scene.objects.some((object) => object.kind === "sphere"));
  assert.ok(scene.objects.some((object) => object.kind === "cube"));
  assert.ok(
    new Set(scene.objects.map((object) => object.color.join(","))).size >=
      MIN_DRESSING_MATERIAL_COUNT,
  );
  assert.ok(scene.objects.some((object) => object.reflectivity > 0.5));
  assert.ok(scene.objects.some((object) => object.transparency > 0.2));
  assert.ok(scene.environment?.floor != null);
  assert.equal(scene.environment?.floor?.kind, "grid");
  assert.deepEqual(scene.environment?.floor?.dark, CHECKER_FLOOR_DARK);
  assert.deepEqual(scene.environment?.floor?.light, CHECKER_FLOOR_LIGHT);
  assert.equal(scene.environment?.floor?.gridScale, CHECKER_FLOOR_GRID_SCALE);
  assert.ok(scene.environment?.light != null);
  assert.equal(scene.environment?.walls, undefined);
  assert.ok(bunny.mesh.triangles.length >= MIN_BUNNY_TRIANGLES);
  assert.ok(bunny.transparency >= MIN_BUNNY_TRANSPARENCY);
  assert.ok(bunny.refractiveIndex >= MIN_BUNNY_REFRACTIVE_INDEX);
});

test("startup snapshot preloads the default bunny as the initial scene", async () => {
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
  assert.equal(snapshot.sceneOverride.objects[0].label, BUNNY_OBJECT_LABEL);
  assert.equal(
    model.availableScenes[0],
    port.DEFAULT_BUILT_IN_TITLE_SCENE_NAME,
  );
  assert.equal(model.sceneOverride, snapshot.sceneOverride);
  assert.equal(model.titleCamera.angle, snapshot.sceneOverride.camera.angle);
  assert.equal(model.titleCamera.radius, snapshot.sceneOverride.camera.radius);
  assert.deepEqual(
    model.titleCamera.position,
    snapshot.sceneOverride.camera.position,
  );
  assert.deepEqual(
    model.titleCamera.target,
    snapshot.sceneOverride.camera.target,
  );
});

test("default bunny renders glass against the authored light stage", async () => {
  const modules = await loadDefaultBunnyModules();
  const scene = await loadDefaultBunnyScene(modules);
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

test("default bunny authored colors remain stable across general themes", async () => {
  const modules = await loadDefaultBunnyModules();
  const scene = await loadDefaultBunnyScene(modules);
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

test("default bunny keeps visible detail around the camera orbit", async () => {
  const modules = await loadDefaultBunnyModules();
  const scene = await loadDefaultBunnyScene(modules);
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

async function loadDefaultBunnyModules() {
  return {
    adapter: await importDist("adapters", "title-scene-loader.js"),
    meshes: await importDist("adapters", "workspace-title-meshes.js"),
    port: await importDist("ports", "title-scene-loader.js"),
    titleScene: await importDist("ui", "title-scene.js"),
    themes: await importDist("ui", "jedit-themes.js"),
    title: await importDist("ui", "title-screen.js"),
  };
}

function loadDefaultBunnyScene(modules) {
  return modules.adapter.loadBuiltInTitleScene(
    DEFAULT_BUNNY_SCENE,
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
