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

type Color3 = TitleSceneEnvironmentColor;
type SceneFloor = NonNullable<TitleSceneEnvironment["floor"]>;
type SceneLight = NonNullable<TitleSceneEnvironment["light"]>;

const DEFAULT_FLOOR_GRID_SCALE = 0.7;
const DEFAULT_FLOOR_FADE_DISTANCE = 36;
const DEFAULT_LOCAL_HOUR = 12;
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 18;
const TWILIGHT_HOUR_SPAN = 2.25;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_HOUR = 3600;
const FULL_TURN_RADIANS = Math.PI * 2;
const SKY_DAY: Color3 = [42, 126, 190];
const SKY_TWILIGHT: Color3 = [210, 96, 86];
const SKY_NIGHT_FALLBACK: Color3 = [2, 3, 7];
const FLOOR_NIGHT_TINT: Color3 = [10, 14, 24];
const FLOOR_TWILIGHT_TINT: Color3 = [168, 80, 70];
const SUN_HORIZONTAL_RADIUS = 1.45;
const SUN_NIGHT_ELEVATION = 0.35;
const SUN_TWILIGHT_ELEVATION = 0.82;
const SUN_DAY_ELEVATION = 2.9;
const NIGHT_AMBIENT = 0.1;
const DAY_AMBIENT = 0.2;
const NIGHT_DIFFUSE = 0.36;
const DAY_DIFFUSE = 0.96;
const NIGHT_SPECULAR = 0.62;
const DAY_SPECULAR = 1.18;
const NIGHT_RIM = 0.8;
const DAY_RIM = 1.35;
const COLOR_CHANNEL_MIN = 0;
const COLOR_CHANNEL_MAX = 255;
const PLANE_EPSILON = 0.000001;
const FLOOR_VISIBILITY_EPSILON = 0.000001;
const FLOOR_Y = 0;

const CHECKER_PALETTES: readonly (Readonly<{
  dark: Color3;
  light: Color3;
}>)[] = [
  { dark: [12, 31, 36], light: [68, 142, 151] },
  { dark: [30, 24, 48], light: [132, 92, 171] },
  { dark: [37, 25, 22], light: [165, 91, 72] },
  { dark: [17, 35, 29], light: [82, 150, 106] },
  { dark: [33, 29, 18], light: [152, 134, 72] },
  { dark: [26, 28, 42], light: [88, 114, 178] },
];

export function titleSceneBackgroundColor(
  environment: TitleSceneEnvironment | undefined,
  colors: TitleEnvironmentDefaultColors,
): TitleSceneEnvironmentColor {
  return environment?.background ?? colors.surface;
}

export function titleSceneLightDirection(environment: TitleSceneEnvironment | undefined): TitleSceneVector3 | undefined {
  return environment?.light?.direction == null ? undefined : normalize(environment.light.direction);
}

export function titleSceneDayNightEnvironment(
  environment: TitleSceneEnvironment | undefined,
  seed: number,
  wallClockMs?: number,
): TitleSceneEnvironment {
  const hour = wallClockMs == null ? DEFAULT_LOCAL_HOUR : titleSceneWallClockHour(wallClockMs);
  return titleSceneDayNightEnvironmentAtHour(environment, seed, hour);
}

export function titleSceneWallClockHour(wallClockMs: number): number {
  const date = new Date(wallClockMs);
  return date.getHours() + date.getMinutes() / MINUTES_PER_HOUR + date.getSeconds() / SECONDS_PER_HOUR;
}

