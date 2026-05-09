import { createSpringState, springStep, type Cmd, type SpringConfig } from '@flyingrobots/bijou-tui';

export const TITLE_CAMERA_AXIS = {
  Angle: 'angle',
  Radius: 'radius',
} as const;

export const TITLE_CAMERA_MESSAGE = {
  Frame: 'title-camera-frame',
} as const;

const TITLE_CAMERA_KEY = {
  Left: 'left',
  Right: 'right',
  Up: 'up',
  Down: 'down',
} as const;

const DEFAULT_TITLE_CAMERA_ANGLE = 0;
const DEFAULT_TITLE_CAMERA_RADIUS = 8.5;
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
  damping: 2 * Math.sqrt(TITLE_CAMERA_SPRING_STIFFNESS * TITLE_CAMERA_SPRING_MASS),
  precision: TITLE_CAMERA_SPRING_PRECISION,
} satisfies SpringConfig;

export type TitleCameraAxis = typeof TITLE_CAMERA_AXIS[keyof typeof TITLE_CAMERA_AXIS];

export interface TitleCameraState {
  readonly angle: number;
  readonly angleTarget: number;
  readonly angleMotionId: number;
  readonly radius: number;
  readonly radiusTarget: number;
  readonly radiusMotionId: number;
}

export interface TitleCameraInitialPlacement {
  readonly angle: number;
  readonly radius: number;
}

export interface TitleCameraMotionMsg {
  readonly type: typeof TITLE_CAMERA_MESSAGE.Frame;
  readonly axis: TitleCameraAxis;
  readonly motionId: number;
  readonly value: number;
}

export interface TitleCameraUpdate {
  readonly state: TitleCameraState;
  readonly commands: Cmd<TitleCameraMotionMsg>[];
}

export function createTitleCameraState(placement: TitleCameraInitialPlacement = {
  angle: DEFAULT_TITLE_CAMERA_ANGLE,
  radius: DEFAULT_TITLE_CAMERA_RADIUS,
}): TitleCameraState {
  return {
    angle: placement.angle,
    angleTarget: placement.angle,
    angleMotionId: 0,
    radius: placement.radius,
    radiusTarget: placement.radius,
    radiusMotionId: 0,
  };
}

export function updateTitleCameraFromKey(key: string, camera: TitleCameraState): TitleCameraUpdate | undefined {
  switch (key) {
    case TITLE_CAMERA_KEY.Left:
      return titleCameraAngleUpdate(camera, camera.angleTarget - TITLE_CAMERA_ANGLE_STEP);
    case TITLE_CAMERA_KEY.Right:
      return titleCameraAngleUpdate(camera, camera.angleTarget + TITLE_CAMERA_ANGLE_STEP);
    case TITLE_CAMERA_KEY.Up:
      return titleCameraRadiusUpdate(camera, Math.max(TITLE_CAMERA_MIN_RADIUS, camera.radiusTarget - TITLE_CAMERA_RADIUS_STEP));
    case TITLE_CAMERA_KEY.Down:
      return titleCameraRadiusUpdate(camera, camera.radiusTarget + TITLE_CAMERA_RADIUS_STEP);
    default:
      return undefined;
  }
}

export function reduceTitleCameraMotion(camera: TitleCameraState, msg: TitleCameraMotionMsg): TitleCameraState {
  if (msg.axis === TITLE_CAMERA_AXIS.Angle) {
    if (msg.motionId !== camera.angleMotionId) {
      return camera;
    }
    return { ...camera, angle: msg.value };
  }

  if (msg.motionId !== camera.radiusMotionId) {
    return camera;
  }
  return { ...camera, radius: msg.value };
}

function titleCameraAngleUpdate(camera: TitleCameraState, target: number): TitleCameraUpdate {
  const motionId = camera.angleMotionId + 1;
  return {
    state: {
      ...camera,
      angleTarget: target,
      angleMotionId: motionId,
    },
    commands: [titleCameraSpringCommand(TITLE_CAMERA_AXIS.Angle, camera.angle, target, motionId)],
  };
}

function titleCameraRadiusUpdate(camera: TitleCameraState, target: number): TitleCameraUpdate {
  const motionId = camera.radiusMotionId + 1;
  return {
    state: {
      ...camera,
      radiusTarget: target,
      radiusMotionId: motionId,
    },
    commands: [titleCameraSpringCommand(TITLE_CAMERA_AXIS.Radius, camera.radius, target, motionId)],
  };
}

function titleCameraSpringCommand(
  axis: TitleCameraAxis,
  from: number,
  to: number,
  motionId: number,
): Cmd<TitleCameraMotionMsg> {
  return (emit, caps) => new Promise((resolve) => {
    let state = createSpringState(from);
    let accumulatedSeconds = 0;
    const pulse = caps.onPulse((dt) => {
      accumulatedSeconds = Math.min(TITLE_CAMERA_MAX_PULSE_SECONDS, accumulatedSeconds + Math.min(dt, TITLE_CAMERA_MAX_PULSE_SECONDS));
      let stepped = false;
      while (accumulatedSeconds >= TITLE_CAMERA_FIXED_STEP_SECONDS && !state.done) {
        state = springStep(state, to, TITLE_CAMERA_SPRING, TITLE_CAMERA_FIXED_STEP_SECONDS);
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

function titleCameraFrame(axis: TitleCameraAxis, motionId: number, value: number): TitleCameraMotionMsg {
  return {
    type: TITLE_CAMERA_MESSAGE.Frame,
    axis,
    motionId,
    value,
  };
}
