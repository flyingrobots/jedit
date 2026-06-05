import {
  brailleSampleActivityRatio,
  brailleSampleRayPressureRatio,
  type BrailleSampleFrameStats,
  type BrailleTraceBudget,
} from "../../ui/averaging-braille-canvas.js";

export interface TitleBrailleTraceBudgetInput {
  readonly frameIndex: number;
  readonly frameTimeMs: number;
  readonly previousStats?: BrailleSampleFrameStats;
  readonly previousPhaseCount?: number;
  readonly cameraMoving?: boolean;
}

const TITLE_BRAILLE_FULL_PHASE_COUNT = 1;
const TITLE_BRAILLE_HALF_PHASE_COUNT = 2;
const TITLE_BRAILLE_QUARTER_PHASE_COUNT = 4;
const TITLE_BRAILLE_MOTION_PHASE_COUNT = 8;
const TITLE_BRAILLE_FRAME_BUDGET_MS = 33;
const TITLE_BRAILLE_HEAVY_FRAME_MS = 66;
const TITLE_BRAILLE_ACTIVE_SCREEN_RATIO = 0.2;
const TITLE_BRAILLE_RAY_PRESSURE_RATIO = 0.2;

export function titleBrailleTraceBudget(
  input: TitleBrailleTraceBudgetInput,
): BrailleTraceBudget {
  const phaseCount = titleBrailleTracePhaseCount(input);
  return {
    phase:
      phaseCount === TITLE_BRAILLE_FULL_PHASE_COUNT
        ? 0
        : input.frameIndex % phaseCount,
    phaseCount,
  };
}

function titleBrailleTracePhaseCount(
  input: TitleBrailleTraceBudgetInput,
): number {
  if (!isTitleBraillePressureScreen(input.previousStats)) {
    return TITLE_BRAILLE_FULL_PHASE_COUNT;
  }
  if (input.cameraMoving === true) {
    return TITLE_BRAILLE_MOTION_PHASE_COUNT;
  }
  if (isTitleBraillePressureFrame(input)) {
    return input.frameTimeMs > TITLE_BRAILLE_HEAVY_FRAME_MS
      ? TITLE_BRAILLE_QUARTER_PHASE_COUNT
      : TITLE_BRAILLE_HALF_PHASE_COUNT;
  }
  return isReducedTitleBraillePhaseCount(input.previousPhaseCount)
    ? input.previousPhaseCount
    : TITLE_BRAILLE_FULL_PHASE_COUNT;
}

function isTitleBraillePressureFrame(
  input: TitleBrailleTraceBudgetInput,
): boolean {
  return input.frameTimeMs > TITLE_BRAILLE_FRAME_BUDGET_MS;
}

function isTitleBraillePressureScreen(
  stats: BrailleSampleFrameStats | undefined,
): boolean {
  const rayPressureRatio =
    stats == null ? undefined : brailleSampleRayPressureRatio(stats);
  if (rayPressureRatio != null) {
    return rayPressureRatio >= TITLE_BRAILLE_RAY_PRESSURE_RATIO;
  }
  return (
    stats != null &&
    brailleSampleActivityRatio(stats) >= TITLE_BRAILLE_ACTIVE_SCREEN_RATIO
  );
}

function isReducedTitleBraillePhaseCount(
  phaseCount: number | undefined,
): phaseCount is 2 | 4 | 8 {
  return (
    phaseCount === TITLE_BRAILLE_HALF_PHASE_COUNT ||
    phaseCount === TITLE_BRAILLE_QUARTER_PHASE_COUNT ||
    phaseCount === TITLE_BRAILLE_MOTION_PHASE_COUNT
  );
}
