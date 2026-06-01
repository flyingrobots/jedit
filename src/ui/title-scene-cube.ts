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
  readonly nearNormal: TitleSceneVector3;
  readonly farNormal: TitleSceneVector3;
}

interface CubeHitInterval {
  readonly nearDistance: number;
  readonly farDistance: number;
  readonly nearNormal: TitleSceneVector3;
  readonly farNormal: TitleSceneVector3;
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
const EMPTY_CUBE_HIT_INTERVAL: CubeHitInterval = {
  nearDistance: -Infinity,
  farDistance: Infinity,
  nearNormal: [0, 0, 0],
  farNormal: [0, 0, 0],
};

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
  const interval = cubeHitInterval(localOrigin, localRay, bounds);
  if (interval == null) {
    return undefined;
  }

  const distance = cubeHitDistance(interval);
  const normal = cubeHitNormal(interval);
  return distance <= 0 ? undefined : { object, distance, normal: rotateTitleSceneVectorY(normal, yaw) };
}

function cubeHitInterval(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  bounds: CubeBounds,
): CubeHitInterval | undefined {
  let interval = EMPTY_CUBE_HIT_INTERVAL;
  for (const axis of CUBE_AXES) {
    const axisHit = cubeAxisHit(origin, ray, bounds, axis);
    if (axisHit == null) {
      return undefined;
    }
    const merged = mergeCubeAxisHit(interval, axisHit);
    if (merged == null) {
      return undefined;
    }
    interval = merged;
  }
  return interval;
}

function mergeCubeAxisHit(interval: CubeHitInterval, axisHit: CubeAxisHit): CubeHitInterval | undefined {
  const nearDistance = Math.max(interval.nearDistance, axisHit.near);
  const farDistance = Math.min(interval.farDistance, axisHit.far);
  if (farDistance < nearDistance) {
    return undefined;
  }
  return {
    nearDistance,
    farDistance,
    nearNormal: axisHit.near > interval.nearDistance ? axisHit.nearNormal : interval.nearNormal,
    farNormal: axisHit.far < interval.farDistance ? axisHit.farNormal : interval.farNormal,
  };
}

function cubeHitDistance(interval: CubeHitInterval): number {
  return interval.nearDistance > 0 ? interval.nearDistance : interval.farDistance;
}

function cubeHitNormal(interval: CubeHitInterval): TitleSceneVector3 {
  return interval.nearDistance > 0 ? interval.nearNormal : interval.farNormal;
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
      : { near: -Infinity, far: Infinity, nearNormal: [0, 0, 0], farNormal: [0, 0, 0] };
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
    nearNormal: cubeFaceNormal(axis, direction > 0 ? CUBE_NEGATIVE_NORMAL : CUBE_POSITIVE_NORMAL),
    farNormal: cubeFaceNormal(axis, direction > 0 ? CUBE_POSITIVE_NORMAL : CUBE_NEGATIVE_NORMAL),
  };
}

function cubeFaceNormal(axis: CubeAxis, direction: number): TitleSceneVector3 {
  return [
    axis === CUBE_AXIS_X ? direction : 0,
    axis === CUBE_AXIS_Y ? direction : 0,
    axis === CUBE_AXIS_Z ? direction : 0,
  ];
}
