import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";
import { loadTitleModules } from "./title-screen-helpers.mjs";

const THEME_VARIABLE_ACCENT = "accent";
const SPOTLIGHT_CAMERA_ANGLE = 0.14;
const SPOTLIGHT_CAMERA_RADIUS = 6.4;
const SPOTLIGHT_CAMERA_HEIGHT = 3.35;
const SPOTLIGHT_SPHERE_CENTER = [0, 0.78, 0];
const SPOTLIGHT_COLOR_DELTA = 80;
const SECOND_RENDER_CAMERA_ANGLE = 1.7;
const SECOND_RENDER_CAMERA_RADIUS = 8.9;

test("title scene spotlight falls back to accent when no lighting rig is authored", async () => {
  const { title, themes } = await loadTitleModules();
  const lighting = await importDist("ui", "title-scene-lighting-tokens.js");

  for (const theme of themes.availableJeditThemes()) {
    if (theme.variables.has(lighting.TITLE_SCENE_LIGHTING_VARIABLE.Spotlight)) {
      continue;
    }
    const colors = title.titleSceneMaterialColors(theme);

    assert.deepEqual(
      colors.spotlight,
      theme.variables.get(THEME_VARIABLE_ACCENT).rgb,
    );
  }
});

test("title scene spotlight targets a point between the camera start and sphere", async () => {
  const { titleOptics, themes } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const color = theme.variables.get(THEME_VARIABLE_ACCENT).rgb;
  const cameraStart = titleCameraStart(
    SPOTLIGHT_CAMERA_ANGLE,
    SPOTLIGHT_CAMERA_RADIUS,
  );
  const spotlight = titleOptics.titleSceneSpotlightAt(
    cameraStart,
    SPOTLIGHT_SPHERE_CENTER,
    color,
  );

  assert.deepEqual(spotlight.color, color);
  assert.ok(
    distance(spotlight.target, cameraStart) <
      distance(SPOTLIGHT_SPHERE_CENTER, cameraStart),
  );
  assert.ok(
    distance(spotlight.target, SPOTLIGHT_SPHERE_CENTER) <
      distance(SPOTLIGHT_SPHERE_CENTER, cameraStart),
  );
  assert.ok(
    titleOptics.titleSceneSpotlightStrengthAt(spotlight.target, spotlight) > 0,
  );
  assert.equal(
    titleOptics.titleSceneSpotlightStrengthAt(
      add(spotlight.target, [4, 0, 0]),
      spotlight,
    ),
    0,
  );
});

test("title scene spotlight stays anchored to scene camera when render camera changes", async () => {
  const { titleOptics, themes } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const color = theme.variables.get(THEME_VARIABLE_ACCENT).rgb;
  const spotlightCamera = {
    angle: SPOTLIGHT_CAMERA_ANGLE,
    radius: SPOTLIGHT_CAMERA_RADIUS,
  };
  const first = titleOptics.titleSceneSpotlightForCameraPlacement(
    spotlightCamera,
    SPOTLIGHT_SPHERE_CENTER,
    color,
  );
  const second = titleOptics.titleSceneSpotlightForCameraPlacement(
    spotlightCamera,
    SPOTLIGHT_SPHERE_CENTER,
    color,
  );
  const renderCameraSpotlight = titleOptics.titleSceneSpotlightAt(
    titleCameraStart(SECOND_RENDER_CAMERA_ANGLE, SECOND_RENDER_CAMERA_RADIUS),
    SPOTLIGHT_SPHERE_CENTER,
    color,
  );

  assert.deepEqual(first.target, second.target);
  assert.notDeepEqual(first.target, renderCameraSpotlight.target);
});

test("title screen keeps ray context construction private to the renderer", async () => {
  const { title } = await loadTitleModules();

  assert.equal(Object.hasOwn(title, "titleSceneRayContext"), false);
});

test("title floor light effects expose sphere shadows and caustics", async () => {
  const { title, titleScene } = await loadTitleModules();
  const spheres = [
    {
      kind: titleScene.TITLE_SCENE_SHAPE_KIND.Sphere,
      position: [0, 1, 0],
      radius: 1.25,
      footprintRadius: 1.25,
      height: 2.5,
      color: [255, 255, 255],
      reflectivity: 0.5,
    },
  ];

  const underSphere = title.titleFloorLightEffectsAt([0, 0, 0], spheres, 0);
  const farAway = title.titleFloorLightEffectsAt([20, 0, 20], spheres, 0);

  assert.ok(underSphere.shadowMultiplier < 1);
  assert.ok(underSphere.contactShadowMultiplier < 1);
  assert.ok(underSphere.causticStrength > 0);
  assert.equal(farAway.shadowMultiplier, 1);
  assert.equal(farAway.contactShadowMultiplier, 1);
  assert.equal(farAway.causticStrength, 0);

  const transparentSphere = [
    { ...spheres[0], reflectivity: 0, transparency: 0.7 },
  ];
  const underTransparentSphere = title.titleFloorLightEffectsAt(
    [0, 0, 0],
    transparentSphere,
    0,
  );
  assert.ok(underTransparentSphere.causticStrength > 0);
});

