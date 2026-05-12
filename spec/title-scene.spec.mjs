import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const TITLE_SCENE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'title-scene.js');
const TITLE_MESH_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'title-mesh.js');
const TITLE_BUNNY_MESH_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'title-bunny-mesh.js');
const TITLE_BUNNY_DIST_ASSET_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'bunny.obj');
const TITLE_TEAPOT_DIST_ASSET_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'utah_teapot.obj');
const TITLE_TEAPOT_SOURCE_ASSET_PATH = path.join(REPO_ROOT, 'src', 'ui', 'utah_teapot.obj');
const TITLE_CAMERA_PATH = path.join(REPO_ROOT, 'dist', 'app', 'title-camera-session.js');
const FIXED_SCENE_SEED = 0.314159;
const OTHER_SCENE_SEED = 0.271828;
const MIN_OBJECT_COUNT = 6;
const MIN_UNIQUE_MATERIALS = 3;
const MIN_UNIQUE_RADII = 3;
const MIN_BUNNY_VERTICES = 2500;
const MIN_BUNNY_TRIANGLES = 4900;
const MIN_TEAPOT_VERTICES = 7000;
const MIN_TEAPOT_TRIANGLES = 14000;
const BUNNY_SCENE_OBJECT_COUNT = 2;
const MIRROR_REFLECTIVITY_MINIMUM = 0.9;
const BUNNY_TITLE_CAMERA_HEIGHT = 2.65;
const MIRROR_REFLECTION_RAY_BIAS = 0.03;
const MIRROR_REFLECTION_TARGET = [0.44, 0.95, 0.35];
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
    titleMesh: await import(pathToFileURL(TITLE_MESH_PATH).href),
    titleBunnyMesh: await import(pathToFileURL(TITLE_BUNNY_MESH_PATH).href),
    titleCamera: await import(pathToFileURL(TITLE_CAMERA_PATH).href),
  };
}

