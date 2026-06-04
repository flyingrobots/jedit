import { createSurface, type Cell, type Surface } from "@flyingrobots/bijou";
import type { BrailleShaderFn, RGB } from "./averaging-braille-canvas.js";

export const TITLE_ASCII_PALETTE = {
  Dense: "dense",
  Minimal: "minimal",
  Technical: "technical",
  Hatching: "hatching",
  Matrix: "matrix",
  Blocks: "blocks",
  Dither: "dither",
} as const;

export type TitleAsciiPalette =
  (typeof TITLE_ASCII_PALETTE)[keyof typeof TITLE_ASCII_PALETTE];

export const TITLE_ASCII_PALETTES: readonly TitleAsciiPalette[] = [
  TITLE_ASCII_PALETTE.Dense,
  TITLE_ASCII_PALETTE.Minimal,
  TITLE_ASCII_PALETTE.Technical,
  TITLE_ASCII_PALETTE.Hatching,
  TITLE_ASCII_PALETTE.Matrix,
  TITLE_ASCII_PALETTE.Blocks,
  TITLE_ASCII_PALETTE.Dither,
];

interface AsciiPaletteSpec {
  readonly name: TitleAsciiPalette;
  readonly ramp: string;
  readonly dither?: boolean;
}

interface CollapseAsciiCellOptions {
  readonly x: number;
  readonly y: number;
  readonly subpixelWidth: number;
  readonly subpixelHeight: number;
  readonly time: number;
  readonly shader: BrailleShaderFn;
  readonly palette: AsciiPaletteSpec;
}

interface CollapseAsciiAccumulator {
  fgRed: number;
  fgGreen: number;
  fgBlue: number;
  bgRed: number;
  bgGreen: number;
  bgBlue: number;
  luminanceSum: number;
  readonly modifiers: string[];
}

export interface AveragingAsciiCanvasOptions {
  readonly palette?: TitleAsciiPalette;
}

const ASCII_PALETTE_SPECS: readonly AsciiPaletteSpec[] = [
  { name: TITLE_ASCII_PALETTE.Dense, ramp: " .,:;irsXA253hMHGS#9B&@" },
  { name: TITLE_ASCII_PALETTE.Minimal, ramp: " .-+*#" },
  { name: TITLE_ASCII_PALETTE.Technical, ramp: " .-_/\\|+x#" },
  { name: TITLE_ASCII_PALETTE.Hatching, ramp: " .`-~:/\\|X#" },
  { name: TITLE_ASCII_PALETTE.Matrix, ramp: " .:!|1I[]{}$#" },
  { name: TITLE_ASCII_PALETTE.Blocks, ramp: " ▁▂▃▄▅▆▇█" },
  { name: TITLE_ASCII_PALETTE.Dither, ramp: " .:-=+*#%@", dither: true },
];
const DEFAULT_ASCII_PALETTE_SPEC = ASCII_PALETTE_SPECS[0]!;
const BAYER_DITHER_SIZE = 4;
const BAYER_DITHER_AREA = BAYER_DITHER_SIZE * BAYER_DITHER_SIZE;
const BAYER_DITHER_MATRIX: readonly (readonly number[])[] = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const ASCII_COLUMNS_PER_CELL = 2;
const ASCII_ROWS_PER_CELL = 2;
export const ASCII_SAMPLE_COUNT = ASCII_COLUMNS_PER_CELL * ASCII_ROWS_PER_CELL;
const RED_INDEX = 0;
const GREEN_INDEX = 1;
const BLUE_INDEX = 2;
const LUMINANCE_RED_WEIGHT = 0.2126;
const LUMINANCE_GREEN_WEIGHT = 0.7152;
const LUMINANCE_BLUE_WEIGHT = 0.0722;
const MAX_RGB_CHANNEL = 255;

export function averagingAsciiCanvas(
  cols: number,
  rows: number,
  shader: BrailleShaderFn,
  time = 0,
  options: AveragingAsciiCanvasOptions = {},
): Surface {
  const surface = createSurface(cols, rows);
  if (cols <= 0 || rows <= 0) {
    return surface;
  }

  const subpixelWidth = cols * ASCII_COLUMNS_PER_CELL;
  const subpixelHeight = rows * ASCII_ROWS_PER_CELL;
  const palette = asciiPaletteSpec(
    options.palette ?? TITLE_ASCII_PALETTE.Dense,
  );

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      surface.set(
        x,
        y,
        collapseAsciiCell({
          x,
          y,
          subpixelWidth,
          subpixelHeight,
          time,
          shader,
          palette,
        }),
      );
    }
  }

  return surface;
}

