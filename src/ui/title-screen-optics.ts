import {
  nearestTitleSceneObjectHit,
  type TitleSceneCameraPlacement,
  type TitleSceneObject,
  type TitleSceneVector3,
} from "./title-scene.js";
import {
  TITLE_SCENE_DEFAULT_CAMERA_EYE_Y,
  titleSceneCameraPosition,
} from "./title-scene-camera.js";
import { titleFloorLightEffectsAtWithLight } from "./title-floor-light-effects.js";
export { titleFloorLightEffectsAtWithLight } from "./title-floor-light-effects.js";
import {
  nearestTitleEnvironmentSurfaceHit,
  titleSceneBackgroundColor,
  type TitleSceneEnvironment,
} from "./title-scene-environment.js";
import {
  add,
  addColor,
  dot,
  mixColor,
  mixVector,
  normalize,
  reflect,
  scale,
  scaleColor,
  sub,
  type TitleSceneColor3,
} from "./title-scene-math.js";
import type { TitleSceneMaterialColors } from "./title-scene-material-colors.js";
import type { TitleFloorLightEffects } from "./title-screen.js";
import type {
  ReflectedEnvironmentColorOptions,
  TitleSceneRayContext,
  TitleSceneSampleOptions,
} from "./title-screen-sample.js";
import type { TitleSceneSpotlight } from "./title-screen-sample.js";

type Vector3 = TitleSceneVector3;
type Color3 = TitleSceneColor3;
type TitleEnvironmentSurfaceHit = NonNullable<
  ReturnType<typeof nearestTitleEnvironmentSurfaceHit>
>;

interface TitleObjectSurfaceHit {
  readonly object: TitleSceneObject;
  readonly distance: number;
  readonly normal: Vector3;
}

