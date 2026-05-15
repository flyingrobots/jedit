import { loadInitialTitleMesh, TITLE_MESH_LOAD_RESULT } from '../app/title-mesh-loader.js';
import type { TitleMeshSource } from '../ports/title-mesh.js';
import { createTitleBunnyMesh, createTitleTeapotMesh, type TitleMesh, type TitleMeshLibrary } from '../ui/title-mesh.js';
import { loadTitleBunnyMeshSource, loadTitleTeapotMeshSource } from './title-bunny-mesh.js';

export function loadStartupTitleMeshes(): TitleMeshLibrary {
  return {
    bunny: loadStartupTitleMesh('bunny', loadTitleBunnyMeshSource, createTitleBunnyMesh),
    teapot: loadStartupTitleMesh('teapot', loadTitleTeapotMeshSource, createTitleTeapotMesh),
  };
}

function loadStartupTitleMesh(
  label: string,
  loadSource: () => TitleMeshSource,
  createMesh: (source: TitleMeshSource) => TitleMesh,
): TitleMesh | undefined {
  const result = loadInitialTitleMesh({
    loadSource,
    createMesh,
  });
  if (result.kind === TITLE_MESH_LOAD_RESULT.Loaded) {
    return result.mesh;
  }
  process.stderr.write(`jedit ${label} title mesh unavailable: ${result.error}\n`);
  return undefined;
}
