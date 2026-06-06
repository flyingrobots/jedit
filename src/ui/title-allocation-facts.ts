import { TITLE_RENDER_MODE, type TitleRenderMode } from "./title-screen.js";

export const TITLE_RAY_ALLOCATION_POSTURE = {
  Unmeasured: "unmeasured",
  Allocating: "allocating",
  BoundedAfterWarmup: "bounded-after-warmup",
  ZeroHotLoop: "zero-hot-loop",
} as const;

export type TitleRayAllocationPosture =
  (typeof TITLE_RAY_ALLOCATION_POSTURE)[keyof typeof TITLE_RAY_ALLOCATION_POSTURE];

export const TITLE_RAY_ALLOCATION_RENDERER = "title-braille-bunny";

export interface TitleRayAllocationFacts {
  readonly renderer: typeof TITLE_RAY_ALLOCATION_RENDERER;
  readonly width: number;
  readonly height: number;
  readonly renderMode: typeof TITLE_RENDER_MODE.Braille;
  readonly warmupFrames: number;
  readonly measuredFrames: number;
  readonly posture: TitleRayAllocationPosture;
  readonly allocatedBytes?: number;
  readonly allocationEvents?: number;
  readonly notes: readonly string[];
}

export interface TitleRayAllocationFactsInput {
  readonly width: number;
  readonly height: number;
  readonly renderMode: TitleRenderMode;
  readonly warmupFrames: number;
  readonly measuredFrames: number;
  readonly posture: TitleRayAllocationPosture;
  readonly allocatedBytes?: number;
  readonly allocationEvents?: number;
  readonly notes?: readonly string[];
}

const MINIMUM_POSITIVE_INTEGER = 1;
const MINIMUM_NON_NEGATIVE_INTEGER = 0;

export function createTitleRayAllocationFacts(
  input: TitleRayAllocationFactsInput,
): TitleRayAllocationFacts {
  assertPositiveInteger(input.width, "width");
  assertPositiveInteger(input.height, "height");
  assertBrailleRenderMode(input.renderMode);
  assertNonNegativeInteger(input.warmupFrames, "warmupFrames");
  assertPositiveInteger(input.measuredFrames, "measuredFrames");
  assertTitleRayAllocationPosture(input.posture);
  const allocatedBytes = optionalNonNegativeInteger(
    input.allocatedBytes,
    "allocatedBytes",
  );
  const allocationEvents = optionalNonNegativeInteger(
    input.allocationEvents,
    "allocationEvents",
  );
  return {
    renderer: TITLE_RAY_ALLOCATION_RENDERER,
    width: input.width,
    height: input.height,
    renderMode: TITLE_RENDER_MODE.Braille,
    warmupFrames: input.warmupFrames,
    measuredFrames: input.measuredFrames,
    posture: input.posture,
    ...(allocatedBytes == null ? {} : { allocatedBytes }),
    ...(allocationEvents == null ? {} : { allocationEvents }),
    notes: [...(input.notes ?? [])],
  };
}

function assertPositiveInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < MINIMUM_POSITIVE_INTEGER) {
    throw new RangeError(`${fieldName} must be a positive integer.`);
  }
}

function assertNonNegativeInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < MINIMUM_NON_NEGATIVE_INTEGER) {
    throw new RangeError(`${fieldName} must be a non-negative integer.`);
  }
}

function optionalNonNegativeInteger(
  value: number | undefined,
  fieldName: string,
): number | undefined {
  if (value == null) {
    return undefined;
  }
  assertNonNegativeInteger(value, fieldName);
  return value;
}

function assertBrailleRenderMode(renderMode: TitleRenderMode): void {
  if (renderMode !== TITLE_RENDER_MODE.Braille) {
    throw new RangeError("title allocation facts only support Braille mode.");
  }
}

function assertTitleRayAllocationPosture(
  posture: TitleRayAllocationPosture,
): void {
  if (!Object.values(TITLE_RAY_ALLOCATION_POSTURE).includes(posture)) {
    throw new RangeError("unknown title allocation posture.");
  }
}
