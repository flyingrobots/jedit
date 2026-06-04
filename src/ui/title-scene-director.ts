export interface TitleSceneCameraCue {
  readonly driftRate: number;
}

export interface TitleSceneOpacityCue {
  readonly appearAtSeconds: number;
  readonly fadeAtSeconds: number;
  readonly fadeDurationSeconds: number;
}

export interface TitleSceneSheenCue {
  readonly startAtSeconds: number;
  readonly durationSeconds: number;
}

export interface TitleSceneDirectorTimeline {
  readonly camera: TitleSceneCameraCue;
  readonly flyingRobotsLogo: TitleSceneOpacityCue;
  readonly titleLogo: TitleSceneOpacityCue;
  readonly titleLogoSheen: TitleSceneSheenCue;
}

const DEFAULT_FLYINGROBOTS_APPEAR_SECONDS = 0;
const DEFAULT_TITLE_APPEAR_SECONDS = 2;
const DEFAULT_FLYINGROBOTS_FADE_START_SECONDS = 3;
const DEFAULT_TITLE_FADE_START_SECONDS = 5;
const DEFAULT_FADE_DURATION_SECONDS = 1;
const DEFAULT_SHEEN_DURATION_SECONDS = 2;
const DEFAULT_CAMERA_DRIFT_RATE = 0.024;

const TITLE_SCENE_DEFAULT_DIRECTOR_TIMELINE_DATA = {
  camera: {
    driftRate: DEFAULT_CAMERA_DRIFT_RATE,
  },
  flyingRobotsLogo: {
    appearAtSeconds: DEFAULT_FLYINGROBOTS_APPEAR_SECONDS,
    fadeAtSeconds: DEFAULT_FLYINGROBOTS_FADE_START_SECONDS,
    fadeDurationSeconds: DEFAULT_FADE_DURATION_SECONDS,
  },
  titleLogo: {
    appearAtSeconds: DEFAULT_TITLE_APPEAR_SECONDS,
    fadeAtSeconds: DEFAULT_TITLE_FADE_START_SECONDS,
    fadeDurationSeconds: DEFAULT_FADE_DURATION_SECONDS,
  },
  titleLogoSheen: {
    startAtSeconds: DEFAULT_TITLE_APPEAR_SECONDS,
    durationSeconds: DEFAULT_SHEEN_DURATION_SECONDS,
  },
} satisfies TitleSceneDirectorTimeline;

export const TITLE_SCENE_DEFAULT_DIRECTOR_TIMELINE =
  validateTitleSceneDirectorTimeline(
    TITLE_SCENE_DEFAULT_DIRECTOR_TIMELINE_DATA,
  );

export function validateTitleSceneDirectorTimeline(
  timeline: TitleSceneDirectorTimeline,
): TitleSceneDirectorTimeline {
  validateCameraCue("camera", timeline.camera);
  validateOpacityCue("flyingRobotsLogo", timeline.flyingRobotsLogo);
  validateOpacityCue("titleLogo", timeline.titleLogo);
  validateSheenCue("titleLogoSheen", timeline.titleLogoSheen);
  return timeline;
}

export function titleSceneCueOpacity(
  time: number,
  cue: TitleSceneOpacityCue,
): number {
  if (
    time < cue.appearAtSeconds ||
    time >= cue.fadeAtSeconds + cue.fadeDurationSeconds
  ) {
    return 0;
  }
  if (cue.fadeDurationSeconds === 0 || time < cue.fadeAtSeconds) {
    return 1;
  }
  return clampTitleSceneCueRatio(
    1 - (time - cue.fadeAtSeconds) / cue.fadeDurationSeconds,
  );
}

export function titleSceneCueProgress(
  time: number,
  cue: TitleSceneSheenCue,
): number | undefined {
  const endAtSeconds = cue.startAtSeconds + cue.durationSeconds;
  if (time < cue.startAtSeconds || time > endAtSeconds) {
    return undefined;
  }
  if (cue.durationSeconds === 0) {
    return 1;
  }
  return clampTitleSceneCueRatio(
    (time - cue.startAtSeconds) / cue.durationSeconds,
  );
}

export function titleSceneCameraAngleAt(
  timeline: TitleSceneDirectorTimeline,
  baseAngle: number,
  time: number,
): number {
  return baseAngle + time * timeline.camera.driftRate;
}

function validateCameraCue(name: string, cue: TitleSceneCameraCue): void {
  requireNonNegativeFinite(`${name}.driftRate`, cue.driftRate);
}

function validateOpacityCue(name: string, cue: TitleSceneOpacityCue): void {
  requireNonNegativeFinite(`${name}.appearAtSeconds`, cue.appearAtSeconds);
  requireNonNegativeFinite(`${name}.fadeAtSeconds`, cue.fadeAtSeconds);
  requireNonNegativeFinite(
    `${name}.fadeDurationSeconds`,
    cue.fadeDurationSeconds,
  );
  if (cue.fadeAtSeconds < cue.appearAtSeconds) {
    throw new RangeError(
      `${name}.fadeAtSeconds must not precede appearAtSeconds`,
    );
  }
}

function validateSheenCue(name: string, cue: TitleSceneSheenCue): void {
  requireNonNegativeFinite(`${name}.startAtSeconds`, cue.startAtSeconds);
  requireNonNegativeFinite(`${name}.durationSeconds`, cue.durationSeconds);
}

function requireNonNegativeFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}

function clampTitleSceneCueRatio(value: number): number {
  return Math.max(0, Math.min(1, value));
}
