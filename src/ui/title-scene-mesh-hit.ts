import { nearestTitleMeshHit, type TitleMeshVector3 } from './title-mesh.js';
import { type TitleMeshSideMode } from './title-mesh-side-mode.js';
import {
  inverseRotateTitleScenePointAroundY,
  inverseRotateTitleSceneVectorY,
  rotateTitleSceneVectorY,
  titleSceneLocalYawAt,
  titleSceneObjectFootprintCenterAt,
} from './title-scene-transform.js';
import type {
  TitleSceneMeshObject,
  TitleSceneObjectHit,
  TitleSceneVector3,
} from './title-scene.js';

export function titleSceneMeshHit(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  object: TitleSceneMeshObject,
  time: number | undefined,
  sideMode?: TitleMeshSideMode,
): TitleSceneObjectHit | undefined {
  const yaw = titleSceneLocalYawAt(object, time);
  const center = titleSceneObjectFootprintCenterAt(object, time);
  const localOrigin = meshLocalOrigin(origin, center, object, yaw);
  const hit = nearestTitleMeshHit(
    localOrigin,
    inverseRotateTitleSceneVectorY(ray, yaw),
    object.mesh,
    sideMode,
  );
  return hit == null
    ? undefined
    : {
        object,
        distance: hit.distance,
        normal: rotateTitleSceneVectorY(hit.normal, yaw),
      };
}

function meshLocalOrigin(
  origin: TitleSceneVector3,
  center: TitleSceneVector3,
  object: TitleSceneMeshObject,
  yaw: number,
): TitleMeshVector3 {
  const meshCenter = titleMeshCenter(object);
  const rotated = inverseRotateTitleScenePointAroundY(origin, center, yaw);
  return [
    meshCenter[0] + rotated[0] - center[0],
    meshCenter[1] + rotated[1] - center[1],
    meshCenter[2] + rotated[2] - center[2],
  ];
}

function titleMeshCenter(object: TitleSceneMeshObject): TitleMeshVector3 {
  return [
    (object.mesh.bounds.min[0] + object.mesh.bounds.max[0]) / 2,
    (object.mesh.bounds.min[1] + object.mesh.bounds.max[1]) / 2,
    (object.mesh.bounds.min[2] + object.mesh.bounds.max[2]) / 2,
  ];
}
