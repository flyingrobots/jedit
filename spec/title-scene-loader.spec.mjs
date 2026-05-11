import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const TITLE_SCENE_LOADER_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'title-scene-loader.js');
const TITLE_SCENE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'title-scene.js');
const TITLE_MESH_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'title-mesh.js');
const TITLE_BUNNY_MESH_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'title-bunny-mesh.js');

async function loadTitleSceneLoaderModules() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return {
    loader: await import(pathToFileURL(TITLE_SCENE_LOADER_PATH).href),
    titleScene: await import(pathToFileURL(TITLE_SCENE_PATH).href),
    titleMesh: await import(pathToFileURL(TITLE_MESH_PATH).href),
    titleBunnyMesh: await import(pathToFileURL(TITLE_BUNNY_MESH_PATH).href),
  };
}

function normalize(vector) {
  const length = Math.sqrt(vector.reduce((sum, component) => sum + (component * component), 0));
  return vector.map((component) => component / length);
}

test('loaded mesh scenes do not expose scene-authored mesh position as ray-hit state', async () => {
  const { loader, titleScene, titleMesh, titleBunnyMesh } = await loadTitleSceneLoaderModules();
  const mesh = titleMesh.createTitleBunnyMesh(titleBunnyMesh.loadTitleBunnyMeshSource());
  const scene = loader.parseTitleSceneJson({
    objects: [
      {
        kind: titleScene.TITLE_SCENE_SHAPE_KIND.Mesh,
        mesh: 'bunny',
        position: [100, 100, 100],
        radius: mesh.footprintRadius,
        footprintRadius: mesh.footprintRadius,
        height: mesh.height,
        color: [224, 113, 63],
        reflectivity: 0.18,
      },
    ],
  }, { bunny: mesh });
  const loadedMesh = scene.objects[0];
  const origin = [-1, 1.1, 4.5];
  const ray = normalize([-0.05, -0.04, -1]);
  const hit = titleScene.nearestTitleSceneObjectHit(origin, ray, scene.objects);

  assert.equal(loadedMesh.kind, titleScene.TITLE_SCENE_SHAPE_KIND.Mesh);
  assert.equal(Object.hasOwn(loadedMesh, 'position'), false);
  assert.ok(hit != null);
  assert.equal(hit.object, loadedMesh);
});

test('scene loader rejects malformed scene JSON with a decode error', async () => {
  const { loader } = await loadTitleSceneLoaderModules();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jedit-scene-'));
  const file = path.join(directory, 'broken.jedit-scene');
  await fs.writeFile(file, '{ "objects": [', 'utf8');

  await assert.rejects(
    () => loader.loadTitleSceneFromFile(file, {}),
    (error) => error?.name === 'SceneDecodeError' && String(error.message).includes('malformed'),
  );
});

test('scene loader rejects unknown mesh ids with a decode error', async () => {
  const { loader, titleScene } = await loadTitleSceneLoaderModules();

  assert.throws(
    () => loader.parseTitleSceneJson({
      objects: [
        {
          kind: titleScene.TITLE_SCENE_SHAPE_KIND.Mesh,
          mesh: 'dragon',
          radius: 1,
          color: [224, 113, 63],
          reflectivity: 0.18,
        },
      ],
    }, {}),
    (error) => error?.name === 'SceneDecodeError' && String(error.message).includes('scene.objects[0].mesh'),
  );
});

test('scene loader rejects known mesh ids when the mesh asset is unavailable', async () => {
  const { loader, titleScene } = await loadTitleSceneLoaderModules();

  assert.throws(
    () => loader.parseTitleSceneJson({
      objects: [
        {
          kind: titleScene.TITLE_SCENE_SHAPE_KIND.Mesh,
          mesh: 'teapot',
          radius: 1,
          color: [224, 113, 63],
          reflectivity: 0.18,
        },
      ],
    }, {}),
    (error) => error?.name === 'SceneLoadError' && String(error.message).includes('not loaded'),
  );
});
