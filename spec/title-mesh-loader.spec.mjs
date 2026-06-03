import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { TitleMeshLoadError } from '../src/domain/errors.ts';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const TITLE_MESH_LOADER_PATH = path.join(REPO_ROOT, 'dist', 'app', 'title-mesh-loader.js');

async function loadTitleMeshLoader() {
  await ensureDistBuilt();
  return import(pathToFileURL(TITLE_MESH_LOADER_PATH).href);
}

test('initial title mesh loader returns a loaded mesh result', async () => {
  const loader = await loadTitleMeshLoader();
  const mesh = { triangles: [] };
  const result = loader.loadInitialTitleMesh({
    loadSource: () => ({ vertices: [], triangles: [] }),
    createMesh: () => mesh,
  });

  assert.equal(result.kind, loader.TITLE_MESH_LOAD_RESULT.Loaded);
  assert.equal(result.mesh, mesh);
});

test('initial title mesh loader returns a failure result instead of swallowing errors', async () => {
  const loader = await loadTitleMeshLoader();
  const result = loader.loadInitialTitleMesh({
    loadSource: () => {
      throw new TitleMeshLoadError('missing bunny asset');
    },
    createMesh: () => ({ triangles: [] }),
  });

  assert.equal(result.kind, loader.TITLE_MESH_LOAD_RESULT.Failed);
  assert.match(result.error, /missing bunny asset/);
});
