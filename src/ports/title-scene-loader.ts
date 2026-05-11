import type { TitleScene } from '../ui/title-scene.js';
import type { TitleMeshLibrary } from '../ui/title-mesh.js';

export interface TitleSceneLoaderPort {
  loadTitleSceneFromFile(path: string, meshes: TitleMeshLibrary): Promise<TitleScene>;
}
