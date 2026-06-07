import {
  titleCameraAdvanced,
  type TitleCameraFpsState,
} from "./title-camera-fps.js";

const TITLE_CAMERA_INPUT_LEASE_MS = 320;
const TITLE_CAMERA_INPUT_CHORD_MEMORY_MS = 1200;
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
  readonly forwardChordUntilMs?: number;
  readonly backwardChordUntilMs?: number;
  readonly leftChordUntilMs?: number;
  readonly rightChordUntilMs?: number;
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
  const activeLease = titleCameraInputHasActiveLease(active);
  return {
    state: titleCameraAdvanced(camera, {
      dtSeconds: Math.max(0, dtMs) / MILLISECONDS_PER_SECOND,
      forward: activeLease && titleCameraInputForward(active),
      backward: activeLease && titleCameraInputBackward(active),
      left: activeLease && titleCameraInputLeft(active),
      right: activeLease && titleCameraInputRight(active),
    }),
    input: active,
  };
}

function refreshForwardInput(
  input: TitleCameraInputState,
  atMs: number,
): TitleCameraInputState {
  const active = activeTitleCameraInput(input, atMs);
  return {
    forwardUntilMs: activeInputUntilMs(atMs),
    forwardChordUntilMs: chordMemoryUntilMs(atMs),
    backwardUntilMs: undefined,
    backwardChordUntilMs: undefined,
    leftUntilMs: refreshedActiveInputUntilMs(active.leftUntilMs, atMs),
    rightUntilMs: refreshedActiveInputUntilMs(active.rightUntilMs, atMs),
    leftChordUntilMs: refreshedChordMemoryUntilMs(active.leftChordUntilMs, atMs),
    rightChordUntilMs: refreshedChordMemoryUntilMs(active.rightChordUntilMs, atMs),
  };
}

function refreshBackwardInput(
  input: TitleCameraInputState,
  atMs: number,
): TitleCameraInputState {
  const active = activeTitleCameraInput(input, atMs);
  return {
    forwardUntilMs: undefined,
    forwardChordUntilMs: undefined,
    backwardUntilMs: activeInputUntilMs(atMs),
    backwardChordUntilMs: chordMemoryUntilMs(atMs),
    leftUntilMs: refreshedActiveInputUntilMs(active.leftUntilMs, atMs),
    rightUntilMs: refreshedActiveInputUntilMs(active.rightUntilMs, atMs),
    leftChordUntilMs: refreshedChordMemoryUntilMs(active.leftChordUntilMs, atMs),
    rightChordUntilMs: refreshedChordMemoryUntilMs(active.rightChordUntilMs, atMs),
  };
}

function refreshLeftInput(
  input: TitleCameraInputState,
  atMs: number,
): TitleCameraInputState {
  const active = activeTitleCameraInput(input, atMs);
  return {
    forwardUntilMs: refreshedActiveInputUntilMs(active.forwardUntilMs, atMs),
    backwardUntilMs: refreshedActiveInputUntilMs(active.backwardUntilMs, atMs),
    forwardChordUntilMs: refreshedChordMemoryUntilMs(active.forwardChordUntilMs, atMs),
    backwardChordUntilMs: refreshedChordMemoryUntilMs(active.backwardChordUntilMs, atMs),
    leftUntilMs: activeInputUntilMs(atMs),
    leftChordUntilMs: chordMemoryUntilMs(atMs),
    rightUntilMs: undefined,
    rightChordUntilMs: undefined,
  };
}

function refreshRightInput(
  input: TitleCameraInputState,
  atMs: number,
): TitleCameraInputState {
  const active = activeTitleCameraInput(input, atMs);
  return {
    forwardUntilMs: refreshedActiveInputUntilMs(active.forwardUntilMs, atMs),
    backwardUntilMs: refreshedActiveInputUntilMs(active.backwardUntilMs, atMs),
    forwardChordUntilMs: refreshedChordMemoryUntilMs(active.forwardChordUntilMs, atMs),
    backwardChordUntilMs: refreshedChordMemoryUntilMs(active.backwardChordUntilMs, atMs),
    leftUntilMs: undefined,
    leftChordUntilMs: undefined,
    rightUntilMs: activeInputUntilMs(atMs),
    rightChordUntilMs: chordMemoryUntilMs(atMs),
  };
}

