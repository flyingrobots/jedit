import {
  createSpringState,
  springStep,
  type Cmd,
  type SpringConfig,
} from "@flyingrobots/bijou-tui";
import {
  TITLE_SCENE_DEFAULT_CAMERA_ANGLE,
  TITLE_SCENE_DEFAULT_CAMERA_RADIUS,
  TITLE_SCENE_DEFAULT_CAMERA_TARGET,
  titleSceneCameraPosition,
  titleSceneCameraTarget,
  titleSceneOrbitCameraPosition,
  type TitleSceneCameraPlacement,
} from "../ui/title-scene-camera.js";
import type { TitleSceneVector3 } from "../ui/title-scene.js";
import {
  titleCameraJumped,
  titleCameraLookDelta,
  titleCameraMovedBackward,
  titleCameraMovedForward,
  titleCameraStrafedLeft,
  titleCameraStrafedRight,
  titleCameraToggledCrouch,
  type TitleCameraKeyModifiers,
  type TitleCameraMouseLookPointer,
} from "./title-camera-fps.js";

export {
  TITLE_CAMERA_CROUCH_HEIGHT,
  TITLE_CAMERA_CROUCH_STEP,
  TITLE_CAMERA_FPS_STEP,
  TITLE_CAMERA_FPS_SPEED,
  TITLE_CAMERA_CROUCH_SPEED,
  TITLE_CAMERA_GRAVITY,
  TITLE_CAMERA_JUMP_STEP,
  TITLE_CAMERA_JUMP_VELOCITY,
  TITLE_CAMERA_MOUSE_LOOK_RADIANS_PER_CELL,
} from "./title-camera-fps.js";

export type {
  TitleCameraKeyModifiers,
  TitleCameraMouseLookPointer,
} from "./title-camera-fps.js";

export {
  advanceTitleCameraFrame,
  createTitleCameraInputState,
} from "./title-camera-input.js";

export const TITLE_CAMERA_AXIS = {
  Angle: "angle",
  Radius: "radius",
} as const;

export const TITLE_CAMERA_MESSAGE = {
  Frame: "title-camera-frame",
} as const;

const TITLE_CAMERA_KEY = {
  W: "w",
  A: "a",
  S: "s",
  D: "d",
  Left: "left",
  Right: "right",
  Up: "up",
  Down: "down",
  Space: "space",
  Shift: "shift",
} as const;

const TITLE_CAMERA_MIN_RADIUS = 2;
export const TITLE_CAMERA_ANGLE_STEP = 0.1;
export const TITLE_CAMERA_RADIUS_STEP = 0.5;
const TITLE_CAMERA_SPRING_MASS = 1;
const TITLE_CAMERA_SPRING_STIFFNESS = 144;
const TITLE_CAMERA_SPRING_PRECISION = 0.001;
const TITLE_CAMERA_FIXED_STEP_SECONDS = 1 / 120;
const TITLE_CAMERA_MAX_PULSE_SECONDS = 1 / 20;

export const TITLE_CAMERA_SPRING = {
  mass: TITLE_CAMERA_SPRING_MASS,
  stiffness: TITLE_CAMERA_SPRING_STIFFNESS,
  damping:
    2 * Math.sqrt(TITLE_CAMERA_SPRING_STIFFNESS * TITLE_CAMERA_SPRING_MASS),
  precision: TITLE_CAMERA_SPRING_PRECISION,
} satisfies SpringConfig;

export type TitleCameraAxis =
  (typeof TITLE_CAMERA_AXIS)[keyof typeof TITLE_CAMERA_AXIS];

