import { titleSceneCubeHit } from "./title-scene-cube.js";
import { titleSceneMeshHit } from "./title-scene-mesh-hit.js";
import { titleScenePrimitivePositionAt } from "./title-scene-transform.js";
import { TITLE_SCENE_SHAPE_KIND } from "./title-scene-shape-kind.js";
import type {
  TitleSceneObject,
  TitleSceneObjectHit,
  TitleScenePrimitiveObject,
  TitleSceneVector3,
} from "./title-scene.js";

type ColumnHitCandidate = {
  readonly distance: number;
  readonly normal: TitleSceneVector3;
};

const COLUMN_RAY_EPSILON = 0.000001;
const COLUMN_HALF_HEIGHT_DIVISOR = 2;
const COLUMN_TOP_NORMAL: TitleSceneVector3 = [0, 1, 0];
const COLUMN_BOTTOM_NORMAL: TitleSceneVector3 = [0, -1, 0];

export function titleSceneObjectHit(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  object: TitleSceneObject,
  time?: number,
): TitleSceneObjectHit | undefined {
  switch (object.kind) {
    case TITLE_SCENE_SHAPE_KIND.Column:
      return columnHit(origin, ray, object, time);
    case TITLE_SCENE_SHAPE_KIND.Cube:
      return titleSceneCubeHit(origin, ray, object, time);
    case TITLE_SCENE_SHAPE_KIND.Mesh:
      return titleSceneMeshHit(origin, ray, object, time);
    case TITLE_SCENE_SHAPE_KIND.Sphere:
      return sphereHit(origin, ray, object, time);
  }
}

function sphereHit(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  object: TitleScenePrimitiveObject,
  time: number | undefined,
): TitleSceneObjectHit | undefined {
  const position = titleScenePrimitivePositionAt(object, time);
  const distance = intersectSphere(origin, ray, position, object.radius);
  if (distance <= 0) {
    return undefined;
  }
  const point = add(origin, scale(ray, distance));
  return {
    object,
    distance,
    normal: normalize(sub(point, position)),
  };
}

function columnHit(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  object: TitleScenePrimitiveObject,
  time: number | undefined,
): TitleSceneObjectHit | undefined {
  const position = titleScenePrimitivePositionAt(object, time);
  const bottomY = position[1] - object.height / COLUMN_HALF_HEIGHT_DIVISOR;
  const topY = position[1] + object.height / COLUMN_HALF_HEIGHT_DIVISOR;
  const side = columnSideHitCandidate(origin, ray, object, position);
  const top = columnCapHitCandidate(origin, ray, object, position, topY);
  const bottom = columnCapHitCandidate(origin, ray, object, position, bottomY);
  const hit = nearestColumnCandidate(nearestColumnCandidate(side, top), bottom);
  return hit == null
    ? undefined
    : { object, distance: hit.distance, normal: hit.normal };
}

function columnSideHitCandidate(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  object: TitleScenePrimitiveObject,
  position: TitleSceneVector3,
): ColumnHitCandidate | undefined {
  const distance = intersectColumnSide(origin, ray, object, position);
  if (distance <= 0) {
    return undefined;
  }
  const point = add(origin, scale(ray, distance));
  return {
    distance,
    normal: normalize([point[0] - position[0], 0, point[2] - position[2]]),
  };
}

function columnCapHitCandidate(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  object: TitleScenePrimitiveObject,
  position: TitleSceneVector3,
  capY: number,
): ColumnHitCandidate | undefined {
  const distance = intersectColumnCap(origin, ray, object, position, capY);
  const normal = capY > position[1] ? COLUMN_TOP_NORMAL : COLUMN_BOTTOM_NORMAL;
  return distance > 0 ? { distance, normal } : undefined;
}

function nearestColumnCandidate(
  current: ColumnHitCandidate | undefined,
  next: ColumnHitCandidate | undefined,
): ColumnHitCandidate | undefined {
  if (current == null) {
    return next;
  }
  return next != null && next.distance < current.distance ? next : current;
}

function intersectColumnCap(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  object: TitleScenePrimitiveObject,
  position: TitleSceneVector3,
  capY: number,
): number {
  if (Math.abs(ray[1]) <= COLUMN_RAY_EPSILON) {
    return -1;
  }
  const t = (capY - origin[1]) / ray[1];
  if (t <= 0) {
    return -1;
  }
  const x = origin[0] + ray[0] * t;
  const z = origin[2] + ray[2] * t;
  const dx = x - position[0];
  const dz = z - position[2];
  if (dx * dx + dz * dz <= object.radius * object.radius) {
    return t;
  }
  return -1;
}

function intersectSphere(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  position: TitleSceneVector3,
  radius: number,
): number {
  const oc = sub(origin, position);
  const b = dot(oc, ray);
  const c = dot(oc, oc) - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) {
    return -1;
  }
  const root = Math.sqrt(discriminant);
  const first = -b - root;
  const second = -b + root;
  return first > 0 ? first : second;
}

function intersectColumnSide(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  object: TitleScenePrimitiveObject,
  position: TitleSceneVector3,
): number {
  const dx = origin[0] - position[0];
  const dz = origin[2] - position[2];
  const a = ray[0] * ray[0] + ray[2] * ray[2];
  if (a <= COLUMN_RAY_EPSILON) {
    return -1;
  }
  const b = 2 * (dx * ray[0] + dz * ray[2]);
  const c = dx * dx + dz * dz - object.radius * object.radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return -1;
  }
  const root = Math.sqrt(discriminant);
  const first = (-b - root) / (2 * a);
  const second = (-b + root) / (2 * a);
  return firstColumnRootInRange(origin, ray, object, position, [first, second]);
}

function firstColumnRootInRange(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  object: TitleScenePrimitiveObject,
  position: TitleSceneVector3,
  roots: readonly [number, number],
): number {
  if (columnRootInRange(origin, ray, object, position, roots[0])) {
    return roots[0];
  }
  return columnRootInRange(origin, ray, object, position, roots[1])
    ? roots[1]
    : -1;
}

function columnRootInRange(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  object: TitleScenePrimitiveObject,
  position: TitleSceneVector3,
  distance: number,
): boolean {
  const bottomY = position[1] - object.height / COLUMN_HALF_HEIGHT_DIVISOR;
  const topY = position[1] + object.height / COLUMN_HALF_HEIGHT_DIVISOR;
  const y = origin[1] + ray[1] * distance;
  return distance > 0 && y >= bottomY && y <= topY;
}

function normalize(vector: TitleSceneVector3): TitleSceneVector3 {
  const length = Math.sqrt(
    vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2],
  );
  return length === 0
    ? [0, 0, 0]
    : [vector[0] / length, vector[1] / length, vector[2] / length];
}

function dot(a: TitleSceneVector3, b: TitleSceneVector3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function add(a: TitleSceneVector3, b: TitleSceneVector3): TitleSceneVector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a: TitleSceneVector3, b: TitleSceneVector3): TitleSceneVector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(vector: TitleSceneVector3, scalar: number): TitleSceneVector3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}
