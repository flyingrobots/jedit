import { loadTitleBunnyMeshSource } from '../../adapters/title-bunny-mesh.js';
import { loadInitialTitleMesh, TITLE_MESH_LOAD_RESULT } from '../title-mesh-loader.js';
import { createTitleBunnyMesh, type TitleMesh } from '../../ui/title-mesh.js';

export function loadStartupTitleMesh(): TitleMesh | undefined {
  const result = loadInitialTitleMesh({
    loadSource: loadTitleBunnyMeshSource,
    createMesh: createTitleBunnyMesh,
  });

  if (result.kind === TITLE_MESH_LOAD_RESULT.Failed) {
    process.stderr.write(`jedit title mesh unavailable: ${result.error}
`);
    return undefined;
  }

  return result.mesh;
}
