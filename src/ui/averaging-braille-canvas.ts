import { createSurface, type Cell, type Surface } from "@flyingrobots/bijou";

export type RGB = readonly [number, number, number];

export interface BrailleShaderParams {
  readonly u: number;
  readonly v: number;
  readonly time: number;
}

export interface BrailleShaderSample {
  readonly on: boolean;
  readonly fgRGB: RGB;
  readonly bgRGB: RGB;
  readonly rayCount?: number;
  readonly rayIntersectionCount?: number;
  readonly modifiers?: readonly string[];
}

export type BrailleShaderFn = (
  params: BrailleShaderParams,
) => BrailleShaderSample;

export interface BrailleTraceBudget {
  readonly phase: number;
  readonly phaseCount: number;
}

export interface BrailleSampleCache {
  width: number;
  height: number;
  samples: Array<BrailleShaderSample | undefined>;
}

export interface BrailleSampleFrameStats {
  totalSamples: number;
  tracedSamples: number;
  reusedSamples: number;
  activeSamples: number;
  coldMissSamples: number;
  rayCount: number;
  rayIntersectionCount: number;
}

export interface AveragingBrailleCanvasOptions {
  readonly sampleCache?: BrailleSampleCache;
  readonly traceBudget?: BrailleTraceBudget;
  readonly stats?: BrailleSampleFrameStats;
}

interface CollapseBrailleCellOptions {
  readonly x: number;
  readonly y: number;
  readonly cols: number;
  readonly subpixelWidth: number;
  readonly subpixelHeight: number;
  readonly time: number;
  readonly shader: BrailleShaderFn;
  readonly sampling: BrailleSamplingContext;
}

interface CollapseBrailleAccumulator {
  code: number;
  fgRed: number;
  fgGreen: number;
  fgBlue: number;
  bgRed: number;
  bgGreen: number;
  bgBlue: number;
  readonly modifiers: string[];
}

interface BrailleSamplingContext {
  readonly cache?: BrailleSampleCache;
  readonly budget: BrailleTraceBudget;
  readonly stats?: BrailleSampleFrameStats;
}

const BRAILLE_COLUMNS_PER_CELL = 2;
const BRAILLE_ROWS_PER_CELL = 4;
export const BRAILLE_SAMPLE_COUNT =
  BRAILLE_COLUMNS_PER_CELL * BRAILLE_ROWS_PER_CELL;
const BRAILLE_BASE_CODE_POINT = 0x2800;
const BRAILLE_FULL_PHASE_COUNT = 1;
const BRAILLE_HALF_PHASE_COUNT = 2;
const BRAILLE_QUARTER_PHASE_COUNT = 4;
const BRAILLE_MOTION_PHASE_COUNT = 8;
const BRAILLE_TEMPORAL_CELL_X_FACTOR = 3;
const BRAILLE_TEMPORAL_CELL_Y_FACTOR = 5;
const BRAILLE_DOT_MAP: readonly (readonly number[])[] = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
];
const BRAILLE_TEMPORAL_PHASE_BY_SAMPLE: readonly number[] = [
  0, 2, 3, 1, 2, 0, 1, 3,
];
const BRAILLE_MOTION_PHASE_BY_SAMPLE: readonly number[] = [
  0, 4, 6, 2, 5, 1, 3, 7,
];
const RED_INDEX = 0;
const GREEN_INDEX = 1;
const BLUE_INDEX = 2;

export function averagingBrailleCanvas(
  cols: number,
  rows: number,
  shader: BrailleShaderFn,
  time = 0,
  options: AveragingBrailleCanvasOptions = {},
): Surface {
  const surface = createSurface(cols, rows);
  if (cols <= 0 || rows <= 0) {
    return surface;
  }

  const subpixelWidth = cols * BRAILLE_COLUMNS_PER_CELL;
  const subpixelHeight = rows * BRAILLE_ROWS_PER_CELL;
  const sampling = brailleSamplingContext(cols, rows, options);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      surface.set(
        x,
        y,
        collapseBrailleCell({
          x,
          y,
          cols,
          subpixelWidth,
          subpixelHeight,
          time,
          shader,
          sampling,
        }),
      );
    }
  }

  return surface;
}

export function createBrailleSampleCache(
  width: number,
  height: number,
): BrailleSampleCache {
  return {
    width,
    height,
    samples: new Array(brailleCacheSampleCount(width, height)),
  };
}

export function createBrailleSampleFrameStats(): BrailleSampleFrameStats {
  return {
    totalSamples: 0,
    tracedSamples: 0,
    reusedSamples: 0,
    activeSamples: 0,
    coldMissSamples: 0,
    rayCount: 0,
    rayIntersectionCount: 0,
  };
}

