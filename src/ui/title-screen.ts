import { type Surface } from "@flyingrobots/bijou";
import {
  averagingAsciiCanvas,
  TITLE_ASCII_PALETTE,
  type TitleAsciiPalette,
} from "./averaging-ascii-canvas.js";
import {
  averagingBrailleCanvas,
  type BrailleShaderFn,
  type BrailleShaderSample,
  type RGB,
} from "./averaging-braille-canvas.js";
import { type JeditTheme } from "./jedit-theme.js";
import {
  flyingRobotsLogoCellBounds,
  paintFlyingRobotsLogo,
} from "./flyingrobots-logo.js";
import {
  generateTitleScene,
  nearestTitleSceneObjectHit,
  type TitleScene,
  type TitleSceneObject,
  type TitleSceneVector3,
} from "./title-scene.js";
import {
  nearestTitleEnvironmentSurfaceHit,
  titleSceneBackgroundColor,
  titleSceneLightDirection,
} from "./title-scene-environment.js";
import { paintTitleLogo, titleLogoCellBounds } from "./title-logo.js";
import type { TitleMesh } from "./title-mesh.js";
import {
  TITLE_SCREEN_TEXT_DIRECTION,
  titlePresentationSequence,
  type TitlePresentationSequence,
  type TitleScreenTextDirection,
} from "./title-presentation-sequence.js";
import {
  titleColorLuminance,
  titleSceneMaterialColors,
  type TitleSceneMaterialColors,
} from "./title-scene-material-colors.js";
import {
  TITLE_KEY_LIGHT_DIRECTION,
  TITLE_SCENE_CAMERA_HEIGHT,
  TITLE_SKY_TINT,
  titleFloorLightEffectsAtWithLight,
  titleObjectSurfaceColor,
  titleSceneSpotlightForCameraPlacement,
} from "./title-screen-optics.js";
import {
  TITLE_SCENE_DEFAULT_DIRECTOR_TIMELINE,
  titleSceneCameraAngleAt,
} from "./title-scene-director.js";
import type {
  TitleSceneRayContext,
  TitleSceneSampleOptions,
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
  readonly sceneSeed?: number;
  readonly mesh?: TitleMesh;
  readonly sceneOverride?: TitleScene;
  readonly renderMode?: TitleRenderMode;
  readonly asciiPalette?: TitleAsciiPalette;
  readonly textDirection?: TitleScreenTextDirection;
}

interface TitlePresentationLogoPaintOptions {
  readonly cols: number;
  readonly rows: number;
  readonly time: number;
  readonly colors: TitleSceneMaterialColors;
  readonly sequence: TitlePresentationSequence;
}

interface TitleSceneShaderOptions {
  readonly cols: number;
  readonly rows: number;
  readonly camAngle: number;
  readonly camRadius: number;
  readonly scene: TitleScene;
  readonly colors: TitleSceneMaterialColors;
}

const DEFAULT_CAMERA_RADIUS = 8.5;
const DEFAULT_TITLE_SCENE_SEED = 0.5;
export const TITLE_CAMERA_DRIFT_RATE =
  TITLE_SCENE_DEFAULT_DIRECTOR_TIMELINE.camera.driftRate;
const CAMERA_TARGET_Y = 0.78;
const BRAILLE_DITHER_MATRIX_SIZE = 4;
const BRAILLE_DITHER_DENOMINATOR =
  BRAILLE_DITHER_MATRIX_SIZE * BRAILLE_DITHER_MATRIX_SIZE;
