import { createSurface, type Cell, type Surface } from '@flyingrobots/bijou';
import type { BrailleShaderFn, RGB } from './averaging-braille-canvas.js';

const ASCII_DENSITY_RAMP = ' .:-=+*#%@';
const ASCII_COLUMNS_PER_CELL = 2;
const ASCII_ROWS_PER_CELL = 2;
const ASCII_SAMPLE_COUNT = ASCII_COLUMNS_PER_CELL * ASCII_ROWS_PER_CELL;
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
): Surface {
  const surface = createSurface(cols, rows);
  if (cols <= 0 || rows <= 0) {
    return surface;
  }

  const subpixelWidth = cols * ASCII_COLUMNS_PER_CELL;
  const subpixelHeight = rows * ASCII_ROWS_PER_CELL;

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      surface.set(x, y, collapseAsciiCell(x, y, subpixelWidth, subpixelHeight, time, shader));
    }
  }

  return surface;
}

function collapseAsciiCell(
  x: number,
  y: number,
  subpixelWidth: number,
  subpixelHeight: number,
  time: number,
  shader: BrailleShaderFn,
): Cell {
  let fgRed = 0;
  let fgGreen = 0;
  let fgBlue = 0;
  let bgRed = 0;
  let bgGreen = 0;
  let bgBlue = 0;
  let luminanceSum = 0;
  const modifiers: string[] = [];

  for (let sampleY = 0; sampleY < ASCII_ROWS_PER_CELL; sampleY += 1) {
    for (let sampleX = 0; sampleX < ASCII_COLUMNS_PER_CELL; sampleX += 1) {
      const sample = shader({
        u: ((x * ASCII_COLUMNS_PER_CELL) + sampleX) / (subpixelWidth - 1 || 1),
        v: ((y * ASCII_ROWS_PER_CELL) + sampleY) / (subpixelHeight - 1 || 1),
        time,
      });

      fgRed += sample.fgRGB[RED_INDEX];
      fgGreen += sample.fgRGB[GREEN_INDEX];
      fgBlue += sample.fgRGB[BLUE_INDEX];
      bgRed += sample.bgRGB[RED_INDEX];
      bgGreen += sample.bgRGB[GREEN_INDEX];
      bgBlue += sample.bgRGB[BLUE_INDEX];
      luminanceSum += sample.on ? luminance(sample.fgRGB) : 0;

      for (const modifier of sample.modifiers ?? []) {
        if (!modifiers.includes(modifier)) {
          modifiers.push(modifier);
        }
      }
    }
  }

  return {
    char: asciiCharForLuminance(luminanceSum / ASCII_SAMPLE_COUNT),
    fgRGB: averageRgb(fgRed, fgGreen, fgBlue),
    bgRGB: averageRgb(bgRed, bgGreen, bgBlue),
    ...(modifiers.length > 0 ? { modifiers } : {}),
  };
}

function asciiCharForLuminance(value: number): string {
  const normalized = Math.max(0, Math.min(1, value / MAX_RGB_CHANNEL));
  const index = Math.round(normalized * (ASCII_DENSITY_RAMP.length - 1));
  return ASCII_DENSITY_RAMP[index] ?? ' ';
}

function luminance(rgb: RGB): number {
  return (rgb[RED_INDEX] * LUMINANCE_RED_WEIGHT)
    + (rgb[GREEN_INDEX] * LUMINANCE_GREEN_WEIGHT)
    + (rgb[BLUE_INDEX] * LUMINANCE_BLUE_WEIGHT);
}

function averageRgb(red: number, green: number, blue: number): RGB {
  return [
    Math.round(red / ASCII_SAMPLE_COUNT),
    Math.round(green / ASCII_SAMPLE_COUNT),
    Math.round(blue / ASCII_SAMPLE_COUNT),
  ];
}
