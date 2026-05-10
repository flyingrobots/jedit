import type { TitleMeshSource } from '../ports/title-mesh.js';
import type { TitleMesh } from '../ui/title-mesh.js';

export const TITLE_MESH_LOAD_RESULT = {
  Loaded: 1,
  Failed: 2,
} as const;

export type TitleMeshLoadResultKind = typeof TITLE_MESH_LOAD_RESULT[keyof typeof TITLE_MESH_LOAD_RESULT];

export interface TitleMeshLoaderDependencies {
  readonly loadSource: () => TitleMeshSource;
  readonly createMesh: (source: TitleMeshSource) => TitleMesh;
}

export type TitleMeshLoadResult =
  | {
    readonly kind: typeof TITLE_MESH_LOAD_RESULT.Loaded;
    readonly mesh: TitleMesh;
  }
  | {
    readonly kind: typeof TITLE_MESH_LOAD_RESULT.Failed;
    readonly error: string;
  };

export function loadInitialTitleMesh(dependencies: TitleMeshLoaderDependencies): TitleMeshLoadResult {
  try {
    return {
      kind: TITLE_MESH_LOAD_RESULT.Loaded,
      mesh: dependencies.createMesh(dependencies.loadSource()),
    };
  } catch (cause) {
    return {
      kind: TITLE_MESH_LOAD_RESULT.Failed,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}
