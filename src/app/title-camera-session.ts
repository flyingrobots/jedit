import { animate, type Cmd, type SpringConfig } from '@flyingrobots/bijou-tui';

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

export function createTitleCameraState(): TitleCameraState {
  return {
    angle: DEFAULT_TITLE_CAMERA_ANGLE,
    angleTarget: DEFAULT_TITLE_CAMERA_ANGLE,
    angleMotionId: 0,
    radius: DEFAULT_TITLE_CAMERA_RADIUS,
    radiusTarget: DEFAULT_TITLE_CAMERA_RADIUS,
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
  return animate<TitleCameraMotionMsg>({
    type: 'spring',
    from,
    to,
    spring: TITLE_CAMERA_SPRING,
    onFrame: (value) => ({
      type: TITLE_CAMERA_MESSAGE.Frame,
      axis,
      motionId,
      value,
    }),
  });
}
