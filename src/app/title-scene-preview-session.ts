import type {
  TitleScene,
  TitleSceneColor,
  TitleSceneObject,
  TitleSceneVector3,
} from "../ui/title-scene.js";
import {
  titleSceneLocalYawAt,
  titleSceneObjectFootprintCenterAt,
} from "../ui/title-scene-transform.js";
import {
  TITLE_SCENE_PREVIEW_INPUT,
  type TitleScenePreviewInput,
} from "./title-scene-preview-input.js";

export {
  TITLE_SCENE_PREVIEW_INPUT,
  type TitleScenePreviewInput,
} from "./title-scene-preview-input.js";

const PREVIEW_RENDER_MODE_BRAILLE = "braille";
const PREVIEW_RENDER_MODE_ASCII = "ascii";

export const TITLE_SCENE_PREVIEW_RENDER_MODE = Object.freeze({
  Braille: PREVIEW_RENDER_MODE_BRAILLE,
  Ascii: PREVIEW_RENDER_MODE_ASCII,
});

export type TitleScenePreviewRenderMode =
  | typeof PREVIEW_RENDER_MODE_BRAILLE
  | typeof PREVIEW_RENDER_MODE_ASCII;

export interface TitleScenePreviewOptions {
  readonly sceneNames: readonly string[];
  readonly sceneObjectCounts: readonly number[];
  readonly themeNames: readonly string[];
  readonly renderModes?: readonly TitleScenePreviewRenderMode[];
  readonly initialSceneIndex?: number;
  readonly initialThemeIndex?: number;
  readonly initialRenderModeIndex?: number;
  readonly initialSelectedObjectIndex?: number;
  readonly initialTimeSeconds?: number;
  readonly initialCameraAngle?: number;
  readonly initialCameraRadius?: number;
}

export interface TitleScenePreviewModel {
  readonly sceneNames: readonly string[];
  readonly sceneObjectCounts: readonly number[];
  readonly themeNames: readonly string[];
  readonly renderModes: readonly TitleScenePreviewRenderMode[];
  readonly sceneIndex: number;
  readonly themeIndex: number;
  readonly renderModeIndex: number;
  readonly selectedObjectIndex: number;
  readonly timeSeconds: number;
  readonly cameraAngle: number;
  readonly cameraRadius: number;
}

export interface TitleScenePreviewRenderOptions {
  readonly camAngle: number;
  readonly camRadius: number;
  readonly renderMode: TitleScenePreviewRenderMode;
}

export interface TitleScenePreviewInspectorOptions {
  readonly scene: TitleScene;
  readonly sceneName: string;
  readonly themeName: string;
}

export interface TitleScenePreviewInspector {
  readonly sceneName: string;
  readonly themeName: string;
  readonly renderMode: TitleScenePreviewRenderMode;
  readonly timeSeconds: number;
  readonly camera: TitleScenePreviewCameraInspector;
  readonly selectedObject?: TitleScenePreviewObjectInspector;
}

export interface TitleScenePreviewCameraInspector {
  readonly angle: number;
  readonly radius: number;
  readonly sceneAngle: number;
  readonly sceneRadius: number;
}

export interface TitleScenePreviewObjectInspector {
  readonly index: number;
  readonly count: number;
  readonly kind: string;
  readonly radius: number;
  readonly reflectivity: number;
  readonly color: TitleSceneColor;
  readonly center: TitleSceneVector3;
  readonly orbitPhase?: number;
  readonly localYaw?: number;
}

type TitleScenePreviewInputHandler = (
  model: TitleScenePreviewModel,
) => TitleScenePreviewModel;

const DEFAULT_RENDER_MODES: readonly TitleScenePreviewRenderMode[] = [
  TITLE_SCENE_PREVIEW_RENDER_MODE.Braille,
  TITLE_SCENE_PREVIEW_RENDER_MODE.Ascii,
];
const DEFAULT_TIME_SECONDS = 0;
const DEFAULT_CAMERA_ANGLE = 0;
const DEFAULT_CAMERA_RADIUS = 8.5;
const PREVIEW_TIME_STEP_SECONDS = 0.5;
const PREVIEW_CAMERA_ANGLE_STEP_RADIANS = 0.12;
const PREVIEW_CAMERA_RADIUS_STEP = 0.25;
const MIN_TIME_SECONDS = 0;
const MIN_CAMERA_RADIUS = 1;
const FIRST_INDEX = 0;
const EMPTY_LENGTH = 0;

