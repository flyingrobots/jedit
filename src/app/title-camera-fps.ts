import type { TitleSceneVector3 } from "../ui/title-scene.js";
import { titleSceneCameraOrbitFromPosition } from "../ui/title-scene-camera.js";
import {
  add,
  clamp,
  cross,
  dot,
  length,
  normalize,
  scale,
  sub,
} from "./title-camera-vector.js";

export const TITLE_CAMERA_FPS_STEP = 0.48;
export const TITLE_CAMERA_CROUCH_STEP = 0.2;
export const TITLE_CAMERA_JUMP_STEP = 0.6;
export const TITLE_CAMERA_FPS_SPEED = 3.2;
export const TITLE_CAMERA_CROUCH_SPEED = 1.4;
export const TITLE_CAMERA_FPS_ACCELERATION = 18;
export const TITLE_CAMERA_CROUCH_ACCELERATION = 9;
export const TITLE_CAMERA_INPUT_IMPULSE = 0.9;
export const TITLE_CAMERA_JUMP_VELOCITY = 3.6;
export const TITLE_CAMERA_GRAVITY = 9.2;
export const TITLE_CAMERA_CROUCH_HEIGHT = 0.44;
export const TITLE_CAMERA_MOUSE_LOOK_RADIANS_PER_CELL = 0.045;

const TITLE_CAMERA_MAX_PITCH_SIN = 0.94;
const TITLE_CAMERA_MAX_ADVANCE_SECONDS = 1 / 20;
const VECTOR_ZERO_EPSILON = 0.000001;
const TITLE_CAMERA_GROUND_DRAG = 8;
const TITLE_CAMERA_AIR_DRAG = 1.2;
const ZERO_VECTOR: TitleSceneVector3 = [0, 0, 0];
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
  readonly velocity?: TitleSceneVector3;
  readonly verticalVelocity?: number;
  readonly groundEyeY?: number;
}

export interface TitleCameraKeyModifiers {
  readonly shift?: boolean;
}

export interface TitleCameraMovementInput {
  readonly dtSeconds: number;
  readonly forward?: boolean;
  readonly backward?: boolean;
  readonly left?: boolean;
  readonly right?: boolean;
}

export interface TitleCameraMouseLookPointer {
  readonly col: number;
  readonly row: number;
}

export function titleCameraMovedForward(
  camera: TitleCameraFpsState,
  modifiers: TitleCameraKeyModifiers,
): TitleCameraFpsState {
  return titleCameraImpulsed(camera, titleCameraForward(camera), modifiers);
}

export function titleCameraMovedBackward(
  camera: TitleCameraFpsState,
  modifiers: TitleCameraKeyModifiers,
): TitleCameraFpsState {
  return titleCameraImpulsed(camera, titleCameraBackward(camera), modifiers);
}

export function titleCameraStrafedLeft(
  camera: TitleCameraFpsState,
  modifiers: TitleCameraKeyModifiers,
): TitleCameraFpsState {
  return titleCameraImpulsed(camera, titleCameraLeft(camera), modifiers);
}

export function titleCameraStrafedRight(
  camera: TitleCameraFpsState,
  modifiers: TitleCameraKeyModifiers,
): TitleCameraFpsState {
  return titleCameraImpulsed(camera, titleCameraRight(camera), modifiers);
}

export function titleCameraJumped(
  camera: TitleCameraFpsState,
): TitleCameraFpsState {
  if (titleCameraIsAirborne(camera)) {
    return camera;
  }
  const base = camera.crouching
    ? titleCameraGroundedShift(
        camera,
        TITLE_CAMERA_CROUCH_HEIGHT,
        TITLE_CAMERA_CROUCH_STATE.Standing,
      )
    : camera;
  return titleCameraWithVelocity(
    { ...base, groundEyeY: titleCameraGroundEyeY(base) },
    velocityWithY(titleCameraVelocity(base), TITLE_CAMERA_JUMP_VELOCITY),
  );
}