export function brailleSampleActivityRatio(
  stats: BrailleSampleFrameStats,
): number {
  return stats.totalSamples <= 0 ? 0 : stats.activeSamples / stats.totalSamples;
}

export function brailleSampleRayPressureRatio(
  stats: BrailleSampleFrameStats,
): number | undefined {
  return stats.rayCount <= 0
    ? undefined
    : stats.rayIntersectionCount / stats.rayCount;
}

function collapseBrailleCell(options: CollapseBrailleCellOptions): Cell {
  const accumulator = createBrailleAccumulator();

  for (let sampleY = 0; sampleY < BRAILLE_ROWS_PER_CELL; sampleY += 1) {
    for (let sampleX = 0; sampleX < BRAILLE_COLUMNS_PER_CELL; sampleX += 1) {
      accumulateBrailleSample(accumulator, options, sampleX, sampleY);
    }
  }

  return {
    char: String.fromCodePoint(BRAILLE_BASE_CODE_POINT + accumulator.code),
    fgRGB: averageRgb(
      accumulator.fgRed,
      accumulator.fgGreen,
      accumulator.fgBlue,
    ),
    bgRGB: averageRgb(
      accumulator.bgRed,
      accumulator.bgGreen,
      accumulator.bgBlue,
    ),
    ...(accumulator.modifiers.length > 0
      ? { modifiers: accumulator.modifiers }
      : {}),
  };
}

function createBrailleAccumulator(): CollapseBrailleAccumulator {
  return {
    code: 0,
    fgRed: 0,
    fgGreen: 0,
    fgBlue: 0,
    bgRed: 0,
    bgGreen: 0,
    bgBlue: 0,
    modifiers: [],
  };
}

function accumulateBrailleSample(
  accumulator: CollapseBrailleAccumulator,
  options: CollapseBrailleCellOptions,
  sampleX: number,
  sampleY: number,
): void {
  const sampleIndex = brailleSampleIndex(sampleX, sampleY);
  const sample = brailleSampleAt(options, sampleX, sampleY, sampleIndex);
  recordResolvedBrailleSample(options.sampling, sample);
  accumulator.code = sample.on
    ? accumulator.code | BRAILLE_DOT_MAP[sampleY]![sampleX]!
    : accumulator.code;
  accumulator.fgRed += sample.fgRGB[RED_INDEX];
  accumulator.fgGreen += sample.fgRGB[GREEN_INDEX];
  accumulator.fgBlue += sample.fgRGB[BLUE_INDEX];
  accumulator.bgRed += sample.bgRGB[RED_INDEX];
  accumulator.bgGreen += sample.bgRGB[GREEN_INDEX];
  accumulator.bgBlue += sample.bgRGB[BLUE_INDEX];
  appendUniqueModifiers(accumulator.modifiers, sample.modifiers);
}

function brailleSampleAt(
  options: CollapseBrailleCellOptions,
  sampleX: number,
  sampleY: number,
  sampleIndex: number,
): BrailleShaderSample {
  const cacheIndex = brailleSampleCacheIndex(options.x, options.y, sampleIndex, {
    cols: options.cols,
  });
  if (shouldTraceBrailleSample(options, sampleIndex)) {
    return traceBrailleSample(options, sampleX, sampleY, cacheIndex);
  }

  const cached = options.sampling.cache?.samples[cacheIndex];
  if (cached != null) {
    recordReusedBrailleSample(options.sampling);
    return cached;
  }

  recordColdMissBrailleSample(options.sampling);
  return traceBrailleSample(options, sampleX, sampleY, cacheIndex);
}

function traceBrailleSample(
  options: CollapseBrailleCellOptions,
  sampleX: number,
  sampleY: number,
  cacheIndex: number,
): BrailleShaderSample {
  const sample = options.shader({
    u:
      (options.x * BRAILLE_COLUMNS_PER_CELL + sampleX) /
      (options.subpixelWidth - 1 || 1),
    v:
      (options.y * BRAILLE_ROWS_PER_CELL + sampleY) /
      (options.subpixelHeight - 1 || 1),
    time: options.time,
  });
  recordTracedBrailleSample(options.sampling);
  if (options.sampling.cache != null) {
    options.sampling.cache.samples[cacheIndex] = sample;
  }
  return sample;
}

function shouldTraceBrailleSample(
  options: CollapseBrailleCellOptions,
  sampleIndex: number,
): boolean {
  if (options.sampling.budget.phaseCount === BRAILLE_FULL_PHASE_COUNT) {
    return true;
  }
  const phase = temporalBrailleCellPhase(
    options.x,
    options.y,
    options.sampling.budget,
  );
  return (
    brailleSampleTemporalPhase(sampleIndex, options.sampling.budget) ===
    phase
  );
}

