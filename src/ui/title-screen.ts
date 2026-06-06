import { type Surface } from "@flyingrobots/bijou";
import {
  averagingAsciiCanvas,
  TITLE_ASCII_PALETTE,
  type TitleAsciiPalette,
} from "./averaging-ascii-canvas.js";
import {
  averagingBrailleCanvas,
  type AveragingBrailleCanvasOptions,
  type BrailleShaderFn,
  type BrailleShaderSample,
  type RGB,
} from "./averaging-braille-canvas.js";
import { type JeditTheme } from "./jedit-theme.js";
import {
  generateTitleScene,
  nearestTitleScenePrimaryObjectHit,
  type TitleScene,
  type TitleSceneCameraPlacement,
  type TitleSceneObject,
  type TitleSceneObjectHit,
  type TitleSceneVector3,
  type TitleMesh,
} from "./title-scene.js";
import {
  nearestTitleEnvironmentSurfaceHit,
  titleSceneBackgroundColor,
  titleSceneDayNightEnvironment,
  titleSceneLightDirection,
  type TitleSceneEnvironment,
} from "./title-scene-environment.js";
import {
  titleColorLuminance,
  titleSceneRenderMaterialColors,
  type TitleSceneMaterialColors,
} from "./title-scene-material-colors.js";
import {
  paintTitleScreenPresentation,
  type TitleScreenTextDirection,
} from "./title-screen-presentation.js";
import {
  TITLE_KEY_LIGHT_DIRECTION,
  TITLE_SKY_TINT,
  titleFloorLightEffectsAtWithLight,
  titleObjectSurfaceColor,
  titleSceneSpotlightForCameraPlacement,
} from "./title-screen-optics.js";
import {
  TITLE_SCENE_DEFAULT_DIRECTOR_TIMELINE,
  titleSceneCameraAngleAt,
} from "./title-scene-director.js";
import {
  TITLE_SCENE_DEFAULT_CAMERA_RADIUS,
  titleSceneCameraPosition,
  titleSceneCameraTarget,
} from "./title-scene-camera.js";
import {
  type TitleSceneRayContext,
  type TitleSceneSampleOptions,
  titleBackgroundRayStats,
  titleEnvironmentRayStats,
  titleObjectRayStats,
} from "./title-screen-sample.js";

type Vector3 = TitleSceneVector3;
type Color3 = RGB;
type TitleEnvironmentSurfaceHit = NonNullable<
  ReturnType<typeof nearestTitleEnvironmentSurfaceHit>
>;
export type TitleSceneSphere = TitleSceneObject;
export { flyingRobotsLogoCellBounds } from "./flyingrobots-logo.js";
export {
  titleSceneMaterialColors,
  titleSceneRenderMaterialColors,
  type TitleSceneMaterialColors,
} from "./title-scene-material-colors.js";
export { titleLogoCellBounds } from "./title-logo.js";
export { titleFloorLightEffectsAt } from "./title-screen-optics.js";

export const TITLE_RENDER_MODE = {
  Braille: "braille",
  Ascii: "ascii",
} as const;

export type TitleRenderMode =
  (typeof TITLE_RENDER_MODE)[keyof typeof TITLE_RENDER_MODE];
export {
  TITLE_ASCII_PALETTE,
  TITLE_ASCII_PALETTES,
  nextTitleAsciiPalette,
  type TitleAsciiPalette,
} from "./averaging-ascii-canvas.js";

export interface TitleFloorLightEffects {
  readonly shadowMultiplier: number;
  readonly contactShadowMultiplier: number;
  readonly causticStrength: number;
}

export interface TitleScreenRenderOptions {
  readonly camAngle: number;
  readonly camRadius?: number;
  readonly camera?: TitleSceneCameraPlacement;
  readonly sceneSeed?: number;
  readonly wallClockMs?: number;
  readonly mesh?: TitleMesh;
  readonly sceneOverride?: TitleScene;
  readonly renderMode?: TitleRenderMode;
  readonly asciiPalette?: TitleAsciiPalette;
  readonly textDirection?: TitleScreenTextDirection;
  readonly brailleSampling?: AveragingBrailleCanvasOptions;
  readonly suppressPresentation?: boolean;
}

interface TitleSceneShaderOptions {
  readonly cols: number;
  readonly rows: number;
  readonly camera: TitleSceneCameraPlacement;
  readonly scene: TitleScene;
  readonly environment: TitleSceneEnvironment | undefined;
  readonly colors: TitleSceneMaterialColors;
}

interface TitleSceneSurfaceOptions {
  readonly cols: number;
  readonly rows: number;
  readonly time: number;
  readonly renderMode: TitleRenderMode;
  readonly shader: BrailleShaderFn;
  readonly asciiPalette: TitleAsciiPalette;
  readonly brailleSampling?: AveragingBrailleCanvasOptions;
}

