import { type Surface } from '@flyingrobots/bijou';
import {
  averagingAsciiCanvas,
  TITLE_ASCII_PALETTE,
  type TitleAsciiPalette,
} from './averaging-ascii-canvas.js';
import { averagingBrailleCanvas, type BrailleShaderFn, type BrailleShaderSample, type RGB } from './averaging-braille-canvas.js';
import { type JeditTheme } from './jedit-theme.js';
import { flyingRobotsLogoCellBounds, paintFlyingRobotsLogo } from './flyingrobots-logo.js';
import {
  generateTitleScene,
  nearestTitleSceneObjectHit,
  type TitleScene,
  type TitleSceneObject,
  type TitleSceneVector3,
} from './title-scene.js';
import {
  nearestTitleEnvironmentSurfaceHit,
  titleSceneBackgroundColor,
  titleSceneLightDirection,
} from './title-scene-environment.js';
import { paintTitleLogo, titleLogoCellBounds } from './title-logo.js';
import type { TitleMesh } from './title-mesh.js';
import {
  TITLE_KEY_LIGHT_DIRECTION,
  TITLE_SKY_TINT,
  titleFloorLightEffectsAtWithLight,
  titleObjectSurfaceColor,
  titleSceneSpotlightAt,
} from './title-screen-optics.js';
import { titleLogoOpacityAt, type TitleLogoFadeTiming } from './title-logo-fade.js';
import type { TitleSceneRayContext, TitleSceneSampleOptions } from './title-screen-sample.js';

type Vector3 = TitleSceneVector3;
type Color3 = RGB;
export type TitleSceneSphere = TitleSceneObject;
export { flyingRobotsLogoCellBounds } from './flyingrobots-logo.js';
export { titleLogoCellBounds } from './title-logo.js';
export { TITLE_LOGO_OPACITY, titleLogoOpacityAt } from './title-logo-fade.js';
export { titleFloorLightEffectsAt } from './title-screen-optics.js';

export const TITLE_RENDER_MODE = {
  Braille: 'braille',
  Ascii: 'ascii',
} as const;

export type TitleRenderMode = typeof TITLE_RENDER_MODE[keyof typeof TITLE_RENDER_MODE];
export {
  TITLE_ASCII_PALETTE,
  TITLE_ASCII_PALETTES,
  nextTitleAsciiPalette,
  type TitleAsciiPalette,
} from './averaging-ascii-canvas.js';

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
  readonly spotlight: Color3;
}

export interface TitleScreenRenderOptions {
  readonly camAngle: number;
  readonly camRadius?: number;
  readonly sceneSeed?: number;
  readonly mesh?: TitleMesh;
  readonly sceneOverride?: TitleScene;
  readonly renderMode?: TitleRenderMode;
  readonly asciiPalette?: TitleAsciiPalette;
}

const DEFAULT_CAMERA_RADIUS = 8.5;
const DEFAULT_TITLE_SCENE_SEED = 0.5;
const CAMERA_DRIFT_RATE = 0.005;
const CAMERA_HEIGHT = 2.65;
const CAMERA_TARGET_Y = 0.78;
const THEME_VARIABLE_ACCENT = 'accent';
export const FLYINGROBOTS_LOGO_FADE_START_SECONDS = 15;
export const JEDIT_LOGO_FADE_START_SECONDS = 30;
export const TITLE_LOGO_FADE_DURATION_SECONDS = 3;
const LUMINANCE_RED_WEIGHT = 0.2126;
const LUMINANCE_GREEN_WEIGHT = 0.7152;
const LUMINANCE_BLUE_WEIGHT = 0.0722;
const BRAILLE_DITHER_MATRIX_SIZE = 4;
const BRAILLE_DITHER_DENOMINATOR = BRAILLE_DITHER_MATRIX_SIZE * BRAILLE_DITHER_MATRIX_SIZE;
const BRAILLE_DITHER_MATRIX: readonly (readonly number[])[] = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const FLYINGROBOTS_LOGO_FADE_TIMING = {
  visibleSeconds: FLYINGROBOTS_LOGO_FADE_START_SECONDS,
  fadeSeconds: TITLE_LOGO_FADE_DURATION_SECONDS,
} satisfies TitleLogoFadeTiming;
const JEDIT_LOGO_FADE_TIMING = {
  visibleSeconds: JEDIT_LOGO_FADE_START_SECONDS,
  fadeSeconds: TITLE_LOGO_FADE_DURATION_SECONDS,
} satisfies TitleLogoFadeTiming;

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
  } = options;
  const colors = titleSceneMaterialColors(theme);
  const scene = sceneOverride ?? generateTitleScene(sceneSeed, colors, mesh);

  const shader: BrailleShaderFn = ({ u, v, time: frameTime }) => {
    return sceneSampleAt({
      u,
      v,
      cols,
      rows,
      time: frameTime,
      camAngle,
      camRadius,
      objects: scene.objects,
      colors,
      environment: scene.environment,
    });
  };

  const surface = renderMode === TITLE_RENDER_MODE.Ascii
    ? averagingAsciiCanvas(cols, rows, shader, time, { palette: asciiPalette })
    : averagingBrailleCanvas(cols, rows, shader, time);
  paintTitleScreenLogoLayers(surface, cols, rows, colors, time);
  return surface;
}

