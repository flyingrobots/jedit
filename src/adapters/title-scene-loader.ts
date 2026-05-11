import * as fs from 'node:fs/promises';
import { TITLE_SCENE_SHAPE_KIND, type TitleScene, type TitleSceneCameraPlacement, type TitleSceneObject } from '../ui/title-scene.js';
import type { TitleMesh } from '../ui/title-mesh.js';
import type { TitleSceneLoaderPort } from '../ports/title-scene-loader.js';

export interface TitleSceneJson {
  readonly camera?: {
    readonly angle?: number;
    readonly radius?: number;
  };
  readonly objects?: ReadonlyArray<{
    readonly kind: string;
    readonly position: readonly [number, number, number];
    readonly radius: number;
    readonly footprintRadius?: number;
    readonly height?: number;
    readonly color: readonly [number, number, number];
    readonly reflectivity: number;
  }>;
}

export async function loadTitleSceneFromFile(path: string, mesh: TitleMesh | undefined): Promise<TitleScene> {
  const content = await fs.readFile(path, 'utf8');
  const json = JSON.parse(content);
  return parseTitleSceneJson(json, mesh);
}

export function parseTitleSceneJson(json: TitleSceneJson, mesh: TitleMesh | undefined): TitleScene {
  const camera: TitleSceneCameraPlacement = {
    angle: json.camera?.angle ?? 0,
    radius: json.camera?.radius ?? 8.5,
  };

  const objects: TitleSceneObject[] = [];

  for (const obj of (json.objects ?? [])) {
    if (obj.kind === TITLE_SCENE_SHAPE_KIND.Sphere) {
      objects.push({
        kind: TITLE_SCENE_SHAPE_KIND.Sphere,
        position: obj.position,
        radius: obj.radius,
        footprintRadius: obj.footprintRadius ?? obj.radius,
        height: obj.height ?? obj.radius * 2,
        color: obj.color,
        reflectivity: obj.reflectivity,
      });
    } else if (obj.kind === TITLE_SCENE_SHAPE_KIND.Column) {
      objects.push({
        kind: TITLE_SCENE_SHAPE_KIND.Column,
        position: obj.position,
        radius: obj.radius,
        footprintRadius: obj.footprintRadius ?? obj.radius,
        height: obj.height ?? obj.radius * 2,
        color: obj.color,
        reflectivity: obj.reflectivity,
      });
    } else if (obj.kind === TITLE_SCENE_SHAPE_KIND.Mesh && mesh != null) {
      objects.push({
        kind: TITLE_SCENE_SHAPE_KIND.Mesh,
        mesh,
        position: obj.position,
        radius: obj.radius,
        footprintRadius: obj.footprintRadius ?? obj.radius,
        height: obj.height ?? mesh.height,
        color: obj.color,
        reflectivity: obj.reflectivity,
      });
    }
  }

  return { camera, objects };
}

export function createTitleSceneLoaderPort(): TitleSceneLoaderPort {
  return {
    loadTitleSceneFromFile,
  };
}