export function titleCameraToggledCrouch(
  camera: TitleCameraFpsState,
): TitleCameraFpsState {
  if (titleCameraIsAirborne(camera)) {
    return camera;
  }
  return camera.crouching
    ? titleCameraGroundedShift(
        camera,
        TITLE_CAMERA_CROUCH_HEIGHT,
        TITLE_CAMERA_CROUCH_STATE.Standing,
      )
    : titleCameraGroundedShift(
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

export function titleCameraAdvanced(
  camera: TitleCameraFpsState,
  input: TitleCameraMovementInput,
): TitleCameraFpsState {
  const dtSeconds = boundedAdvanceSeconds(input.dtSeconds);
  const velocity = titleCameraFrameVelocity(camera, input, dtSeconds);
  return titleCameraPositionAdvanced(camera, velocity, dtSeconds);
}

function titleCameraFrameVelocity(
  camera: TitleCameraFpsState,
  input: TitleCameraMovementInput,
  dtSeconds: number,
): TitleSceneVector3 {
  const movement = titleCameraMovementVelocity(camera, input, dtSeconds);
  return titleCameraGravityVelocity(camera, movement, dtSeconds);
}

function titleCameraMovementVelocity(
  camera: TitleCameraFpsState,
  input: TitleCameraMovementInput,
  dtSeconds: number,
): TitleSceneVector3 {
  const velocity = titleCameraVelocity(camera);
  const direction = titleCameraMovementDirection(camera, input);
  if (direction == null || dtSeconds === 0) {
    return dampTitleCameraHorizontalVelocity(camera, velocity, dtSeconds);
  }
  return clampTitleCameraHorizontalSpeed(
    add(velocity, scale(direction, titleCameraAcceleration(camera) * dtSeconds)),
    titleCameraMomentumLimit(camera, velocity),
  );
}

function titleCameraGravityVelocity(
  camera: TitleCameraFpsState,
  velocity: TitleSceneVector3,
  dtSeconds: number,
): TitleSceneVector3 {
  const falling = titleCameraIsAirborne(camera) || velocity[1] !== 0;
  const nextY = falling ? velocity[1] - TITLE_CAMERA_GRAVITY * dtSeconds : 0;
  return velocityWithY(velocity, nextY);
}

function titleCameraPositionAdvanced(
  camera: TitleCameraFpsState,
  velocity: TitleSceneVector3,
  dtSeconds: number,
): TitleCameraFpsState {
  const moved = titleCameraWithPositionAndTarget(
    camera,
    add(camera.position, scale(velocity, dtSeconds)),
    add(camera.target, scale(velocity, dtSeconds)),
    titleCameraCrouchState(camera),
  );
  const withVelocity = titleCameraWithVelocity(moved, velocity);
  return withVelocity.position[1] <= titleCameraGroundEyeY(camera)
    ? titleCameraLanded(withVelocity, titleCameraGroundEyeY(camera))
    : withVelocity;
}

function titleCameraMovementDirection(
  camera: TitleCameraFpsState,
  input: TitleCameraMovementInput,
): TitleSceneVector3 | undefined {
  const direction = titleCameraMovementVector(camera, input);
  return length(direction) <= VECTOR_ZERO_EPSILON ? undefined : normalize(direction);
}

function titleCameraMovementVector(
  camera: TitleCameraFpsState,
  input: TitleCameraMovementInput,
): TitleSceneVector3 {
  let direction = ZERO_VECTOR;
  if (input.forward === true) {
    direction = add(direction, titleCameraForward(camera));
  }
  if (input.backward === true) {
    direction = add(direction, titleCameraBackward(camera));
  }
  if (input.left === true) {
    direction = add(direction, titleCameraLeft(camera));
  }
  if (input.right === true) {
    direction = add(direction, titleCameraRight(camera));
  }
  return direction;
}

function titleCameraMovementSpeed(camera: TitleCameraFpsState): number {
  return camera.crouching ? TITLE_CAMERA_CROUCH_SPEED : TITLE_CAMERA_FPS_SPEED;
}

function titleCameraImpulse(camera: TitleCameraFpsState): number {
  const crouchFactor = TITLE_CAMERA_CROUCH_SPEED / TITLE_CAMERA_FPS_SPEED;
  return TITLE_CAMERA_INPUT_IMPULSE * (camera.crouching ? crouchFactor : 1);
}

function titleCameraAcceleration(camera: TitleCameraFpsState): number {
  return camera.crouching ? TITLE_CAMERA_CROUCH_ACCELERATION : TITLE_CAMERA_FPS_ACCELERATION;
}

function titleCameraImpulsed(
  camera: TitleCameraFpsState,
  direction: TitleSceneVector3,
  modifiers: TitleCameraKeyModifiers,
): TitleCameraFpsState {
  const base = titleCameraMovementBase(camera, modifiers);
  const velocity = add(
    titleCameraVelocity(base),
    scale(normalize(direction), titleCameraImpulse(base)),
  );
  return titleCameraWithVelocity(
    base,
    clampTitleCameraHorizontalSpeed(
      velocity,
      titleCameraMomentumLimit(base, titleCameraVelocity(base)),
    ),
  );
}

function titleCameraMovementBase(
  camera: TitleCameraFpsState,
  modifiers: TitleCameraKeyModifiers,
): TitleCameraFpsState {
  return modifiers.shift && !camera.crouching
    ? titleCameraGroundedShift(
        camera,
        -TITLE_CAMERA_CROUCH_HEIGHT,
        TITLE_CAMERA_CROUCH_STATE.Crouching,
      )
    : camera;
}

function titleCameraGroundedShift(
  camera: TitleCameraFpsState,
  amount: number,
  crouchState: TitleCameraCrouchState,
): TitleCameraFpsState {
  const shifted = titleCameraVerticalShift(camera, amount, crouchState);
  return titleCameraLanded(shifted, shifted.eyeY);
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

function titleCameraVerticalPositionShift(
  camera: TitleCameraFpsState,
  amount: number,
): TitleCameraFpsState {
  return titleCameraWithPositionAndTarget(
    camera,
    add(camera.position, [0, amount, 0]),
    add(camera.target, [0, amount, 0]),
    titleCameraCrouchState(camera),
  );
}

function titleCameraLanded(
  camera: TitleCameraFpsState,
  groundEyeY: number,
): TitleCameraFpsState {
  const correction = groundEyeY - camera.position[1];
  const grounded =
    correction === 0
      ? camera
      : titleCameraVerticalPositionShift(camera, correction);
  return {
    ...grounded,
    velocity: velocityWithY(titleCameraVelocity(grounded), 0),
    verticalVelocity: 0,
    groundEyeY,
  };
}

function titleCameraGroundEyeY(camera: TitleCameraFpsState): number {
  return camera.groundEyeY ?? camera.eyeY;
}

function titleCameraIsAirborne(camera: TitleCameraFpsState): boolean {
  return (
    Math.abs(camera.position[1] - titleCameraGroundEyeY(camera)) >
      VECTOR_ZERO_EPSILON || titleCameraVelocity(camera)[1] !== 0
  );
}

function titleCameraVelocity(camera: TitleCameraFpsState): TitleSceneVector3 {
  return camera.velocity ?? [0, camera.verticalVelocity ?? 0, 0];
}

function titleCameraMomentumLimit(
  camera: TitleCameraFpsState,
  velocity: TitleSceneVector3,
): number {
  return Math.max(titleCameraMovementSpeed(camera), Math.hypot(velocity[0], velocity[2]));
}

function titleCameraWithVelocity(
  camera: TitleCameraFpsState,
  velocity: TitleSceneVector3,
): TitleCameraFpsState {
  return {
    ...camera,
    velocity,
    verticalVelocity: velocity[1],
  };
}

function velocityWithY(
  velocity: TitleSceneVector3,
  y: number,
): TitleSceneVector3 {
  return [velocity[0], y, velocity[2]];
}

function dampTitleCameraHorizontalVelocity(
  camera: TitleCameraFpsState,
  velocity: TitleSceneVector3,
  dtSeconds: number,
): TitleSceneVector3 {
  const factor = Math.max(
    0,
    1 - (titleCameraIsAirborne(camera) ? TITLE_CAMERA_AIR_DRAG : TITLE_CAMERA_GROUND_DRAG) * dtSeconds,
  );
  return [velocity[0] * factor, velocity[1], velocity[2] * factor];
}

function clampTitleCameraHorizontalSpeed(
  velocity: TitleSceneVector3,
  maxSpeed: number,
): TitleSceneVector3 {
  const speed = Math.hypot(velocity[0], velocity[2]);
  if (speed <= maxSpeed || speed <= VECTOR_ZERO_EPSILON) {
    return velocity;
  }
  const scaleFactor = maxSpeed / speed;
  return [velocity[0] * scaleFactor, velocity[1], velocity[2] * scaleFactor];
}

function boundedAdvanceSeconds(dtSeconds: number): number {
  return Math.max(0, Math.min(dtSeconds, TITLE_CAMERA_MAX_ADVANCE_SECONDS));
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
  const view = sub(camera.target, camera.position);
  return normalize([view[0], 0, view[2]]);
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