function brailleSampleTemporalPhase(
  sampleIndex: number,
  budget: BrailleTraceBudget,
): number {
  return budget.phaseCount === BRAILLE_MOTION_PHASE_COUNT
    ? BRAILLE_MOTION_PHASE_BY_SAMPLE[sampleIndex]!
    : BRAILLE_TEMPORAL_PHASE_BY_SAMPLE[sampleIndex]! % budget.phaseCount;
}

function temporalBrailleCellPhase(
  x: number,
  y: number,
  budget: BrailleTraceBudget,
): number {
  return (
    normalizedBraillePhase(budget) +
    (x * BRAILLE_TEMPORAL_CELL_X_FACTOR +
      y * BRAILLE_TEMPORAL_CELL_Y_FACTOR) %
      budget.phaseCount
  ) % budget.phaseCount;
}

function normalizedBraillePhase(budget: BrailleTraceBudget): number {
  return ((budget.phase % budget.phaseCount) + budget.phaseCount) %
    budget.phaseCount;
}

function brailleSamplingContext(
  cols: number,
  rows: number,
  options: AveragingBrailleCanvasOptions,
): BrailleSamplingContext {
  const budget = options.traceBudget ?? {
    phase: 0,
    phaseCount: BRAILLE_FULL_PHASE_COUNT,
  };
  validateBrailleTraceBudget(budget);
  if (options.sampleCache != null) {
    resetBrailleSampleCacheIfNeeded(options.sampleCache, cols, rows);
  }
  return {
    cache: options.sampleCache,
    budget,
    stats: options.stats,
  };
}

function recordResolvedBrailleSample(
  sampling: BrailleSamplingContext,
  sample: BrailleShaderSample,
): void {
  if (sampling.stats == null) {
    return;
  }
  sampling.stats.totalSamples += 1;
  sampling.stats.activeSamples += sample.on ? 1 : 0;
  sampling.stats.rayCount += sample.rayCount ?? 0;
  sampling.stats.rayIntersectionCount += sample.rayIntersectionCount ?? 0;
}

function recordTracedBrailleSample(sampling: BrailleSamplingContext): void {
  if (sampling.stats != null) {
    sampling.stats.tracedSamples += 1;
  }
}

function recordReusedBrailleSample(sampling: BrailleSamplingContext): void {
  if (sampling.stats != null) {
    sampling.stats.reusedSamples += 1;
  }
}

function recordColdMissBrailleSample(sampling: BrailleSamplingContext): void {
  if (sampling.stats != null) {
    sampling.stats.coldMissSamples += 1;
  }
}

function resetBrailleSampleCacheIfNeeded(
  cache: BrailleSampleCache,
  width: number,
  height: number,
): void {
  if (cache.width === width && cache.height === height) {
    return;
  }
  cache.width = width;
  cache.height = height;
  cache.samples = new Array(brailleCacheSampleCount(width, height));
}

function validateBrailleTraceBudget(budget: BrailleTraceBudget): void {
  if (
    budget.phaseCount !== BRAILLE_FULL_PHASE_COUNT &&
    budget.phaseCount !== BRAILLE_HALF_PHASE_COUNT &&
    budget.phaseCount !== BRAILLE_QUARTER_PHASE_COUNT &&
    budget.phaseCount !== BRAILLE_MOTION_PHASE_COUNT
  ) {
    throw new RangeError("Braille trace phase count must be 1, 2, 4, or 8.");
  }
  if (!Number.isInteger(budget.phase)) {
    throw new RangeError("Braille trace phase must be an integer.");
  }
}

function brailleSampleIndex(sampleX: number, sampleY: number): number {
  return sampleY * BRAILLE_COLUMNS_PER_CELL + sampleX;
}

function brailleSampleCacheIndex(
  x: number,
  y: number,
  sampleIndex: number,
  options: { readonly cols: number },
): number {
  return (y * options.cols + x) * BRAILLE_SAMPLE_COUNT + sampleIndex;
}

function brailleCacheSampleCount(width: number, height: number): number {
  return Math.max(0, width * height * BRAILLE_SAMPLE_COUNT);
}

function appendUniqueModifiers(
  modifiers: string[],
  nextModifiers: readonly string[] | undefined,
): void {
  for (const modifier of nextModifiers ?? []) {
    if (!modifiers.includes(modifier)) {
      modifiers.push(modifier);
    }
  }
}

function averageRgb(red: number, green: number, blue: number): RGB {
  return [
    Math.round(red / BRAILLE_SAMPLE_COUNT),
    Math.round(green / BRAILLE_SAMPLE_COUNT),
    Math.round(blue / BRAILLE_SAMPLE_COUNT),
  ];
}
