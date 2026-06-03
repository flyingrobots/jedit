import { TITLE_SCENE_SHAPE_KIND } from './title-scene-shape-kind.js';
import type {
  TitleSceneMeshObject,
  TitleSceneObject,
  TitleScenePrimitiveObject,
  TitleSceneVector3,
} from './title-scene.js';

const CENTER_DIVISOR = 2;
const DEFAULT_TIME = 0;
const ZERO_YAW = 0;
const ZERO_VECTOR: TitleSceneVector3 = [0, 0, 0];

export function titleSceneObjectFootprintCenterAt(
  object: TitleSceneObject,
  time = DEFAULT_TIME,
): TitleSceneVector3 {
  if (object.kind !== TITLE_SCENE_SHAPE_KIND.Mesh) {
    return titleScenePrimitivePositionAt(object, time);
  }
  const offset = titleSceneMeshOffsetAt(object, time);

  return [
    ((object.mesh.bounds.min[0] + object.mesh.bounds.max[0]) / CENTER_DIVISOR) + offset[0],
    ((object.mesh.bounds.min[1] + object.mesh.bounds.max[1]) / CENTER_DIVISOR) + offset[1],
    ((object.mesh.bounds.min[2] + object.mesh.bounds.max[2]) / CENTER_DIVISOR) + offset[2],
  ];
}

export function titleScenePrimitivePositionAt(
  object: TitleScenePrimitiveObject,
  time = DEFAULT_TIME,
): TitleSceneVector3 {
  return add(object.position, titleSceneOrbitOffsetAt(object, time));
}

export function titleSceneMeshOffsetAt(
  object: TitleSceneMeshObject,
  time = DEFAULT_TIME,
): TitleSceneVector3 {
  return add(object.offset ?? ZERO_VECTOR, titleSceneOrbitOffsetAt(object, time));
}

export function titleSceneLocalYawAt(
  object: TitleSceneObject,
  time = DEFAULT_TIME,
): number {
  return object.localYaw == null
    ? ZERO_YAW
    : object.localYaw.phase + (time * object.localYaw.angularSpeed);
}

export function rotateTitleSceneVectorY(vector: TitleSceneVector3, yaw: number): TitleSceneVector3 {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [
    (vector[0] * cos) - (vector[2] * sin),
    vector[1],
    (vector[0] * sin) + (vector[2] * cos),
  ];
}

export function inverseRotateTitleSceneVectorY(vector: TitleSceneVector3, yaw: number): TitleSceneVector3 {
  return rotateTitleSceneVectorY(vector, -yaw);
}

export function inverseRotateTitleScenePointAroundY(
  point: TitleSceneVector3,
  center: TitleSceneVector3,
  yaw: number,
): TitleSceneVector3 {
  return add(center, inverseRotateTitleSceneVectorY(sub(point, center), yaw));
}

function titleSceneOrbitOffsetAt(
  object: TitleSceneObject,
  time: number,
): TitleSceneVector3 {
  if (object.orbit == null) {
    return ZERO_VECTOR;
  }
  const angle = object.orbit.phase + (time * object.orbit.angularSpeed);
  return [
    object.orbit.center[0] + (Math.cos(angle) * object.orbit.radius),
    object.orbit.center[1],
    object.orbit.center[2] + (Math.sin(angle) * object.orbit.radius),
  ];
}

function add(a: TitleSceneVector3, b: TitleSceneVector3): TitleSceneVector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a: TitleSceneVector3, b: TitleSceneVector3): TitleSceneVector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
