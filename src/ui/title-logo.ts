import { type Surface } from '@flyingrobots/bijou';
import { createSpringState, springStep, type SpringConfig } from '@flyingrobots/bijou-tui';

import { type RGB } from './averaging-braille-canvas.js';
import { JEDIT_TEXT_MODIFIER } from './jedit-theme.js';
import { JEDIT_LOGO_HEIGHT, JEDIT_LOGO_MASK, JEDIT_LOGO_WIDTH } from './logo-data.js';

type Color3 = RGB;

export const TITLE_LOGO_RENDER_MODE = {
  Bitmap: Symbol('jedit.title-logo.render-mode.bitmap'),
  CompactText: Symbol('jedit.title-logo.render-mode.compact-text'),
} as const;

export type TitleLogoRenderMode = typeof TITLE_LOGO_RENDER_MODE[keyof typeof TITLE_LOGO_RENDER_MODE];

export interface LogoBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly renderMode: TitleLogoRenderMode;
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
  readonly targetBounceOffset: number;
  readonly colorShift: number;
}

interface TitleLogoSourceLetter {
  readonly index: number;
  readonly sourceX: number;
  readonly sourceWidth: number;
  readonly phaseSeconds: number;
}

const LOGO_PREFERRED_WIDTH = 36;
const LOGO_MAX_WIDTH = 48;
const LOGO_WIDE_SCREEN_WIDTH_RATIO = 0.32;
const LOGO_HORIZONTAL_MARGIN_COLUMNS = 2;
const LOGO_MIN_BITMAP_WIDTH = 24;
const LOGO_MIN_BITMAP_HEIGHT = 5;
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
const LOGO_COMPACT_TEXT = 'jedit';
const LOGO_LETTER_COLOR_RATE = 1.4;
const LOGO_LETTER_PHASE_STEP_SECONDS = 0.16;
const LOGO_LETTER_COLOR_SWING = 0.18;
const LOGO_COLOR_SOURCE_WIDTH = 0.5;
const LOGO_COLOR_ANIMATION_WIDTH = 0.5;
const LOGO_MASK_BITS_PER_BYTE = 8;
const LOGO_MASK_HEX_BYTE_LENGTH = 4;
const LOGO_MASK_HEX_PREFIX_LENGTH = 2;
const LOGO_LETTER_REST_OFFSET = 0;
const LOGO_LETTER_BOUNCE_TARGET_STEP_SECONDS = 0.46;
const LOGO_LETTER_SPRING_PREROLL_CYCLES = 3;
const LOGO_LETTER_FIXED_STEP_SECONDS = 1 / 120;
const LOGO_LETTER_SPRING_MASS = 1;
const LOGO_LETTER_SPRING_STIFFNESS = 96;
const LOGO_LETTER_SPRING_DAMPING = 19;
const LOGO_LETTER_SPRING_PRECISION = 0.0005;
const LOGO_LETTER_BOUNCE_TARGETS: readonly number[] = [
  LOGO_LETTER_REST_OFFSET,
  -0.72,
  0.48,
  LOGO_LETTER_REST_OFFSET,
];
const LOGO_LETTER_BOUNCE_CYCLE_SECONDS = LOGO_LETTER_BOUNCE_TARGETS.length * LOGO_LETTER_BOUNCE_TARGET_STEP_SECONDS;
const LOGO_LETTER_SPRING_PREROLL_SECONDS = LOGO_LETTER_BOUNCE_CYCLE_SECONDS * LOGO_LETTER_SPRING_PREROLL_CYCLES;
const LOGO_LETTER_SPRING = {
  mass: LOGO_LETTER_SPRING_MASS,
  stiffness: LOGO_LETTER_SPRING_STIFFNESS,
  damping: LOGO_LETTER_SPRING_DAMPING,
  precision: LOGO_LETTER_SPRING_PRECISION,
} satisfies SpringConfig;

