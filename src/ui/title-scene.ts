import type { RGB } from './averaging-braille-canvas.js';
import { nearestTitleMeshHit, type TitleMesh } from './title-mesh.js';

export const TITLE_SCENE_SHAPE_KIND = {
  Sphere: 'sphere',
  Column: 'column',
  Mesh: 'mesh',
} as const;

export type TitleSceneShapeKind = typeof TITLE_SCENE_SHAPE_KIND[keyof typeof TITLE_SCENE_SHAPE_KIND];
export type TitleScenePrimitiveShapeKind =
  | typeof TITLE_SCENE_SHAPE_KIND.Sphere
  | typeof TITLE_SCENE_SHAPE_KIND.Column;
export type TitleSceneVector3 = readonly [number, number, number];
export type TitleSceneColor = RGB;

export interface TitleSceneColorSet {
  readonly accent: TitleSceneColor;
  readonly info: TitleSceneColor;
  readonly success: TitleSceneColor;
  readonly ink: TitleSceneColor;
  readonly muted: TitleSceneColor;
  readonly surface: TitleSceneColor;
}

interface TitleSceneBaseObject {
  readonly position: TitleSceneVector3;
  readonly radius: number;
  readonly footprintRadius: number;
  readonly height: number;
  readonly color: TitleSceneColor;
  readonly reflectivity: number;
}

export interface TitleScenePrimitiveObject extends TitleSceneBaseObject {
  readonly kind: TitleScenePrimitiveShapeKind;
}

export interface TitleSceneMeshObject extends TitleSceneBaseObject {
  readonly kind: typeof TITLE_SCENE_SHAPE_KIND.Mesh;
  readonly mesh: TitleMesh;
}

export type TitleSceneObject = TitleScenePrimitiveObject | TitleSceneMeshObject;

export interface TitleSceneCameraPlacement {
  readonly angle: number;
  readonly radius: number;
}

export interface TitleScene {
  readonly camera: TitleSceneCameraPlacement;
  readonly objects: readonly TitleSceneObject[];
}

export interface TitleSceneObjectHit {
  readonly object: TitleSceneObject;
  readonly distance: number;
  readonly normal: TitleSceneVector3;
}

const CAMERA_MIN_RADIUS = 7.2;
const CAMERA_RADIUS_SPAN = 3;
const BUNNY_SCENE_CAMERA_ANGLE = -0.58;
const BUNNY_SCENE_CAMERA_RADIUS = 5.4;
const FULL_TURN_RADIANS = Math.PI * 2;
const SCENE_OBJECT_COUNT = 6;
const BUNNY_SCENE_MIRROR_SPHERE_RADIUS = 1.25;
const BUNNY_SCENE_MIRROR_SPHERE_HEIGHT = BUNNY_SCENE_MIRROR_SPHERE_RADIUS * 2;
const BUNNY_SCENE_MIRROR_SPHERE_FOOTPRINT_RADIUS = BUNNY_SCENE_MIRROR_SPHERE_RADIUS;
const BUNNY_SCENE_MIRROR_SPHERE_REFLECTIVITY = 1;
const BUNNY_SCENE_MESH_REFLECTIVITY = 0.18;
const PRIMARY_SPHERE_MIN_RADIUS = 1.05;
const PRIMARY_SPHERE_RADIUS_SPAN = 0.22;
const SECONDARY_MIN_RADIUS = 0.45;
const SECONDARY_RADIUS_SPAN = 0.42;
const FALLBACK_SECONDARY_RADIUS = 0.42;
const COLUMN_MIN_HEIGHT = 1.1;
const COLUMN_HEIGHT_SPAN = 1.4;
const POSITION_JITTER = 0.32;
const PLACEMENT_ATTEMPTS = 18;
const PRNG_SEED_SCALE = 0xffffffff;
const PRNG_STEP = 0x6d2b79f5;
const PRNG_DIVISOR = 4294967296;
const COLUMN_RAY_EPSILON = 0.000001;
const COLUMN_FLOOR_Y = 0;
export const TITLE_SCENE_OBJECT_MARGIN = 0.28;