const INPUT_HANDLERS = new Map<
  TitleScenePreviewInput,
  TitleScenePreviewInputHandler
>([
  [TITLE_SCENE_PREVIEW_INPUT.TimeForward, timeForward],
  [TITLE_SCENE_PREVIEW_INPUT.TimeBack, timeBack],
  [TITLE_SCENE_PREVIEW_INPUT.CameraAngleLeft, cameraAngleLeft],
  [TITLE_SCENE_PREVIEW_INPUT.CameraAngleRight, cameraAngleRight],
  [TITLE_SCENE_PREVIEW_INPUT.CameraRadiusIn, cameraRadiusIn],
  [TITLE_SCENE_PREVIEW_INPUT.CameraRadiusOut, cameraRadiusOut],
  [TITLE_SCENE_PREVIEW_INPUT.ThemeNext, themeNext],
  [TITLE_SCENE_PREVIEW_INPUT.ThemePrevious, themePrevious],
  [TITLE_SCENE_PREVIEW_INPUT.RenderModeNext, renderModeNext],
  [TITLE_SCENE_PREVIEW_INPUT.RenderModePrevious, renderModePrevious],
  [TITLE_SCENE_PREVIEW_INPUT.SceneNext, sceneNext],
  [TITLE_SCENE_PREVIEW_INPUT.ScenePrevious, scenePrevious],
  [TITLE_SCENE_PREVIEW_INPUT.ObjectNext, objectNext],
  [TITLE_SCENE_PREVIEW_INPUT.ObjectPrevious, objectPrevious],
]);

export function createTitleScenePreviewModel(
  options: TitleScenePreviewOptions,
): TitleScenePreviewModel {
  const renderModes = options.renderModes ?? DEFAULT_RENDER_MODES;
  validatePreviewOptions(options, renderModes);
  const sceneIndex = clampIndex(
    options.initialSceneIndex ?? FIRST_INDEX,
    options.sceneNames.length,
  );
  return {
    sceneNames: options.sceneNames,
    sceneObjectCounts: options.sceneObjectCounts,
    themeNames: options.themeNames,
    renderModes,
    sceneIndex,
    themeIndex: clampIndex(
      options.initialThemeIndex ?? FIRST_INDEX,
      options.themeNames.length,
    ),
    renderModeIndex: clampIndex(
      options.initialRenderModeIndex ?? FIRST_INDEX,
      renderModes.length,
    ),
    selectedObjectIndex: initialObjectIndex(options, sceneIndex),
    timeSeconds: Math.max(
      MIN_TIME_SECONDS,
      options.initialTimeSeconds ?? DEFAULT_TIME_SECONDS,
    ),
    cameraAngle: options.initialCameraAngle ?? DEFAULT_CAMERA_ANGLE,
    cameraRadius: Math.max(
      MIN_CAMERA_RADIUS,
      options.initialCameraRadius ?? DEFAULT_CAMERA_RADIUS,
    ),
  };
}

export function updateTitleScenePreviewModel(
  model: TitleScenePreviewModel,
  input: TitleScenePreviewInput,
): TitleScenePreviewModel {
  return INPUT_HANDLERS.get(input)?.(model) ?? model;
}

export function titleScenePreviewRenderOptions(
  model: TitleScenePreviewModel,
): TitleScenePreviewRenderOptions {
  return {
    camAngle: model.cameraAngle,
    camRadius: model.cameraRadius,
    renderMode: titleScenePreviewRenderMode(model),
  };
}