const RGB_CHANNEL_MAX = 255;
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
  const {
    camAngle,
    camRadius = DEFAULT_CAMERA_RADIUS,
    sceneSeed = DEFAULT_TITLE_SCENE_SEED,
    mesh,
    sceneOverride,
    renderMode = TITLE_RENDER_MODE.Braille,
    asciiPalette = TITLE_ASCII_PALETTE.Dense,
    textDirection = TITLE_SCREEN_TEXT_DIRECTION.LeftToRight,
  } = options;
  const colors = titleSceneMaterialColors(theme);
  const scene = sceneOverride ?? generateTitleScene(sceneSeed, colors, mesh);
  const sequence = titlePresentationSequence(time, textDirection);
  const shader = titleSceneShader({
    cols,
    rows,
    camAngle,
    camRadius,
    scene,
    colors,
  });

  const surface =
    renderMode === TITLE_RENDER_MODE.Ascii
      ? averagingAsciiCanvas(cols, rows, shader, time, {
          palette: asciiPalette,
        })
      : averagingBrailleCanvas(cols, rows, shader, time);
  paintTitlePresentationLogos(surface, { cols, rows, time, colors, sequence });
  return surface;
}

function titleSceneShader(options: TitleSceneShaderOptions): BrailleShaderFn {
  return ({ u, v, time: frameTime }) =>
    sceneSampleAt({
      u,
      v,
      cols: options.cols,
      rows: options.rows,
      time: frameTime,
      camAngle: options.camAngle,
      camRadius: options.camRadius,
      spotlightCamera: options.scene.camera,
      objects: options.scene.objects,
      colors: options.colors,
      environment: options.scene.environment,
    });
}

function paintTitlePresentationLogos(
  surface: Surface,
  options: TitlePresentationLogoPaintOptions,
): void {
  paintFlyingRobotsLogo(
    surface,
    flyingRobotsLogoCellBounds(options.cols, options.rows),
    options.colors,
    options.time,
    {
      opacity: options.sequence.flyingRobotsOpacity,
    },
  );
  paintTitleLogo(
    surface,
    titleLogoCellBounds(options.cols, options.rows),
    options.colors,
    options.time,
    {
      opacity: options.sequence.titleOpacity,
      sheen: options.sequence.titleSheen,
    },
  );
}

function sceneSampleAt(options: TitleSceneSampleOptions): BrailleShaderSample {
  const context = titleSceneRayContext(options);
  const objectHit = nearestTitleSceneObjectHit(
    context.origin,
    context.ray,
    options.objects,
    undefined,
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
    options.camAngle,
    options.time,
  );
  const origin: Vector3 = [
    Math.sin(finalAngle) * options.camRadius,
    TITLE_SCENE_CAMERA_HEIGHT,
    Math.cos(finalAngle) * options.camRadius,
  ];
  const sphereCenter: Vector3 = [0, CAMERA_TARGET_Y, 0];
  return {
    origin,
    ray: getRayDir(origin, [0, CAMERA_TARGET_Y, 0], [rx, -ry - 0.2, 2.7]),
    lightDirection:
      titleSceneLightDirection(options.environment) ??
      TITLE_KEY_LIGHT_DIRECTION,
    spotlight: titleSceneSpotlightForCameraPlacement(
      options.spotlightCamera,
      sphereCenter,
      options.colors.spotlight,
    ),
  };
}

function objectSceneSample(
  options: TitleSceneSampleOptions,
  context: TitleSceneRayContext,
  objectHit: NonNullable<ReturnType<typeof nearestTitleSceneObjectHit>>,
): BrailleShaderSample {
  return {
    on: true,
    fgRGB: titleObjectSurfaceColor(options, context, objectHit),
    bgRGB: options.colors.surface,
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
  return {
    on: brailleSubpixelVisible(
      options.u,
      options.v,
      options.cols,
      options.rows,
      fgRGB,
    ),
    fgRGB,
    bgRGB: options.colors.surface,
  };
}

function environmentSceneForeground(
  options: TitleSceneSampleOptions,
  environmentHit: TitleEnvironmentSurfaceHit,
  effects: TitleFloorLightEffects,
): Color3 {
  const causticColor = scaleColor(options.colors.info, effects.causticStrength);
  return addColor(
    scaleColor(
      environmentHit.color,
      effects.shadowMultiplier * effects.contactShadowMultiplier,
    ),
    causticColor,
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