const POSITION_TEMPLATES: readonly (readonly [number, number])[] = [
  [0, 0],
  [2.8, 1.7],
  [-2.7, -1.5],
  [3.2, -1.6],
  [-3.1, 1.8],
  [0.8, -3.3],
];

export function generateTitleScene(seed: number, colors: TitleSceneColorSet, mesh?: TitleMesh): TitleScene {
  if (mesh != null) {
    return {
      camera: titleBunnySceneCameraPlacement(),
      objects: createBunnySceneObjects(colors, mesh),
    };
  }

  const random = seededRandom(seed);
  const objects: TitleSceneObject[] = [];
  for (let index = 0; index < SCENE_OBJECT_COUNT; index += 1) {
    const object = placeSceneObject(index, random, colors, objects, mesh);
    objects.push(object);
  }
  return {
    camera: titleSceneCameraPlacement(seed),
    objects,
  };
}

export function titleSceneCameraPlacement(seed: number): TitleSceneCameraPlacement {
  const random = seededRandom(seed + 1);
  return {
    angle: random() * FULL_TURN_RADIANS,
    radius: CAMERA_MIN_RADIUS + (random() * CAMERA_RADIUS_SPAN),
  };
}

export function titleBunnySceneCameraPlacement(): TitleSceneCameraPlacement {
  return {
    angle: BUNNY_SCENE_CAMERA_ANGLE,
    radius: BUNNY_SCENE_CAMERA_RADIUS,
  };
}

export function nearestTitleSceneObjectHit(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  objects: readonly TitleSceneObject[],
  ignoredObject?: TitleSceneObject,
): TitleSceneObjectHit | undefined {
  let nearest: TitleSceneObjectHit | undefined;
  for (const object of objects) {
    if (object === ignoredObject) {
      continue;
    }
    const hit = titleSceneObjectHit(origin, ray, object);
    if (hit != null && hit.distance > 0 && (nearest == null || hit.distance < nearest.distance)) {
      nearest = hit;
    }
  }
  return nearest;
}

export function intersectsTitleSceneObjectAlongRay(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  object: TitleSceneObject,
): boolean {
  const hit = titleSceneObjectHit(origin, ray, object);
  return hit != null && hit.distance > 0;
}

function placeSceneObject(
  index: number,
  random: () => number,
  colors: TitleSceneColorSet,
  existing: readonly TitleSceneObject[],
  mesh: TitleMesh | undefined,
): TitleSceneObject {
  for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt += 1) {
    const candidate = createSceneObject(index, random, colors, mesh);
    if (!overlapsSceneObjects(candidate, existing)) {
      return candidate;
    }
  }
  return createFallbackSceneObject(index, colors, mesh);
}

function createSceneObject(
  index: number,
  random: () => number,
  colors: TitleSceneColorSet,
  mesh: TitleMesh | undefined,
): TitleSceneObject {
  if (index === 0 && mesh != null) {
    return createMeshSceneObject(colors, mesh);
  }

  const kind = sceneShapeKind(index, random);
  const template = POSITION_TEMPLATES[index % POSITION_TEMPLATES.length] ?? [0, 0];
  const radius = index === 0
    ? PRIMARY_SPHERE_MIN_RADIUS + (random() * PRIMARY_SPHERE_RADIUS_SPAN)
    : SECONDARY_MIN_RADIUS + (random() * SECONDARY_RADIUS_SPAN);
  const height = kind === TITLE_SCENE_SHAPE_KIND.Column
    ? COLUMN_MIN_HEIGHT + (random() * COLUMN_HEIGHT_SPAN)
    : radius * 2;
  const x = template[0] + jitter(random);
  const z = template[1] + jitter(random);
  return {
    kind,
    position: [x, height / 2, z],
    radius,
    footprintRadius: radius,
    height,
    color: materialColor(index, random, colors),
    reflectivity: 0.18 + (random() * 0.34),
  };
}