export interface TitleCameraState {
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

export interface TitleCameraInitialPlacement {
  readonly angle: number;
  readonly radius: number;
  readonly position?: TitleSceneVector3;
  readonly target?: TitleSceneVector3;
}

export interface TitleCameraMotionMsg {
  readonly type: typeof TITLE_CAMERA_MESSAGE.Frame;
  readonly axis: TitleCameraAxis;
  readonly motionId: number;
  readonly value: number;
}

export interface TitleCameraMouseLookResult {
  readonly state: TitleCameraState;
  readonly pointer: TitleCameraMouseLookPointer;
}

export interface TitleCameraUpdate {
  readonly state: TitleCameraState;
  readonly commands: Cmd<TitleCameraMotionMsg>[];
}

export function createTitleCameraState(
  placement: TitleCameraInitialPlacement = {
    angle: TITLE_SCENE_DEFAULT_CAMERA_ANGLE,
    radius: TITLE_SCENE_DEFAULT_CAMERA_RADIUS,
    target: TITLE_SCENE_DEFAULT_CAMERA_TARGET,
  },
): TitleCameraState {
  const camera = resolvedInitialCameraPlacement(placement);
  return {
    angle: camera.angle,
    angleTarget: camera.angle,
    angleMotionId: 0,
    radius: camera.radius,
    radiusTarget: camera.radius,
    radiusMotionId: 0,
    position: titleSceneCameraPosition(camera),
    target: titleSceneCameraTarget(camera),
    eyeY: titleSceneCameraPosition(camera)[1],
    crouching: false,
  };
}

export function updateTitleCameraFromKey(
  key: string,
  camera: TitleCameraState,
  modifiers: TitleCameraKeyModifiers = {},
): TitleCameraUpdate | undefined {
  return (
    titleCameraFpsKeyUpdate(key, camera, modifiers) ??
    titleCameraOrbitKeyUpdate(key, camera)
  );
}

function titleCameraFpsKeyUpdate(
  key: string,
  camera: TitleCameraState,
  modifiers: TitleCameraKeyModifiers,
): TitleCameraUpdate | undefined {
  switch (key) {
    case TITLE_CAMERA_KEY.W:
      return titleCameraImmediateUpdate(
        titleCameraMovedForward(camera, modifiers),
      );
    case TITLE_CAMERA_KEY.S:
      return titleCameraImmediateUpdate(
        titleCameraMovedBackward(camera, modifiers),
      );
    case TITLE_CAMERA_KEY.A:
      return titleCameraImmediateUpdate(
        titleCameraStrafedLeft(camera, modifiers),
      );
    case TITLE_CAMERA_KEY.D:
      return titleCameraImmediateUpdate(
        titleCameraStrafedRight(camera, modifiers),
      );
    case TITLE_CAMERA_KEY.Space:
      return titleCameraImmediateUpdate(titleCameraJumped(camera));
    case TITLE_CAMERA_KEY.Shift:
      return titleCameraImmediateUpdate(titleCameraToggledCrouch(camera));
    default:
      return undefined;
  }
}

function titleCameraOrbitKeyUpdate(
  key: string,
  camera: TitleCameraState,
): TitleCameraUpdate | undefined {
  switch (key) {
    case TITLE_CAMERA_KEY.Left:
      return titleCameraAngleUpdate(
        camera,
        camera.angleTarget - TITLE_CAMERA_ANGLE_STEP,
      );
    case TITLE_CAMERA_KEY.Right:
      return titleCameraAngleUpdate(
        camera,
        camera.angleTarget + TITLE_CAMERA_ANGLE_STEP,
      );
    case TITLE_CAMERA_KEY.Up:
      return titleCameraRadiusUpdate(
        camera,
        Math.max(
          TITLE_CAMERA_MIN_RADIUS,
          camera.radiusTarget - TITLE_CAMERA_RADIUS_STEP,
        ),
      );
    case TITLE_CAMERA_KEY.Down:
      return titleCameraRadiusUpdate(
        camera,
        camera.radiusTarget + TITLE_CAMERA_RADIUS_STEP,
      );
    default:
      return undefined;
  }
}

export function updateTitleCameraFromMouseLook(
  pointer: TitleCameraMouseLookPointer,
  camera: TitleCameraState,
  previous?: TitleCameraMouseLookPointer,
): TitleCameraMouseLookResult {
  if (previous == null) {
    return { state: camera, pointer };
  }
  const dx = pointer.col - previous.col;
  const dy = pointer.row - previous.row;
  if (dx === 0 && dy === 0) {
    return { state: camera, pointer };
  }
  return {
    state: titleCameraLookDelta(camera, dx, dy),
    pointer,
  };
}

export function reduceTitleCameraMotion(
  camera: TitleCameraState,
  msg: TitleCameraMotionMsg,
): TitleCameraState {
  if (msg.axis === TITLE_CAMERA_AXIS.Angle) {
    if (msg.motionId !== camera.angleMotionId) {
      return camera;
    }
    return titleCameraWithAngle(camera, msg.value);
  }

  if (msg.motionId !== camera.radiusMotionId) {
    return camera;
  }
  return titleCameraWithRadius(camera, msg.value);
}

function titleCameraAngleUpdate(
  camera: TitleCameraState,
  target: number,
): TitleCameraUpdate {
  const motionId = camera.angleMotionId + 1;
  return {
    state: {
      ...camera,
      angleTarget: target,
      angleMotionId: motionId,
    },
    commands: [
      titleCameraSpringCommand(
        TITLE_CAMERA_AXIS.Angle,
        camera.angle,
        target,
        motionId,
      ),
    ],
  };
}

function titleCameraRadiusUpdate(
  camera: TitleCameraState,
  target: number,
): TitleCameraUpdate {
  const motionId = camera.radiusMotionId + 1;
  return {
    state: {
      ...camera,
      radiusTarget: target,
      radiusMotionId: motionId,
    },
    commands: [
      titleCameraSpringCommand(
        TITLE_CAMERA_AXIS.Radius,
        camera.radius,
        target,
        motionId,
      ),
    ],
  };
}

function resolvedInitialCameraPlacement(
  placement: TitleCameraInitialPlacement,
): TitleSceneCameraPlacement {
  return {
    angle: placement.angle,
    radius: placement.radius,
    ...(placement.position == null ? {} : { position: placement.position }),
    ...(placement.target == null ? {} : { target: placement.target }),
  };
}

function titleCameraImmediateUpdate(camera: TitleCameraState): TitleCameraUpdate {
  return { state: camera, commands: [] };
}

function titleCameraWithAngle(
  camera: TitleCameraState,
  angle: number,
): TitleCameraState {
  return {
    ...camera,
    angle,
    position: titleSceneOrbitCameraPosition(
      angle,
      camera.radius,
      camera.target,
      camera.eyeY,
    ),
  };
}

function titleCameraWithRadius(
  camera: TitleCameraState,
  radius: number,
): TitleCameraState {
  return {
    ...camera,
    radius,
    position: titleSceneOrbitCameraPosition(
      camera.angle,
      radius,
      camera.target,
      camera.eyeY,
    ),
  };
}

function titleCameraSpringCommand(
  axis: TitleCameraAxis,
  from: number,
  to: number,
  motionId: number,
): Cmd<TitleCameraMotionMsg> {
  return (emit, caps) =>
    new Promise((resolve) => {
      let state = createSpringState(from);
      let accumulatedSeconds = 0;
      const pulse = caps.onPulse((dt) => {
        accumulatedSeconds = Math.min(
          TITLE_CAMERA_MAX_PULSE_SECONDS,
          accumulatedSeconds + Math.min(dt, TITLE_CAMERA_MAX_PULSE_SECONDS),
        );
        let stepped = false;
        while (
          accumulatedSeconds >= TITLE_CAMERA_FIXED_STEP_SECONDS &&
          !state.done
        ) {
          state = springStep(
            state,
            to,
            TITLE_CAMERA_SPRING,
            TITLE_CAMERA_FIXED_STEP_SECONDS,
          );
          accumulatedSeconds -= TITLE_CAMERA_FIXED_STEP_SECONDS;
          stepped = true;
        }
        if (!stepped) {
          return;
        }
        emit(titleCameraFrame(axis, motionId, state.value));
        if (state.done) {
          pulse.dispose();
          resolve();
        }
      });
    });
}

function titleCameraFrame(
  axis: TitleCameraAxis,
  motionId: number,
  value: number,
): TitleCameraMotionMsg {
  return {
    type: TITLE_CAMERA_MESSAGE.Frame,
    axis,
    motionId,
    value,
  };
}