const TITLE_LOGO_MASK_BYTES = decodeLogoMask();
const TITLE_LOGO_SOURCE_LETTERS = titleLogoSourceLetters(TITLE_LOGO_MASK_BYTES);

export function paintTitleLogo(
  surface: Surface,
  bounds: LogoBounds,
  colors: TitleLogoColors,
  time: number,
): void {
  if (bounds.renderMode === TITLE_LOGO_RENDER_MODE.CompactText) {
    paintCompactTitleLogo(surface, bounds, colors, time);
    return;
  }

  for (const letter of titleLogoAnimatedLetters(bounds, time)) {
    paintTitleLogoLetter(surface, letter, colors);
  }
}

export function titleLogoAnimatedLetters(bounds: LogoBounds, time: number): readonly TitleLogoAnimatedLetter[] {
  return TITLE_LOGO_SOURCE_LETTERS.map((letter) => {
    const targetStart = bounds.x + Math.floor((letter.sourceX / JEDIT_LOGO_WIDTH) * bounds.width);
    const targetEnd = bounds.x + Math.ceil(((letter.sourceX + letter.sourceWidth) / JEDIT_LOGO_WIDTH) * bounds.width);
    const bounce = titleLogoSpringBounceAt(time, letter.phaseSeconds);
    const colorShift = Math.sin((time * LOGO_LETTER_COLOR_RATE) + letter.phaseSeconds) * LOGO_LETTER_COLOR_SWING;

    return {
      index: letter.index,
      sourceX: letter.sourceX,
      sourceWidth: letter.sourceWidth,
      x: targetStart,
      y: bounds.y + bounce.offset,
      width: Math.max(1, targetEnd - targetStart),
      height: bounds.height,
      bounceOffset: bounce.offset,
      targetBounceOffset: bounce.target,
      colorShift,
    };
  });
}

export function titleLogoCellBounds(screenWidth: number, screenHeight: number): LogoBounds {
  const availableWidth = Math.max(1, screenWidth - (LOGO_HORIZONTAL_MARGIN_COLUMNS * 2));
  const requestedWidth = Math.min(LOGO_MAX_WIDTH, Math.max(LOGO_PREFERRED_WIDTH, Math.floor(screenWidth * LOGO_WIDE_SCREEN_WIDTH_RATIO)));
  const maxWidth = Math.max(1, Math.min(availableWidth, requestedWidth));
  const naturalHeight = Math.max(1, Math.floor(maxWidth * (JEDIT_LOGO_HEIGHT / JEDIT_LOGO_WIDTH)));
  const height = Math.min(screenHeight, naturalHeight);
  const width = Math.min(maxWidth, Math.max(1, Math.floor(height * (JEDIT_LOGO_WIDTH / JEDIT_LOGO_HEIGHT))));
  if (width < LOGO_MIN_BITMAP_WIDTH || height < LOGO_MIN_BITMAP_HEIGHT) {
    return compactTitleLogoCellBounds(screenWidth, screenHeight);
  }

  const centerY = Math.floor((screenHeight * LOGO_VERTICAL_CENTER_NUMERATOR) / LOGO_VERTICAL_CENTER_DENOMINATOR);
  const maxY = Math.max(0, screenHeight - height);
  return {
    x: Math.floor((screenWidth - width) / 2),
    y: Math.min(maxY, Math.max(0, Math.floor(centerY - (height / 2)))),
    width,
    height,
    renderMode: TITLE_LOGO_RENDER_MODE.Bitmap,
  };
}

function compactTitleLogoCellBounds(screenWidth: number, screenHeight: number): LogoBounds {
  const width = Math.min(Math.max(1, screenWidth), LOGO_COMPACT_TEXT.length);
  const height = Math.min(1, Math.max(1, screenHeight));
  const centerY = Math.floor((screenHeight * LOGO_VERTICAL_CENTER_NUMERATOR) / LOGO_VERTICAL_CENTER_DENOMINATOR);
  return {
    x: Math.max(0, Math.floor((screenWidth - width) / 2)),
    y: Math.max(0, Math.min(screenHeight - height, centerY)),
    width,
    height,
    renderMode: TITLE_LOGO_RENDER_MODE.CompactText,
  };
}

