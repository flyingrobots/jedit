import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const TITLE_SCENE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'title-scene.js');

async function loadTitleSceneModules() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (build.status !== 0) {
    throw new Error(build.stderr || build.stdout);
  }
  return {
    titleScene: await import(pathToFileURL(TITLE_SCENE_PATH).href),
  };
}

test('column top cap intersection', async () => {
  const { titleScene } = await loadTitleSceneModules();

  const column = {
    kind: 'column',
    position: [0, 1, 0], // y is height/2
    radius: 1,
    footprintRadius: 1,
    height: 2,
    color: [255, 255, 255],
    reflectivity: 0.5,
  };

  // Look straight down at the top cap
  const origin = [0, 5, 0];
  const ray = [0, -1, 0];

  const hit = titleScene.nearestTitleSceneObjectHit(origin, ray, [column]);

  assert.ok(hit != null, 'Ray should hit the column top cap');
  assert.equal(hit.object, column);
  // The distance should be from y=5 to y=2, so distance=3
  assert.equal(hit.distance, 3);
  assert.deepEqual(hit.normal, [0, 1, 0], 'Normal should point straight up');
});

test('column bottom cap intersection', async () => {
  const { titleScene } = await loadTitleSceneModules();

  const column = {
    kind: 'column',
    position: [0, 1, 0],
    radius: 1,
    footprintRadius: 1,
    height: 2,
    color: [255, 255, 255],
    reflectivity: 0.5,
  };

  // Look straight up at the bottom cap
  const origin = [0, -1, 0];
  const ray = [0, 1, 0];

  const hit = titleScene.nearestTitleSceneObjectHit(origin, ray, [column]);

  assert.ok(hit != null, 'Ray should hit the column bottom cap');
  assert.equal(hit.object, column);
  // The distance should be from y=-1 to y=0, so distance=1
  assert.equal(hit.distance, 1);
  assert.deepEqual(hit.normal, [0, -1, 0], 'Normal should point straight down');
});
