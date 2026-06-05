import type { RGB } from "./averaging-braille-canvas.js";
import type { TitleSceneEnvironment } from "./title-scene-environment.js";
import {
  createBunnySceneObjects,
  titleBunnySceneCameraPlacement,
} from "./title-bunny-scene.js";
import type { TitleMesh } from "./title-mesh.js";
import { TITLE_MESH_SIDE_MODE } from "./title-mesh-side-mode.js";
import { titleSceneObjectFootprintCenterAt } from "./title-scene-transform.js";
import {
  titleSceneObjectHit,
  type TitleSceneObjectHitOptions,
} from "./title-scene-hit.js";
import {
  TITLE_SCENE_SHAPE_KIND,
  type TitleScenePrimitiveShapeKind,
} from "./title-scene-shape-kind.js";

export { titleBunnySceneCameraPlacement } from "./title-bunny-scene.js";
export { titleSceneObjectFootprintCenterAt as titleSceneObjectFootprintCenter } from "./title-scene-transform.js";
export { TITLE_SCENE_SHAPE_KIND } from "./title-scene-shape-kind.js";
export type { TitleMesh } from "./title-mesh.js";
export type {
  TitleScenePrimitiveShapeKind,
  TitleSceneShapeKind,
} from "./title-scene-shape-kind.js";
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

export interface TitleSceneOrbit {
  readonly center: TitleSceneVector3;
  readonly radius: number;
  readonly phase: number;
  readonly angularSpeed: number;
}

export interface TitleSceneLocalYaw {
  readonly phase: number;
  readonly angularSpeed: number;
}

interface TitleSceneBaseObject {
  readonly label?: string;
  readonly radius: number;
  readonly footprintRadius: number;
  readonly height: number;
  readonly color: TitleSceneColor;
  readonly reflectivity: number;
  readonly transparency?: number;
  readonly refractiveIndex?: number;
  readonly orbit?: TitleSceneOrbit;
  readonly localYaw?: TitleSceneLocalYaw;
}

export interface TitleScenePrimitiveObject extends TitleSceneBaseObject {
  readonly kind: TitleScenePrimitiveShapeKind;
  readonly position: TitleSceneVector3;
}

export interface TitleSceneMeshObject extends TitleSceneBaseObject {
  readonly kind: typeof TITLE_SCENE_SHAPE_KIND.Mesh;
  readonly mesh: TitleMesh;
  readonly offset?: TitleSceneVector3;
}

export type TitleSceneObject = TitleScenePrimitiveObject | TitleSceneMeshObject;

export interface TitleSceneCameraPlacement {
  readonly angle: number;
  readonly radius: number;
}

export interface TitleScene {
  readonly camera: TitleSceneCameraPlacement;
  readonly objects: readonly TitleSceneObject[];
  readonly environment?: TitleSceneEnvironment;
}

export interface TitleSceneObjectHit {
  readonly object: TitleSceneObject;
  readonly distance: number;
  readonly normal: TitleSceneVector3;
}

export interface TitleSceneHitOptions extends TitleSceneObjectHitOptions {
  readonly ignoredObject?: TitleSceneObject;
}

const CAMERA_MIN_RADIUS = 7.2;
const CAMERA_RADIUS_SPAN = 3;
const FULL_TURN_RADIANS = Math.PI * 2;
const SCENE_OBJECT_COUNT = 6;
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
const TITLE_SCENE_HIT_DEFAULT_OPTIONS: TitleSceneHitOptions = {};
export const TITLE_SCENE_OBJECT_MARGIN = 0.28;

const POSITION_TEMPLATES: readonly (readonly [number, number])[] = [
  [0, 0],
  [2.8, 1.7],
  [-2.7, -1.5],
  [3.2, -1.6],
  [-3.1, 1.8],
  [0.8, -3.3],
];

export function generateTitleScene(
  seed: number,
  colors: TitleSceneColorSet,
  mesh?: TitleMesh,
): TitleScene {
  if (mesh != null) {
    return {
      camera: titleBunnySceneCameraPlacement(),
      objects: createBunnySceneObjects(colors, mesh),
    };
  }

  const random = seededRandom(seed);
  const objects: TitleSceneObject[] = [];
  for (let index = 0; index < SCENE_OBJECT_COUNT; index += 1) {
    const object = placeSceneObject(index, random, colors, objects);
    objects.push(object);
  }
  return {
    camera: titleSceneCameraPlacement(seed),
    objects,
  };
}

export function titleSceneCameraPlacement(
  seed: number,
): TitleSceneCameraPlacement {
  const random = seededRandom(seed + 1);
  return {
    angle: random() * FULL_TURN_RADIANS,
    radius: CAMERA_MIN_RADIUS + random() * CAMERA_RADIUS_SPAN,
  };
}

