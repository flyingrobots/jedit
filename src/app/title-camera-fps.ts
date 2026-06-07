import type { TitleSceneVector3 } from "../ui/title-scene.js";
import { titleSceneCameraOrbitFromPosition } from "../ui/title-scene-camera.js";

export const TITLE_CAMERA_FPS_STEP = 0.48;
export const TITLE_CAMERA_CROUCH_STEP = 0.2;
export const TITLE_CAMERA_JUMP_STEP = 0.6;
export const TITLE_CAMERA_CROUCH_HEIGHT = 0.44;
export const TITLE_CAMERA_MOUSE_LOOK_RADIANS_PER_CELL = 0.045;

const TITLE_CAMERA_MAX_PITCH_SIN = 0.94;
const VECTOR_ZERO_EPSILON = 0.000001;
const REVERSE_DIRECTION = -1;
const WORLD_UP: TitleSceneVector3 = [0, 1, 0];
const TITLE_CAMERA_CROUCH_STATE = {
  Crouching: "crouching",
  Standing: "standing",
} as const;

type TitleCameraCrouchState =
  (typeof TITLE_CAMERA_CROUCH_STATE)[keyof typeof TITLE_CAMERA_CROUCH_STATE];

export interface TitleCameraFpsState {
  readonly angle: number;
  readonly angleTarget: number;
  readonly angleMotionId: number;
  readonly radius: number;
  readonly radiusTarget: number;
  readonly radiusMotionId: number;
  readonly position: TitleSceneVector3;
  readonly target: TitleSceneVector3;
  readonly eyeY: number;
  readonly crouching: boolean;
}

export interface TitleCameraKeyModifiers {
  readonly shift?: boolean;
}

export interface TitleCameraMouseLookPointer {
  readonly col: number;
  readonly row: number;
}

export function titleCameraMovedForward(
  camera: TitleCameraFpsState,
  modifiers: TitleCameraKeyModifiers,
): TitleCameraFpsState {
  return titleCameraTranslated(camera, titleCameraForward(camera), modifiers);
}

export function titleCameraMovedBackward(
  camera: TitleCameraFpsState,
  modifiers: TitleCameraKeyModifiers,
): TitleCameraFpsState {
  return titleCameraTranslated(camera, titleCameraBackward(camera), modifiers);
}

export function titleCameraStrafedLeft(
  camera: TitleCameraFpsState,
  modifiers: TitleCameraKeyModifiers,
): TitleCameraFpsState {
  return titleCameraTranslated(camera, titleCameraLeft(camera), modifiers);
}

export function titleCameraStrafedRight(
  camera: TitleCameraFpsState,
  modifiers: TitleCameraKeyModifiers,
): TitleCameraFpsState {
  return titleCameraTranslated(camera, titleCameraRight(camera), modifiers);
}

export function titleCameraJumped(
  camera: TitleCameraFpsState,
): TitleCameraFpsState {
  return titleCameraVerticalShift(
    camera,
    TITLE_CAMERA_JUMP_STEP,
    TITLE_CAMERA_CROUCH_STATE.Standing,
  );
}

export function titleCameraToggledCrouch(
  camera: TitleCameraFpsState,
): TitleCameraFpsState {
  return camera.crouching
    ? titleCameraVerticalShift(
        camera,
        TITLE_CAMERA_CROUCH_HEIGHT,
        TITLE_CAMERA_CROUCH_STATE.Standing,
      )
    : titleCameraVerticalShift(
        camera,
        -TITLE_CAMERA_CROUCH_HEIGHT,
        TITLE_CAMERA_CROUCH_STATE.Crouching,
      );
}

export function titleCameraLookDelta(
  camera: TitleCameraFpsState,
  dx: number,
  dy: number,
): TitleCameraFpsState {
  const view = sub(camera.target, camera.position);
  const distance = Math.max(VECTOR_ZERO_EPSILON, length(view));
  const yawed = rotateAroundAxis(
    normalize(view),
    WORLD_UP,
    -dx * TITLE_CAMERA_MOUSE_LOOK_RADIANS_PER_CELL,
  );
  const pitched = rotateAroundAxis(
    yawed,
    titleCameraRightFromForward(yawed),
    -dy * TITLE_CAMERA_MOUSE_LOOK_RADIANS_PER_CELL,
  );
  return titleCameraWithPositionAndTarget(
    camera,
    camera.position,
    add(camera.position, scale(clampPitch(normalize(pitched)), distance)),
    titleCameraCrouchState(camera),
  );
}

