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
const CAMERA_ORBIT_SAMPLE_COUNT = 16;
const FULL_CAMERA_ORBIT_RADIANS = Math.PI * 2;
const MIN_ORBIT_RENDER_COLOR_VARIETY = 10;
const CHECKER_FLOOR_DARK = [2, 3, 7];
const CHECKER_FLOOR_LIGHT = [42, 52, 60];
const CHECKER_FLOOR_GRID_SCALE = 1.05;
const MAX_DEFAULT_CAMERA_RADIUS = 5.4;
const MIN_DEFAULT_CAMERA_Y = 3.4;
const MIN_CAMERA_LOOKDOWN = 2;
const MAX_PRIMARY_TRANSPARENCY = 0.05;
const MAX_MIRROR_RADIUS = 1.05;
const MIN_MIRROR_FRONT_OFFSET = 0.45;
const REFLECTION_GRID_WIDTH = 72;
const REFLECTION_GRID_HEIGHT = 40;
const MIN_MIRROR_REFLECTED_BUNNY_RAYS = 25;
const MIRROR_REFLECTION_RAY_BIAS = 0.03;
const TITLE_PROJECTION_DISTANCE = 2.7;
const TITLE_VERTICAL_SCREEN_OFFSET = 0.2;
const DEFAULT_SCENE_OBJECT_COUNT = 2;
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
  assert.ok(scene.camera.position[1] >= MIN_DEFAULT_CAMERA_Y);
  assert.ok(
    scene.camera.position[1] - scene.camera.target[1] >= MIN_CAMERA_LOOKDOWN,
  );
  assert.ok(scene.camera.position[2] > scene.camera.target[2]);
  assert.equal(primary.label, PRIMARY_OBJECT_LABEL);
  assert.equal(primary.kind, "mesh");
  assert.ok(primary.radius >= MIN_PRIMARY_RADIUS);
  assert.ok((primary.transparency ?? 0) <= MAX_PRIMARY_TRANSPARENCY);
  assert.ok(mirror != null);
  assert.deepEqual(scene.camera.target, mirror.position);
  assert.equal(mirror.kind, "sphere");
  assert.ok(mirror.radius <= MAX_MIRROR_RADIUS);
  assert.ok(mirror.reflectivity >= MIN_MIRROR_REFLECTIVITY);
  assert.ok(mirror.position[0] > primaryCenter[0]);
  assert.ok(primaryCenter[2] - mirror.position[2] >= MIN_MIRROR_FRONT_OFFSET);
  assert.ok(mirror.position[1] > primaryCenter[1]);
  assert.ok(
    mirrorReflectedBunnyRayCount(modules.titleScene, scene) >=
      MIN_MIRROR_REFLECTED_BUNNY_RAYS,
  );
  assert.ok(scene.environment?.floor != null);
  assert.equal(scene.environment?.floor?.kind, "grid");
  assert.deepEqual(scene.environment?.floor?.dark, CHECKER_FLOOR_DARK);
  assert.deepEqual(scene.environment?.floor?.light, CHECKER_FLOOR_LIGHT);
  assert.equal(scene.environment?.floor?.gridScale, CHECKER_FLOOR_GRID_SCALE);
  assert.equal(scene.environment?.light, undefined);
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

test("default title scene renders glass against the day-night light stage", async () => {
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

function mirrorReflectedBunnyRayCount(titleScene, scene) {
  let count = 0;
  for (let row = 0; row < REFLECTION_GRID_HEIGHT; row += 1) {
    for (let col = 0; col < REFLECTION_GRID_WIDTH; col += 1) {
      count += mirrorReflectedBunnyRayHit(titleScene, scene, col, row);
    }
  }
  return count;
}

function mirrorReflectedBunnyRayHit(titleScene, scene, col, row) {
  const ray = titleSceneSampleRay(scene.camera, col, row);
  const mirrorHit = titleScene.nearestTitleSceneObjectHit(
    scene.camera.position,
    ray,
    scene.objects,
  );
  if (mirrorHit?.object?.label !== MIRROR_OBJECT_LABEL) {
    return 0;
  }
  const point = add(
    scene.camera.position,
    scale(ray, mirrorHit.distance + MIRROR_REFLECTION_RAY_BIAS),
  );
  const reflectedHit = titleScene.nearestTitleSceneObjectHit(
    point,
    reflect(ray, mirrorHit.normal),
    scene.objects,
    { ignoredObject: mirrorHit.object },
  );
  return reflectedHit?.object?.label === PRIMARY_OBJECT_LABEL ? 1 : 0;
}

function titleSceneSampleRay(camera, col, row) {
  const rx = ((col + 0.5) / REFLECTION_GRID_WIDTH) * 2 - 1;
  const ry = ((row + 0.5) / REFLECTION_GRID_HEIGHT) * 2 - 1;
  return projectedRay(camera.position, camera.target, [
    rx,
    -ry - TITLE_VERTICAL_SCREEN_OFFSET,
    TITLE_PROJECTION_DISTANCE,
  ]);
}

function projectedRay(origin, target, screenCoords) {
  const forward = normalize(sub(target, origin));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  return normalize(
    add(
      add(scale(right, screenCoords[0]), scale(up, screenCoords[1])),
      scale(forward, screenCoords[2]),
    ),
  );
}

function reflect(ray, normal) {
  return sub(ray, scale(normal, 2 * dot(ray, normal)));
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  return length === 0 ? [0, 0, 0] : scale(vector, 1 / length);
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a, b) {
  return a.reduce((sum, component, index) => sum + component * b[index], 0);
}

function add(a, b) {
  return a.map((component, index) => component + b[index]);
}

function sub(a, b) {
  return a.map((component, index) => component - b[index]);
}

function scale(vector, scalar) {
  return vector.map((component) => component * scalar);
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
