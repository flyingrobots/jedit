import type { BrailleShaderSample } from "./averaging-braille-canvas.js";
import type { TitleEnvironmentSurfaceHit } from "./title-scene-environment.js";
import type { TitleSceneEnvironment } from "./title-scene-environment.js";
import type { TitleSceneMaterialColors } from "./title-scene-material-colors.js";
import type {
  TitleSceneCameraPlacement,
  TitleSceneObject,
  TitleSceneVector3,
} from "./title-scene.js";
import type { TitleFloorLightEffects } from "./title-screen.js";

type TitleSampleRayStats = Pick<
  BrailleShaderSample,
  "rayCount" | "rayIntersectionCount"
>;

const TITLE_PRIMARY_SAMPLE_RAY_COUNT = 1;
const TITLE_KNOWN_INTERSECTION_COUNT = 1;
const TITLE_NO_INTERSECTION_COUNT = 0;
const TITLE_REFLECTION_SAMPLE_RAY_COUNT = 1;
const TITLE_REFRACTION_SAMPLE_RAY_COUNT = 1;
const TITLE_SHADOW_RAY_PER_OBJECT = 1;
const TITLE_NO_SHADOW_MULTIPLIER = 1;

export function titleBackgroundRayStats(): TitleSampleRayStats {
  return {
    rayCount: TITLE_PRIMARY_SAMPLE_RAY_COUNT,
    rayIntersectionCount: TITLE_NO_INTERSECTION_COUNT,
  };
}

export function titleObjectRayStats(
  object: TitleSceneObject,
): TitleSampleRayStats {
  const refractionRayCount =
    (object.transparency ?? 0) > 0 ? TITLE_REFRACTION_SAMPLE_RAY_COUNT : 0;
  return {
    rayCount:
      TITLE_PRIMARY_SAMPLE_RAY_COUNT +
      TITLE_REFLECTION_SAMPLE_RAY_COUNT +
      refractionRayCount,
    rayIntersectionCount: TITLE_KNOWN_INTERSECTION_COUNT,
  };
}

export function titleEnvironmentRayStats(
  hit: TitleEnvironmentSurfaceHit,
  effects: TitleFloorLightEffects,
  objectCount: number,
): TitleSampleRayStats {
  const shadowRayCount = hit.receivesFloorEffects
    ? objectCount * TITLE_SHADOW_RAY_PER_OBJECT
    : 0;
  return {
    rayCount: TITLE_PRIMARY_SAMPLE_RAY_COUNT + shadowRayCount,
    rayIntersectionCount:
      TITLE_KNOWN_INTERSECTION_COUNT + shadowIntersectionCount(effects),
  };
}

function shadowIntersectionCount(effects: TitleFloorLightEffects): number {
  return effects.shadowMultiplier < TITLE_NO_SHADOW_MULTIPLIER
    ? TITLE_KNOWN_INTERSECTION_COUNT
    : TITLE_NO_INTERSECTION_COUNT;
}

export interface TitleSceneSampleOptions {
  readonly u: number;
  readonly v: number;
  readonly cols: number;
  readonly rows: number;
  readonly time: number;
  readonly camera: TitleSceneCameraPlacement;
  readonly spotlightCamera: TitleSceneCameraPlacement;
  readonly objects: readonly TitleSceneObject[];
  readonly colors: TitleSceneMaterialColors;
  readonly environment: TitleSceneEnvironment | undefined;
}

export interface TitleSceneRayContext {
  readonly origin: TitleSceneVector3;
  readonly ray: TitleSceneVector3;
  readonly lightDirection: TitleSceneVector3;
  readonly spotlight: TitleSceneSpotlight;
}

export interface ReflectedEnvironmentColorOptions {
  readonly point: TitleSceneVector3;
  readonly ray: TitleSceneVector3;
  readonly colors: TitleSceneMaterialColors;
  readonly objects: readonly TitleSceneObject[];
  readonly time: number;
  readonly ignoredObject: TitleSceneObject;
  readonly environment: TitleSceneEnvironment | undefined;
  readonly lightDirection: TitleSceneVector3;
  readonly spotlight: TitleSceneSpotlight;
}

export interface TitleSceneSpotlight {
  readonly source: TitleSceneVector3;
  readonly target: TitleSceneVector3;
  readonly direction: TitleSceneVector3;
  readonly color: readonly [number, number, number];
  readonly intensity: number;
  readonly innerConeCosine: number;
  readonly outerConeCosine: number;
}
