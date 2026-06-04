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
  readonly modifiers?: readonly string[];
}

export type BrailleShaderFn = (
  params: BrailleShaderParams,
) => BrailleShaderSample;

interface CollapseBrailleCellOptions {
  readonly x: number;
  readonly y: number;
  readonly subpixelWidth: number;
  readonly subpixelHeight: number;
  readonly time: number;
  readonly shader: BrailleShaderFn;
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

const BRAILLE_COLUMNS_PER_CELL = 2;
const BRAILLE_ROWS_PER_CELL = 4;
export const BRAILLE_SAMPLE_COUNT =
  BRAILLE_COLUMNS_PER_CELL * BRAILLE_ROWS_PER_CELL;
const BRAILLE_BASE_CODE_POINT = 0x2800;
const BRAILLE_DOT_MAP: readonly (readonly number[])[] = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
];
const RED_INDEX = 0;
const GREEN_INDEX = 1;
const BLUE_INDEX = 2;

export function averagingBrailleCanvas(
  cols: number,
  rows: number,
  shader: BrailleShaderFn,
  time = 0,
): Surface {
  const surface = createSurface(cols, rows);
  if (cols <= 0 || rows <= 0) {
    return surface;
  }

  const subpixelWidth = cols * BRAILLE_COLUMNS_PER_CELL;
  const subpixelHeight = rows * BRAILLE_ROWS_PER_CELL;

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      surface.set(
        x,
        y,
        collapseBrailleCell({
          x,
          y,
          subpixelWidth,
          subpixelHeight,
          time,
          shader,
        }),
      );
    }
  }

  return surface;
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
  const sample = options.shader({
    u:
      (options.x * BRAILLE_COLUMNS_PER_CELL + sampleX) /
      (options.subpixelWidth - 1 || 1),
    v:
      (options.y * BRAILLE_ROWS_PER_CELL + sampleY) /
      (options.subpixelHeight - 1 || 1),
    time: options.time,
  });
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
