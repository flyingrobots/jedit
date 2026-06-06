import type { TitleSceneVector3 } from "./title-scene.js";

export interface TitleSceneCameraPlacement {
  readonly angle: number;
  readonly radius: number;
  readonly position?: TitleSceneVector3;
  readonly target?: TitleSceneVector3;
}

export interface TitleSceneCameraOrbit {
  readonly angle: number;
  readonly radius: number;
}

export const TITLE_SCENE_DEFAULT_CAMERA_ANGLE = 0;
export const TITLE_SCENE_DEFAULT_CAMERA_RADIUS = 8.5;
export const TITLE_SCENE_DEFAULT_CAMERA_EYE_Y = 3.35;
export const TITLE_SCENE_DEFAULT_CAMERA_TARGET: TitleSceneVector3 = [
  0, 0.78, 0,
];

const CAMERA_ZERO_RADIUS_EPSILON = 0.000001;

export function titleSceneCameraTarget(
  camera: TitleSceneCameraPlacement,
): TitleSceneVector3 {
  return camera.target ?? TITLE_SCENE_DEFAULT_CAMERA_TARGET;
}

export function titleSceneCameraPosition(
  camera: TitleSceneCameraPlacement,
): TitleSceneVector3 {
  if (camera.position != null) {
    return camera.position;
  }
  const target = titleSceneCameraTarget(camera);
  return titleSceneOrbitCameraPosition(
    camera.angle,
    camera.radius,
    target,
    TITLE_SCENE_DEFAULT_CAMERA_EYE_Y,
  );
}

export function titleSceneCameraPlacementFromPosition(
  position: TitleSceneVector3,
  target: TitleSceneVector3 = TITLE_SCENE_DEFAULT_CAMERA_TARGET,
): TitleSceneCameraPlacement {
  return {
    ...titleSceneCameraOrbitFromPosition(position, target),
    position,
    target,
  };
}

export function titleSceneCameraOrbitFromPosition(
  position: TitleSceneVector3,
  target: TitleSceneVector3,
): TitleSceneCameraOrbit {
  const x = position[0] - target[0];
  const z = position[2] - target[2];
  const radius = Math.hypot(x, z);
  return {
    angle:
      radius <= CAMERA_ZERO_RADIUS_EPSILON
        ? TITLE_SCENE_DEFAULT_CAMERA_ANGLE
        : Math.atan2(x, z),
    radius,
  };
}

export function titleSceneOrbitCameraPosition(
  angle: number,
  radius: number,
  target: TitleSceneVector3,
  eyeY: number,
): TitleSceneVector3 {
  return [
    target[0] + Math.sin(angle) * radius,
    eyeY,
    target[2] + Math.cos(angle) * radius,
  ];
}
