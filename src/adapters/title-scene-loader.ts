import * as fs from 'node:fs/promises';
import { TITLE_SCENE_SHAPE_KIND, type TitleScene, type TitleSceneCameraPlacement, type TitleSceneObject } from '../ui/title-scene.js';
import type { TitleSceneEnvironment } from '../ui/title-scene-environment.js';
import { TITLE_MESH_ID, type TitleMesh, type TitleMeshLibrary } from '../ui/title-mesh.js';
import type { TitleSceneLoaderPort } from '../ports/title-scene-loader.js';

export interface TitleSceneJson {
  readonly camera?: {
    readonly angle?: number;
    readonly radius?: number;
  };
  readonly environment?: TitleSceneEnvironment;
  readonly objects?: ReadonlyArray<{
    readonly kind: string;
    readonly mesh?: string;
    readonly position: readonly [number, number, number];
    readonly radius: number;
    readonly footprintRadius?: number;
    readonly height?: number;
    readonly color: readonly [number, number, number];
    readonly reflectivity: number;
  }>;
}

export async function loadTitleSceneFromFile(path: string, meshes: TitleMeshLibrary): Promise<TitleScene> {
  const content = await fs.readFile(path, 'utf8');
  const json = JSON.parse(content);
  return parseTitleSceneJson(json, meshes);
}

export function parseTitleSceneJson(json: TitleSceneJson, meshes: TitleMeshLibrary): TitleScene {
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
    } else if (obj.kind === TITLE_SCENE_SHAPE_KIND.Mesh) {
      const mesh = titleSceneObjectMesh(obj.mesh, meshes);
      if (mesh == null) {
        continue;
      }
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

  return { camera, objects, environment: json.environment };
}

export function createTitleSceneLoaderPort(): TitleSceneLoaderPort {
  return {
    loadTitleSceneFromFile,
  };
}

function titleSceneObjectMesh(meshId: string | undefined, meshes: TitleMeshLibrary): TitleMesh | undefined {
  if (meshId === TITLE_MESH_ID.Teapot) {
    return meshes.teapot;
  }
  return meshes.bunny;
}