function createFallbackSceneObject(index: number, colors: TitleSceneColorSet, mesh: TitleMesh | undefined): TitleSceneObject {
  if (index === 0 && mesh != null) {
    return createMeshSceneObject(colors, mesh);
  }

  const kind = index === 1 ? TITLE_SCENE_SHAPE_KIND.Column : TITLE_SCENE_SHAPE_KIND.Sphere;
  const template = POSITION_TEMPLATES[index % POSITION_TEMPLATES.length] ?? [0, 0];
  const radius = index === 0 ? PRIMARY_SPHERE_MIN_RADIUS : FALLBACK_SECONDARY_RADIUS;
  const height = kind === TITLE_SCENE_SHAPE_KIND.Column ? COLUMN_MIN_HEIGHT : radius * 2;
  return {
    kind,
    position: [template[0], height / 2, template[1]],
    radius,
    footprintRadius: radius,
    height,
    color: materialColor(index, seededRandom(index), colors),
    reflectivity: 0.18,
  };
}

function createBunnySceneObjects(colors: TitleSceneColorSet, mesh: TitleMesh): readonly TitleSceneObject[] {
  return [
    createMeshSceneObject(colors, mesh),
    createMirrorSphere(colors),
  ];
}

function createMeshSceneObject(colors: TitleSceneColorSet, mesh: TitleMesh): TitleSceneMeshObject {
  const bounds = mesh.bounds;
  return {
    kind: TITLE_SCENE_SHAPE_KIND.Mesh,
    mesh,
    position: [
      (bounds.min[0] + bounds.max[0]) / 2,
      mesh.height / 2,
      (bounds.min[2] + bounds.max[2]) / 2,
    ],
    radius: mesh.footprintRadius,
    footprintRadius: mesh.footprintRadius,
    height: mesh.height,
    color: colors.accent,
    reflectivity: BUNNY_SCENE_MESH_REFLECTIVITY,
  };
}

function createMirrorSphere(colors: TitleSceneColorSet): TitleScenePrimitiveObject {
  return {
    kind: TITLE_SCENE_SHAPE_KIND.Sphere,
    position: [1.34, BUNNY_SCENE_MIRROR_SPHERE_RADIUS, 0.55],
    radius: BUNNY_SCENE_MIRROR_SPHERE_RADIUS,
    footprintRadius: BUNNY_SCENE_MIRROR_SPHERE_FOOTPRINT_RADIUS,
    height: BUNNY_SCENE_MIRROR_SPHERE_HEIGHT,
    color: colors.ink,
    reflectivity: BUNNY_SCENE_MIRROR_SPHERE_REFLECTIVITY,
  };
}

function sceneShapeKind(index: number, random: () => number): TitleScenePrimitiveShapeKind {
  if (index === 0) {
    return TITLE_SCENE_SHAPE_KIND.Sphere;
  }
  if (index === 1) {
    return TITLE_SCENE_SHAPE_KIND.Column;
  }
  return random() > 0.55 ? TITLE_SCENE_SHAPE_KIND.Column : TITLE_SCENE_SHAPE_KIND.Sphere;
}

function materialColor(index: number, random: () => number, colors: TitleSceneColorSet): TitleSceneColor {
  const palette: readonly TitleSceneColor[] = [
    colors.accent,
    colors.success,
    colors.info,
    colors.muted,
    colors.ink,
  ];
  return palette[(index + Math.floor(random() * palette.length)) % palette.length] ?? colors.accent;
}

function overlapsSceneObjects(candidate: TitleSceneObject, existing: readonly TitleSceneObject[]): boolean {
  return existing.some((object) => {
    const dx = candidate.position[0] - object.position[0];
    const dz = candidate.position[2] - object.position[2];
    const distance = Math.sqrt((dx * dx) + (dz * dz));
    return distance < candidate.footprintRadius + object.footprintRadius + TITLE_SCENE_OBJECT_MARGIN;
  });
}