function collapseAsciiCell(options: CollapseAsciiCellOptions): Cell {
  const accumulator = createAsciiAccumulator();

  for (let sampleY = 0; sampleY < ASCII_ROWS_PER_CELL; sampleY += 1) {
    for (let sampleX = 0; sampleX < ASCII_COLUMNS_PER_CELL; sampleX += 1) {
      accumulateAsciiSample(accumulator, options, sampleX, sampleY);
    }
  }

  return {
    char: asciiCharForLuminance(
      accumulator.luminanceSum / ASCII_SAMPLE_COUNT,
      options.palette,
      options.x,
      options.y,
    ),
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

function createAsciiAccumulator(): CollapseAsciiAccumulator {
  return {
    fgRed: 0,
    fgGreen: 0,
    fgBlue: 0,
    bgRed: 0,
    bgGreen: 0,
    bgBlue: 0,
    luminanceSum: 0,
    modifiers: [],
  };
}

function accumulateAsciiSample(
  accumulator: CollapseAsciiAccumulator,
  options: CollapseAsciiCellOptions,
  sampleX: number,
  sampleY: number,
): void {
  const sample = options.shader({
    u:
      (options.x * ASCII_COLUMNS_PER_CELL + sampleX) /
      (options.subpixelWidth - 1 || 1),
    v:
      (options.y * ASCII_ROWS_PER_CELL + sampleY) /
      (options.subpixelHeight - 1 || 1),
    time: options.time,
  });
  const visibleFgRGB = sample.on ? sample.fgRGB : sample.bgRGB;
  accumulator.fgRed += visibleFgRGB[RED_INDEX];
  accumulator.fgGreen += visibleFgRGB[GREEN_INDEX];
  accumulator.fgBlue += visibleFgRGB[BLUE_INDEX];
  accumulator.bgRed += sample.bgRGB[RED_INDEX];
  accumulator.bgGreen += sample.bgRGB[GREEN_INDEX];
  accumulator.bgBlue += sample.bgRGB[BLUE_INDEX];
  accumulator.luminanceSum += sample.on ? luminance(sample.fgRGB) : 0;
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

export function nextTitleAsciiPalette(
  current: TitleAsciiPalette,
): TitleAsciiPalette {
  const currentIndex = TITLE_ASCII_PALETTES.indexOf(current);
  return (
    TITLE_ASCII_PALETTES[(currentIndex + 1) % TITLE_ASCII_PALETTES.length] ??
    TITLE_ASCII_PALETTE.Dense
  );
}

function asciiPaletteSpec(palette: TitleAsciiPalette): AsciiPaletteSpec {
  return (
    ASCII_PALETTE_SPECS.find((spec) => spec.name === palette) ??
    DEFAULT_ASCII_PALETTE_SPEC
  );
}

function asciiCharForLuminance(
  value: number,
  palette: AsciiPaletteSpec,
  x: number,
  y: number,
): string {
  const ramp = palette.ramp;
  const normalized = Math.max(0, Math.min(1, value / MAX_RGB_CHANNEL));
  if (palette.dither === true) {
    return ditheredAsciiChar(normalized, ramp, x, y);
  }
  const index = Math.round(normalized * (ramp.length - 1));
  return ramp[index] ?? " ";
}

function ditheredAsciiChar(
  normalized: number,
  ramp: string,
  x: number,
  y: number,
): string {
  const scaled = normalized * (ramp.length - 1);
  const baseIndex = Math.floor(scaled);
  const nextIndex = Math.min(ramp.length - 1, baseIndex + 1);
  const fraction = scaled - baseIndex;
  const threshold =
    ((BAYER_DITHER_MATRIX[y % BAYER_DITHER_SIZE]?.[x % BAYER_DITHER_SIZE] ??
      0) +
      0.5) /
    BAYER_DITHER_AREA;
  return ramp[fraction >= threshold ? nextIndex : baseIndex] ?? " ";
}

function luminance(rgb: RGB): number {
  return (
    rgb[RED_INDEX] * LUMINANCE_RED_WEIGHT +
    rgb[GREEN_INDEX] * LUMINANCE_GREEN_WEIGHT +
    rgb[BLUE_INDEX] * LUMINANCE_BLUE_WEIGHT
  );
}

function averageRgb(red: number, green: number, blue: number): RGB {
  return [
    Math.round(red / ASCII_SAMPLE_COUNT),
    Math.round(green / ASCII_SAMPLE_COUNT),
    Math.round(blue / ASCII_SAMPLE_COUNT),
  ];
}