export function titleScenePreviewInspector(
  model: TitleScenePreviewModel,
  options: TitleScenePreviewInspectorOptions,
): TitleScenePreviewInspector {
  return {
    sceneName: options.sceneName,
    themeName: options.themeName,
    renderMode: titleScenePreviewRenderMode(model),
    timeSeconds: model.timeSeconds,
    camera: titleScenePreviewCameraInspector(model, options.scene),
    selectedObject: titleScenePreviewObjectInspector(model, options.scene),
  };
}

export function titleScenePreviewSceneName(
  model: TitleScenePreviewModel,
): string {
  return (
    model.sceneNames[model.sceneIndex] ?? model.sceneNames[FIRST_INDEX] ?? ""
  );
}

export function titleScenePreviewThemeName(
  model: TitleScenePreviewModel,
): string {
  return (
    model.themeNames[model.themeIndex] ?? model.themeNames[FIRST_INDEX] ?? ""
  );
}

export function titleScenePreviewRenderMode(
  model: TitleScenePreviewModel,
): TitleScenePreviewRenderMode {
  return (
    model.renderModes[model.renderModeIndex] ??
    model.renderModes[FIRST_INDEX] ??
    TITLE_SCENE_PREVIEW_RENDER_MODE.Braille
  );
}

function validatePreviewOptions(
  options: TitleScenePreviewOptions,
  renderModes: readonly TitleScenePreviewRenderMode[],
): void {
  requireNonEmpty("sceneNames", options.sceneNames);
  requireNonEmpty("sceneObjectCounts", options.sceneObjectCounts);
  requireNonEmpty("themeNames", options.themeNames);
  requireNonEmpty("renderModes", renderModes);
  if (options.sceneObjectCounts.length !== options.sceneNames.length) {
    throw new RangeError("sceneObjectCounts must match sceneNames length.");
  }
}

function requireNonEmpty(
  name: string,
  value: readonly string[] | readonly number[],
): void {
  if (value.length === EMPTY_LENGTH) {
    throw new RangeError(`${name} must not be empty.`);
  }
}

function initialObjectIndex(
  options: TitleScenePreviewOptions,
  sceneIndex: number,
): number {
  return clampObjectIndex(
    options.initialSelectedObjectIndex ?? FIRST_INDEX,
    options.sceneObjectCounts[sceneIndex] ?? EMPTY_LENGTH,
  );
}

function titleScenePreviewCameraInspector(
  model: TitleScenePreviewModel,
  scene: TitleScene,
): TitleScenePreviewCameraInspector {
  return {
    angle: model.cameraAngle,
    radius: model.cameraRadius,
    sceneAngle: scene.camera.angle,
    sceneRadius: scene.camera.radius,
  };
}

function titleScenePreviewObjectInspector(
  model: TitleScenePreviewModel,
  scene: TitleScene,
): TitleScenePreviewObjectInspector | undefined {
  const object = scene.objects[model.selectedObjectIndex];
  return object == null
    ? undefined
    : inspectTitleSceneObject(model, object, scene.objects.length);
}

function inspectTitleSceneObject(
  model: TitleScenePreviewModel,
  object: TitleSceneObject,
  count: number,
): TitleScenePreviewObjectInspector {
  return {
    index: model.selectedObjectIndex,
    count,
    kind: object.kind,
    radius: object.radius,
    reflectivity: object.reflectivity,
    color: object.color,
    center: titleSceneObjectFootprintCenterAt(object, model.timeSeconds),
    ...(object.orbit == null
      ? {}
      : { orbitPhase: orbitPhaseAt(object, model.timeSeconds) }),
    ...(object.localYaw == null
      ? {}
      : { localYaw: titleSceneLocalYawAt(object, model.timeSeconds) }),
  };
}

function orbitPhaseAt(
  object: TitleSceneObject,
  timeSeconds: number,
): number | undefined {
  return object.orbit == null
    ? undefined
    : object.orbit.phase + timeSeconds * object.orbit.angularSpeed;
}

function timeForward(model: TitleScenePreviewModel): TitleScenePreviewModel {
  return {
    ...model,
    timeSeconds: model.timeSeconds + PREVIEW_TIME_STEP_SECONDS,
  };
}

