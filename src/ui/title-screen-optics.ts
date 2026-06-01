import {
  intersectsTitleSceneObjectAlongRay,
  nearestTitleSceneObjectHit,
  titleSceneObjectFootprintCenter,
  type TitleSceneObject,
  type TitleSceneVector3,
} from './title-scene.js';
import {
  nearestTitleEnvironmentSurfaceHit,
  titleSceneBackgroundColor,
  type TitleSceneEnvironment,
} from './title-scene-environment.js';
import type { TitleFloorLightEffects, TitleSceneMaterialColors } from './title-screen.js';
import type { ReflectedEnvironmentColorOptions, TitleSceneRayContext, TitleSceneSampleOptions } from './title-screen-sample.js';
import type { TitleSceneSpotlight } from './title-screen-sample.js';

type Vector3 = TitleSceneVector3;
type Color3 = readonly [number, number, number];

interface TitleObjectSurfaceHit {
  readonly object: TitleSceneObject;
  readonly distance: number;
  readonly normal: Vector3;
}

interface ShadedObjectColorOptions {
  readonly objectHit: { readonly object: TitleSceneObject; readonly normal: Vector3 };
  readonly point: Vector3;
  readonly ray: Vector3;
  readonly colors: TitleSceneMaterialColors;
  readonly environment: TitleSceneEnvironment | undefined;
  readonly lightDirection: Vector3;
  readonly spotlight: TitleSceneSpotlight;
}

const LIGHT_AMBIENT = 0.24;
const LIGHT_DIFFUSE = 0.76;
export const TITLE_KEY_LIGHT_DIRECTION: Vector3 = normalize([-1.3, 2.8, -1.7]);
export const TITLE_SKY_TINT = 1.08;
export const TITLE_SPOTLIGHT_CAMERA_TO_SPHERE_RATIO = 0.64;
const SPECULAR_POWER = 28;
const SPECULAR_STRENGTH = 0.52;
const SPOTLIGHT_HEIGHT_ABOVE_TARGET = 4.6;
const SPOTLIGHT_INTENSITY = 1.65;
const SPOTLIGHT_INNER_CONE_COSINE = 0.96;
const SPOTLIGHT_OUTER_CONE_COSINE = 0.82;
const SPOTLIGHT_EDGE_POWER = 1.45;
const SPOTLIGHT_MIN_SURFACE_RESPONSE = 0.32;
const RIM_LIGHT_POWER = 2.2;
const RIM_LIGHT_STRENGTH = 0.74;
const REFLECTION_EDGE_BIAS = 0.28;
const REFLECTION_FRESNEL_POWER = 3;
const MIRROR_REFLECTIVITY_THRESHOLD = 0.95;
const MIRROR_REFLECTION_AMOUNT = 1;
const REFLECTION_OBJECT_TINT = 1.18;
const SURFACE_REFLECTION_TINT = 0.72;
const REFRACTION_RAY_BIAS = 0.04;
const REFRACTION_FRESNEL_LOSS = 0.65;
const REFRACTION_TINT = 1.08;
const AIR_REFRACTIVE_INDEX = 1;
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
const NO_LIGHT: Color3 = [0, 0, 0];

export function titleSceneSpotlightAt(
  cameraStart: Vector3,
  sphereCenter: Vector3,
  color: Color3,
): TitleSceneSpotlight {
  const target = mixVector(cameraStart, sphereCenter, TITLE_SPOTLIGHT_CAMERA_TO_SPHERE_RATIO);
  const source = add(target, [0, SPOTLIGHT_HEIGHT_ABOVE_TARGET, 0]);
  return {
    source,
    target,
    direction: normalize(sub(target, source)),
    color,
    intensity: SPOTLIGHT_INTENSITY,
    innerConeCosine: SPOTLIGHT_INNER_CONE_COSINE,
    outerConeCosine: SPOTLIGHT_OUTER_CONE_COSINE,
  };
}