test("title object optics refract transmitted color by material index", async () => {
  const { titleOptics, titleScene, titleSceneEnvironment } =
    await loadTitleModules();
  const colors = emptyMaterialColors();
  const environment = {
    floor: { kind: titleSceneEnvironment.TITLE_SCENE_FLOOR_KIND.None },
    light: { ambient: 0, diffuse: 0, specularStrength: 0, rimStrength: 0 },
    walls: [
      { normal: [0, 0, 1], offset: -5, color: [240, 20, 20] },
      { normal: [-1, 0, 0], offset: -2, color: [20, 20, 240] },
    ],
  };
  const context = {
    origin: [0, 0, 0],
    ray: normalize([0.45, 0, -1]),
    lightDirection: [0, 1, 0],
    spotlight: titleOptics.titleSceneSpotlightAt(
      [0, 4, 2],
      [0, 0, 0],
      colors.spotlight,
    ),
  };
  const straightGlass = glassSphere(titleScene, 1);
  const bentGlass = glassSphere(titleScene, 1.6);
  const straightColor = titleOptics.titleObjectSurfaceColor(
    sampleOptions([straightGlass], colors, environment),
    context,
    { object: straightGlass, distance: 0, normal: [0, 0, 1] },
  );
  const bentColor = titleOptics.titleObjectSurfaceColor(
    sampleOptions([bentGlass], colors, environment),
    context,
    { object: bentGlass, distance: 0, normal: [0, 0, 1] },
  );

  assert.ok(straightColor[2] > straightColor[0] + 40);
  assert.ok(bentColor[0] > bentColor[2] + 40);
});

test("title scene spotlight visibly tints an object under the beam", async () => {
  const { titleOptics, titleScene, themes } = await loadTitleModules();
  const theme = themes.availableJeditThemes()[0];
  const color = theme.variables.get(THEME_VARIABLE_ACCENT).rgb;
  const spotlight = titleOptics.titleSceneSpotlightAt(
    titleCameraStart(SPOTLIGHT_CAMERA_ANGLE, SPOTLIGHT_CAMERA_RADIUS),
    SPOTLIGHT_SPHERE_CENTER,
    color,
  );
  const colors = {
    ...emptyMaterialColors(),
    spotlight: color,
  };
  const object = {
    kind: titleScene.TITLE_SCENE_SHAPE_KIND.Sphere,
    position: spotlight.target,
    radius: 1,
    footprintRadius: 1,
    height: 2,
    color: [0, 0, 0],
    reflectivity: 0,
  };
  const environment = {
    light: { ambient: 0, diffuse: 0, specularStrength: 0, rimStrength: 0 },
  };
  const underColor = titleOptics.titleObjectSurfaceColor(
    sampleOptions([object], colors, environment),
    spotlightTestContext(spotlight.target, spotlight),
    { object, distance: 1, normal: [0, 1, 0] },
  );
  const awayColor = titleOptics.titleObjectSurfaceColor(
    sampleOptions([object], colors, environment),
    spotlightTestContext(add(spotlight.target, [4, 0, 0]), spotlight),
    { object, distance: 1, normal: [0, 1, 0] },
  );

  assert.ok(underColor[0] > awayColor[0] + SPOTLIGHT_COLOR_DELTA);
  assert.ok(underColor[2] > awayColor[2] + SPOTLIGHT_COLOR_DELTA);
});

test("title mirror reflections preserve the reflected object's material hue", async () => {
  const { titleOptics, titleScene } = await loadTitleModules();
  const colors = {
    ...emptyMaterialColors(),
    spotlight: [255, 128, 16],
  };
  const environment = {
    light: { ambient: 0, diffuse: 0, specularStrength: 0, rimStrength: 0 },
  };
  const red = titleOptics.reflectedEnvironmentColor({
    point: [0, 0, 2.1],
    ray: [0, 0, -1],
    colors,
    objects: [materialSphere(titleScene, [240, 32, 32])],
    time: 0,
    environment,
    lightDirection: [0, 1, 0],
    spotlight: titleOptics.titleSceneSpotlightAt(
      [0, 4, 2],
      [0, 0, 0],
      colors.spotlight,
    ),
  });
  const blue = titleOptics.reflectedEnvironmentColor({
    point: [0, 0, 2.1],
    ray: [0, 0, -1],
    colors,
    objects: [materialSphere(titleScene, [32, 64, 240])],
    time: 0,
    environment,
    lightDirection: [0, 1, 0],
    spotlight: titleOptics.titleSceneSpotlightAt(
      [0, 4, 2],
      [0, 0, 0],
      colors.spotlight,
    ),
  });

  assert.ok(red[0] > blue[0] + 80);
  assert.ok(blue[2] > red[2] + 80);
});

