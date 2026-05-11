import type { TitleScene } from '../ui/title-scene.js';
import type { TitleMesh } from '../ui/title-mesh.js';

export interface TitleSceneLoaderPort {
  loadTitleSceneFromFile(path: string, mesh: TitleMesh | undefined): Promise<TitleScene>;
}
