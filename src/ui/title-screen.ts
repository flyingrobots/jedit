import { type Surface } from '@flyingrobots/bijou';

import { averagingBrailleCanvas, type BrailleShaderFn, type BrailleShaderSample, type RGB } from './averaging-braille-canvas.js';
import { type JeditTheme, JEDIT_SOURCE_TOKEN, JEDIT_TEXT_MODIFIER } from './jedit-theme.js';
import { JEDIT_LOGO_HEIGHT, JEDIT_LOGO_MASK, JEDIT_LOGO_WIDTH } from './logo-data.js';

type Vector3 = readonly [number, number, number];
type Color3 = RGB;

interface Sphere {
  readonly position: Vector3;
  readonly radius: number;
  readonly color: Color3;
  readonly reflectivity: number;
}

export interface TitleSceneMaterialColors {
  readonly accent: Color3;
  readonly info: Color3;
  readonly success: Color3;
  readonly ink: Color3;
  readonly muted: Color3;
  readonly surface: Color3;
  readonly floorDark: Color3;
  readonly floorLight: Color3;
}

interface LogoBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const DEFAULT_CAMERA_RADIUS = 8.5;
const CAMERA_DRIFT_RATE = 0.005;
const CAMERA_HEIGHT = 3.5;
const LOGO_WIDTH_RATIO = 0.8;
const LOGO_MAX_HEIGHT_RATIO = 0.62;
const BRAILLE_COLUMNS_PER_CELL = 2;
const BRAILLE_ROWS_PER_CELL = 4;
const LIGHT_AMBIENT = 0.24;
const LIGHT_DIFFUSE = 0.76;
const KEY_LIGHT_DIRECTION: Vector3 = normalize([1.4, 2.2, -1.1]);
const SPECULAR_POWER = 28;
const SPECULAR_STRENGTH = 0.52;
const REFLECTION_EDGE_BIAS = 0.28;
const REFLECTION_FRESNEL_POWER = 3;
const PLANE_FADE_DISTANCE = 36;
const PLANE_MIN_FADE = 0.05;
const PLANE_GRID_SCALE = 0.7;
const SKY_TINT = 1.08;
const SURFACE_REFLECTION_TINT = 0.72;
const LUMINANCE_RED_WEIGHT = 0.2126;
const LUMINANCE_GREEN_WEIGHT = 0.7152;
const LUMINANCE_BLUE_WEIGHT = 0.0722;

export function renderTitleScreen(
  cols: number,
  rows: number,
  time: number,
  theme: JeditTheme,
  camAngle: number,
  camRadius = DEFAULT_CAMERA_RADIUS,
): Surface {
  const logoMask = decodeLogoMask();
  const colors = titleSceneMaterialColors(theme);
  const subpixelCols = cols * BRAILLE_COLUMNS_PER_CELL;
  const subpixelRows = rows * BRAILLE_ROWS_PER_CELL;
  const logoBounds = titleLogoBounds(subpixelCols, subpixelRows);
  const spheres: readonly Sphere[] = [
    { position: [0, 1.0, 0], radius: 1.25, color: colors.accent, reflectivity: 0.48 },
    { position: [2.7, 0.55, 1.6], radius: 0.65, color: colors.success, reflectivity: 0.26 },
    { position: [-2.3, 0.75, -1.1], radius: 0.85, color: colors.info, reflectivity: 0.42 },
  ];

  const shader: BrailleShaderFn = ({ u, v, time: frameTime }) => {
    const x = Math.round(u * (subpixelCols - 1 || 1));
    const y = Math.round(v * (subpixelRows - 1 || 1));
    const logoSample = logoSampleAt(x, y, logoBounds, logoMask, colors);
    if (logoSample != null) {
      return logoSample;
    }

    return sceneSampleAt(u, v, cols, rows, frameTime, camAngle, camRadius, spheres, colors);
  };

  return averagingBrailleCanvas(cols, rows, shader, time);
}

export function titleSceneMaterialColors(theme: JeditTheme): TitleSceneMaterialColors {
  const baseColors = {
    accent: theme.chrome.titleLogo.fgRGB ?? theme.chrome.activeEdge.fgRGB ?? [216, 151, 255],
    info: theme.source.get(JEDIT_SOURCE_TOKEN.Number)?.fgRGB ?? [101, 194, 255],
    success: theme.source.get(JEDIT_SOURCE_TOKEN.String)?.fgRGB ?? [124, 213, 156],
    ink: theme.chrome.titleSceneNear.fgRGB ?? theme.surface.workspace.fgRGB ?? [226, 231, 236],
    muted: theme.chrome.titleSceneFar.fgRGB ?? [126, 137, 148],
    surface: theme.surface.workspace.bgRGB ?? [14, 17, 22],
  } as const;
  const floorColors = orderedFloorMaterialColors(baseColors.ink, baseColors.muted);

  return {
    ...baseColors,
    floorDark: floorColors.dark,
    floorLight: floorColors.light,
  };
}