const DEFAULT_TITLE_SCENE_SEED = 0.5;
export const TITLE_CAMERA_DRIFT_RATE =
  TITLE_SCENE_DEFAULT_DIRECTOR_TIMELINE.camera.driftRate;
const BRAILLE_DITHER_MATRIX_SIZE = 4;
const BRAILLE_DITHER_DENOMINATOR =
  BRAILLE_DITHER_MATRIX_SIZE * BRAILLE_DITHER_MATRIX_SIZE;
const RGB_CHANNEL_MAX = 255;
const MIN_ENVIRONMENT_VISIBILITY = 0.06;
const BRAILLE_DITHER_MATRIX: readonly (readonly number[])[] = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export function renderTitleScreen(
  cols: number,
  rows: number,
  time: number,
  theme: JeditTheme,
  options: TitleScreenRenderOptions,
): Surface {
  const surface = renderTitleSceneSurface(
    titleSceneSurfaceOptions(cols, rows, time, theme, options),
  );
  if (options.suppressPresentation !== true) {
    paintTitleScreenPresentation(surface, {
      cols,
      rows,
      time,
      theme,
      textDirection: options.textDirection,
    });
  }
  return surface;
}

function titleSceneSurfaceOptions(
  cols: number,
  rows: number,
  time: number,
  theme: JeditTheme,
  options: TitleScreenRenderOptions,
): TitleSceneSurfaceOptions {
  const sceneColors = titleSceneRenderMaterialColors(theme);
  const scene =
    options.sceneOverride ??
    generateTitleScene(
      options.sceneSeed ?? DEFAULT_TITLE_SCENE_SEED,
      sceneColors,
      options.mesh,
    );
  const environment = titleSceneDayNightEnvironment(
    scene.environment,
    options.sceneSeed ?? DEFAULT_TITLE_SCENE_SEED,
    options.wallClockMs,
  );
  const shader = titleSceneShader({
    cols,
    rows,
    camera: titleSceneRenderCamera(options),
    scene,
    environment,
    colors: sceneColors,
  });
  return {
    cols,
    rows,
    time,
    renderMode: options.renderMode ?? TITLE_RENDER_MODE.Braille,
    shader,
    asciiPalette: options.asciiPalette ?? TITLE_ASCII_PALETTE.Dense,
    brailleSampling: options.brailleSampling,
  };
}

function renderTitleSceneSurface(options: TitleSceneSurfaceOptions): Surface {
  return options.renderMode === TITLE_RENDER_MODE.Ascii
    ? averagingAsciiCanvas(
        options.cols,
        options.rows,
        options.shader,
        options.time,
        {
          palette: options.asciiPalette,
        },
      )
    : averagingBrailleCanvas(
        options.cols,
        options.rows,
        options.shader,
        options.time,
        options.brailleSampling,
      );
}

function titleSceneShader(options: TitleSceneShaderOptions): BrailleShaderFn {
  return ({ u, v, time: frameTime }) =>
    sceneSampleAt({
      u,
      v,
      cols: options.cols,
      rows: options.rows,
      time: frameTime,
      camera: options.camera,
      spotlightCamera: options.scene.camera,
      objects: options.scene.objects,
      colors: options.colors,
      environment: options.environment,
    });
}

function titleSceneRenderCamera(
  options: TitleScreenRenderOptions,
): TitleSceneCameraPlacement {
  return (
    options.camera ?? {
      angle: options.camAngle,
      radius: options.camRadius ?? TITLE_SCENE_DEFAULT_CAMERA_RADIUS,
    }
  );
}

function sceneSampleAt(options: TitleSceneSampleOptions): BrailleShaderSample {
  const context = titleSceneRayContext(options);
  const objectHit = nearestTitleScenePrimaryObjectHit(
    context.origin,
    context.ray,
    options.objects,
    options.time,
  );
  const environmentHit = nearestTitleEnvironmentSurfaceHit(
    context.origin,
    context.ray,
    options.environment,
    options.colors,
  );

  if (
    objectHit != null &&
    (environmentHit == null || objectHit.distance < environmentHit.distance)
  ) {
    return objectSceneSample(options, context, objectHit);
  }

  if (environmentHit != null) {
    return environmentSceneSample(options, context, environmentHit);
  }

  return backgroundSceneSample(options);
}

function backgroundSceneSample(
  options: TitleSceneSampleOptions,
): BrailleShaderSample {
  const background = scaleColor(
    titleSceneBackgroundColor(options.environment, options.colors),
    TITLE_SKY_TINT,
  );
  return {
    on: false,
    fgRGB: background,
    bgRGB: background,
    ...titleBackgroundRayStats(),
  };
}

