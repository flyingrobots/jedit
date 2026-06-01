import {
  inverseRotateTitleScenePointAroundY,
  inverseRotateTitleSceneVectorY,
  rotateTitleSceneVectorY,
  titleSceneLocalYawAt,
  titleScenePrimitivePositionAt,
} from './title-scene-transform.js';
import type {
  TitleSceneObjectHit,
  TitleScenePrimitiveObject,
  TitleSceneVector3,
} from './title-scene.js';

interface CubeBounds {
  readonly min: TitleSceneVector3;
  readonly max: TitleSceneVector3;
}

interface CubeAxisHit {
  readonly near: number;
  readonly far: number;
  readonly normal: TitleSceneVector3;
}

type CubeAxis = typeof CUBE_AXIS_X | typeof CUBE_AXIS_Y | typeof CUBE_AXIS_Z;

const CUBE_AXIS_X = 0;
const CUBE_AXIS_Y = 1;
const CUBE_AXIS_Z = 2;
const CUBE_AXES: readonly CubeAxis[] = [CUBE_AXIS_X, CUBE_AXIS_Y, CUBE_AXIS_Z];
const CUBE_HALF_HEIGHT_DIVISOR = 2;
const CUBE_RAY_EPSILON = 0.000001;
const CUBE_NEGATIVE_NORMAL = -1;
const CUBE_POSITIVE_NORMAL = 1;

export function titleSceneCubeHit(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  object: TitleScenePrimitiveObject,
  time: number | undefined,
): TitleSceneObjectHit | undefined {
  const position = titleScenePrimitivePositionAt(object, time);
  const yaw = titleSceneLocalYawAt(object, time);
  const localOrigin = inverseRotateTitleScenePointAroundY(origin, position, yaw);
  const localRay = inverseRotateTitleSceneVectorY(ray, yaw);
  const bounds = cubeBounds(position, object);
  let nearDistance = -Infinity;
  let farDistance = Infinity;
  let normal: TitleSceneVector3 = [0, 0, 0];

  for (const axis of CUBE_AXES) {
    const axisHit = cubeAxisHit(localOrigin, localRay, bounds, axis);
    if (axisHit == null) {
      return undefined;
    }
    if (axisHit.near > nearDistance) {
      nearDistance = axisHit.near;
      normal = axisHit.normal;
    }
    farDistance = Math.min(farDistance, axisHit.far);
    if (farDistance < nearDistance) {
      return undefined;
    }
  }

  const distance = nearDistance > 0 ? nearDistance : farDistance;
  return distance <= 0 ? undefined : { object, distance, normal: rotateTitleSceneVectorY(normal, yaw) };
}

function cubeBounds(position: TitleSceneVector3, object: TitleScenePrimitiveObject): CubeBounds {
  const halfHeight = object.height / CUBE_HALF_HEIGHT_DIVISOR;
  return {
    min: [position[0] - object.radius, position[1] - halfHeight, position[2] - object.radius],
    max: [position[0] + object.radius, position[1] + halfHeight, position[2] + object.radius],
  };
}

function cubeAxisHit(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  bounds: CubeBounds,
  axis: CubeAxis,
): CubeAxisHit | undefined {
  const direction = ray[axis];
  if (Math.abs(direction) <= CUBE_RAY_EPSILON) {
    return origin[axis] < bounds.min[axis] || origin[axis] > bounds.max[axis]
      ? undefined
      : { near: -Infinity, far: Infinity, normal: [0, 0, 0] };
  }
  return cubeDirectedAxisHit(origin, bounds, axis, direction);
}

function cubeDirectedAxisHit(
  origin: TitleSceneVector3,
  bounds: CubeBounds,
  axis: CubeAxis,
  direction: number,
): CubeAxisHit {
  const first = (bounds.min[axis] - origin[axis]) / direction;
  const second = (bounds.max[axis] - origin[axis]) / direction;
  return {
    near: Math.min(first, second),
    far: Math.max(first, second),
    normal: cubeFaceNormal(axis, direction > 0 ? CUBE_NEGATIVE_NORMAL : CUBE_POSITIVE_NORMAL),
  };
}

function cubeFaceNormal(axis: CubeAxis, direction: number): TitleSceneVector3 {
  return [
    axis === CUBE_AXIS_X ? direction : 0,
    axis === CUBE_AXIS_Y ? direction : 0,
    axis === CUBE_AXIS_Z ? direction : 0,
  ];
}
