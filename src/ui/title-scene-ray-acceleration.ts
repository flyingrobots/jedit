import { TITLE_SCENE_SHAPE_KIND } from "./title-scene-shape-kind.js";
import { titleSceneObjectFootprintCenterAt } from "./title-scene-transform.js";
import type {
  TitleSceneObject,
  TitleSceneVector3,
} from "./title-scene.js";

export interface TitleSceneRayBound {
  readonly center: TitleSceneVector3;
  readonly radius: number;
}

export interface TitleSceneObjectRayBound extends TitleSceneRayBound {
  readonly object: TitleSceneObject;
}

export interface TitleSceneRayAcceleration {
  readonly objectBounds: readonly TitleSceneObjectRayBound[];
  readonly sceneBound?: TitleSceneRayBound;
}

interface TitleSceneRayBoundExtents {
  readonly min: TitleSceneVector3;
  readonly max: TitleSceneVector3;
}

export function createTitleSceneRayAcceleration(
  objects: readonly TitleSceneObject[],
  time: number,
): TitleSceneRayAcceleration {
  const objectBounds = objects.map((object) =>
    titleSceneObjectRayBound(object, time),
  );
  const sceneBound = titleSceneBound(objectBounds);
  return {
    objectBounds,
    ...(sceneBound == null ? {} : { sceneBound }),
  };
}

export function titleSceneRayMayHitAnyObject(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  acceleration: TitleSceneRayAcceleration | undefined,
): boolean {
  return acceleration?.sceneBound == null
    ? true
    : titleSceneRayMayHitBound(origin, ray, acceleration.sceneBound);
}

export function titleSceneObjectRayBoundAt(
  acceleration: TitleSceneRayAcceleration | undefined,
  object: TitleSceneObject,
  index: number,
): TitleSceneObjectRayBound | undefined {
  const bound = acceleration?.objectBounds[index];
  return bound?.object === object ? bound : undefined;
}

export function titleSceneRayMayHitBound(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  bound: TitleSceneRayBound,
): boolean {
  const dx = bound.center[0] - origin[0];
  const dy = bound.center[1] - origin[1];
  const dz = bound.center[2] - origin[2];
  const centerDistanceSquared = dx * dx + dy * dy + dz * dz;
  const radiusSquared = bound.radius * bound.radius;
  const rayMagnitudeSquared =
    ray[0] * ray[0] + ray[1] * ray[1] + ray[2] * ray[2];
  if (rayMagnitudeSquared <= 0) {
    return centerDistanceSquared <= radiusSquared;
  }
  const projection = dx * ray[0] + dy * ray[1] + dz * ray[2];
  if (projection <= 0) {
    return centerDistanceSquared <= radiusSquared;
  }
  const closestDistanceSquared =
    centerDistanceSquared - (projection * projection) / rayMagnitudeSquared;
  return closestDistanceSquared <= radiusSquared;
}

function titleSceneObjectRayBound(
  object: TitleSceneObject,
  time: number,
): TitleSceneObjectRayBound {
  return {
    object,
    center: titleSceneObjectFootprintCenterAt(object, time),
    radius: titleSceneObjectBoundingRadius(object),
  };
}

function titleSceneObjectBoundingRadius(object: TitleSceneObject): number {
  const footprint = Math.max(
    object.radius,
    object.footprintRadius,
    object.kind === TITLE_SCENE_SHAPE_KIND.Mesh
      ? object.mesh.footprintRadius
      : 0,
  );
  const halfHeight = object.height / 2;
  return Math.sqrt(footprint * footprint + halfHeight * halfHeight);
}

function titleSceneBound(
  objectBounds: readonly TitleSceneObjectRayBound[],
): TitleSceneRayBound | undefined {
  const first = objectBounds[0];
  if (first == null) {
    return undefined;
  }
  const extents = titleSceneBoundExtents(first, objectBounds);
  const center = titleSceneExtentsCenter(extents);
  return {
    center,
    radius: titleSceneBoundRadius(objectBounds, center),
  };
}

function titleSceneBoundExtents(
  first: TitleSceneObjectRayBound,
  objectBounds: readonly TitleSceneObjectRayBound[],
): TitleSceneRayBoundExtents {
  let extents = titleSceneObjectBoundExtents(first);
  for (let index = 1; index < objectBounds.length; index += 1) {
    extents = mergeTitleSceneBoundExtents(
      extents,
      titleSceneObjectBoundExtents(objectBounds[index]!),
    );
  }
  return extents;
}

function titleSceneObjectBoundExtents(
  bound: TitleSceneObjectRayBound,
): TitleSceneRayBoundExtents {
  return {
    min: [
      bound.center[0] - bound.radius,
      bound.center[1] - bound.radius,
      bound.center[2] - bound.radius,
    ],
    max: [
      bound.center[0] + bound.radius,
      bound.center[1] + bound.radius,
      bound.center[2] + bound.radius,
    ],
  };
}

function mergeTitleSceneBoundExtents(
  left: TitleSceneRayBoundExtents,
  right: TitleSceneRayBoundExtents,
): TitleSceneRayBoundExtents {
  return {
    min: [
      Math.min(left.min[0], right.min[0]),
      Math.min(left.min[1], right.min[1]),
      Math.min(left.min[2], right.min[2]),
    ],
    max: [
      Math.max(left.max[0], right.max[0]),
      Math.max(left.max[1], right.max[1]),
      Math.max(left.max[2], right.max[2]),
    ],
  };
}

function titleSceneExtentsCenter(
  extents: TitleSceneRayBoundExtents,
): TitleSceneVector3 {
  return [
    (extents.min[0] + extents.max[0]) / 2,
    (extents.min[1] + extents.max[1]) / 2,
    (extents.min[2] + extents.max[2]) / 2,
  ];
}

function titleSceneBoundRadius(
  objectBounds: readonly TitleSceneObjectRayBound[],
  center: TitleSceneVector3,
): number {
  let radius = 0;
  for (const bound of objectBounds) {
    radius = Math.max(radius, titleSceneBoundRadiusCandidate(bound, center));
  }
  return radius;
}

function titleSceneBoundRadiusCandidate(
  bound: TitleSceneObjectRayBound,
  center: TitleSceneVector3,
): number {
  const dx = bound.center[0] - center[0];
  const dy = bound.center[1] - center[1];
  const dz = bound.center[2] - center[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz) + bound.radius;
}
