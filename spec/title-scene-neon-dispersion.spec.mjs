import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";
import { cells, fixedTitleRenderOptions } from "./title-screen-helpers.mjs";
import { mockI18n, mockJeditTheme, REPO_ROOT } from "./workspace-helpers.mjs";

const DEFAULT_TITLE_SCENE = "continuum-gate.jedit-scene";
const PRIMARY_OBJECT_LABEL = "stanford-bunny";
const MIRROR_OBJECT_LABEL = "chrome-mirror-sphere";
const TITLE_WIDTH = 92;
const TITLE_HEIGHT = 28;
const TITLE_TIME = 6.75;
const MIN_RENDER_COLOR_VARIETY = 6;
const MIN_PRIMARY_RADIUS = 1;
const MIN_MIRROR_REFLECTIVITY = 0.9;
const MIN_LIGHT_ORBIT_SPEED = 0.1;
const CAMERA_ORBIT_SAMPLE_COUNT = 16;
const FULL_CAMERA_ORBIT_RADIANS = Math.PI * 2;
const MIN_ORBIT_RENDER_COLOR_VARIETY = 10;
const CHECKER_FLOOR_DARK = [2, 3, 7];
const CHECKER_FLOOR_LIGHT = [42, 52, 60];
const CHECKER_FLOOR_GRID_SCALE = 1.05;
const MAX_DEFAULT_CAMERA_RADIUS = 5.6;
const MAX_DEFAULT_CAMERA_Y = 0.8;
const MAX_TARGET_CENTERLINE_OFFSET = 0.18;
const DEFAULT_SCENE_OBJECT_COUNT = 2;
const LIGHT_ORBIT_SAMPLE_TIME = 2.5;
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

test("continuum gate is the registered default title scene", async () => {
  const modules = await loadDefaultSceneModules();
  const scene = await loadDefaultScene(modules);
  const primary = scene.objects[0];
  const mirror = scene.objects.find(
    (object) => object.label === MIRROR_OBJECT_LABEL,
  );
  const primaryCenter =
    modules.titleScene.titleSceneObjectFootprintCenter(primary);

  assert.equal(
    modules.port.DEFAULT_BUILT_IN_TITLE_SCENE_NAME,
    DEFAULT_TITLE_SCENE,
  );
  assert.equal(modules.port.BUILT_IN_TITLE_SCENE_NAMES[0], DEFAULT_TITLE_SCENE);
  assert.equal(scene.objects.length, DEFAULT_SCENE_OBJECT_COUNT);
  assert.ok(scene.camera.radius <= MAX_DEFAULT_CAMERA_RADIUS);
  assert.ok(scene.camera.position[1] <= MAX_DEFAULT_CAMERA_Y);
  assert.ok(scene.camera.position[1] < scene.camera.target[1]);
  assert.ok(scene.camera.position[2] > scene.camera.target[2]);
  assert.ok(
    Math.abs(scene.camera.target[0] - primaryCenter[0]) <=
      MAX_TARGET_CENTERLINE_OFFSET,
  );
  assert.ok(scene.camera.target[1] > primaryCenter[1]);
  assert.ok(scene.camera.target[2] < scene.camera.position[2]);
  assert.equal(primary.label, PRIMARY_OBJECT_LABEL);
  assert.equal(primary.kind, "mesh");
  assert.ok(primary.radius >= MIN_PRIMARY_RADIUS);
  assert.ok((primary.transparency ?? 0) > 0);
  assert.ok(mirror != null);
  assert.equal(mirror.kind, "sphere");
  assert.ok(mirror.reflectivity >= MIN_MIRROR_REFLECTIVITY);
  assert.ok(scene.environment?.floor != null);
  assert.equal(scene.environment?.floor?.kind, "grid");
  assert.deepEqual(scene.environment?.floor?.dark, CHECKER_FLOOR_DARK);
  assert.deepEqual(scene.environment?.floor?.light, CHECKER_FLOOR_LIGHT);
  assert.equal(scene.environment?.floor?.gridScale, CHECKER_FLOOR_GRID_SCALE);
  assert.ok(scene.environment?.light != null);
  assert.ok(scene.environment?.light?.orbit != null);
  assert.ok(
    Math.abs(scene.environment.light.orbit.angularSpeed) >=
      MIN_LIGHT_ORBIT_SPEED,
  );
  assert.notDeepEqual(
    modules.titleSceneEnvironment.titleSceneLightDirectionAt(
      scene.environment,
      0,
    ),
    modules.titleSceneEnvironment.titleSceneLightDirectionAt(
      scene.environment,
      LIGHT_ORBIT_SAMPLE_TIME,
    ),
  );
  assert.equal(scene.environment?.walls, undefined);
});

test("startup snapshot preloads the default title scene", async () => {
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
  assert.equal(snapshot.sceneOverride.objects[0].label, PRIMARY_OBJECT_LABEL);
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

test("default title scene renders glass against the authored light stage", async () => {
  const modules = await loadDefaultSceneModules();
  const scene = await loadDefaultScene(modules);
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
      camera: scene.camera,
      sceneOverride: scene,
    }),
  );

  assert.ok(visibleColorKeys(surface).size >= MIN_RENDER_COLOR_VARIETY);
  assert.ok(floorEffects.causticStrength > 0);
});

test("default title scene authored colors remain stable across general themes", async () => {
  const modules = await loadDefaultSceneModules();
  const scene = await loadDefaultScene(modules);
  const theme = modules.themes.resolveInitialJeditTheme("graphite");
  const washedTheme = themeWithWashedGeneralColors(theme);
  const renderOptions = fixedTitleRenderOptions({
    camera: scene.camera,
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

test("default title scene keeps visible detail around the camera orbit", async () => {
  const modules = await loadDefaultSceneModules();
  const scene = await loadDefaultScene(modules);
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

async function loadDefaultSceneModules() {
  return {
    adapter: await importDist("adapters", "title-scene-loader.js"),
    meshes: await importDist("adapters", "workspace-title-meshes.js"),
    port: await importDist("ports", "title-scene-loader.js"),
    titleSceneEnvironment: await importDist("ui", "title-scene-environment.js"),
    titleScene: await importDist("ui", "title-scene.js"),
    themes: await importDist("ui", "jedit-themes.js"),
    title: await importDist("ui", "title-screen.js"),
  };
}

function loadDefaultScene(modules) {
  return modules.adapter.loadBuiltInTitleScene(
    DEFAULT_TITLE_SCENE,
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
