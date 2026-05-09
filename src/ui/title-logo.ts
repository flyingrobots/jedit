import { type Surface } from '@flyingrobots/bijou';

import { type RGB } from './averaging-braille-canvas.js';
import { JEDIT_TEXT_MODIFIER } from './jedit-theme.js';
import { JEDIT_LOGO_HEIGHT, JEDIT_LOGO_MASK, JEDIT_LOGO_WIDTH } from './logo-data.js';

type Color3 = RGB;

export interface LogoBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TitleLogoColors {
  readonly accent: Color3;
  readonly info: Color3;
  readonly surface: Color3;
}

export interface TitleLogoAnimatedLetter {
  readonly index: number;
  readonly sourceX: number;
  readonly sourceWidth: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly bounceOffset: number;
  readonly colorShift: number;
}

interface TitleLogoSourceLetter {
  readonly index: number;
  readonly sourceX: number;
  readonly sourceWidth: number;
  readonly phase: number;
}

const LOGO_WIDTH_RATIO = 0.8;
const LOGO_REQUESTED_SCALE_RATIO = 0.32;
const LOGO_TARGET_WIDTH_RATIO = LOGO_WIDTH_RATIO * LOGO_REQUESTED_SCALE_RATIO;
const LOGO_VERTICAL_CENTER_NUMERATOR = 4;
const LOGO_VERTICAL_CENTER_DENOMINATOR = 5;
const LOGO_COVERAGE_SAMPLE_COLUMNS = 4;
const LOGO_COVERAGE_SAMPLE_ROWS = 4;
const LOGO_SOLID_THRESHOLD = 0.72;
const LOGO_DENSE_THRESHOLD = 0.45;
const LOGO_MID_THRESHOLD = 0.18;
const LOGO_FAINT_THRESHOLD = 0.05;
const LOGO_SOLID_GLYPH = '█';
const LOGO_DENSE_GLYPH = '▓';
const LOGO_MID_GLYPH = '▒';
const LOGO_FAINT_GLYPH = '░';
const LOGO_LETTER_BOUNCE_ROWS = 1;
const LOGO_LETTER_BOUNCE_RATE = 3.1;
const LOGO_LETTER_COLOR_RATE = 1.4;
const LOGO_LETTER_PHASE_STEP = 0.72;
const LOGO_LETTER_COLOR_SWING = 0.18;
const LOGO_COLOR_SOURCE_WIDTH = 0.5;
const LOGO_COLOR_ANIMATION_WIDTH = 0.5;
const LOGO_MASK_BITS_PER_BYTE = 8;
const LOGO_MASK_HEX_BYTE_LENGTH = 4;
const LOGO_MASK_HEX_PREFIX_LENGTH = 2;

const TITLE_LOGO_MASK_BYTES = decodeLogoMask();
const TITLE_LOGO_SOURCE_LETTERS = titleLogoSourceLetters(TITLE_LOGO_MASK_BYTES);

export function paintTitleLogo(
  surface: Surface,
  bounds: LogoBounds,
  colors: TitleLogoColors,
  time: number,
): void {
  for (const letter of titleLogoAnimatedLetters(bounds, time)) {
    paintTitleLogoLetter(surface, letter, colors);
  }
}

export function titleLogoAnimatedLetters(bounds: LogoBounds, time: number): readonly TitleLogoAnimatedLetter[] {
  return TITLE_LOGO_SOURCE_LETTERS.map((letter) => {
    const targetStart = bounds.x + Math.floor((letter.sourceX / JEDIT_LOGO_WIDTH) * bounds.width);
    const targetEnd = bounds.x + Math.ceil(((letter.sourceX + letter.sourceWidth) / JEDIT_LOGO_WIDTH) * bounds.width);
    const bounceOffset = Math.round(Math.sin((time * LOGO_LETTER_BOUNCE_RATE) + letter.phase) * LOGO_LETTER_BOUNCE_ROWS);
    const colorShift = Math.sin((time * LOGO_LETTER_COLOR_RATE) + letter.phase) * LOGO_LETTER_COLOR_SWING;

    return {
      index: letter.index,
      sourceX: letter.sourceX,
      sourceWidth: letter.sourceWidth,
      x: targetStart,
      y: bounds.y + bounceOffset,
      width: Math.max(1, targetEnd - targetStart),
      height: bounds.height,
      bounceOffset,
      colorShift,
    };
  });
}

export function titleLogoCellBounds(screenWidth: number, screenHeight: number): LogoBounds {
  const maxWidth = Math.max(1, Math.floor(screenWidth * LOGO_TARGET_WIDTH_RATIO));
  const naturalHeight = Math.max(1, Math.floor(maxWidth * (JEDIT_LOGO_HEIGHT / JEDIT_LOGO_WIDTH)));
  const height = Math.min(screenHeight, naturalHeight);
  const width = Math.min(maxWidth, Math.max(1, Math.floor(height * (JEDIT_LOGO_WIDTH / JEDIT_LOGO_HEIGHT))));
  const centerY = Math.floor((screenHeight * LOGO_VERTICAL_CENTER_NUMERATOR) / LOGO_VERTICAL_CENTER_DENOMINATOR);
  const maxY = Math.max(0, screenHeight - height);
  return {
    x: Math.floor((screenWidth - width) / 2),
    y: Math.min(maxY, Math.max(0, Math.floor(centerY - (height / 2)))),
    width,
    height,
  };
}

