import {
  titleCameraAdvanced,
  type TitleCameraFpsState,
} from "./title-camera-fps.js";

const TITLE_CAMERA_INPUT_LEASE_MS = 320;
const MILLISECONDS_PER_SECOND = 1000;

const TITLE_CAMERA_INPUT_KEY = {
  W: "w",
  A: "a",
  S: "s",
  D: "d",
} as const;

export interface TitleCameraInputState {
  readonly forwardUntilMs?: number;
  readonly backwardUntilMs?: number;
  readonly leftUntilMs?: number;
  readonly rightUntilMs?: number;
}

export interface TitleCameraFrameAdvance {
  readonly state: TitleCameraFpsState;
  readonly input: TitleCameraInputState;
}

export function createTitleCameraInputState(): TitleCameraInputState {
  return {};
}

export function refreshTitleCameraInputFromKey(
  key: string,
  input: TitleCameraInputState,
  atMs: number,
): TitleCameraInputState | undefined {
  switch (key) {
    case TITLE_CAMERA_INPUT_KEY.W:
      return refreshForwardInput(input, atMs);
    case TITLE_CAMERA_INPUT_KEY.S:
      return refreshBackwardInput(input, atMs);
    case TITLE_CAMERA_INPUT_KEY.A:
      return refreshLeftInput(input, atMs);
    case TITLE_CAMERA_INPUT_KEY.D:
      return refreshRightInput(input, atMs);
    default:
      return undefined;
  }
}

export function advanceTitleCameraFrame(
  camera: TitleCameraFpsState,
  input: TitleCameraInputState,
  atMs: number,
  dtMs: number,
): TitleCameraFrameAdvance {
  const active = activeTitleCameraInput(input, atMs);
  return {
    state: titleCameraAdvanced(camera, {
      dtSeconds: Math.max(0, dtMs) / MILLISECONDS_PER_SECOND,
      forward: active.forwardUntilMs != null,
      backward: active.backwardUntilMs != null,
      left: active.leftUntilMs != null,
      right: active.rightUntilMs != null,
    }),
    input: active,
  };
}

function refreshForwardInput(
  input: TitleCameraInputState,
  atMs: number,
): TitleCameraInputState {
  return {
    ...input,
    forwardUntilMs: activeInputUntilMs(atMs),
    backwardUntilMs: undefined,
  };
}

function refreshBackwardInput(
  input: TitleCameraInputState,
  atMs: number,
): TitleCameraInputState {
  return {
    ...input,
    forwardUntilMs: undefined,
    backwardUntilMs: activeInputUntilMs(atMs),
  };
}

function refreshLeftInput(
  input: TitleCameraInputState,
  atMs: number,
): TitleCameraInputState {
  return {
    ...input,
    leftUntilMs: activeInputUntilMs(atMs),
    rightUntilMs: undefined,
  };
}

function refreshRightInput(
  input: TitleCameraInputState,
  atMs: number,
): TitleCameraInputState {
  return {
    ...input,
    leftUntilMs: undefined,
    rightUntilMs: activeInputUntilMs(atMs),
  };
}

function activeTitleCameraInput(
  input: TitleCameraInputState,
  atMs: number,
): TitleCameraInputState {
  return titleCameraInputState(
    activeUntilMs(input.forwardUntilMs, atMs),
    activeUntilMs(input.backwardUntilMs, atMs),
    activeUntilMs(input.leftUntilMs, atMs),
    activeUntilMs(input.rightUntilMs, atMs),
  );
}

function titleCameraInputState(
  forwardUntilMs: number | undefined,
  backwardUntilMs: number | undefined,
  leftUntilMs: number | undefined,
  rightUntilMs: number | undefined,
): TitleCameraInputState {
  return {
    ...(forwardUntilMs == null ? {} : { forwardUntilMs }),
    ...(backwardUntilMs == null ? {} : { backwardUntilMs }),
    ...(leftUntilMs == null ? {} : { leftUntilMs }),
    ...(rightUntilMs == null ? {} : { rightUntilMs }),
  };
}

function activeUntilMs(
  candidateUntilMs: number | undefined,
  atMs: number,
): number | undefined {
  return candidateUntilMs != null && candidateUntilMs >= atMs
    ? candidateUntilMs
    : undefined;
}

function activeInputUntilMs(atMs: number): number {
  return atMs + TITLE_CAMERA_INPUT_LEASE_MS;
}