export function titleSceneSpotlightStrengthAt(point: Vector3, spotlight: TitleSceneSpotlight): number {
  const coneAlignment = dot(normalize(sub(point, spotlight.source)), spotlight.direction);
  if (coneAlignment <= spotlight.outerConeCosine) {
    return 0;
  }
  const range = spotlight.innerConeCosine - spotlight.outerConeCosine;
  const coneFade = Math.max(0, Math.min(1, (coneAlignment - spotlight.outerConeCosine) / range));
  return Math.pow(coneFade, SPOTLIGHT_EDGE_POWER);
}

export function titleObjectSurfaceColor(
  options: TitleSceneSampleOptions,
  context: TitleSceneRayContext,
  objectHit: TitleObjectSurfaceHit,
): Color3 {
  const normal = objectHit.normal;
  const point = add(context.origin, scale(context.ray, objectHit.distance));
  const fresnel = Math.pow(1 - Math.max(0, dot(scale(context.ray, -1), normal)), REFLECTION_FRESNEL_POWER);
  const reflectionColor = objectReflectionColor(options, context, objectHit);
  const reflectionAmount = titleObjectReflectionAmount(objectHit.object.reflectivity, fresnel);
  const litColor = mixColor(
    shadedObjectColor({
      objectHit,
      point,
      ray: context.ray,
      colors: options.colors,
      environment: options.environment,
      lightDirection: context.lightDirection,
      spotlight: context.spotlight,
    }),
    reflectionColor,
    reflectionAmount,
  );
  const transmittedColor = mixColor(litColor, objectRefractionColor(options, context, objectHit), titleObjectTransmissionAmount(objectHit.object, fresnel));
  return addColor(
    transmittedColor,
    objectRimLightColor(objectHit, context.ray, options.colors, options.environment),
  );
}

export function titleFloorLightEffectsAt(
  point: Vector3,
  objects: readonly TitleSceneObject[],
  time: number,
): TitleFloorLightEffects {
  return titleFloorLightEffectsAtWithLight(point, objects, time, TITLE_KEY_LIGHT_DIRECTION);
}

export function titleFloorLightEffectsAtWithLight(
  point: Vector3,
  objects: readonly TitleSceneObject[],
  time: number,
  lightDirection: Vector3,
): TitleFloorLightEffects {
  return {
    shadowMultiplier: titleFloorPointInShadow(point, objects, lightDirection, time) ? FLOOR_SHADOW_MULTIPLIER : 1,
    contactShadowMultiplier: titleFloorContactShadowMultiplierAt(point, objects, time),
    causticStrength: titleFloorCausticStrengthAt(point, objects, time),
  };
}

export function reflectedEnvironmentColor(options: ReflectedEnvironmentColorOptions): Color3 {
  const {
    point,
    ray,
    colors,
    objects,
    time,
    ignoredObject,
    environment,
    lightDirection,
    spotlight,
  } = options;
  const objectHit = nearestTitleSceneObjectHit(point, ray, objects, ignoredObject, time);
  if (objectHit != null) {
    return scaleColor(shadedObjectColor({
      objectHit,
      point: add(point, scale(ray, objectHit.distance)),
      ray,
      colors,
      environment,
      lightDirection,
      spotlight,
    }), REFLECTION_OBJECT_TINT);
  }

  const environmentHit = nearestTitleEnvironmentSurfaceHit(point, ray, environment, colors);
  if (environmentHit != null) {
    const effects = environmentHit.receivesFloorEffects
      ? titleFloorLightEffectsAtWithLight(environmentHit.point, objects, time, lightDirection)
      : { shadowMultiplier: 1, contactShadowMultiplier: 1, causticStrength: 0 };
    const causticColor = scaleColor(colors.info, effects.causticStrength);
    return scaleColor(
      addColor(scaleColor(environmentHit.color, effects.shadowMultiplier * effects.contactShadowMultiplier), causticColor),
      SURFACE_REFLECTION_TINT,
    );
  }

  return mixColor(scaleColor(titleSceneBackgroundColor(environment, colors), TITLE_SKY_TINT), colors.muted, Math.max(0, ray[1]));
}