function sceneSampleAt(
  u: number,
  v: number,
  cols: number,
  rows: number,
  time: number,
  camAngle: number,
  camRadius: number,
  spheres: readonly Sphere[],
  colors: TitleSceneMaterialColors,
): BrailleShaderSample {
  const aspect = cols / Math.max(1, rows);
  const rx = (u * 2 - 1) * aspect;
  const ry = v * 2 - 1;
  const finalAngle = camAngle + (time * CAMERA_DRIFT_RATE);
  const origin: Vector3 = [
    Math.sin(finalAngle) * camRadius,
    CAMERA_HEIGHT,
    Math.cos(finalAngle) * camRadius,
  ];
  const ray = getRayDir(origin, [0, 0.4, 0], [rx, -ry - 0.2, 2.7]);
  const sphereHit = nearestSphereHit(origin, ray, spheres);
  const planeDistance = -origin[1] / ray[1];

  if (sphereHit != null && (planeDistance <= 0 || sphereHit.distance < planeDistance)) {
    const point = add(origin, scale(ray, sphereHit.distance));
    const normal = normalize(sub(point, sphereHit.sphere.position));
    const light = Math.max(0, dot(normal, KEY_LIGHT_DIRECTION));
    const intensity = LIGHT_AMBIENT + (light * LIGHT_DIFFUSE);
    const reflectionRay = reflect(ray, normal);
    const reflectionColor = reflectedEnvironmentColor(point, reflectionRay, colors);
    const fresnel = Math.pow(1 - Math.max(0, dot(scale(ray, -1), normal)), REFLECTION_FRESNEL_POWER);
    const reflectionAmount = sphereHit.sphere.reflectivity * (REFLECTION_EDGE_BIAS + ((1 - REFLECTION_EDGE_BIAS) * fresnel));
    const viewDirection = scale(ray, -1);
    const halfVector = normalize(add(KEY_LIGHT_DIRECTION, viewDirection));
    const specular = Math.pow(Math.max(0, dot(normal, halfVector)), SPECULAR_POWER) * SPECULAR_STRENGTH;
    return {
      on: true,
      fgRGB: addColor(
        mixColor(scaleColor(sphereHit.sphere.color, intensity), reflectionColor, reflectionAmount),
        scaleColor(colors.ink, specular),
      ),
      bgRGB: colors.surface,
    };
  }

  if (planeDistance > 0) {
    const point = add(origin, scale(ray, planeDistance));
    const fade = Math.max(0, 1 - (planeDistance / PLANE_FADE_DISTANCE));
    const grid = (Math.floor(point[0] * PLANE_GRID_SCALE) + Math.floor(point[2] * PLANE_GRID_SCALE)) % 2 === 0;
    if (fade > PLANE_MIN_FADE) {
      const floorColor = grid ? colors.floorLight : colors.floorDark;
      return {
        on: true,
        fgRGB: mixColor(colors.surface, floorColor, fade),
        bgRGB: colors.surface,
      };
    }
  }

  const background = scaleColor(colors.surface, SKY_TINT);
  return {
    on: false,
    fgRGB: background,
    bgRGB: background,
  };
}

function reflectedEnvironmentColor(
  point: Vector3,
  ray: Vector3,
  colors: TitleSceneMaterialColors,
): Color3 {
  const planeDistance = -point[1] / ray[1];
  if (planeDistance > 0) {
    const reflectedPoint = add(point, scale(ray, planeDistance));
    const fade = Math.max(0, 1 - (planeDistance / PLANE_FADE_DISTANCE));
    const grid = (Math.floor(reflectedPoint[0] * PLANE_GRID_SCALE) + Math.floor(reflectedPoint[2] * PLANE_GRID_SCALE)) % 2 === 0;
    const floorColor = grid ? colors.floorLight : colors.floorDark;
    return scaleColor(mixColor(colors.surface, floorColor, fade), SURFACE_REFLECTION_TINT);
  }

  return mixColor(scaleColor(colors.surface, SKY_TINT), colors.muted, Math.max(0, ray[1]));
}

function logoSampleAt(
  x: number,
  y: number,
  bounds: LogoBounds,
  mask: readonly (readonly number[])[],
  colors: TitleSceneMaterialColors,
): BrailleShaderSample | undefined {
  if (bounds.width <= 0 || bounds.height <= 0 || x < bounds.x || y < bounds.y) {
    return undefined;
  }
  if (x >= bounds.x + bounds.width || y >= bounds.y + bounds.height) {
    return undefined;
  }

  const logoX = Math.floor((x - bounds.x) * (JEDIT_LOGO_WIDTH / bounds.width));
  const logoY = Math.floor((y - bounds.y) * (JEDIT_LOGO_HEIGHT / bounds.height));
  if (!logoMaskBit(mask, logoX, logoY)) {
    return undefined;
  }

  const ratio = (x - bounds.x) / Math.max(1, bounds.width - 1);
  return {
    on: true,
    fgRGB: mixColor(colors.accent, colors.info, ratio),
    bgRGB: colors.surface,
    modifiers: [JEDIT_TEXT_MODIFIER.Bold],
  };
}

