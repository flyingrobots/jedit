import { type Surface } from '@flyingrobots/bijou';

import { averagingBrailleCanvas, type BrailleShaderFn, type BrailleShaderSample, type RGB } from './averaging-braille-canvas.js';
import { type JeditTheme } from './jedit-theme.js';
import {
  generateTitleScene,
  intersectsTitleSceneObjectAlongRay,
  nearestTitleSceneObjectHit,
  type TitleSceneObject,
  type TitleSceneVector3,
} from './title-scene.js';
import { paintTitleLogo, titleLogoCellBounds } from './title-logo.js';
import type { TitleMesh } from './title-mesh.js';

type Vector3 = TitleSceneVector3;
type Color3 = RGB;
export type TitleSceneSphere = TitleSceneObject;
export { titleLogoCellBounds } from './title-logo.js';
export interface TitleFloorLightEffects {
  readonly shadowMultiplier: number;
  readonly contactShadowMultiplier: number;
  readonly causticStrength: number;
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

const DEFAULT_CAMERA_RADIUS = 8.5;
const DEFAULT_TITLE_SCENE_SEED = 0.5;
const CAMERA_DRIFT_RATE = 0.005;
const CAMERA_HEIGHT = 2.65;
const CAMERA_TARGET_Y = 0.78;
const LIGHT_AMBIENT = 0.24;
const LIGHT_DIFFUSE = 0.76;
const KEY_LIGHT_DIRECTION: Vector3 = normalize([-1.3, 2.8, -1.7]);
const SPECULAR_POWER = 28;
const SPECULAR_STRENGTH = 0.52;
const RIM_LIGHT_POWER = 2.2;
const RIM_LIGHT_STRENGTH = 0.74;
const REFLECTION_EDGE_BIAS = 0.28;
const REFLECTION_FRESNEL_POWER = 3;
const MIRROR_REFLECTIVITY_THRESHOLD = 0.95;
const MIRROR_REFLECTION_AMOUNT = 1;
const REFLECTION_OBJECT_TINT = 1.18;
const PLANE_FADE_DISTANCE = 36;
const PLANE_MIN_FADE = 0.05;
const PLANE_GRID_SCALE = 0.7;
const SKY_TINT = 1.08;
const SURFACE_REFLECTION_TINT = 0.72;
const SHADOW_RAY_BIAS = 0.03;
const FLOOR_SHADOW_MULTIPLIER = 0.34;
const CONTACT_SHADOW_RADIUS_SCALE = 1.32;
const CONTACT_SHADOW_STRENGTH = 0.72;
const CONTACT_SHADOW_POWER = 1.75;
const CONTACT_SHADOW_MIN_MULTIPLIER = 0.18;
const CAUSTIC_RADIUS_SCALE = 2.4;
const CAUSTIC_WAVE_FREQUENCY = 3.1;
const CAUSTIC_WAVE_SECONDARY_FREQUENCY = 1.7;
const CAUSTIC_TIME_RATE = 0.9;
const CAUSTIC_STRENGTH = 0.45;
const MAX_CAUSTIC_STRENGTH = 0.42;
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
  sceneSeed = DEFAULT_TITLE_SCENE_SEED,
  mesh?: TitleMesh,
): Surface {
  const colors = titleSceneMaterialColors(theme);
  const scene = generateTitleScene(sceneSeed, colors, mesh);

  const shader: BrailleShaderFn = ({ u, v, time: frameTime }) => {
    return sceneSampleAt(u, v, cols, rows, frameTime, camAngle, camRadius, scene.objects, colors);
  };

  const surface = averagingBrailleCanvas(cols, rows, shader, time);
  paintTitleLogo(surface, titleLogoCellBounds(cols, rows), colors, time);
  return surface;
}

export function titleSceneMaterialColors(theme: JeditTheme): TitleSceneMaterialColors {
  const baseColors = fixedTitleSceneBaseColors(theme);
  const floorColors = orderedFloorMaterialColors(baseColors.ink, baseColors.muted);

  return {
    ...baseColors,
    floorDark: floorColors.dark,
    floorLight: floorColors.light,
  };
}

