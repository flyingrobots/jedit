import {
  loadInitialTitleMesh,
  TITLE_MESH_LOAD_RESULT,
} from "../app/title-mesh-loader.js";
import type { TitleMeshSource } from "../ports/title-mesh.js";
import type { TitleMesh } from "../ui/title-mesh.js";
import {
  createTitleBunnyMesh,
  createTitleDragonMesh,
  createTitleTeapotMesh,
  type TitleMeshLibrary,
} from "../ui/title-mesh-library.js";
import {
  loadTitleBunnyMeshSource,
  loadTitleDragonMeshSource,
  loadTitleTeapotMeshSource,
} from "./title-bunny-mesh.js";

export type { TitleMeshLibrary };

// Startup loads no title geometry, so the workspace model carries an empty mesh
// library and hands it straight to the scene loader. Every built-in scene
// references bunny, teapot or dragon, so without this they all failed to
// decode -- including continuum-gate, the one the picker offers first. The
// meshes are parsed at most once, and only when a scene is actually opened,
// which is what preserves the startup saving that emptied the library.
let onDemandMeshes: TitleMeshLibrary | undefined;

export function withBuiltInTitleMeshes(meshes: TitleMeshLibrary): TitleMeshLibrary {
  onDemandMeshes ??= loadStartupTitleMeshes();
  // The caller's library wins, so a scene opened with an explicitly supplied
  // mesh keeps it and only the gaps are filled.
  return { ...onDemandMeshes, ...meshes };
}

export function loadStartupTitleMeshes(): TitleMeshLibrary {
  return {
    bunny: loadStartupTitleMesh(
      "bunny",
      loadTitleBunnyMeshSource,
      createTitleBunnyMesh,
    ),
    dragon: loadStartupTitleMesh(
      "dragon",
      loadTitleDragonMeshSource,
      createTitleDragonMesh,
    ),
    teapot: loadStartupTitleMesh(
      "teapot",
      loadTitleTeapotMeshSource,
      createTitleTeapotMesh,
    ),
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
  process.stderr.write(
    `jedit ${label} title mesh unavailable: ${result.error}\n`,
  );
  return undefined;
}
