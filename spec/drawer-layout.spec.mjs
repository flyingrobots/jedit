import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'drawer-layout.js');

async function loadDrawerLayoutModule() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return import(pathToFileURL(MODULE_PATH).href);
}

test('graft drawer opens on the right using the same width as the file drawer', async () => {
  const layout = await loadDrawerLayoutModule();

  assert.deepEqual(
    layout.resolveDrawerLayout('graft', 120, 1),
    { width: 31, x: 89 },
  );
});

test('graft drawer follows the same width policy at larger terminal sizes', async () => {
  const layout = await loadDrawerLayoutModule();

  assert.deepEqual(
    layout.resolveDrawerLayout('graft', 220, 1),
    { width: 34, x: 186 },
  );
});

test('file drawer remains left-aligned', async () => {
  const layout = await loadDrawerLayoutModule();

  assert.deepEqual(
    layout.resolveDrawerLayout('files', 120, 1),
    { width: 31, x: 0 },
  );
});

test('workspace layout leaves a center viewer between both drawers', async () => {
  const layout = await loadDrawerLayoutModule();

  assert.deepEqual(
    layout.resolveWorkspaceLayout(120, 1, 1),
    {
      fileDrawer: { width: 31, x: 0 },
      graftDrawer: { width: 31, x: 89 },
      viewer: { width: 58, x: 31 },
    },
  );
});
