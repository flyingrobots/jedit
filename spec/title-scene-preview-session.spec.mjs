import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";

const SCENE_NAMES = ["sphere.jedit-scene", "column.jedit-scene"];
const SCENE_OBJECT_COUNTS = [1, 2];
const THEME_NAMES = ["graphite", "morning"];
const INITIAL_CAMERA_ANGLE = 0;
const INITIAL_CAMERA_RADIUS = 8.5;
const EXPECTED_TIME_STEP_SECONDS = 0.5;
const EXPECTED_CAMERA_STEP_RADIANS = 0.12;
const EXPECTED_CAMERA_RADIUS_STEP = 0.25;

test("title-scene preview session applies authoring controls deterministically", async () => {
  const preview = await importPreviewSession();
  let model = preview.createTitleScenePreviewModel({
    sceneNames: SCENE_NAMES,
    sceneObjectCounts: SCENE_OBJECT_COUNTS,
    themeNames: THEME_NAMES,
  });

  assert.equal(model.sceneIndex, 0);
  assert.equal(model.themeIndex, 0);
  assert.equal(model.renderModeIndex, 0);
  assert.equal(model.selectedObjectIndex, 0);
  assert.equal(model.timeSeconds, 0);
  assert.equal(model.cameraAngle, INITIAL_CAMERA_ANGLE);
  assert.equal(model.cameraRadius, INITIAL_CAMERA_RADIUS);

  model = preview.updateTitleScenePreviewModel(
    model,
    preview.TITLE_SCENE_PREVIEW_INPUT.TimeForward,
  );
  model = preview.updateTitleScenePreviewModel(
    model,
    preview.TITLE_SCENE_PREVIEW_INPUT.ThemeNext,
  );
  model = preview.updateTitleScenePreviewModel(
    model,
    preview.TITLE_SCENE_PREVIEW_INPUT.RenderModeNext,
  );
  model = preview.updateTitleScenePreviewModel(
    model,
    preview.TITLE_SCENE_PREVIEW_INPUT.CameraAngleRight,
  );
  model = preview.updateTitleScenePreviewModel(
    model,
    preview.TITLE_SCENE_PREVIEW_INPUT.CameraRadiusOut,
  );

  assert.equal(model.timeSeconds, EXPECTED_TIME_STEP_SECONDS);
  assert.equal(model.themeIndex, 1);
  assert.equal(model.renderModeIndex, 1);
  assert.equal(model.cameraAngle, EXPECTED_CAMERA_STEP_RADIANS);
  assert.equal(
    model.cameraRadius,
    INITIAL_CAMERA_RADIUS + EXPECTED_CAMERA_RADIUS_STEP,
  );

  model = preview.updateTitleScenePreviewModel(
    model,
    preview.TITLE_SCENE_PREVIEW_INPUT.TimeBack,
  );
  model = preview.updateTitleScenePreviewModel(
    model,
    preview.TITLE_SCENE_PREVIEW_INPUT.CameraAngleLeft,
  );
  model = preview.updateTitleScenePreviewModel(
    model,
    preview.TITLE_SCENE_PREVIEW_INPUT.CameraRadiusIn,
  );

  assert.equal(model.timeSeconds, 0);
  assert.equal(model.cameraAngle, INITIAL_CAMERA_ANGLE);
  assert.equal(model.cameraRadius, INITIAL_CAMERA_RADIUS);
});

test("title-scene preview session cycles scenes and selected objects", async () => {
  const preview = await importPreviewSession();
  let model = preview.createTitleScenePreviewModel({
    sceneNames: SCENE_NAMES,
    sceneObjectCounts: SCENE_OBJECT_COUNTS,
    themeNames: THEME_NAMES,
  });

  model = preview.updateTitleScenePreviewModel(
    model,
    preview.TITLE_SCENE_PREVIEW_INPUT.SceneNext,
  );
  assert.equal(model.sceneIndex, 1);
  assert.equal(model.selectedObjectIndex, 0);

  model = preview.updateTitleScenePreviewModel(
    model,
    preview.TITLE_SCENE_PREVIEW_INPUT.ObjectNext,
  );
  assert.equal(model.selectedObjectIndex, 1);

  model = preview.updateTitleScenePreviewModel(
    model,
    preview.TITLE_SCENE_PREVIEW_INPUT.SceneNext,
  );
  assert.equal(model.sceneIndex, 0);
  assert.equal(model.selectedObjectIndex, 0);
});

test("title-scene preview inspector exposes scene facts without pixel scraping", async () => {
  const preview = await importPreviewSession();
  const model = preview.createTitleScenePreviewModel({
    sceneNames: SCENE_NAMES,
    sceneObjectCounts: SCENE_OBJECT_COUNTS,
    themeNames: THEME_NAMES,
  });
  const scene = {
    camera: { angle: 1.25, radius: 7 },
    objects: [
      {
        kind: "sphere",
        position: [1, 2, 3],
        radius: 1,
        footprintRadius: 1,
        height: 2,
        color: [78, 195, 224],
        reflectivity: 0.5,
      },
    ],
  };
  const inspector = preview.titleScenePreviewInspector(model, {
    scene,
    sceneName: SCENE_NAMES[0],
    themeName: THEME_NAMES[0],
  });

  assert.equal(inspector.sceneName, SCENE_NAMES[0]);
  assert.equal(inspector.themeName, THEME_NAMES[0]);
  assert.equal(
    inspector.renderMode,
    preview.TITLE_SCENE_PREVIEW_RENDER_MODE.Braille,
  );
  assert.deepEqual(inspector.camera, {
    angle: INITIAL_CAMERA_ANGLE,
    radius: INITIAL_CAMERA_RADIUS,
    sceneAngle: 1.25,
    sceneRadius: 7,
  });
  assert.deepEqual(inspector.selectedObject, {
    index: 0,
    count: 1,
    kind: "sphere",
    radius: 1,
    reflectivity: 0.5,
    color: [78, 195, 224],
    center: [1, 2, 3],
  });
});

async function importPreviewSession() {
  return importDist("app", "title-scene-preview-session.js");
}