function fixedTitleSceneBaseColors(_theme: JeditTheme): Omit<TitleSceneMaterialColors, 'floorDark' | 'floorLight'> {
  return {
    accent: [224, 113, 63],
    info: [78, 195, 224],
    success: [112, 216, 167],
    ink: [222, 232, 232],
    muted: [55, 75, 88],
    surface: [5, 7, 12],
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
  objects: readonly TitleSceneObject[],
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
  const ray = getRayDir(origin, [0, CAMERA_TARGET_Y, 0], [rx, -ry - 0.2, 2.7]);
  const objectHit = nearestTitleSceneObjectHit(origin, ray, objects);
  const planeDistance = -origin[1] / ray[1];

  if (objectHit != null && (planeDistance <= 0 || objectHit.distance < planeDistance)) {
    const point = add(origin, scale(ray, objectHit.distance));
    const normal = objectHit.normal;
    const reflectionRay = reflect(ray, normal);
    const reflectionColor = reflectedEnvironmentColor(add(point, scale(normal, SHADOW_RAY_BIAS)), reflectionRay, colors, objects, time, objectHit.object);
    const fresnel = Math.pow(1 - Math.max(0, dot(scale(ray, -1), normal)), REFLECTION_FRESNEL_POWER);
    const reflectionAmount = titleObjectReflectionAmount(objectHit.object.reflectivity, fresnel);
    return {
      on: true,
      fgRGB: addColor(
        mixColor(shadedObjectColor(objectHit, ray, colors), reflectionColor, reflectionAmount),
        objectRimLightColor(objectHit, ray, colors),
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
      const effects = titleFloorLightEffectsAt(point, objects, time);
      const materialColor = mixColor(colors.surface, floorColor, fade);
      const causticColor = scaleColor(colors.info, effects.causticStrength * fade);
      return {
        on: true,
        fgRGB: addColor(scaleColor(materialColor, effects.shadowMultiplier * effects.contactShadowMultiplier), causticColor),
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

function titleObjectReflectionAmount(reflectivity: number, fresnel: number): number {
  if (reflectivity >= MIRROR_REFLECTIVITY_THRESHOLD) {
    return MIRROR_REFLECTION_AMOUNT;
  }
  return reflectivity * (REFLECTION_EDGE_BIAS + ((1 - REFLECTION_EDGE_BIAS) * fresnel));
}

function reflectedEnvironmentColor(
  point: Vector3,
  ray: Vector3,
  colors: TitleSceneMaterialColors,
  objects: readonly TitleSceneObject[],
  time: number,
  ignoredObject: TitleSceneObject,
): Color3 {
  const objectHit = nearestTitleSceneObjectHit(point, ray, objects, ignoredObject);
  if (objectHit != null) {
    return scaleColor(shadedObjectColor(objectHit, ray, colors), REFLECTION_OBJECT_TINT);
  }

  const planeDistance = -point[1] / ray[1];
  if (planeDistance > 0) {
    const reflectedPoint = add(point, scale(ray, planeDistance));
    const fade = Math.max(0, 1 - (planeDistance / PLANE_FADE_DISTANCE));
    const grid = (Math.floor(reflectedPoint[0] * PLANE_GRID_SCALE) + Math.floor(reflectedPoint[2] * PLANE_GRID_SCALE)) % 2 === 0;
    const floorColor = grid ? colors.floorLight : colors.floorDark;
    const effects = titleFloorLightEffectsAt(reflectedPoint, objects, time);
    const materialColor = mixColor(colors.surface, floorColor, fade);
    const causticColor = scaleColor(colors.info, effects.causticStrength * fade);
    return scaleColor(
      addColor(scaleColor(materialColor, effects.shadowMultiplier * effects.contactShadowMultiplier), causticColor),
      SURFACE_REFLECTION_TINT,
    );
  }

  return mixColor(scaleColor(colors.surface, SKY_TINT), colors.muted, Math.max(0, ray[1]));
}

function shadedObjectColor(
  objectHit: { readonly object: TitleSceneObject; readonly normal: Vector3 },
  ray: Vector3,
  colors: TitleSceneMaterialColors,
): Color3 {
  const light = Math.max(0, dot(objectHit.normal, KEY_LIGHT_DIRECTION));
  const intensity = LIGHT_AMBIENT + (light * LIGHT_DIFFUSE);
  const viewDirection = scale(ray, -1);
  const halfVector = normalize(add(KEY_LIGHT_DIRECTION, viewDirection));
  const specular = Math.pow(Math.max(0, dot(objectHit.normal, halfVector)), SPECULAR_POWER) * SPECULAR_STRENGTH;
  return addColor(scaleColor(objectHit.object.color, intensity), scaleColor(colors.ink, specular));
}

function objectRimLightColor(
  objectHit: { readonly object: TitleSceneObject; readonly normal: Vector3 },
  ray: Vector3,
  colors: TitleSceneMaterialColors,
): Color3 {
  const viewAlignment = Math.max(0, dot(objectHit.normal, scale(ray, -1)));
  const strength = Math.pow(1 - viewAlignment, RIM_LIGHT_POWER) * RIM_LIGHT_STRENGTH;
  const color = objectHit.object.reflectivity >= MIRROR_REFLECTIVITY_THRESHOLD ? colors.ink : colors.info;
  return scaleColor(color, strength);
}

export function titleFloorLightEffectsAt(
  point: Vector3,
  objects: readonly TitleSceneObject[],
  time: number,
): TitleFloorLightEffects {
  return {
    shadowMultiplier: titleFloorPointInShadow(point, objects) ? FLOOR_SHADOW_MULTIPLIER : 1,
    contactShadowMultiplier: titleFloorContactShadowMultiplierAt(point, objects),
    causticStrength: titleFloorCausticStrengthAt(point, objects, time),
  };
}

function titleFloorPointInShadow(point: Vector3, objects: readonly TitleSceneObject[]): boolean {
  const shadowOrigin = add(point, [0, SHADOW_RAY_BIAS, 0]);
  return objects.some((object) => intersectsTitleSceneObjectAlongRay(shadowOrigin, KEY_LIGHT_DIRECTION, object));
}

function titleFloorCausticStrengthAt(
  point: Vector3,
  objects: readonly TitleSceneObject[],
  time: number,
): number {
  let strength = 0;
  for (const object of objects) {
    if (object.reflectivity <= 0) {
      continue;
    }
    const dx = point[0] - object.position[0];
    const dz = point[2] - object.position[2];
    const distance = Math.sqrt((dx * dx) + (dz * dz));
    const radius = (object.footprintRadius ?? object.radius) * CAUSTIC_RADIUS_SCALE;
    const falloff = Math.max(0, 1 - (distance / radius));
    if (falloff <= 0) {
      continue;
    }
    const wave = (Math.sin(
      (dx * CAUSTIC_WAVE_FREQUENCY)
        + (dz * CAUSTIC_WAVE_SECONDARY_FREQUENCY)
        + (time * CAUSTIC_TIME_RATE),
    ) + 1) / 2;
    strength += falloff * wave * object.reflectivity * CAUSTIC_STRENGTH;
  }
  return Math.min(MAX_CAUSTIC_STRENGTH, strength);
}

function titleFloorContactShadowMultiplierAt(point: Vector3, objects: readonly TitleSceneObject[]): number {
  let strength = 0;
  for (const object of objects) {
    const dx = point[0] - object.position[0];
    const dz = point[2] - object.position[2];
    const falloff = Math.max(0, 1 - (Math.sqrt((dx * dx) + (dz * dz)) / (object.footprintRadius * CONTACT_SHADOW_RADIUS_SCALE)));
    strength = Math.max(strength, Math.pow(falloff, CONTACT_SHADOW_POWER) * CONTACT_SHADOW_STRENGTH);
  }
  return Math.max(CONTACT_SHADOW_MIN_MULTIPLIER, 1 - strength);
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
