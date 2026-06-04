import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";
import { cells, fixedTitleRenderOptions } from "./title-screen-helpers.mjs";

const MATERIAL_LAB_SCENE = "material-lab.jedit-scene";
const EXPECTED_LANE_LABELS = [
  "matte",
  "mirror",
  "transparent",
  "refractive",
  "rim-column",
  "spotlight-target",
];
const TITLE_WIDTH = 88;
const TITLE_HEIGHT = 26;
const TITLE_TIME = 6.75;
const MIN_RENDER_COLOR_VARIETY = 4;

test("material lab is a registered non-default scene with labeled lanes", async () => {
  const { adapter, port } = await loadMaterialLabModules();
  const scene = await adapter.loadBuiltInTitleScene(MATERIAL_LAB_SCENE, {});
  const lanes = materialLanes(scene);

  assert.ok(port.BUILT_IN_TITLE_SCENE_NAMES.includes(MATERIAL_LAB_SCENE));
  assert.notEqual(port.BUILT_IN_TITLE_SCENE_NAMES[0], MATERIAL_LAB_SCENE);
  assert.deepEqual([...lanes.keys()], EXPECTED_LANE_LABELS);
  assert.equal(lanes.get("matte").reflectivity, 0);
  assert.equal(lanes.get("mirror").reflectivity, 1);
  assert.ok(lanes.get("transparent").transparency > 0);
  assert.ok(lanes.get("refractive").refractiveIndex > 1);
  assert.ok(scene.environment?.floor != null);
  assert.ok(scene.environment?.light != null);
});

test("material lab preview inspector exposes labels and optical material facts", async () => {
  const { adapter, preview } = await loadMaterialLabModules();
  const scene = await adapter.loadBuiltInTitleScene(MATERIAL_LAB_SCENE, {});
  const refractiveIndex = scene.objects.findIndex(
    (object) => object.label === "refractive",
  );
  const model = preview.createTitleScenePreviewModel({
    sceneNames: [MATERIAL_LAB_SCENE],
    sceneObjectCounts: [scene.objects.length],
    themeNames: ["graphite"],
    initialSelectedObjectIndex: refractiveIndex,
  });
  const inspector = preview.titleScenePreviewInspector(model, {
    scene,
    sceneName: MATERIAL_LAB_SCENE,
    themeName: "graphite",
  });

  assert.equal(inspector.selectedObject.label, "refractive");
  assert.equal(
    inspector.selectedObject.refractiveIndex,
    scene.objects[refractiveIndex].refractiveIndex,
  );
  assert.equal(
    inspector.selectedObject.transparency,
    scene.objects[refractiveIndex].transparency,
  );
});

test("material lab renders a varied scene and exercises transparent floor effects", async () => {
  const { adapter, title, themes } = await loadMaterialLabModules();
  const scene = await adapter.loadBuiltInTitleScene(MATERIAL_LAB_SCENE, {});
  const transparent = materialLanes(scene).get("transparent");
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
  const effects = title.titleFloorLightEffectsAt(
    [transparent.position[0], 0, transparent.position[2]],
    scene.objects,
    0,
  );

  assert.ok(visibleColorKeys(surface).size >= MIN_RENDER_COLOR_VARIETY);
  assert.ok(effects.shadowMultiplier < 1);
  assert.ok(effects.causticStrength > 0);
});

async function loadMaterialLabModules() {
  return {
    adapter: await importDist("adapters", "title-scene-loader.js"),
    port: await importDist("ports", "title-scene-loader.js"),
    preview: await importDist("app", "title-scene-preview-session.js"),
    themes: await importDist("ui", "jedit-themes.js"),
    title: await importDist("ui", "title-screen.js"),
  };
}

function materialLanes(scene) {
  return new Map(scene.objects.map((object) => [object.label, object]));
}

function visibleColorKeys(surface) {
  return new Set(
    cells(surface)
      .filter((cell) => cell.char !== " ")
      .map((cell) => `${cell.fgRGB.join(",")}:${cell.bgRGB.join(",")}`),
  );
}