function paintTitleScreenLogoLayers(
  surface: Surface,
  cols: number,
  rows: number,
  colors: TitleSceneMaterialColors,
  time: number,
): void {
  paintFlyingRobotsLogo(
    surface,
    flyingRobotsLogoCellBounds(cols, rows),
    colors,
    time,
    titleLogoOpacityAt(time, FLYINGROBOTS_LOGO_FADE_TIMING),
  );
  paintTitleLogo(
    surface,
    titleLogoCellBounds(cols, rows),
    colors,
    time,
    titleLogoOpacityAt(time, JEDIT_LOGO_FADE_TIMING),
  );
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
    spotlight: themeAccentColor(_theme),
  };
}

function themeAccentColor(theme: JeditTheme): Color3 {
  return theme.variables.get(THEME_VARIABLE_ACCENT)?.rgb ?? [224, 113, 63];
}

function sceneSampleAt(options: TitleSceneSampleOptions): BrailleShaderSample {
  const context = titleSceneRayContext(options);
  const objectHit = nearestTitleSceneObjectHit(context.origin, context.ray, options.objects, undefined, options.time);
  const environmentHit = nearestTitleEnvironmentSurfaceHit(
    context.origin,
    context.ray,
    options.environment,
    options.colors,
  );

  if (objectHit != null && (environmentHit == null || objectHit.distance < environmentHit.distance)) {
    return objectSceneSample(options, context, objectHit);
  }

  if (environmentHit != null) {
    return environmentSceneSample(options, context, environmentHit);
  }

  const background = scaleColor(titleSceneBackgroundColor(options.environment, options.colors), TITLE_SKY_TINT);
  return {
    on: false,
    fgRGB: background,
    bgRGB: background,
  };
}

function titleSceneRayContext(options: TitleSceneSampleOptions): TitleSceneRayContext {
  const aspect = options.cols / Math.max(1, options.rows);
  const rx = (options.u * 2 - 1) * aspect;
  const ry = options.v * 2 - 1;
  const finalAngle = options.camAngle + (options.time * CAMERA_DRIFT_RATE);
  const cameraStart: Vector3 = [
    Math.sin(options.camAngle) * options.camRadius,
    CAMERA_HEIGHT,
    Math.cos(options.camAngle) * options.camRadius,
  ];
  const origin: Vector3 = [
    Math.sin(finalAngle) * options.camRadius,
    CAMERA_HEIGHT,
    Math.cos(finalAngle) * options.camRadius,
  ];
  const sphereCenter: Vector3 = [0, CAMERA_TARGET_Y, 0];
  return {
    origin,
    ray: getRayDir(origin, [0, CAMERA_TARGET_Y, 0], [rx, -ry - 0.2, 2.7]),
    lightDirection: titleSceneLightDirection(options.environment) ?? TITLE_KEY_LIGHT_DIRECTION,
    spotlight: titleSceneSpotlightAt(cameraStart, sphereCenter, options.colors.spotlight),
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
  environmentHit: NonNullable<ReturnType<typeof nearestTitleEnvironmentSurfaceHit>>,
): BrailleShaderSample {
  const effects = environmentHit.receivesFloorEffects
    ? titleFloorLightEffectsAtWithLight(environmentHit.point, options.objects, options.time, context.lightDirection)
    : { shadowMultiplier: 1, contactShadowMultiplier: 1, causticStrength: 0 };
  const causticColor = scaleColor(options.colors.info, effects.causticStrength);
  const fgRGB = addColor(
    scaleColor(environmentHit.color, effects.shadowMultiplier * effects.contactShadowMultiplier),
    causticColor,
  );
  return {
    on: brailleSubpixelVisible(options.u, options.v, options.cols, options.rows, fgRGB),
    fgRGB,
    bgRGB: options.colors.surface,
  };
}

function brailleSubpixelVisible(u: number, v: number, cols: number, rows: number, color: Color3): boolean {
  const x = Math.floor(u * cols * 2) % BRAILLE_DITHER_MATRIX_SIZE;
  const y = Math.floor(v * rows * 4) % BRAILLE_DITHER_MATRIX_SIZE;
  const threshold = (BRAILLE_DITHER_MATRIX[y]![x]! + 0.5) / BRAILLE_DITHER_DENOMINATOR;
  return (colorLuminance(color) / 255) >= threshold;
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

function add(a: Vector3, b: Vector3): Vector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(vector: Vector3, scalar: number): Vector3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}