function orderedFloorMaterialColors(
  first: Color3,
  second: Color3,
): { readonly dark: Color3; readonly light: Color3 } {
  return colorLuminance(first) <= colorLuminance(second)
    ? { dark: first, light: second }
    : { dark: second, light: first };
}

function colorLuminance(color: Color3): number {
  return (color[0] * LUMINANCE_RED_WEIGHT)
    + (color[1] * LUMINANCE_GREEN_WEIGHT)
    + (color[2] * LUMINANCE_BLUE_WEIGHT);
}

function titleLogoBounds(screenWidth: number, screenHeight: number): LogoBounds {
  const maxWidth = Math.max(1, Math.floor(screenWidth * LOGO_WIDTH_RATIO));
  const maxHeight = Math.max(1, Math.floor(screenHeight * LOGO_MAX_HEIGHT_RATIO));
  const naturalHeight = Math.max(1, Math.floor(maxWidth * (JEDIT_LOGO_HEIGHT / JEDIT_LOGO_WIDTH)));
  const height = Math.min(maxHeight, naturalHeight);
  const width = Math.min(maxWidth, Math.max(1, Math.floor(height * (JEDIT_LOGO_WIDTH / JEDIT_LOGO_HEIGHT))));
  return {
    x: Math.floor((screenWidth - width) / 2),
    y: Math.floor((screenHeight - height) / 2),
    width,
    height,
  };
}

function logoMaskBit(mask: readonly (readonly number[])[], x: number, y: number): boolean {
  if (x < 0 || x >= JEDIT_LOGO_WIDTH || y < 0 || y >= JEDIT_LOGO_HEIGHT) {
    return false;
  }
  const row = mask[y];
  return row != null && (row[Math.floor(x / 8)]! & (1 << (7 - (x % 8)))) !== 0;
}

function decodeLogoMask(): readonly (readonly number[])[] {
  return JEDIT_LOGO_MASK.map((row) => {
    const bytes: number[] = [];
    for (let index = 0; index < row.length; index += 4) {
      bytes.push(parseInt(row.slice(index + 2, index + 4), 16));
    }
    return bytes;
  });
}

function nearestSphereHit(origin: Vector3, ray: Vector3, spheres: readonly Sphere[]) {
  let nearest: { readonly sphere: Sphere; readonly distance: number } | undefined;
  for (const sphere of spheres) {
    const distance = intersectSphere(origin, ray, sphere.position, sphere.radius);
    if (distance > 0 && (nearest == null || distance < nearest.distance)) {
      nearest = { sphere, distance };
    }
  }
  return nearest;
}

function mixColor(from: Color3, to: Color3, ratio: number): Color3 {
  const clamped = Math.max(0, Math.min(1, ratio));
  return [
    Math.round(from[0] + ((to[0] - from[0]) * clamped)),
    Math.round(from[1] + ((to[1] - from[1]) * clamped)),
    Math.round(from[2] + ((to[2] - from[2]) * clamped)),
  ];
}

function scaleColor(color: Color3, scalar: number): Color3 {
  return [
    Math.max(0, Math.min(255, Math.round(color[0] * scalar))),
    Math.max(0, Math.min(255, Math.round(color[1] * scalar))),
    Math.max(0, Math.min(255, Math.round(color[2] * scalar))),
  ];
}

function addColor(a: Color3, b: Color3): Color3 {
  return [
    Math.min(255, a[0] + b[0]),
    Math.min(255, a[1] + b[1]),
    Math.min(255, a[2] + b[2]),
  ];
}

function getRayDir(origin: Vector3, target: Vector3, screenCoords: Vector3): Vector3 {
  const forward = normalize(sub(target, origin));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  return normalize(add(add(scale(right, screenCoords[0]), scale(up, screenCoords[1])), scale(forward, screenCoords[2])));
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return [
    (a[1] * b[2]) - (a[2] * b[1]),
    (a[2] * b[0]) - (a[0] * b[2]),
    (a[0] * b[1]) - (a[1] * b[0]),
  ];
}

function normalize(vector: Vector3): Vector3 {
  const length = Math.sqrt((vector[0] * vector[0]) + (vector[1] * vector[1]) + (vector[2] * vector[2]));
  return length === 0 ? [0, 0, 0] : [vector[0] / length, vector[1] / length, vector[2] / length];
}

function dot(a: Vector3, b: Vector3): number {
  return (a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]);
}

function add(a: Vector3, b: Vector3): Vector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(vector: Vector3, scalar: number): Vector3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function reflect(ray: Vector3, normal: Vector3): Vector3 {
  return sub(ray, scale(normal, 2 * dot(ray, normal)));
}

function intersectSphere(origin: Vector3, ray: Vector3, position: Vector3, radius: number): number {
  const oc = sub(origin, position);
  const b = dot(oc, ray);
  const c = dot(oc, oc) - (radius * radius);
  const discriminant = (b * b) - c;
  return discriminant < 0 ? -1 : -b - Math.sqrt(discriminant);
}