function paintTitleLogoLetter(
  surface: Surface,
  letter: TitleLogoAnimatedLetter,
  colors: TitleLogoColors,
): void {
  for (let row = 0; row < letter.height; row++) {
    const y = letter.y + row;
    if (y < 0 || y >= surface.height) {
      continue;
    }

    for (let col = 0; col < letter.width; col++) {
      const x = letter.x + col;
      if (x < 0 || x >= surface.width) {
        continue;
      }

      const coverage = logoLetterCoverageAt(col, row, letter);
      const char = titleLogoGlyphForCoverage(coverage);
      if (char == null) {
        continue;
      }

      surface.set(x, y, {
        char,
        fgRGB: mixColor(colors.accent, colors.info, titleLogoCellColorRatio(letter, col)),
        bgRGB: colors.surface,
        modifiers: [JEDIT_TEXT_MODIFIER.Bold],
      });
    }
  }
}

function logoLetterCoverageAt(
  col: number,
  row: number,
  letter: TitleLogoAnimatedLetter,
): number {
  let covered = 0;
  const sampleCount = LOGO_COVERAGE_SAMPLE_COLUMNS * LOGO_COVERAGE_SAMPLE_ROWS;
  for (let sampleY = 0; sampleY < LOGO_COVERAGE_SAMPLE_ROWS; sampleY++) {
    for (let sampleX = 0; sampleX < LOGO_COVERAGE_SAMPLE_COLUMNS; sampleX++) {
      const logoX = letter.sourceX + Math.floor(
        ((col + ((sampleX + 0.5) / LOGO_COVERAGE_SAMPLE_COLUMNS)) / letter.width) * letter.sourceWidth,
      );
      const logoY = Math.floor(
        ((row + ((sampleY + 0.5) / LOGO_COVERAGE_SAMPLE_ROWS)) / letter.height) * JEDIT_LOGO_HEIGHT,
      );
      if (logoMaskBit(TITLE_LOGO_MASK_BYTES, logoX, logoY)) {
        covered += 1;
      }
    }
  }
  return covered / sampleCount;
}

function titleLogoGlyphForCoverage(coverage: number): string | undefined {
  if (coverage >= LOGO_SOLID_THRESHOLD) {
    return LOGO_SOLID_GLYPH;
  }
  if (coverage >= LOGO_DENSE_THRESHOLD) {
    return LOGO_DENSE_GLYPH;
  }
  if (coverage >= LOGO_MID_THRESHOLD) {
    return LOGO_MID_GLYPH;
  }
  if (coverage >= LOGO_FAINT_THRESHOLD) {
    return LOGO_FAINT_GLYPH;
  }
  return undefined;
}

function titleLogoCellColorRatio(letter: TitleLogoAnimatedLetter, col: number): number {
  const sourceCellRatio = (letter.sourceX + (((col + 0.5) / letter.width) * letter.sourceWidth)) / JEDIT_LOGO_WIDTH;
  return clamp(
    (sourceCellRatio * LOGO_COLOR_SOURCE_WIDTH)
      + ((sourceCellRatio + letter.colorShift) * LOGO_COLOR_ANIMATION_WIDTH),
  );
}

function titleLogoSourceLetters(mask: readonly (readonly number[])[]): readonly TitleLogoSourceLetter[] {
  const letters: TitleLogoSourceLetter[] = [];
  let rangeStart: number | undefined;

  for (let x = 0; x < JEDIT_LOGO_WIDTH; x++) {
    const occupied = titleLogoColumnOccupied(mask, x);
    if (occupied && rangeStart == null) {
      rangeStart = x;
    }

    if ((rangeStart != null) && (!occupied || x === JEDIT_LOGO_WIDTH - 1)) {
      const rangeEnd = occupied && x === JEDIT_LOGO_WIDTH - 1 ? x : x - 1;
      letters.push({
        index: letters.length,
        sourceX: rangeStart,
        sourceWidth: rangeEnd - rangeStart + 1,
        phase: letters.length * LOGO_LETTER_PHASE_STEP,
      });
      rangeStart = undefined;
    }
  }

  return letters;
}

function titleLogoColumnOccupied(mask: readonly (readonly number[])[], x: number): boolean {
  for (let y = 0; y < JEDIT_LOGO_HEIGHT; y++) {
    if (logoMaskBit(mask, x, y)) {
      return true;
    }
  }
  return false;
}

function logoMaskBit(mask: readonly (readonly number[])[], x: number, y: number): boolean {
  if (x < 0 || x >= JEDIT_LOGO_WIDTH || y < 0 || y >= JEDIT_LOGO_HEIGHT) {
    return false;
  }
  const row = mask[y];
  return row != null && (row[Math.floor(x / LOGO_MASK_BITS_PER_BYTE)]! & (1 << (LOGO_MASK_BITS_PER_BYTE - 1 - (x % LOGO_MASK_BITS_PER_BYTE)))) !== 0;
}

function decodeLogoMask(): readonly (readonly number[])[] {
  return JEDIT_LOGO_MASK.map((row) => {
    const bytes: number[] = [];
    for (let index = 0; index < row.length; index += LOGO_MASK_HEX_BYTE_LENGTH) {
      bytes.push(parseInt(row.slice(index + LOGO_MASK_HEX_PREFIX_LENGTH, index + LOGO_MASK_HEX_BYTE_LENGTH), 16));
    }
    return bytes;
  });
}

function mixColor(from: Color3, to: Color3, ratio: number): Color3 {
  const clamped = clamp(ratio);
  return [
    Math.round(from[0] + ((to[0] - from[0]) * clamped)),
    Math.round(from[1] + ((to[1] - from[1]) * clamped)),
    Math.round(from[2] + ((to[2] - from[2]) * clamped)),
  ];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
