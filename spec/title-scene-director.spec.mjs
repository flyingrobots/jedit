import assert from "node:assert/strict";
import test from "node:test";
import { loadTitleModules } from "./title-screen-helpers.mjs";

const EXPECTED_CAMERA_DRIFT_RATE = 0.024;
const BASE_CAMERA_ANGLE = 0.25;
const CAMERA_TIME_SECONDS = 10;
const FLYINGROBOTS_APPEAR_SECONDS = 0;
const FLYINGROBOTS_FADE_DONE_SECONDS = 4;
const TITLE_BEFORE_APPEAR_SECONDS = 1.99;
const TITLE_APPEAR_SECONDS = 2;
const TITLE_FADE_DONE_SECONDS = 6;
const SHEEN_MIDPOINT_SECONDS = 3;

test("default title-scene director timeline owns logo cues and camera drift", async () => {
  const { titleDirector } = await loadTitleModules();
  const timeline = titleDirector.TITLE_SCENE_DEFAULT_DIRECTOR_TIMELINE;

  assert.doesNotThrow(() =>
    titleDirector.validateTitleSceneDirectorTimeline(timeline),
  );
  assert.equal(timeline.camera.driftRate, EXPECTED_CAMERA_DRIFT_RATE);
  assert.equal(
    titleDirector.titleSceneCueOpacity(
      FLYINGROBOTS_APPEAR_SECONDS,
      timeline.flyingRobotsLogo,
    ),
    1,
  );
  assert.equal(
    titleDirector.titleSceneCueOpacity(
      FLYINGROBOTS_FADE_DONE_SECONDS,
      timeline.flyingRobotsLogo,
    ),
    0,
  );
  assert.equal(
    titleDirector.titleSceneCueOpacity(
      TITLE_BEFORE_APPEAR_SECONDS,
      timeline.titleLogo,
    ),
    0,
  );
  assert.equal(
    titleDirector.titleSceneCueOpacity(
      TITLE_APPEAR_SECONDS,
      timeline.titleLogo,
    ),
    1,
  );
  assert.equal(
    titleDirector.titleSceneCueOpacity(
      TITLE_FADE_DONE_SECONDS,
      timeline.titleLogo,
    ),
    0,
  );
});

test("title-scene director timeline exposes deterministic sheen and camera helpers", async () => {
  const { titleDirector } = await loadTitleModules();
  const timeline = titleDirector.TITLE_SCENE_DEFAULT_DIRECTOR_TIMELINE;

  assert.equal(
    titleDirector.titleSceneCueProgress(
      TITLE_BEFORE_APPEAR_SECONDS,
      timeline.titleLogoSheen,
    ),
    undefined,
  );
  assert.equal(
    titleDirector.titleSceneCueProgress(
      SHEEN_MIDPOINT_SECONDS,
      timeline.titleLogoSheen,
    ),
    0.5,
  );
  assert.equal(
    titleDirector.titleSceneCameraAngleAt(
      timeline,
      BASE_CAMERA_ANGLE,
      CAMERA_TIME_SECONDS,
    ),
    BASE_CAMERA_ANGLE + CAMERA_TIME_SECONDS * EXPECTED_CAMERA_DRIFT_RATE,
  );
});

test("title-scene director timeline rejects invalid cue data", async () => {
  const { titleDirector } = await loadTitleModules();
  const timeline = titleDirector.TITLE_SCENE_DEFAULT_DIRECTOR_TIMELINE;

  assert.throws(
    () =>
      titleDirector.validateTitleSceneDirectorTimeline({
        ...timeline,
        titleLogo: {
          ...timeline.titleLogo,
          fadeAtSeconds: timeline.titleLogo.appearAtSeconds - 1,
        },
      }),
    RangeError,
  );
  assert.throws(
    () =>
      titleDirector.validateTitleSceneDirectorTimeline({
        ...timeline,
        camera: {
          ...timeline.camera,
          driftRate: -1,
        },
      }),
    RangeError,
  );
});