test('build copies the title bunny mesh asset into dist', async () => {
  const build = spawnSync('npm', ['run', 'build'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);
  assert.ok(existsSync(TITLE_BUNNY_DIST_ASSET_PATH), 'dist/ui/bunny.obj should exist after build');
  assert.ok(existsSync(TITLE_TEAPOT_DIST_ASSET_PATH), 'dist/ui/utah_teapot.obj should exist after build');
});

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

test('title scene can ray cast the loaded bunny mesh', async () => {
  const { titleScene, titleMesh, titleBunnyMesh } = await loadTitleSceneModules();
  const meshSource = titleBunnyMesh.loadTitleBunnyMeshSource();
  const mesh = titleMesh.createTitleBunnyMesh(meshSource);
  const scene = titleScene.generateTitleScene(FIXED_SCENE_SEED, SCENE_COLORS, mesh);
  const primary = scene.objects[0];
  const mirror = scene.objects[1];

  assert.ok(meshSource.vertices.length >= MIN_BUNNY_VERTICES);
  assert.ok(meshSource.triangles.length >= MIN_BUNNY_TRIANGLES);
  assert.equal(scene.objects.length, BUNNY_SCENE_OBJECT_COUNT);
  assert.equal(primary.kind, titleScene.TITLE_SCENE_SHAPE_KIND.Mesh);
  assert.equal(primary.mesh, mesh);
  assert.equal(mirror.kind, titleScene.TITLE_SCENE_SHAPE_KIND.Sphere);
  assert.ok(mirror.reflectivity >= MIRROR_REFLECTIVITY_MINIMUM);

  const origin = [-1, 1.1, 4.5];
  const ray = normalize([-0.05, -0.04, -1]);
  const hit = titleScene.nearestTitleSceneObjectHit(origin, ray, scene.objects);

  assert.ok(hit != null);
  assert.equal(hit.object.kind, titleScene.TITLE_SCENE_SHAPE_KIND.Mesh);
  assert.ok(hit.distance > 0);
  assert.ok(hit.normal.some((component) => Math.abs(component) > 0));
});

test('title scene can construct the Utah teapot mesh from the source asset', async () => {
  const { titleMesh, titleBunnyMesh } = await loadTitleSceneModules();
  const meshSource = titleBunnyMesh.loadTitleTeapotMeshSource();
  const mesh = titleMesh.createTitleTeapotMesh(meshSource);

  assert.ok(meshSource.vertices.length >= MIN_TEAPOT_VERTICES);
  assert.ok(meshSource.triangles.length >= MIN_TEAPOT_TRIANGLES);
  assert.ok(mesh.height > 0);
  assert.ok(mesh.footprintRadius > 0);
});

test('title mesh source loader fails fast when no candidate asset is available', async () => {
  const { titleBunnyMesh } = await loadTitleSceneModules();
  const hiddenPaths = [
    hideExistingFile(TITLE_TEAPOT_DIST_ASSET_PATH),
    hideExistingFile(TITLE_TEAPOT_SOURCE_ASSET_PATH),
  ];

  try {
    assert.throws(
      () => titleBunnyMesh.loadTitleTeapotMeshSource(),
      (error) => error?.name === 'TitleMeshLoadError',
    );
  } finally {
    restoreHiddenFiles(hiddenPaths);
  }
});

test('title mirror sphere reflects the loaded bunny mesh from the title camera', async () => {
  const { titleScene, titleMesh, titleBunnyMesh } = await loadTitleSceneModules();
  const mesh = titleMesh.createTitleBunnyMesh(titleBunnyMesh.loadTitleBunnyMeshSource());
  const scene = titleScene.generateTitleScene(FIXED_SCENE_SEED, SCENE_COLORS, mesh);
  const placement = titleScene.titleBunnySceneCameraPlacement();
  const origin = [
    Math.sin(placement.angle) * placement.radius,
    BUNNY_TITLE_CAMERA_HEIGHT,
    Math.cos(placement.angle) * placement.radius,
  ];
  const viewRay = normalize(sub(MIRROR_REFLECTION_TARGET, origin));
  const mirrorHit = titleScene.nearestTitleSceneObjectHit(origin, viewRay, scene.objects);

  assert.ok(mirrorHit != null);
  assert.equal(mirrorHit.object.kind, titleScene.TITLE_SCENE_SHAPE_KIND.Sphere);
  assert.ok(mirrorHit.object.reflectivity >= MIRROR_REFLECTIVITY_MINIMUM);

  const reflectionOrigin = add(origin, scale(viewRay, mirrorHit.distance + MIRROR_REFLECTION_RAY_BIAS));
  const reflectionRay = reflect(viewRay, mirrorHit.normal);
  const reflectedHit = titleScene.nearestTitleSceneObjectHit(reflectionOrigin, reflectionRay, scene.objects, mirrorHit.object);

  assert.ok(reflectedHit != null);
  assert.equal(reflectedHit.object.kind, titleScene.TITLE_SCENE_SHAPE_KIND.Mesh);
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

function hideExistingFile(filePath) {
  if (!existsSync(filePath)) {
    return undefined;
  }
  const hiddenPath = `${filePath}.jedit-test-hidden-${process.pid}`;
  renameSync(filePath, hiddenPath);
  return { hiddenPath, filePath };
}

function restoreHiddenFiles(hiddenPaths) {
  for (const entry of hiddenPaths.toReversed()) {
    if (entry != null) {
      renameSync(entry.hiddenPath, entry.filePath);
    }
  }
}

function normalize(vector) {
  const length = Math.sqrt(vector.reduce((sum, component) => sum + (component * component), 0));
  return vector.map((component) => component / length);
}

function reflect(ray, normal) {
  return sub(ray, scale(normal, 2 * dot(ray, normal)));
}

function dot(a, b) {
  return (a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]);
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(vector, scalar) {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}
