import { createSurface, type Cell, type Surface } from '@flyingrobots/bijou';

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

export type BrailleShaderFn = (params: BrailleShaderParams) => BrailleShaderSample;

const BRAILLE_COLUMNS_PER_CELL = 2;
const BRAILLE_ROWS_PER_CELL = 4;
const BRAILLE_SAMPLE_COUNT = BRAILLE_COLUMNS_PER_CELL * BRAILLE_ROWS_PER_CELL;
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
      surface.set(x, y, collapseBrailleCell(x, y, subpixelWidth, subpixelHeight, time, shader));
    }
  }

  return surface;
}

function collapseBrailleCell(
  x: number,
  y: number,
  subpixelWidth: number,
  subpixelHeight: number,
  time: number,
  shader: BrailleShaderFn,
): Cell {
  let code = 0;
  let fgRed = 0;
  let fgGreen = 0;
  let fgBlue = 0;
  let bgRed = 0;
  let bgGreen = 0;
  let bgBlue = 0;
  const modifiers: string[] = [];

  for (let sampleY = 0; sampleY < BRAILLE_ROWS_PER_CELL; sampleY += 1) {
    for (let sampleX = 0; sampleX < BRAILLE_COLUMNS_PER_CELL; sampleX += 1) {
      const sample = shader({
        u: ((x * BRAILLE_COLUMNS_PER_CELL) + sampleX) / (subpixelWidth - 1 || 1),
        v: ((y * BRAILLE_ROWS_PER_CELL) + sampleY) / (subpixelHeight - 1 || 1),
        time,
      });

      if (sample.on) {
        code |= BRAILLE_DOT_MAP[sampleY]![sampleX]!;
      }

      fgRed += sample.fgRGB[RED_INDEX];
      fgGreen += sample.fgRGB[GREEN_INDEX];
      fgBlue += sample.fgRGB[BLUE_INDEX];
      bgRed += sample.bgRGB[RED_INDEX];
      bgGreen += sample.bgRGB[GREEN_INDEX];
      bgBlue += sample.bgRGB[BLUE_INDEX];

      for (const modifier of sample.modifiers ?? []) {
        if (!modifiers.includes(modifier)) {
          modifiers.push(modifier);
        }
      }
    }
  }

  return {
    char: String.fromCodePoint(BRAILLE_BASE_CODE_POINT + code),
    fgRGB: averageRgb(fgRed, fgGreen, fgBlue),
    bgRGB: averageRgb(bgRed, bgGreen, bgBlue),
    ...(modifiers.length > 0 ? { modifiers } : {}),
  };
}

function averageRgb(red: number, green: number, blue: number): RGB {
  return [
    Math.round(red / BRAILLE_SAMPLE_COUNT),
    Math.round(green / BRAILLE_SAMPLE_COUNT),
    Math.round(blue / BRAILLE_SAMPLE_COUNT),
  ];
}