test("title environment fogs infinite floor hits into the background", async () => {
  const { titleSceneEnvironment } = await loadTitleModules();
  const colors = {
    surface: [5, 7, 12],
    floorDark: [55, 75, 88],
    floorLight: [222, 232, 232],
  };
  const environment = {
    background: [12, 34, 56],
    floor: {
      kind: titleSceneEnvironment.TITLE_SCENE_FLOOR_KIND.Solid,
      fadeDistance: 2,
    },
  };
  const visibleHit = titleSceneEnvironment.nearestTitleEnvironmentSurfaceHit(
    [0, 1, 0],
    [0, -1, 0],
    environment,
    colors,
  );
  const fadedHit = titleSceneEnvironment.nearestTitleEnvironmentSurfaceHit(
    [0, 3, 0],
    [0, -1, 0],
    environment,
    colors,
  );

  assert.ok(visibleHit != null);
  assert.ok(visibleHit.visibility > 0);
  assert.equal(visibleHit.receivesFloorEffects, true);
  assert.ok(fadedHit != null);
  assert.equal(fadedHit.visibility, 0);
  assert.equal(fadedHit.receivesFloorEffects, false);
  assert.deepEqual(fadedHit.color, environment.background);
});

test("title environment still disables explicit none floors", async () => {
  const { titleSceneEnvironment } = await loadTitleModules();
  const colors = {
    surface: [5, 7, 12],
    floorDark: [55, 75, 88],
    floorLight: [222, 232, 232],
  };
  const floor = {
    kind: titleSceneEnvironment.TITLE_SCENE_FLOOR_KIND.Solid,
    fadeDistance: 0,
  };
  const noFloorHit = titleSceneEnvironment.nearestTitleEnvironmentSurfaceHit(
    [0, 1, 0],
    [0, -1, 0],
    { floor: { ...floor, kind: titleSceneEnvironment.TITLE_SCENE_FLOOR_KIND.None } },
    colors,
  );

  assert.equal(noFloorHit, undefined);
});

function emptyMaterialColors() {
  return {
    accent: [0, 0, 0],
    info: [0, 0, 0],
    success: [0, 0, 0],
    ink: [0, 0, 0],
    muted: [0, 0, 0],
    surface: [0, 0, 0],
    floorDark: [0, 0, 0],
    floorLight: [0, 0, 0],
    spotlight: [0, 0, 0],
  };
}

function glassSphere(titleScene, refractiveIndex) {
  return {
    kind: titleScene.TITLE_SCENE_SHAPE_KIND.Sphere,
    position: [0, 0, 0],
    radius: 1,
    footprintRadius: 1,
    height: 2,
    color: [0, 0, 0],
    reflectivity: 0,
    transparency: 0.9,
    refractiveIndex,
  };
}

function materialSphere(titleScene, color) {
  return {
    kind: titleScene.TITLE_SCENE_SHAPE_KIND.Sphere,
    position: [0, 0, 0],
    radius: 1,
    footprintRadius: 1,
    height: 2,
    color,
    reflectivity: 0,
    transparency: 0,
    refractiveIndex: 1,
  };
}

function sampleOptions(objects, colors, environment, extra = {}) {
  return {
    u: 0.5,
    v: 0.5,
    cols: 1,
    rows: 1,
    time: 0,
    camAngle: 0,
    camRadius: 1,
    spotlightCamera: {
      angle: SPOTLIGHT_CAMERA_ANGLE,
      radius: SPOTLIGHT_CAMERA_RADIUS,
    },
    objects,
    colors,
    environment,
    ...extra,
  };
}

function titleCameraStart(angle, radius) {
  return [
    Math.sin(angle) * radius,
    SPOTLIGHT_CAMERA_HEIGHT,
    Math.cos(angle) * radius,
  ];
}

function spotlightTestContext(point, spotlight) {
  return {
    origin: add(point, [0, 1, 0]),
    ray: [0, -1, 0],
    lightDirection: [0, 1, 0],
    spotlight,
  };
}

function normalize(vector) {
  const length = Math.sqrt(
    vector.reduce((sum, component) => sum + component * component, 0),
  );
  return vector.map((component) => component / length);
}

function add(a, b) {
  return a.map((component, index) => component + b[index]);
}

function distance(a, b) {
  return Math.sqrt(
    a.reduce((sum, component, index) => sum + (component - b[index]) ** 2, 0),
  );
}
