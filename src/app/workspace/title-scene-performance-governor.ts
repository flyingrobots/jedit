const LIVE_TRACE = "live-trace";
const LOW_RATE_FROZEN_BACKDROP = "low-rate-frozen-backdrop";
const ANIMATED_TITLE_INPUT = "animated-title";
const LOW_RATE_INPUT = "low-rate-title";
const WITHIN_BUDGET = "within-budget";
const OVER_BUDGET = "over-budget";

export const TITLE_SCENE_FRAME_BUDGET_MS = 33;
export const TITLE_SCENE_LOW_RATE_REFRESH_SECONDS = 0.5;

export const TITLE_SCENE_RENDER_POSTURE = Object.freeze({
  LiveTrace: LIVE_TRACE,
  LowRateFrozenBackdrop: LOW_RATE_FROZEN_BACKDROP,
});

export type TitleSceneRenderPosture =
  | typeof LIVE_TRACE
  | typeof LOW_RATE_FROZEN_BACKDROP;

export type TitleSceneInputLatencyPosture =
  | typeof ANIMATED_TITLE_INPUT
  | typeof LOW_RATE_INPUT;

export type TitleSceneFrameBudgetPosture =
  | typeof WITHIN_BUDGET
  | typeof OVER_BUDGET;

export interface TitleScenePerformanceGovernorInput {
  readonly introActive: boolean;
  readonly idleTitleScreen: boolean;
  readonly frozenBackdropAvailable: boolean;
  readonly cacheAgeSeconds?: number;
  readonly frameTimeMs: number;
}

export interface TitleSceneRenderDecision {
  readonly posture: TitleSceneRenderPosture;
  readonly shouldTraceRays: boolean;
  readonly shouldUseFrozenBackdrop: boolean;
  readonly shouldRetainRenderedBackdrop: boolean;
  readonly inputLatencyPosture: TitleSceneInputLatencyPosture;
  readonly frameBudgetPosture: TitleSceneFrameBudgetPosture;
}

export interface TitleScenePerformanceFacts {
  readonly posture: TitleSceneRenderPosture;
  readonly tracesRays: boolean;
  readonly usesFrozenBackdrop: boolean;
  readonly retainsBackdrop: boolean;
  readonly inputLatencyPosture: TitleSceneInputLatencyPosture;
  readonly frameBudgetPosture: TitleSceneFrameBudgetPosture;
}

export function governTitleSceneRender(
  input: TitleScenePerformanceGovernorInput,
): TitleSceneRenderDecision {
  validateGovernorInput(input);
  const frameBudgetPosture = frameBudgetPostureFor(input.frameTimeMs);
  if (input.introActive) {
    return liveTraceDecision(frameBudgetPosture);
  }
  if (shouldReuseLowRateBackdrop(input, frameBudgetPosture)) {
    return frozenBackdropDecision(
      TITLE_SCENE_RENDER_POSTURE.LowRateFrozenBackdrop,
      LOW_RATE_INPUT,
      frameBudgetPosture,
    );
  }
  return liveTraceDecision(frameBudgetPosture);
}

export function titleScenePerformanceFacts(
  decision: TitleSceneRenderDecision,
): TitleScenePerformanceFacts {
  return {
    posture: decision.posture,
    tracesRays: decision.shouldTraceRays,
    usesFrozenBackdrop: decision.shouldUseFrozenBackdrop,
    retainsBackdrop: decision.shouldRetainRenderedBackdrop,
    inputLatencyPosture: decision.inputLatencyPosture,
    frameBudgetPosture: decision.frameBudgetPosture,
  };
}

function liveTraceDecision(
  frameBudgetPosture: TitleSceneFrameBudgetPosture,
): TitleSceneRenderDecision {
  return {
    posture: TITLE_SCENE_RENDER_POSTURE.LiveTrace,
    shouldTraceRays: true,
    shouldUseFrozenBackdrop: false,
    shouldRetainRenderedBackdrop: true,
    inputLatencyPosture: ANIMATED_TITLE_INPUT,
    frameBudgetPosture,
  };
}

function frozenBackdropDecision(
  posture: TitleSceneRenderPosture,
  inputLatencyPosture: TitleSceneInputLatencyPosture,
  frameBudgetPosture: TitleSceneFrameBudgetPosture,
): TitleSceneRenderDecision {
  return {
    posture,
    shouldTraceRays: false,
    shouldUseFrozenBackdrop: true,
    shouldRetainRenderedBackdrop: false,
    inputLatencyPosture,
    frameBudgetPosture,
  };
}

function shouldReuseLowRateBackdrop(
  input: TitleScenePerformanceGovernorInput,
  frameBudgetPosture: TitleSceneFrameBudgetPosture,
): boolean {
  return (
    input.idleTitleScreen &&
    input.frozenBackdropAvailable &&
    input.cacheAgeSeconds != null &&
    input.cacheAgeSeconds < TITLE_SCENE_LOW_RATE_REFRESH_SECONDS &&
    frameBudgetPosture === OVER_BUDGET
  );
}

function frameBudgetPostureFor(
  frameTimeMs: number,
): TitleSceneFrameBudgetPosture {
  return frameTimeMs > TITLE_SCENE_FRAME_BUDGET_MS
    ? OVER_BUDGET
    : WITHIN_BUDGET;
}

function validateGovernorInput(
  input: TitleScenePerformanceGovernorInput,
): void {
  if (!Number.isFinite(input.frameTimeMs) || input.frameTimeMs < 0) {
    throw new RangeError("frameTimeMs must be a non-negative finite number.");
  }
  if (
    input.cacheAgeSeconds != null &&
    (!Number.isFinite(input.cacheAgeSeconds) || input.cacheAgeSeconds < 0)
  ) {
    throw new RangeError(
      "cacheAgeSeconds must be a non-negative finite number.",
    );
  }
}