function activeTitleCameraInput(
  input: TitleCameraInputState,
  atMs: number,
): TitleCameraInputState {
  return titleCameraInputState({
    forwardUntilMs: activeUntilMs(input.forwardUntilMs, atMs),
    backwardUntilMs: activeUntilMs(input.backwardUntilMs, atMs),
    leftUntilMs: activeUntilMs(input.leftUntilMs, atMs),
    rightUntilMs: activeUntilMs(input.rightUntilMs, atMs),
    forwardChordUntilMs: activeUntilMs(input.forwardChordUntilMs, atMs),
    backwardChordUntilMs: activeUntilMs(input.backwardChordUntilMs, atMs),
    leftChordUntilMs: activeUntilMs(input.leftChordUntilMs, atMs),
    rightChordUntilMs: activeUntilMs(input.rightChordUntilMs, atMs),
  });
}

function titleCameraInputState(input: TitleCameraInputState): TitleCameraInputState {
  return {
    ...forwardUntilField(input),
    ...backwardUntilField(input),
    ...leftUntilField(input),
    ...rightUntilField(input),
    ...forwardChordUntilField(input),
    ...backwardChordUntilField(input),
    ...leftChordUntilField(input),
    ...rightChordUntilField(input),
  };
}

function forwardUntilField(input: TitleCameraInputState): TitleCameraInputState {
  return input.forwardUntilMs == null
    ? {}
    : { forwardUntilMs: input.forwardUntilMs };
}

function backwardUntilField(input: TitleCameraInputState): TitleCameraInputState {
  return input.backwardUntilMs == null
    ? {}
    : { backwardUntilMs: input.backwardUntilMs };
}

function leftUntilField(input: TitleCameraInputState): TitleCameraInputState {
  return input.leftUntilMs == null ? {} : { leftUntilMs: input.leftUntilMs };
}

function rightUntilField(input: TitleCameraInputState): TitleCameraInputState {
  return input.rightUntilMs == null ? {} : { rightUntilMs: input.rightUntilMs };
}

function forwardChordUntilField(
  input: TitleCameraInputState,
): TitleCameraInputState {
  return input.forwardChordUntilMs == null
    ? {}
    : { forwardChordUntilMs: input.forwardChordUntilMs };
}

function backwardChordUntilField(
  input: TitleCameraInputState,
): TitleCameraInputState {
  return input.backwardChordUntilMs == null
    ? {}
    : { backwardChordUntilMs: input.backwardChordUntilMs };
}

function leftChordUntilField(input: TitleCameraInputState): TitleCameraInputState {
  return input.leftChordUntilMs == null
    ? {}
    : { leftChordUntilMs: input.leftChordUntilMs };
}

function rightChordUntilField(
  input: TitleCameraInputState,
): TitleCameraInputState {
  return input.rightChordUntilMs == null
    ? {}
    : { rightChordUntilMs: input.rightChordUntilMs };
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

function chordMemoryUntilMs(atMs: number): number {
  return atMs + TITLE_CAMERA_INPUT_CHORD_MEMORY_MS;
}

function refreshedActiveInputUntilMs(
  candidateUntilMs: number | undefined,
  atMs: number,
): number | undefined {
  return candidateUntilMs == null ? undefined : activeInputUntilMs(atMs);
}

function refreshedChordMemoryUntilMs(
  candidateUntilMs: number | undefined,
  atMs: number,
): number | undefined {
  return candidateUntilMs == null ? undefined : chordMemoryUntilMs(atMs);
}

function titleCameraInputHasActiveLease(input: TitleCameraInputState): boolean {
  return (
    input.forwardUntilMs != null ||
    input.backwardUntilMs != null ||
    input.leftUntilMs != null ||
    input.rightUntilMs != null
  );
}

function titleCameraInputForward(input: TitleCameraInputState): boolean {
  return input.forwardUntilMs != null || input.forwardChordUntilMs != null;
}

function titleCameraInputBackward(input: TitleCameraInputState): boolean {
  return input.backwardUntilMs != null || input.backwardChordUntilMs != null;
}

function titleCameraInputLeft(input: TitleCameraInputState): boolean {
  return input.leftUntilMs != null || input.leftChordUntilMs != null;
}

function titleCameraInputRight(input: TitleCameraInputState): boolean {
  return input.rightUntilMs != null || input.rightChordUntilMs != null;
}