function titleSceneObjectHit(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  object: TitleSceneObject,
): TitleSceneObjectHit | undefined {
  switch (object.kind) {
    case TITLE_SCENE_SHAPE_KIND.Column:
      return columnHit(origin, ray, object);
    case TITLE_SCENE_SHAPE_KIND.Mesh:
      return meshHit(origin, ray, object);
    case TITLE_SCENE_SHAPE_KIND.Sphere:
      return sphereHit(origin, ray, object);
  }
}

function sphereHit(origin: TitleSceneVector3, ray: TitleSceneVector3, object: TitleSceneObject): TitleSceneObjectHit | undefined {
  const distance = intersectSphere(origin, ray, object.position, object.radius);
  if (distance <= 0) {
    return undefined;
  }
  const point = add(origin, scale(ray, distance));
  return {
    object,
    distance,
    normal: normalize(sub(point, object.position)),
  };
}

function columnHit(origin: TitleSceneVector3, ray: TitleSceneVector3, object: TitleSceneObject): TitleSceneObjectHit | undefined {
  const distance = intersectColumnSide(origin, ray, object);
  if (distance <= 0) {
    return undefined;
  }
  const point = add(origin, scale(ray, distance));
  return {
    object,
    distance,
    normal: normalize([point[0] - object.position[0], 0, point[2] - object.position[2]]),
  };
}

function meshHit(origin: TitleSceneVector3, ray: TitleSceneVector3, object: TitleSceneMeshObject): TitleSceneObjectHit | undefined {
  const hit = nearestTitleMeshHit(origin, ray, object.mesh);
  return hit == null
    ? undefined
    : {
        object,
        distance: hit.distance,
        normal: hit.normal,
      };
}

function intersectSphere(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  position: TitleSceneVector3,
  radius: number,
): number {
  const oc = sub(origin, position);
  const b = dot(oc, ray);
  const c = dot(oc, oc) - (radius * radius);
  const discriminant = (b * b) - c;
  if (discriminant < 0) {
    return -1;
  }
  const root = Math.sqrt(discriminant);
  const first = -b - root;
  const second = -b + root;
  return first > 0 ? first : second;
}

function intersectColumnSide(origin: TitleSceneVector3, ray: TitleSceneVector3, object: TitleSceneObject): number {
  const dx = origin[0] - object.position[0];
  const dz = origin[2] - object.position[2];
  const a = (ray[0] * ray[0]) + (ray[2] * ray[2]);
  if (a <= COLUMN_RAY_EPSILON) {
    return -1;
  }
  const b = 2 * ((dx * ray[0]) + (dz * ray[2]));
  const c = (dx * dx) + (dz * dz) - (object.radius * object.radius);
  const discriminant = (b * b) - (4 * a * c);
  if (discriminant < 0) {
    return -1;
  }
  const root = Math.sqrt(discriminant);
  const first = (-b - root) / (2 * a);
  const second = (-b + root) / (2 * a);
  return firstColumnRootInRange(origin, ray, object, first, second);
}

function firstColumnRootInRange(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  object: TitleSceneObject,
  first: number,
  second: number,
): number {
  if (columnRootInRange(origin, ray, object, first)) {
    return first;
  }
  return columnRootInRange(origin, ray, object, second) ? second : -1;
}

function columnRootInRange(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  object: TitleSceneObject,
  distance: number,
): boolean {
  const y = origin[1] + (ray[1] * distance);
  return distance > 0 && y >= COLUMN_FLOOR_Y && y <= object.height;
}

function jitter(random: () => number): number {
  return (random() - 0.5) * POSITION_JITTER;
}

function normalize(vector: TitleSceneVector3): TitleSceneVector3 {
  const length = Math.sqrt((vector[0] * vector[0]) + (vector[1] * vector[1]) + (vector[2] * vector[2]));
  return length === 0 ? [0, 0, 0] : [vector[0] / length, vector[1] / length, vector[2] / length];
}

function dot(a: TitleSceneVector3, b: TitleSceneVector3): number {
  return (a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]);
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

function seededRandom(seed: number): () => number {
  let state = Math.floor(Math.abs(seed) * PRNG_SEED_SCALE) >>> 0;
  return () => {
    state = (state + PRNG_STEP) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / PRNG_DIVISOR;
  };
}
