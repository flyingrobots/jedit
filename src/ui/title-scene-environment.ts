import type { RGB } from './averaging-braille-canvas.js';
import type { TitleSceneVector3 } from './title-scene.js';

export const TITLE_SCENE_FLOOR_KIND = {
  Grid: 'grid',
  Solid: 'solid',
  None: 'none',
} as const;

export type TitleSceneFloorKind = typeof TITLE_SCENE_FLOOR_KIND[keyof typeof TITLE_SCENE_FLOOR_KIND];
export type TitleSceneEnvironmentColor = RGB;

export interface TitleSceneFloorEnvironment {
  readonly kind: TitleSceneFloorKind;
  readonly dark?: TitleSceneEnvironmentColor;
  readonly light?: TitleSceneEnvironmentColor;
  readonly gridScale?: number;
  readonly fadeDistance?: number;
}

export interface TitleSceneWallEnvironment {
  readonly normal: TitleSceneVector3;
  readonly offset: number;
  readonly color: TitleSceneEnvironmentColor;
}

export interface TitleSceneLightEnvironment {
  readonly direction?: TitleSceneVector3;
  readonly ambient?: number;
  readonly diffuse?: number;
  readonly specularStrength?: number;
  readonly rimStrength?: number;
}

export interface TitleSceneEnvironment {
  readonly background?: TitleSceneEnvironmentColor;
  readonly floor?: TitleSceneFloorEnvironment;
  readonly light?: TitleSceneLightEnvironment;
  readonly walls?: readonly TitleSceneWallEnvironment[];
}

export interface TitleEnvironmentSurfaceHit {
  readonly distance: number;
  readonly point: TitleSceneVector3;
  readonly normal: TitleSceneVector3;
  readonly color: TitleSceneEnvironmentColor;
  readonly receivesFloorEffects: boolean;
}

export interface TitleEnvironmentDefaultColors {
  readonly surface: TitleSceneEnvironmentColor;
  readonly floorDark: TitleSceneEnvironmentColor;
  readonly floorLight: TitleSceneEnvironmentColor;
}

const DEFAULT_FLOOR_GRID_SCALE = 0.7;
const DEFAULT_FLOOR_FADE_DISTANCE = 36;
const PLANE_EPSILON = 0.000001;
const FLOOR_Y = 0;

export function titleSceneBackgroundColor(
  environment: TitleSceneEnvironment | undefined,
  colors: TitleEnvironmentDefaultColors,
): TitleSceneEnvironmentColor {
  return environment?.background ?? colors.surface;
}

export function titleSceneLightDirection(environment: TitleSceneEnvironment | undefined): TitleSceneVector3 | undefined {
  return environment?.light?.direction == null ? undefined : normalize(environment.light.direction);
}

export function nearestTitleEnvironmentSurfaceHit(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  environment: TitleSceneEnvironment | undefined,
  colors: TitleEnvironmentDefaultColors,
): TitleEnvironmentSurfaceHit | undefined {
  const hits = [
    floorHit(origin, ray, environment?.floor, colors),
    ...(environment?.walls ?? []).map((wall) => wallHit(origin, ray, wall)),
  ].filter(isTitleEnvironmentSurfaceHit);

  return hits.reduce<TitleEnvironmentSurfaceHit | undefined>((nearest, hit) => (
    nearest == null || hit.distance < nearest.distance ? hit : nearest
  ), undefined);
}

function isTitleEnvironmentSurfaceHit(hit: TitleEnvironmentSurfaceHit | undefined): hit is TitleEnvironmentSurfaceHit {
  return hit != null;
}

function floorHit(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  floor: TitleSceneFloorEnvironment | undefined,
  colors: TitleEnvironmentDefaultColors,
): TitleEnvironmentSurfaceHit | undefined {
  if (!floorCanBeHit(floor, ray)) {
    return undefined;
  }
  const distance = (FLOOR_Y - origin[1]) / ray[1];
  if (distance <= 0) {
    return undefined;
  }
  const point = add(origin, scale(ray, distance));
  const fadeDistance = floor?.fadeDistance ?? DEFAULT_FLOOR_FADE_DISTANCE;
  const fade = Math.max(0, 1 - (distance / fadeDistance));
  const color = floorColorAt(point, floor, colors);

  return {
    distance,
    point,
    normal: [0, 1, 0],
    color: mixColor(colors.surface, color, fade),
    receivesFloorEffects: true,
  };
}

function floorCanBeHit(floor: TitleSceneFloorEnvironment | undefined, ray: TitleSceneVector3): boolean {
  return floor?.kind !== TITLE_SCENE_FLOOR_KIND.None && Math.abs(ray[1]) > PLANE_EPSILON;
}

function floorColorAt(
  point: TitleSceneVector3,
  floor: TitleSceneFloorEnvironment | undefined,
  colors: TitleEnvironmentDefaultColors,
): TitleSceneEnvironmentColor {
  const light = floor?.light ?? colors.floorLight;
  if (floor?.kind === TITLE_SCENE_FLOOR_KIND.Solid) {
    return light;
  }
  return checkerColor(point, floor?.dark ?? colors.floorDark, light, floor?.gridScale ?? DEFAULT_FLOOR_GRID_SCALE);
}

function wallHit(
  origin: TitleSceneVector3,
  ray: TitleSceneVector3,
  wall: TitleSceneWallEnvironment,
): TitleEnvironmentSurfaceHit | undefined {
  const normal = normalize(wall.normal);
  const denominator = dot(normal, ray);
  if (Math.abs(denominator) <= PLANE_EPSILON) {
    return undefined;
  }
  const distance = (wall.offset - dot(normal, origin)) / denominator;
  return distance <= 0
    ? undefined
    : {
        distance,
        point: add(origin, scale(ray, distance)),
        normal,
        color: wall.color,
        receivesFloorEffects: false,
      };
}

function checkerColor(
  point: TitleSceneVector3,
  dark: TitleSceneEnvironmentColor,
  light: TitleSceneEnvironmentColor,
  gridScale: number,
): TitleSceneEnvironmentColor {
  return (Math.floor(point[0] * gridScale) + Math.floor(point[2] * gridScale)) % 2 === 0 ? light : dark;
}

function mixColor(
  from: TitleSceneEnvironmentColor,
  to: TitleSceneEnvironmentColor,
  ratio: number,
): TitleSceneEnvironmentColor {
  const clamped = Math.max(0, Math.min(1, ratio));
  return [
    Math.round(from[0] + ((to[0] - from[0]) * clamped)),
    Math.round(from[1] + ((to[1] - from[1]) * clamped)),
    Math.round(from[2] + ((to[2] - from[2]) * clamped)),
  ];
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

function scale(vector: TitleSceneVector3, scalar: number): TitleSceneVector3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}