export function titleSceneDayNightEnvironmentAtHour(
  environment: TitleSceneEnvironment | undefined,
  seed: number,
  hour: number,
): TitleSceneEnvironment {
  const normalizedHour = normalizeHour(hour);
  const factors = titleSceneDayNightFactors(normalizedHour);
  return {
    ...environment,
    background: titleSceneSkyColor(environment?.background, factors),
    ...(environment?.floor == null ? {} : { floor: titleSceneCheckerFloor(environment.floor, seed, factors) }),
    light: titleSceneDayNightLight(environment?.light, normalizedHour, factors),
  };
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
  if (fade <= FLOOR_VISIBILITY_EPSILON) {
    return undefined;
  }
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

function titleSceneCheckerFloor(
  floor: SceneFloor,
  seed: number,
  factors: TitleSceneDayNightFactors,
): SceneFloor {
  const palette = checkerPalette(seed);
  return {
    ...floor,
    dark: floorColorForDayNight(palette.dark, factors, 0.04),
    light: floorColorForDayNight(palette.light, factors, 0.18),
  };
}

function titleSceneDayNightLight(
  light: SceneLight | undefined,
  hour: number,
  factors: TitleSceneDayNightFactors,
): SceneLight {
  return {
    ...light,
    direction: titleSceneSunDirection(hour, factors),
    ambient: mixScalar(NIGHT_AMBIENT, DAY_AMBIENT, factors.daylight),
    diffuse: mixScalar(NIGHT_DIFFUSE, DAY_DIFFUSE, Math.max(factors.daylight, factors.twilight * 0.72)),
    specularStrength: mixScalar(NIGHT_SPECULAR, DAY_SPECULAR, factors.daylight),
    rimStrength: mixScalar(NIGHT_RIM, DAY_RIM, factors.daylight),
  };
}

interface TitleSceneDayNightFactors {
  readonly daylight: number;
  readonly twilight: number;
  readonly night: number;
}

function titleSceneSkyColor(
  authoredBackground: Color3 | undefined,
  factors: TitleSceneDayNightFactors,
): Color3 {
  const night = authoredBackground ?? SKY_NIGHT_FALLBACK;
  const daylightSky = mixColor(night, SKY_DAY, factors.daylight);
  return mixColor(daylightSky, SKY_TWILIGHT, factors.twilight * (1 - factors.daylight * 0.55));
}

function floorColorForDayNight(
  color: Color3,
  factors: TitleSceneDayNightFactors,
  daylightBoost: number,
): Color3 {
  const daylight = scaleColor(color, 0.86 + factors.daylight * (0.28 + daylightBoost));
  const twilight = mixColor(daylight, FLOOR_TWILIGHT_TINT, factors.twilight * 0.22);
  return mixColor(twilight, FLOOR_NIGHT_TINT, factors.night * 0.34);
}

function titleSceneDayNightFactors(hour: number): TitleSceneDayNightFactors {
  const daylight = daylightRatio(hour);
  const twilight = Math.max(twilightRatio(hour, DAY_START_HOUR), twilightRatio(hour, DAY_END_HOUR));
  return {
    daylight,
    twilight,
    night: clamp01(1 - Math.max(daylight, twilight * 0.55)),
  };
}

function daylightRatio(hour: number): number {
  if (hour < DAY_START_HOUR || hour > DAY_END_HOUR) {
    return 0;
  }
  return Math.sin(((hour - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * Math.PI);
}

function twilightRatio(hour: number, targetHour: number): number {
  return clamp01(1 - circularHourDistance(hour, targetHour) / TWILIGHT_HOUR_SPAN);
}

function titleSceneSunDirection(
  hour: number,
  factors: TitleSceneDayNightFactors,
): TitleSceneVector3 {
  const azimuth = (hour / HOURS_PER_DAY) * FULL_TURN_RADIANS - Math.PI / 2;
  const elevation = SUN_NIGHT_ELEVATION + factors.twilight * SUN_TWILIGHT_ELEVATION + factors.daylight * SUN_DAY_ELEVATION;
  return normalize([
    Math.cos(azimuth) * SUN_HORIZONTAL_RADIUS,
    elevation,
    Math.sin(azimuth) * SUN_HORIZONTAL_RADIUS,
  ]);
}

function checkerPalette(seed: number): (typeof CHECKER_PALETTES)[number] {
  const normalized = Math.abs(seed - Math.floor(seed));
  const index = Math.min(CHECKER_PALETTES.length - 1, Math.floor(normalized * CHECKER_PALETTES.length));
  return CHECKER_PALETTES[index] ?? CHECKER_PALETTES[0]!;
}

function normalizeHour(hour: number): number {
  return ((hour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
}

function circularHourDistance(hour: number, targetHour: number): number {
  const distance = Math.abs(normalizeHour(hour) - normalizeHour(targetHour));
  return Math.min(distance, HOURS_PER_DAY - distance);
}

function mixScalar(from: number, to: number, ratio: number): number {
  return from + (to - from) * clamp01(ratio);
}

function scaleColor(color: Color3, scalar: number): Color3 {
  return [
    clampColorChannel(color[0] * scalar),
    clampColorChannel(color[1] * scalar),
    clampColorChannel(color[2] * scalar),
  ];
}

function clampColorChannel(value: number): number {
  return Math.max(COLOR_CHANNEL_MIN, Math.min(COLOR_CHANNEL_MAX, Math.round(value)));
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
