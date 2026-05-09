import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const TITLE_SCENE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'title-scene.js');
const TITLE_CAMERA_PATH = path.join(REPO_ROOT, 'dist', 'app', 'title-camera-session.js');
const FIXED_SCENE_SEED = 0.314159;
const OTHER_SCENE_SEED = 0.271828;
const MIN_OBJECT_COUNT = 6;
const MIN_UNIQUE_MATERIALS = 3;
const MIN_UNIQUE_RADII = 3;
const SCENE_COLORS = {
  accent: [216, 151, 255],
  info: [101, 194, 255],
  success: [124, 213, 156],
  ink: [226, 231, 236],
  muted: [126, 137, 148],
  surface: [14, 17, 22],
};

async function loadTitleSceneModules() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return {
    titleScene: await import(pathToFileURL(TITLE_SCENE_PATH).href),
    titleCamera: await import(pathToFileURL(TITLE_CAMERA_PATH).href),
  };
}

test('title scene generation is deterministic and seed-sensitive', async () => {
  const { titleScene } = await loadTitleSceneModules();
  const first = titleScene.generateTitleScene(FIXED_SCENE_SEED, SCENE_COLORS);
  const second = titleScene.generateTitleScene(FIXED_SCENE_SEED, SCENE_COLORS);
  const other = titleScene.generateTitleScene(OTHER_SCENE_SEED, SCENE_COLORS);

  assert.deepEqual(first, second);
  assert.notDeepEqual(first.camera, other.camera);
  assert.notDeepEqual(first.objects, other.objects);
});

test('title scene generation creates varied non-overlapping objects', async () => {
  const { titleScene } = await loadTitleSceneModules();
  const scene = titleScene.generateTitleScene(FIXED_SCENE_SEED, SCENE_COLORS);

  assert.ok(scene.objects.length >= MIN_OBJECT_COUNT);
  assert.ok(scene.objects.some((object) => object.kind === titleScene.TITLE_SCENE_SHAPE_KIND.Sphere));
  assert.ok(scene.objects.some((object) => object.kind === titleScene.TITLE_SCENE_SHAPE_KIND.Column));
  assert.ok(new Set(scene.objects.map((object) => object.color.join(','))).size >= MIN_UNIQUE_MATERIALS);
  assert.ok(new Set(scene.objects.map((object) => object.radius.toFixed(2))).size >= MIN_UNIQUE_RADII);
  assert.ok(new Set(scene.objects.map((object) => object.reflectivity.toFixed(2))).size > 1);
  assertNonOverlapping(scene.objects, titleScene.TITLE_SCENE_OBJECT_MARGIN);
});

test('initial title camera state can use a seeded scene placement', async () => {
  const { titleScene, titleCamera } = await loadTitleSceneModules();
  const placement = titleScene.titleSceneCameraPlacement(FIXED_SCENE_SEED);
  const camera = titleCamera.createTitleCameraState(placement);

  assert.equal(camera.angle, placement.angle);
  assert.equal(camera.angleTarget, placement.angle);
  assert.equal(camera.radius, placement.radius);
  assert.equal(camera.radiusTarget, placement.radius);
});

function assertNonOverlapping(objects, margin) {
  for (let firstIndex = 0; firstIndex < objects.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < objects.length; secondIndex += 1) {
      const first = objects[firstIndex];
      const second = objects[secondIndex];
      const dx = first.position[0] - second.position[0];
      const dz = first.position[2] - second.position[2];
      const distance = Math.sqrt((dx * dx) + (dz * dz));
      assert.ok(
        distance >= first.footprintRadius + second.footprintRadius + margin,
        `${firstIndex} and ${secondIndex} should not overlap`,
      );
    }
  }
}