export function nearestTitleSceneObjectHit(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  objects: readonly TitleSceneObject[],
  options: TitleSceneHitOptions = TITLE_SCENE_HIT_DEFAULT_OPTIONS,
): TitleSceneObjectHit | undefined {
  let nearest: TitleSceneObjectHit | undefined;
  for (const object of objects) {
    if (object === options.ignoredObject) {
      continue;
    }
    const hit = titleSceneObjectHit(origin, ray, object, options);
    if (
      hit != null &&
      hit.distance > 0 &&
      (nearest == null || hit.distance < nearest.distance)
    ) {
      nearest = hit;
    }
  }
  return nearest;
}

export function nearestTitleScenePrimaryObjectHit(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  objects: readonly TitleSceneObject[],
  time: number,
): TitleSceneObjectHit | undefined {
  return nearestTitleSceneObjectHit(origin, ray, objects, {
    time,
    sideMode: TITLE_MESH_SIDE_MODE.FrontFacing,
  });
}

export function intersectsTitleSceneObjectAlongRay(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  object: TitleSceneObject,
  time?: number,
): boolean {
  const hit = titleSceneObjectHit(origin, ray, object, { time });
  return hit != null && hit.distance > 0;
}

function placeSceneObject(
  index: number,
  random: () => number,
  colors: TitleSceneColorSet,
  existing: readonly TitleSceneObject[],
): TitleSceneObject {
  for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt += 1) {
    const candidate = createSceneObject(index, random, colors);
    if (!overlapsSceneObjects(candidate, existing)) {
      return candidate;
    }
  }
  return createFallbackSceneObject(index, colors);
}

function createSceneObject(
  index: number,
  random: () => number,
  colors: TitleSceneColorSet,
): TitleSceneObject {
  const kind = sceneShapeKind(index, random);
  const template = POSITION_TEMPLATES[index % POSITION_TEMPLATES.length] ?? [
    0, 0,
  ];
  const radius =
    index === 0
      ? PRIMARY_SPHERE_MIN_RADIUS + random() * PRIMARY_SPHERE_RADIUS_SPAN
      : SECONDARY_MIN_RADIUS + random() * SECONDARY_RADIUS_SPAN;
  const height =
    kind === TITLE_SCENE_SHAPE_KIND.Column
      ? COLUMN_MIN_HEIGHT + random() * COLUMN_HEIGHT_SPAN
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
    reflectivity: 0.18 + random() * 0.34,
  };
}

function createFallbackSceneObject(
  index: number,
  colors: TitleSceneColorSet,
): TitleSceneObject {
  const kind =
    index === 1 ? TITLE_SCENE_SHAPE_KIND.Column : TITLE_SCENE_SHAPE_KIND.Sphere;
  const template = POSITION_TEMPLATES[index % POSITION_TEMPLATES.length] ?? [
    0, 0,
  ];
  const radius =
    index === 0 ? PRIMARY_SPHERE_MIN_RADIUS : FALLBACK_SECONDARY_RADIUS;
  const height =
    kind === TITLE_SCENE_SHAPE_KIND.Column ? COLUMN_MIN_HEIGHT : radius * 2;
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

function sceneShapeKind(
  index: number,
  random: () => number,
): TitleScenePrimitiveShapeKind {
  if (index === 0) {
    return TITLE_SCENE_SHAPE_KIND.Sphere;
  }
  if (index === 1) {
    return TITLE_SCENE_SHAPE_KIND.Column;
  }
  return random() > 0.55
    ? TITLE_SCENE_SHAPE_KIND.Column
    : TITLE_SCENE_SHAPE_KIND.Sphere;
}

function materialColor(
  index: number,
  random: () => number,
  colors: TitleSceneColorSet,
): TitleSceneColor {
  const palette: readonly TitleSceneColor[] = [
    colors.accent,
    colors.success,
    colors.info,
    colors.muted,
    colors.ink,
  ];
  return (
    palette[(index + Math.floor(random() * palette.length)) % palette.length] ??
    colors.accent
  );
}

function overlapsSceneObjects(
  candidate: TitleSceneObject,
  existing: readonly TitleSceneObject[],
): boolean {
  const candidateCenter = titleSceneObjectFootprintCenterAt(candidate);
  return existing.some((object) => {
    const objectCenter = titleSceneObjectFootprintCenterAt(object);
    const dx = candidateCenter[0] - objectCenter[0];
    const dz = candidateCenter[2] - objectCenter[2];
    const distance = Math.sqrt(dx * dx + dz * dz);
    return (
      distance <
      candidate.footprintRadius +
        object.footprintRadius +
        TITLE_SCENE_OBJECT_MARGIN
    );
  });
}

function jitter(random: () => number): number {
  return (random() - 0.5) * POSITION_JITTER;
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