function objectReflectionColor(
  options: TitleSceneSampleOptions,
  context: TitleSceneRayContext,
  objectHit: TitleObjectSurfaceHit,
): Color3 {
  const point = add(context.origin, scale(context.ray, objectHit.distance));
  return reflectedEnvironmentColor({
    point: add(point, scale(objectHit.normal, SHADOW_RAY_BIAS)),
    ray: reflect(context.ray, objectHit.normal),
    colors: options.colors,
    objects: options.objects,
    time: options.time,
    ignoredObject: objectHit.object,
    environment: options.environment,
    lightDirection: context.lightDirection,
    spotlight: context.spotlight,
  });
}

function objectRefractionColor(
  options: TitleSceneSampleOptions,
  context: TitleSceneRayContext,
  objectHit: TitleObjectSurfaceHit,
): Color3 {
  if ((objectHit.object.transparency ?? 0) <= 0) {
    return options.colors.surface;
  }
  const refractedRay = refract(context.ray, objectHit.normal, objectHit.object.refractiveIndex ?? AIR_REFRACTIVE_INDEX)
    ?? reflect(context.ray, objectHit.normal);
  const point = add(context.origin, scale(context.ray, objectHit.distance));
  return scaleColor(reflectedEnvironmentColor({
    point: add(point, scale(refractedRay, REFRACTION_RAY_BIAS)),
    ray: refractedRay,
    colors: options.colors,
    objects: options.objects,
    time: options.time,
    ignoredObject: objectHit.object,
    environment: options.environment,
    lightDirection: context.lightDirection,
    spotlight: context.spotlight,
  }), REFRACTION_TINT);
}

function shadedObjectColor(options: ShadedObjectColorOptions): Color3 {
  const light = Math.max(0, dot(options.objectHit.normal, options.lightDirection));
  const intensity = (options.environment?.light?.ambient ?? LIGHT_AMBIENT)
    + (light * (options.environment?.light?.diffuse ?? LIGHT_DIFFUSE));
  const viewDirection = scale(options.ray, -1);
  const halfVector = normalize(add(options.lightDirection, viewDirection));
  const specular = Math.pow(Math.max(0, dot(options.objectHit.normal, halfVector)), SPECULAR_POWER)
    * (options.environment?.light?.specularStrength ?? SPECULAR_STRENGTH);
  return addColor(
    addColor(scaleColor(options.objectHit.object.color, intensity), scaleColor(options.colors.ink, specular)),
    objectSpotlightColor(options),
  );
}

function objectSpotlightColor(options: ShadedObjectColorOptions): Color3 {
  const beamStrength = titleSceneSpotlightStrengthAt(options.point, options.spotlight);
  if (beamStrength <= 0) {
    return NO_LIGHT;
  }
  const toLight = normalize(sub(options.spotlight.source, options.point));
  const surfaceResponse = Math.max(SPOTLIGHT_MIN_SURFACE_RESPONSE, dot(options.objectHit.normal, toLight));
  return scaleColor(options.spotlight.color, beamStrength * surfaceResponse * options.spotlight.intensity);
}

function objectRimLightColor(
  objectHit: { readonly object: TitleSceneObject; readonly normal: Vector3 },
  ray: Vector3,
  colors: TitleSceneMaterialColors,
  environment: TitleSceneEnvironment | undefined,
): Color3 {
  const viewAlignment = Math.max(0, dot(objectHit.normal, scale(ray, -1)));
  const strength = Math.pow(1 - viewAlignment, RIM_LIGHT_POWER) * (environment?.light?.rimStrength ?? RIM_LIGHT_STRENGTH);
  const color = objectHit.object.reflectivity >= MIRROR_REFLECTIVITY_THRESHOLD ? colors.ink : colors.info;
  return scaleColor(color, strength);
}

function titleObjectReflectionAmount(reflectivity: number, fresnel: number): number {
  if (reflectivity >= MIRROR_REFLECTIVITY_THRESHOLD) {
    return MIRROR_REFLECTION_AMOUNT;
  }
  return reflectivity * (REFLECTION_EDGE_BIAS + ((1 - REFLECTION_EDGE_BIAS) * fresnel));
}

