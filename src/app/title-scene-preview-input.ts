const PREVIEW_INPUT_TIME_FORWARD = Symbol(
  "jedit.title-preview.input.time-forward",
);
const PREVIEW_INPUT_TIME_BACK = Symbol("jedit.title-preview.input.time-back");
const PREVIEW_INPUT_CAMERA_ANGLE_LEFT = Symbol(
  "jedit.title-preview.input.camera-angle-left",
);
const PREVIEW_INPUT_CAMERA_ANGLE_RIGHT = Symbol(
  "jedit.title-preview.input.camera-angle-right",
);
const PREVIEW_INPUT_CAMERA_RADIUS_IN = Symbol(
  "jedit.title-preview.input.camera-radius-in",
);
const PREVIEW_INPUT_CAMERA_RADIUS_OUT = Symbol(
  "jedit.title-preview.input.camera-radius-out",
);
const PREVIEW_INPUT_THEME_NEXT = Symbol("jedit.title-preview.input.theme-next");
const PREVIEW_INPUT_THEME_PREVIOUS = Symbol(
  "jedit.title-preview.input.theme-previous",
);
const PREVIEW_INPUT_RENDER_MODE_NEXT = Symbol(
  "jedit.title-preview.input.render-mode-next",
);
const PREVIEW_INPUT_RENDER_MODE_PREVIOUS = Symbol(
  "jedit.title-preview.input.render-mode-previous",
);
const PREVIEW_INPUT_SCENE_NEXT = Symbol("jedit.title-preview.input.scene-next");
const PREVIEW_INPUT_SCENE_PREVIOUS = Symbol(
  "jedit.title-preview.input.scene-previous",
);
const PREVIEW_INPUT_OBJECT_NEXT = Symbol(
  "jedit.title-preview.input.object-next",
);
const PREVIEW_INPUT_OBJECT_PREVIOUS = Symbol(
  "jedit.title-preview.input.object-previous",
);

export const TITLE_SCENE_PREVIEW_INPUT = Object.freeze({
  TimeForward: PREVIEW_INPUT_TIME_FORWARD,
  TimeBack: PREVIEW_INPUT_TIME_BACK,
  CameraAngleLeft: PREVIEW_INPUT_CAMERA_ANGLE_LEFT,
  CameraAngleRight: PREVIEW_INPUT_CAMERA_ANGLE_RIGHT,
  CameraRadiusIn: PREVIEW_INPUT_CAMERA_RADIUS_IN,
  CameraRadiusOut: PREVIEW_INPUT_CAMERA_RADIUS_OUT,
  ThemeNext: PREVIEW_INPUT_THEME_NEXT,
  ThemePrevious: PREVIEW_INPUT_THEME_PREVIOUS,
  RenderModeNext: PREVIEW_INPUT_RENDER_MODE_NEXT,
  RenderModePrevious: PREVIEW_INPUT_RENDER_MODE_PREVIOUS,
  SceneNext: PREVIEW_INPUT_SCENE_NEXT,
  ScenePrevious: PREVIEW_INPUT_SCENE_PREVIOUS,
  ObjectNext: PREVIEW_INPUT_OBJECT_NEXT,
  ObjectPrevious: PREVIEW_INPUT_OBJECT_PREVIOUS,
});

export type TitleScenePreviewInput =
  | typeof PREVIEW_INPUT_TIME_FORWARD
  | typeof PREVIEW_INPUT_TIME_BACK
  | typeof PREVIEW_INPUT_CAMERA_ANGLE_LEFT
  | typeof PREVIEW_INPUT_CAMERA_ANGLE_RIGHT
  | typeof PREVIEW_INPUT_CAMERA_RADIUS_IN
  | typeof PREVIEW_INPUT_CAMERA_RADIUS_OUT
  | typeof PREVIEW_INPUT_THEME_NEXT
  | typeof PREVIEW_INPUT_THEME_PREVIOUS
  | typeof PREVIEW_INPUT_RENDER_MODE_NEXT
  | typeof PREVIEW_INPUT_RENDER_MODE_PREVIOUS
  | typeof PREVIEW_INPUT_SCENE_NEXT
  | typeof PREVIEW_INPUT_SCENE_PREVIOUS
  | typeof PREVIEW_INPUT_OBJECT_NEXT
  | typeof PREVIEW_INPUT_OBJECT_PREVIOUS;