function titleSceneRayContext(
  options: TitleSceneSampleOptions,
): TitleSceneRayContext {
  const aspect = options.cols / Math.max(1, options.rows);
  const rx = (options.u * 2 - 1) * aspect;
  const ry = options.v * 2 - 1;
  const finalAngle = titleSceneCameraAngleAt(
    TITLE_SCENE_DEFAULT_DIRECTOR_TIMELINE,
    options.camera.angle,
    options.time,
  );
  const renderCamera = { ...options.camera, angle: finalAngle };
  const origin = titleSceneCameraPosition(renderCamera);
  const target = titleSceneCameraTarget(renderCamera);
  return {
    origin,
    ray: getRayDir(origin, target, [rx, -ry - 0.2, 2.7]),
    lightDirection:
      titleSceneLightDirection(options.environment) ??
      TITLE_KEY_LIGHT_DIRECTION,
    spotlight: titleSceneSpotlightForCameraPlacement(
      options.spotlightCamera,
      target,
      options.colors.spotlight,
    ),
  };
}

function objectSceneSample(
  options: TitleSceneSampleOptions,
  context: TitleSceneRayContext,
  objectHit: TitleSceneObjectHit,
): BrailleShaderSample {
  return {
    on: true,
    fgRGB: titleObjectSurfaceColor(options, context, objectHit),
    bgRGB: options.colors.surface,
    ...titleObjectRayStats(objectHit.object),
  };
}

function environmentSceneSample(
  options: TitleSceneSampleOptions,
  context: TitleSceneRayContext,
  environmentHit: TitleEnvironmentSurfaceHit,
): BrailleShaderSample {
  const effects = environmentSceneLightEffects(
    options,
    context,
    environmentHit,
  );
  const fgRGB = environmentSceneForeground(options, environmentHit, effects);
  const bgRGB = environmentSceneBackground(options, environmentHit);
  return {
    on: environmentHit.visibility >= MIN_ENVIRONMENT_VISIBILITY &&
      brailleSubpixelVisible(
        options.u,
        options.v,
        options.cols,
        options.rows,
        fgRGB,
    ),
    fgRGB,
    bgRGB,
    ...titleEnvironmentRayStats(
      environmentHit,
      effects,
      options.objects.length,
    ),
  };
}

function environmentSceneForeground(
  options: TitleSceneSampleOptions,
  environmentHit: TitleEnvironmentSurfaceHit,
  effects: TitleFloorLightEffects,
): Color3 {
  const causticColor = scaleColor(options.colors.info, effects.causticStrength);
  const litColor = addColor(
    scaleColor(
      environmentHit.color,
      effects.shadowMultiplier * effects.contactShadowMultiplier,
    ),
    causticColor,
  );
  return mixColor(
    titleSceneBackgroundColor(options.environment, options.colors),
    litColor,
    environmentHit.visibility,
  );
}

function environmentSceneBackground(
  options: TitleSceneSampleOptions,
  environmentHit: TitleEnvironmentSurfaceHit,
): Color3 {
  return mixColor(
    titleSceneBackgroundColor(options.environment, options.colors),
    options.colors.surface,
    environmentHit.visibility,
  );
}

function environmentSceneLightEffects(
  options: TitleSceneSampleOptions,
  context: TitleSceneRayContext,
  environmentHit: TitleEnvironmentSurfaceHit,
): TitleFloorLightEffects {
  return environmentHit.receivesFloorEffects
    ? titleFloorLightEffectsAtWithLight(
        environmentHit.point,
        options.objects,
        options.time,
        context.lightDirection,
      )
    : { shadowMultiplier: 1, contactShadowMultiplier: 1, causticStrength: 0 };
}

function brailleSubpixelVisible(
  u: number,
  v: number,
  cols: number,
  rows: number,
  color: Color3,
): boolean {
  const x = Math.floor(u * cols * 2) % BRAILLE_DITHER_MATRIX_SIZE;
  const y = Math.floor(v * rows * 4) % BRAILLE_DITHER_MATRIX_SIZE;
  const threshold =
    (BRAILLE_DITHER_MATRIX[y]![x]! + 0.5) / BRAILLE_DITHER_DENOMINATOR;
  return titleColorLuminance(color) / RGB_CHANNEL_MAX >= threshold;
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

function mixColor(from: Color3, to: Color3, ratio: number): Color3 {
  const clamped = Math.max(0, Math.min(1, ratio));
  return [
    Math.round(from[0] + (to[0] - from[0]) * clamped),
    Math.round(from[1] + (to[1] - from[1]) * clamped),
    Math.round(from[2] + (to[2] - from[2]) * clamped),
  ];
}

function getRayDir(
  origin: Vector3,
  target: Vector3,
  screenCoords: Vector3,
): Vector3 {
  const forward = normalize(sub(target, origin));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  return normalize(
    add(
      add(scale(right, screenCoords[0]), scale(up, screenCoords[1])),
      scale(forward, screenCoords[2]),
    ),
  );
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(vector: Vector3): Vector3 {
  const length = Math.sqrt(
    vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2],
  );
  return length === 0
    ? [0, 0, 0]
    : [vector[0] / length, vector[1] / length, vector[2] / length];
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