function titleCameraTranslated(
  camera: TitleCameraFpsState,
  direction: TitleSceneVector3,
  modifiers: TitleCameraKeyModifiers,
): TitleCameraFpsState {
  const base = titleCameraMovementBase(camera, modifiers);
  const distance = base.crouching
    ? TITLE_CAMERA_CROUCH_STEP
    : TITLE_CAMERA_FPS_STEP;
  const movement = scale(normalize(direction), distance);
  return titleCameraWithPositionAndTarget(
    base,
    add(base.position, movement),
    add(base.target, movement),
    titleCameraCrouchState(base),
  );
}

function titleCameraMovementBase(
  camera: TitleCameraFpsState,
  modifiers: TitleCameraKeyModifiers,
): TitleCameraFpsState {
  return modifiers.shift && !camera.crouching
    ? titleCameraVerticalShift(
        camera,
        -TITLE_CAMERA_CROUCH_HEIGHT,
        TITLE_CAMERA_CROUCH_STATE.Crouching,
      )
    : camera;
}

function titleCameraVerticalShift(
  camera: TitleCameraFpsState,
  amount: number,
  crouchState: TitleCameraCrouchState,
): TitleCameraFpsState {
  const movement: TitleSceneVector3 = [0, amount, 0];
  return titleCameraWithPositionAndTarget(
    camera,
    add(camera.position, movement),
    add(camera.target, movement),
    crouchState,
  );
}

function titleCameraWithPositionAndTarget(
  camera: TitleCameraFpsState,
  position: TitleSceneVector3,
  target: TitleSceneVector3,
  crouchState: TitleCameraCrouchState,
): TitleCameraFpsState {
  const orbit = titleSceneCameraOrbitFromPosition(position, target);
  return {
    ...camera,
    angle: orbit.angle,
    angleTarget: orbit.angle,
    radius: orbit.radius,
    radiusTarget: orbit.radius,
    position,
    target,
    eyeY: position[1],
    crouching: crouchState === TITLE_CAMERA_CROUCH_STATE.Crouching,
  };
}

function titleCameraCrouchState(
  camera: TitleCameraFpsState,
): TitleCameraCrouchState {
  return camera.crouching
    ? TITLE_CAMERA_CROUCH_STATE.Crouching
    : TITLE_CAMERA_CROUCH_STATE.Standing;
}

function titleCameraForward(camera: TitleCameraFpsState): TitleSceneVector3 {
  return normalize(sub(camera.target, camera.position));
}

function titleCameraBackward(camera: TitleCameraFpsState): TitleSceneVector3 {
  return scale(titleCameraForward(camera), REVERSE_DIRECTION);
}

function titleCameraLeft(camera: TitleCameraFpsState): TitleSceneVector3 {
  return scale(titleCameraRight(camera), REVERSE_DIRECTION);
}

function titleCameraRight(camera: TitleCameraFpsState): TitleSceneVector3 {
  return titleCameraRightFromForward(titleCameraForward(camera));
}

function titleCameraRightFromForward(
  forward: TitleSceneVector3,
): TitleSceneVector3 {
  return normalize(cross(forward, WORLD_UP));
}

function clampPitch(direction: TitleSceneVector3): TitleSceneVector3 {
  const y = clamp(
    direction[1],
    -TITLE_CAMERA_MAX_PITCH_SIN,
    TITLE_CAMERA_MAX_PITCH_SIN,
  );
  const horizontal = normalize([direction[0], 0, direction[2]]);
  const horizontalLength = Math.sqrt(1 - y * y);
  return normalize([
    horizontal[0] * horizontalLength,
    y,
    horizontal[2] * horizontalLength,
  ]);
}

function rotateAroundAxis(
  vector: TitleSceneVector3,
  axis: TitleSceneVector3,
  radians: number,
): TitleSceneVector3 {
  const normalizedAxis = normalize(axis);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return add(
    add(scale(vector, cos), scale(cross(normalizedAxis, vector), sin)),
    scale(normalizedAxis, dot(normalizedAxis, vector) * (1 - cos)),
  );
}

function length(vector: TitleSceneVector3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalize(vector: TitleSceneVector3): TitleSceneVector3 {
  const magnitude = length(vector);
  return magnitude <= VECTOR_ZERO_EPSILON
    ? [0, 0, -1]
    : scale(vector, 1 / magnitude);
}

function add(a: TitleSceneVector3, b: TitleSceneVector3): TitleSceneVector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a: TitleSceneVector3, b: TitleSceneVector3): TitleSceneVector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(
  vector: TitleSceneVector3,
  scalar: number,
): TitleSceneVector3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function cross(a: TitleSceneVector3, b: TitleSceneVector3): TitleSceneVector3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: TitleSceneVector3, b: TitleSceneVector3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}
