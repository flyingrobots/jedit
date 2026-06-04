import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";
import { cells, fixedTitleRenderOptions } from "./title-screen-helpers.mjs";
import { mockI18n, mockJeditTheme, REPO_ROOT } from "./workspace-helpers.mjs";

const NEON_DISPERSION_SCENE = "neon-dispersion.jedit-scene";
const EXPECTED_SCENE_LABELS = [
  "dispersion-core",
  "dispersion-shard-left",
  "dispersion-shard-right",
  "pink-neon-tube",
  "cyan-neon-tube",
  "violet-neon-tube",
  "wet-floor-reflector",
  "chrome-orb-front",
  "chrome-orb-rear",
  "matte-depth-left",
  "matte-depth-right",
];
const TITLE_WIDTH = 92;
const TITLE_HEIGHT = 28;
const TITLE_TIME = 6.75;
const MIN_RENDER_COLOR_VARIETY = 6;
const MIN_REFRACTIVE_INDEX = 1.5;
const MIN_TRANSPARENCY = 0.65;
const MIN_NEON_REFLECTIVITY = 0.5;
const MIN_CHROME_REFLECTIVITY = 0.9;
const MAX_MATTE_REFLECTIVITY = 0.08;
const CAMERA_ORBIT_SAMPLE_COUNT = 16;
const FULL_CAMERA_ORBIT_RADIANS = Math.PI * 2;
const MIN_ORBIT_RENDER_COLOR_VARIETY = 20;

test("neon dispersion is the registered default title scene", async () => {
  const { adapter, port } = await loadNeonDispersionModules();
  const scene = await adapter.loadBuiltInTitleScene(NEON_DISPERSION_SCENE, {});
  const labeledObjects = labeledSceneObjects(scene);

  assert.equal(port.DEFAULT_BUILT_IN_TITLE_SCENE_NAME, NEON_DISPERSION_SCENE);
  assert.equal(port.BUILT_IN_TITLE_SCENE_NAMES[0], NEON_DISPERSION_SCENE);
  assert.deepEqual([...labeledObjects.keys()], EXPECTED_SCENE_LABELS);
  assert.ok(scene.environment?.floor != null);
  assert.ok(scene.environment?.light != null);
  assert.equal(scene.environment?.walls, undefined);
  assert.equal(
    labeledObjects.get("dispersion-core").refractiveIndex >=
      MIN_REFRACTIVE_INDEX,
    true,
  );
  assert.equal(
    labeledObjects.get("dispersion-core").transparency >= MIN_TRANSPARENCY,
    true,
  );
  assert.equal(
    labeledObjects.get("pink-neon-tube").reflectivity >= MIN_NEON_REFLECTIVITY,
    true,
  );
  assert.equal(
    labeledObjects.get("cyan-neon-tube").reflectivity >= MIN_NEON_REFLECTIVITY,
    true,
  );
  assert.equal(
    labeledObjects.get("chrome-orb-front").reflectivity >=
      MIN_CHROME_REFLECTIVITY,
    true,
  );
  assert.equal(
    labeledObjects.get("matte-depth-left").reflectivity <=
      MAX_MATTE_REFLECTIVITY,
    true,
  );
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
  assert.equal(
    snapshot.sceneOverride.objects[0].label,
    EXPECTED_SCENE_LABELS[0],
  );
  assert.equal(
    model.availableScenes[0],
    port.DEFAULT_BUILT_IN_TITLE_SCENE_NAME,
  );
  assert.equal(model.sceneOverride, snapshot.sceneOverride);
  assert.equal(model.titleCamera.angle, snapshot.sceneOverride.camera.angle);
  assert.equal(model.titleCamera.radius, snapshot.sceneOverride.camera.radius);
});

test("neon dispersion renders neon glass against the authored light stage", async () => {
  const { adapter, themes, title } = await loadNeonDispersionModules();
  const scene = await adapter.loadBuiltInTitleScene(NEON_DISPERSION_SCENE, {});
  const floorEffects = title.titleFloorLightEffectsAt(
    [0, 0, 0],
    scene.objects,
    TITLE_TIME,
  );
  const surface = title.renderTitleScreen(
    TITLE_WIDTH,
    TITLE_HEIGHT,
    TITLE_TIME,
    themes.resolveInitialJeditTheme("graphite"),
    fixedTitleRenderOptions({
      camAngle: scene.camera.angle,
      camRadius: scene.camera.radius,
      sceneOverride: scene,
    }),
  );

  assert.ok(visibleColorKeys(surface).size >= MIN_RENDER_COLOR_VARIETY);
  assert.ok(floorEffects.shadowMultiplier < 1);
  assert.ok(floorEffects.causticStrength > 0);
});

test("neon dispersion keeps visible detail around the camera orbit", async () => {
  const { adapter, themes, title } = await loadNeonDispersionModules();
  const scene = await adapter.loadBuiltInTitleScene(NEON_DISPERSION_SCENE, {});
  const theme = themes.resolveInitialJeditTheme("graphite");

  for (let index = 0; index < CAMERA_ORBIT_SAMPLE_COUNT; index += 1) {
    const angle =
      (index / CAMERA_ORBIT_SAMPLE_COUNT) * FULL_CAMERA_ORBIT_RADIANS;
    const surface = title.renderTitleScreen(
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
    port: await importDist("ports", "title-scene-loader.js"),
    themes: await importDist("ui", "jedit-themes.js"),
    title: await importDist("ui", "title-screen.js"),
  };
}

function labeledSceneObjects(scene) {
  return new Map(
    scene.objects
      .filter((object) => object.label != null)
      .map((object) => [object.label, object]),
  );
}

function visibleColorKeys(surface) {
  return new Set(
    cells(surface)
      .filter((cell) => cell.char !== " ")
      .map((cell) => `${cell.fgRGB.join(",")}:${cell.bgRGB.join(",")}`),
  );
}