function paintCompactTitleLogo(
  surface: Surface,
  bounds: LogoBounds,
  colors: TitleLogoColors,
  time: number,
): void {
  const text = LOGO_COMPACT_TEXT.slice(0, bounds.width);
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char == null) {
      continue;
    }
    const x = bounds.x + index;
    const y = bounds.y;
    if (x < 0 || x >= surface.width || y < 0 || y >= surface.height) {
      continue;
    }
    const phaseSeconds = index * LOGO_LETTER_PHASE_STEP_SECONDS;
    const bounce = titleLogoSpringBounceAt(time, phaseSeconds);
    const colorShift = Math.sin((time * LOGO_LETTER_COLOR_RATE) + phaseSeconds) * LOGO_LETTER_COLOR_SWING;
    surface.set(x, y, {
      char,
      fgRGB: mixColor(colors.accent, colors.info, compactLogoColorRatio(index, text.length, colorShift + (bounce.offset * LOGO_LETTER_COLOR_SWING))),
      bgRGB: colors.surface,
      modifiers: [JEDIT_TEXT_MODIFIER.Bold],
    });
  }
}

function paintTitleLogoLetter(
  surface: Surface,
  letter: TitleLogoAnimatedLetter,
  colors: TitleLogoColors,
): void {
  const minY = Math.floor(letter.y);
  const maxY = Math.ceil(letter.y + letter.height);
  for (let y = minY; y < maxY; y++) {
    if (y < 0 || y >= surface.height) {
      continue;
    }
    const localRow = y - letter.y;

    for (let col = 0; col < letter.width; col++) {
      const x = letter.x + col;
      if (x < 0 || x >= surface.width) {
        continue;
      }

      const coverage = logoLetterCoverageAt(col, localRow, letter);
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

function compactLogoColorRatio(index: number, length: number, colorShift: number): number {
  const sourceRatio = index / Math.max(1, length - 1);
  return clamp(
    (sourceRatio * LOGO_COLOR_SOURCE_WIDTH)
      + ((sourceRatio + colorShift) * LOGO_COLOR_ANIMATION_WIDTH),
  );
}

function titleLogoSpringBounceAt(
  time: number,
  phaseSeconds: number,
): { readonly offset: number; readonly target: number } {
  const cycleTime = positiveModulo(time + phaseSeconds, LOGO_LETTER_BOUNCE_CYCLE_SECONDS);
  const simulationEnd = LOGO_LETTER_SPRING_PREROLL_SECONDS + cycleTime;
  let state = createSpringState(titleLogoBounceTargetAt(0));
  let simulated = 0;

  while (simulated < simulationEnd) {
    const stepSeconds = Math.min(LOGO_LETTER_FIXED_STEP_SECONDS, simulationEnd - simulated);
    state = springStep(state, titleLogoBounceTargetAt(simulated), LOGO_LETTER_SPRING, stepSeconds);
    simulated += stepSeconds;
  }

  return {
    offset: state.value,
    target: titleLogoBounceTargetAt(simulationEnd),
  };
}

function titleLogoBounceTargetAt(time: number): number {
  const cycleTime = positiveModulo(time, LOGO_LETTER_BOUNCE_CYCLE_SECONDS);
  const targetIndex = Math.floor(cycleTime / LOGO_LETTER_BOUNCE_TARGET_STEP_SECONDS);
  return LOGO_LETTER_BOUNCE_TARGETS[targetIndex] ?? LOGO_LETTER_REST_OFFSET;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
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
        phaseSeconds: letters.length * LOGO_LETTER_PHASE_STEP_SECONDS,
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