function titleObjectTransmissionAmount(object: TitleSceneObject, fresnel: number): number {
  if (object.reflectivity >= MIRROR_REFLECTIVITY_THRESHOLD) {
    return 0;
  }
  return Math.max(0, Math.min(1, (object.transparency ?? 0) * (1 - (fresnel * REFRACTION_FRESNEL_LOSS))));
}

function titleFloorPointInShadow(
  point: Vector3,
  objects: readonly TitleSceneObject[],
  lightDirection: Vector3,
  time: number,
): boolean {
  const shadowOrigin = add(point, [0, SHADOW_RAY_BIAS, 0]);
  return objects.some((object) => intersectsTitleSceneObjectAlongRay(shadowOrigin, lightDirection, object, time));
}

function titleFloorCausticStrengthAt(
  point: Vector3,
  objects: readonly TitleSceneObject[],
  time: number,
): number {
  let strength = 0;
  for (const object of objects) {
    const causticIntensity = Math.max(object.reflectivity, object.transparency ?? 0);
    if (causticIntensity <= 0) {
      continue;
    }
    const footprintCenter = titleSceneObjectFootprintCenter(object, time);
    const dx = point[0] - footprintCenter[0];
    const dz = point[2] - footprintCenter[2];
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
    strength += falloff * wave * causticIntensity * CAUSTIC_STRENGTH;
  }
  return Math.min(MAX_CAUSTIC_STRENGTH, strength);
}

function titleFloorContactShadowMultiplierAt(
  point: Vector3,
  objects: readonly TitleSceneObject[],
  time: number,
): number {
  let strength = 0;
  for (const object of objects) {
    const footprintCenter = titleSceneObjectFootprintCenter(object, time);
    const dx = point[0] - footprintCenter[0];
    const dz = point[2] - footprintCenter[2];
    const falloff = Math.max(0, 1 - (Math.sqrt((dx * dx) + (dz * dz)) / (object.footprintRadius * CONTACT_SHADOW_RADIUS_SCALE)));
    strength = Math.max(strength, Math.pow(falloff, CONTACT_SHADOW_POWER) * CONTACT_SHADOW_STRENGTH);
  }
  return Math.max(CONTACT_SHADOW_MIN_MULTIPLIER, 1 - strength);
}

function refract(ray: Vector3, normal: Vector3, refractiveIndex: number): Vector3 | undefined {
  const clampedIndex = Math.max(AIR_REFRACTIVE_INDEX, refractiveIndex);
  const cosIncident = Math.max(-1, Math.min(1, dot(ray, normal)));
  const entering = cosIncident < 0;
  const orientedNormal = entering ? normal : scale(normal, -1);
  const eta = entering ? AIR_REFRACTIVE_INDEX / clampedIndex : clampedIndex / AIR_REFRACTIVE_INDEX;
  const cosTheta = entering ? -cosIncident : cosIncident;
  const discriminant = 1 - ((eta * eta) * (1 - (cosTheta * cosTheta)));
  return discriminant < 0
    ? undefined
    : normalize(add(scale(ray, eta), scale(orientedNormal, (eta * cosTheta) - Math.sqrt(discriminant))));
}

function mixColor(from: Color3, to: Color3, ratio: number): Color3 {
  const clamped = Math.max(0, Math.min(1, ratio));
  return [
    Math.round(from[0] + ((to[0] - from[0]) * clamped)),
    Math.round(from[1] + ((to[1] - from[1]) * clamped)),
    Math.round(from[2] + ((to[2] - from[2]) * clamped)),
  ];
}

function mixVector(from: Vector3, to: Vector3, ratio: number): Vector3 {
  return [
    from[0] + ((to[0] - from[0]) * ratio),
    from[1] + ((to[1] - from[1]) * ratio),
    from[2] + ((to[2] - from[2]) * ratio),
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
