import {
  brailleSampleActivityRatio,
  type BrailleSampleFrameStats,
  type BrailleTraceBudget,
} from "../../ui/averaging-braille-canvas.js";

export interface TitleBrailleTraceBudgetInput {
  readonly frameIndex: number;
  readonly frameTimeMs: number;
  readonly previousStats?: BrailleSampleFrameStats;
}

const TITLE_BRAILLE_FULL_PHASE_COUNT = 1;
const TITLE_BRAILLE_HALF_PHASE_COUNT = 2;
const TITLE_BRAILLE_QUARTER_PHASE_COUNT = 4;
const TITLE_BRAILLE_FRAME_BUDGET_MS = 33;
const TITLE_BRAILLE_HEAVY_FRAME_MS = 66;
const TITLE_BRAILLE_ACTIVE_SCREEN_RATIO = 0.2;

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
  if (!isTitleBraillePressureFrame(input)) {
    return TITLE_BRAILLE_FULL_PHASE_COUNT;
  }
  return input.frameTimeMs > TITLE_BRAILLE_HEAVY_FRAME_MS
    ? TITLE_BRAILLE_QUARTER_PHASE_COUNT
    : TITLE_BRAILLE_HALF_PHASE_COUNT;
}

function isTitleBraillePressureFrame(
  input: TitleBrailleTraceBudgetInput,
): boolean {
  return (
    input.frameTimeMs > TITLE_BRAILLE_FRAME_BUDGET_MS &&
    input.previousStats != null &&
    brailleSampleActivityRatio(input.previousStats) >=
      TITLE_BRAILLE_ACTIVE_SCREEN_RATIO
  );
}