function timeBack(model: TitleScenePreviewModel): TitleScenePreviewModel {
  return {
    ...model,
    timeSeconds: Math.max(
      MIN_TIME_SECONDS,
      model.timeSeconds - PREVIEW_TIME_STEP_SECONDS,
    ),
  };
}

function cameraAngleLeft(
  model: TitleScenePreviewModel,
): TitleScenePreviewModel {
  return {
    ...model,
    cameraAngle: model.cameraAngle - PREVIEW_CAMERA_ANGLE_STEP_RADIANS,
  };
}

function cameraAngleRight(
  model: TitleScenePreviewModel,
): TitleScenePreviewModel {
  return {
    ...model,
    cameraAngle: model.cameraAngle + PREVIEW_CAMERA_ANGLE_STEP_RADIANS,
  };
}

function cameraRadiusIn(model: TitleScenePreviewModel): TitleScenePreviewModel {
  return {
    ...model,
    cameraRadius: Math.max(
      MIN_CAMERA_RADIUS,
      model.cameraRadius - PREVIEW_CAMERA_RADIUS_STEP,
    ),
  };
}

function cameraRadiusOut(
  model: TitleScenePreviewModel,
): TitleScenePreviewModel {
  return {
    ...model,
    cameraRadius: model.cameraRadius + PREVIEW_CAMERA_RADIUS_STEP,
  };
}

function themeNext(model: TitleScenePreviewModel): TitleScenePreviewModel {
  return {
    ...model,
    themeIndex: wrapIndex(model.themeIndex + 1, model.themeNames.length),
  };
}

function themePrevious(model: TitleScenePreviewModel): TitleScenePreviewModel {
  return {
    ...model,
    themeIndex: wrapIndex(model.themeIndex - 1, model.themeNames.length),
  };
}

function renderModeNext(model: TitleScenePreviewModel): TitleScenePreviewModel {
  return {
    ...model,
    renderModeIndex: wrapIndex(
      model.renderModeIndex + 1,
      model.renderModes.length,
    ),
  };
}

function renderModePrevious(
  model: TitleScenePreviewModel,
): TitleScenePreviewModel {
  return {
    ...model,
    renderModeIndex: wrapIndex(
      model.renderModeIndex - 1,
      model.renderModes.length,
    ),
  };
}

function sceneNext(model: TitleScenePreviewModel): TitleScenePreviewModel {
  return sceneAt(
    model,
    wrapIndex(model.sceneIndex + 1, model.sceneNames.length),
  );
}

function scenePrevious(model: TitleScenePreviewModel): TitleScenePreviewModel {
  return sceneAt(
    model,
    wrapIndex(model.sceneIndex - 1, model.sceneNames.length),
  );
}

function sceneAt(
  model: TitleScenePreviewModel,
  sceneIndex: number,
): TitleScenePreviewModel {
  return {
    ...model,
    sceneIndex,
    selectedObjectIndex: clampObjectIndex(
      model.selectedObjectIndex,
      model.sceneObjectCounts[sceneIndex] ?? EMPTY_LENGTH,
    ),
  };
}

function objectNext(model: TitleScenePreviewModel): TitleScenePreviewModel {
  return {
    ...model,
    selectedObjectIndex: wrapObjectIndex(model, model.selectedObjectIndex + 1),
  };
}

function objectPrevious(model: TitleScenePreviewModel): TitleScenePreviewModel {
  return {
    ...model,
    selectedObjectIndex: wrapObjectIndex(model, model.selectedObjectIndex - 1),
  };
}

function wrapObjectIndex(model: TitleScenePreviewModel, index: number): number {
  return wrapIndex(
    index,
    model.sceneObjectCounts[model.sceneIndex] ?? EMPTY_LENGTH,
  );
}

function clampObjectIndex(index: number, count: number): number {
  return count <= EMPTY_LENGTH ? FIRST_INDEX : clampIndex(index, count);
}

function clampIndex(index: number, count: number): number {
  return Math.min(Math.max(index, FIRST_INDEX), count - 1);
}

function wrapIndex(index: number, count: number): number {
  if (count <= EMPTY_LENGTH) {
    return FIRST_INDEX;
  }
  return ((index % count) + count) % count;
}