interface ShadedObjectColorOptions {
  readonly objectHit: {
    readonly object: TitleSceneObject;
    readonly normal: Vector3;
  };
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
const NO_LIGHT: Color3 = [0, 0, 0];
export const TITLE_SCENE_CAMERA_HEIGHT = TITLE_SCENE_DEFAULT_CAMERA_EYE_Y;

export function titleSceneSpotlightAt(
  cameraStart: Vector3,
  sphereCenter: Vector3,
  color: Color3,
): TitleSceneSpotlight {
  const target = mixVector(
    cameraStart,
    sphereCenter,
    TITLE_SPOTLIGHT_CAMERA_TO_SPHERE_RATIO,
  );
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

export function titleSceneSpotlightForCameraPlacement(
  camera: TitleSceneCameraPlacement,
  sphereCenter: Vector3,
  color: Color3,
): TitleSceneSpotlight {
  return titleSceneSpotlightAt(
    titleSceneCameraPosition(camera),
    sphereCenter,
    color,
  );
}

export function titleSceneSpotlightStrengthAt(
  point: Vector3,
  spotlight: TitleSceneSpotlight,
): number {
  const coneAlignment = dot(
    normalize(sub(point, spotlight.source)),
    spotlight.direction,
  );
  if (coneAlignment <= spotlight.outerConeCosine) {
    return 0;
  }
  const range = spotlight.innerConeCosine - spotlight.outerConeCosine;
  const coneFade = Math.max(
    0,
    Math.min(1, (coneAlignment - spotlight.outerConeCosine) / range),
  );
  return Math.pow(coneFade, SPOTLIGHT_EDGE_POWER);
}

export function titleObjectSurfaceColor(
  options: TitleSceneSampleOptions,
  context: TitleSceneRayContext,
  objectHit: TitleObjectSurfaceHit,
): Color3 {
  const normal = objectHit.normal;
  const point = add(context.origin, scale(context.ray, objectHit.distance));
  const fresnel = Math.pow(
    1 - Math.max(0, dot(scale(context.ray, -1), normal)),
    REFLECTION_FRESNEL_POWER,
  );
  const litColor = titleObjectLitColor(
    options,
    context,
    objectHit,
    point,
    fresnel,
  );
  const transmittedColor = mixColor(
    litColor,
    objectRefractionColor(options, context, objectHit),
    titleObjectTransmissionAmount(objectHit.object, fresnel),
  );
  return addColor(
    transmittedColor,
    objectRimLightColor(
      objectHit,
      context.ray,
      options.colors,
      options.environment,
    ),
  );
}

function titleObjectLitColor(
  options: TitleSceneSampleOptions,
  context: TitleSceneRayContext,
  objectHit: TitleObjectSurfaceHit,
  point: Vector3,
  fresnel: number,
): Color3 {
  return mixColor(
    shadedObjectColor({
      objectHit,
      point,
      ray: context.ray,
      colors: options.colors,
      environment: options.environment,
      lightDirection: context.lightDirection,
      spotlight: context.spotlight,
    }),
    objectReflectionColor(options, context, objectHit),
    titleObjectReflectionAmount(objectHit.object.reflectivity, fresnel),
  );
}

export function titleFloorLightEffectsAt(
  point: Vector3,
  objects: readonly TitleSceneObject[],
  time: number,
): TitleFloorLightEffects {
  return titleFloorLightEffectsAtWithLight(
    point,
    objects,
    time,
    TITLE_KEY_LIGHT_DIRECTION,
  );
}

export function reflectedEnvironmentColor(
  options: ReflectedEnvironmentColorOptions,
): Color3 {
  const objectHit = nearestTitleSceneObjectHit(
    options.point,
    options.ray,
    options.objects,
    { ignoredObject: options.ignoredObject, time: options.time },
  );
  if (objectHit != null) {
    return reflectedObjectColor(options, objectHit);
  }

  const environmentHit = nearestTitleEnvironmentSurfaceHit(
    options.point,
    options.ray,
    options.environment,
    options.colors,
  );
  if (environmentHit != null) {
    return reflectedSurfaceColor(options, environmentHit);
  }

  return reflectedSkyColor(options);
}

function reflectedObjectColor(
  options: ReflectedEnvironmentColorOptions,
  objectHit: TitleObjectSurfaceHit,
): Color3 {
  return scaleColor(
    shadedObjectColor({
      objectHit,
      point: add(options.point, scale(options.ray, objectHit.distance)),
      ray: options.ray,
      colors: options.colors,
      environment: options.environment,
      lightDirection: options.lightDirection,
      spotlight: options.spotlight,
    }),
    REFLECTION_OBJECT_TINT,
  );
}

function reflectedSurfaceColor(
  options: ReflectedEnvironmentColorOptions,
  environmentHit: TitleEnvironmentSurfaceHit,
): Color3 {
  const effects = environmentHit.receivesFloorEffects
    ? titleFloorLightEffectsAtWithLight(
        environmentHit.point,
        options.objects,
        options.time,
        options.lightDirection,
      )
    : { shadowMultiplier: 1, contactShadowMultiplier: 1, causticStrength: 0 };
  const causticColor = scaleColor(options.colors.info, effects.causticStrength);
  return scaleColor(
    addColor(
      scaleColor(
        environmentHit.color,
        effects.shadowMultiplier * effects.contactShadowMultiplier,
      ),
      causticColor,
    ),
    SURFACE_REFLECTION_TINT,
  );
}

function reflectedSkyColor(options: ReflectedEnvironmentColorOptions): Color3 {
  return mixColor(
    scaleColor(
      titleSceneBackgroundColor(options.environment, options.colors),
      TITLE_SKY_TINT,
    ),
    options.colors.muted,
    Math.max(0, options.ray[1]),
  );
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
  const refractedRay =
    refract(
      context.ray,
      objectHit.normal,
      objectHit.object.refractiveIndex ?? AIR_REFRACTIVE_INDEX,
    ) ?? reflect(context.ray, objectHit.normal);
  const point = add(context.origin, scale(context.ray, objectHit.distance));
  return scaleColor(
    reflectedEnvironmentColor({
      point: add(point, scale(refractedRay, REFRACTION_RAY_BIAS)),
      ray: refractedRay,
      colors: options.colors,
      objects: options.objects,
      time: options.time,
      ignoredObject: objectHit.object,
      environment: options.environment,
      lightDirection: context.lightDirection,
      spotlight: context.spotlight,
    }),
    REFRACTION_TINT,
  );
}

function shadedObjectColor(options: ShadedObjectColorOptions): Color3 {
  const light = Math.max(
    0,
    dot(options.objectHit.normal, options.lightDirection),
  );
  const intensity =
    (options.environment?.light?.ambient ?? LIGHT_AMBIENT) +
    light * (options.environment?.light?.diffuse ?? LIGHT_DIFFUSE);
  const viewDirection = scale(options.ray, -1);
  const halfVector = normalize(add(options.lightDirection, viewDirection));
  const specular =
    Math.pow(
      Math.max(0, dot(options.objectHit.normal, halfVector)),
      SPECULAR_POWER,
    ) * (options.environment?.light?.specularStrength ?? SPECULAR_STRENGTH);
  return addColor(
    addColor(
      scaleColor(options.objectHit.object.color, intensity),
      scaleColor(options.colors.ink, specular),
    ),
    objectSpotlightColor(options),
  );
}

function objectSpotlightColor(options: ShadedObjectColorOptions): Color3 {
  const beamStrength = titleSceneSpotlightStrengthAt(
    options.point,
    options.spotlight,
  );
  if (beamStrength <= 0) {
    return NO_LIGHT;
  }
  const toLight = normalize(sub(options.spotlight.source, options.point));
  const surfaceResponse = Math.max(
    SPOTLIGHT_MIN_SURFACE_RESPONSE,
    dot(options.objectHit.normal, toLight),
  );
  return scaleColor(
    options.spotlight.color,
    beamStrength * surfaceResponse * options.spotlight.intensity,
  );
}

function objectRimLightColor(
  objectHit: { readonly object: TitleSceneObject; readonly normal: Vector3 },
  ray: Vector3,
  colors: TitleSceneMaterialColors,
  environment: TitleSceneEnvironment | undefined,
): Color3 {
  const viewAlignment = Math.max(0, dot(objectHit.normal, scale(ray, -1)));
  const strength =
    Math.pow(1 - viewAlignment, RIM_LIGHT_POWER) *
    (environment?.light?.rimStrength ?? RIM_LIGHT_STRENGTH);
  const color =
    objectHit.object.reflectivity >= MIRROR_REFLECTIVITY_THRESHOLD
      ? colors.ink
      : colors.info;
  return scaleColor(color, strength);
}

function titleObjectReflectionAmount(
  reflectivity: number,
  fresnel: number,
): number {
  if (reflectivity >= MIRROR_REFLECTIVITY_THRESHOLD) {
    return MIRROR_REFLECTION_AMOUNT;
  }
  return (
    reflectivity * (REFLECTION_EDGE_BIAS + (1 - REFLECTION_EDGE_BIAS) * fresnel)
  );
}

function titleObjectTransmissionAmount(
  object: TitleSceneObject,
  fresnel: number,
): number {
  if (object.reflectivity >= MIRROR_REFLECTIVITY_THRESHOLD) {
    return 0;
  }
  return Math.max(
    0,
    Math.min(
      1,
      (object.transparency ?? 0) * (1 - fresnel * REFRACTION_FRESNEL_LOSS),
    ),
  );
}

function refract(
  ray: Vector3,
  normal: Vector3,
  refractiveIndex: number,
): Vector3 | undefined {
  const clampedIndex = Math.max(AIR_REFRACTIVE_INDEX, refractiveIndex);
  const cosIncident = Math.max(-1, Math.min(1, dot(ray, normal)));
  const entering = cosIncident < 0;
  const orientedNormal = entering ? normal : scale(normal, -1);
  const eta = entering
    ? AIR_REFRACTIVE_INDEX / clampedIndex
    : clampedIndex / AIR_REFRACTIVE_INDEX;
  const cosTheta = entering ? -cosIncident : cosIncident;
  const discriminant = 1 - eta * eta * (1 - cosTheta * cosTheta);
  return discriminant < 0
    ? undefined
    : normalize(
        add(
          scale(ray, eta),
          scale(orientedNormal, eta * cosTheta - Math.sqrt(discriminant)),
        ),
      );
}
