import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Surface } from '@flyingrobots/bijou';

import { type RGB } from './averaging-braille-canvas.js';
import { JEDIT_TEXT_MODIFIER } from './jedit-theme.js';
import { clampTitleOverlayRatio, paintTitleOverlayCell } from './title-overlay-cell.js';

type Color3 = RGB;

export interface FlyingRobotsLogoBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface FlyingRobotsLogoColors {
  readonly accent: Color3;
  readonly info: Color3;
  readonly surface: Color3;
}

export interface FlyingRobotsLogoPaintOptions {
  readonly opacity?: number;
}

interface FlyingRobotsLogoPaintContext {
  readonly surface: Surface;
  readonly bounds: FlyingRobotsLogoBounds;
  readonly colors: FlyingRobotsLogoColors;
  readonly time: number;
  readonly opacity: number;
}

interface FlyingRobotsLogoCellPaintContext extends FlyingRobotsLogoPaintContext {
  readonly row: number;
  readonly sourceLine: readonly string[];
}

const UTF8_ENCODING = 'utf8';
const FLYINGROBOTS_LOGO_FILE_NAME = 'flyingrobotslogo.txt';
const SOURCE_ASSET_DIR = 'src';
const SOURCE_ASSET_UI_DIR = 'ui';
const LOGO_HORIZONTAL_MARGIN_COLUMNS = 3;
const LOGO_VERTICAL_PLACEMENT_RATIO = 0.08;
const LOGO_MIN_SCREEN_WIDTH = 48;
const LOGO_MIN_SCREEN_HEIGHT = 14;
const LOGO_MIN_RENDER_WIDTH = 32;
const LOGO_MIN_RENDER_HEIGHT = 2;
const LOGO_MAX_RENDER_HEIGHT = 6;
const LOGO_COLOR_RATE = 0.16;
const LOGO_COLOR_ROW_PHASE = 0.37;
const LOGO_COLOR_SWING = 0.24;
const LOGO_SURFACE_BLEND = 0.06;
const LOGO_COLOR_CONTRAST_BOOST = 1.35;
const LOGO_FULL_TURN_RADIANS = Math.PI * 2;
const LOGO_DEFAULT_OPACITY = 1;
const PRESENTS_TEXT = 'PRESENTS';
const PRESENTS_VERTICAL_GAP_ROWS = 0;
const PRESENTS_COLOR_RATE = 0.12;
const PRESENTS_COLOR_SWING = 0.18;
const PRESENTS_SURFACE_BLEND = 0.2;
const RGB_CHANNEL_MIN = 0;
const RGB_CHANNEL_MAX = 255;
const BRAILLE_BLANK = '⠀';

const FLYINGROBOTS_LOGO_LINES = parseFlyingRobotsLogo(readFlyingRobotsLogoSource());
const FLYINGROBOTS_LOGO_WIDTH = Math.max(...FLYINGROBOTS_LOGO_LINES.map((line) => line.length));
const FLYINGROBOTS_LOGO_HEIGHT = FLYINGROBOTS_LOGO_LINES.length;

export function flyingRobotsLogoCellBounds(screenWidth: number, screenHeight: number): FlyingRobotsLogoBounds | undefined {
  if (
    screenWidth < LOGO_MIN_SCREEN_WIDTH
    || screenHeight < LOGO_MIN_SCREEN_HEIGHT
    || FLYINGROBOTS_LOGO_WIDTH < LOGO_MIN_RENDER_WIDTH
    || FLYINGROBOTS_LOGO_HEIGHT < LOGO_MIN_RENDER_HEIGHT
  ) {
    return undefined;
  }

  const availableWidth = Math.max(1, screenWidth - (LOGO_HORIZONTAL_MARGIN_COLUMNS * 2));
  const width = Math.min(availableWidth, FLYINGROBOTS_LOGO_WIDTH);
  const height = Math.min(
    LOGO_MAX_RENDER_HEIGHT,
    FLYINGROBOTS_LOGO_HEIGHT,
    Math.max(LOGO_MIN_RENDER_HEIGHT, Math.floor(screenHeight * LOGO_VERTICAL_PLACEMENT_RATIO) + LOGO_MIN_RENDER_HEIGHT),
  );

  return {
    x: Math.max(0, Math.floor((screenWidth - width) / 2)),
    y: Math.max(0, Math.floor(screenHeight * LOGO_VERTICAL_PLACEMENT_RATIO)),
    width,
    height,
  };
}

export function paintFlyingRobotsLogo(
  surface: Surface,
  bounds: FlyingRobotsLogoBounds | undefined,
  colors: FlyingRobotsLogoColors,
  time: number,
  options: FlyingRobotsLogoPaintOptions = {},
): void {
  if (bounds == null) {
    return;
  }

  const opacity = clampTitleOverlayRatio(options.opacity ?? LOGO_DEFAULT_OPACITY);
  if (opacity <= 0) {
    return;
  }

  const context = { surface, bounds, colors, time, opacity };
  for (let row = 0; row < bounds.height; row++) {
    paintFlyingRobotsLogoRow(context, row);
  }
  paintFlyingRobotsPresents(surface, bounds, colors, time, opacity);
}

function paintFlyingRobotsLogoRow(context: FlyingRobotsLogoPaintContext, row: number): void {
  const { bounds, surface } = context;
  const y = bounds.y + row;
  if (isOutsideSurface(y, surface.height)) {
    return;
  }

  const sourceLine = FLYINGROBOTS_LOGO_LINES[sourceIndex(row, bounds.height, FLYINGROBOTS_LOGO_HEIGHT)];
  if (sourceLine == null) {
    return;
  }

  for (let col = 0; col < bounds.width; col++) {
    paintFlyingRobotsLogoCell({ ...context, row, sourceLine }, col);
  }
}

function paintFlyingRobotsLogoCell(
  context: FlyingRobotsLogoCellPaintContext,
  col: number,
): void {
  const { bounds, colors, row, sourceLine, surface, time } = context;
  const x = bounds.x + col;
  if (isOutsideSurface(x, surface.width)) {
    return;
  }

  const char = sourceLine[sourceIndex(col, bounds.width, sourceLine.length)];
  if (char == null || !isLogoInk(char)) {
    return;
  }

  paintTitleOverlayCell(surface, x, bounds.y + row, {
    char,
    fgRGB: flyingRobotsLogoColor(colors, col, bounds.width, row, time),
    bgRGB: colors.surface,
    modifiers: [JEDIT_TEXT_MODIFIER.Bold],
    opacity: context.opacity,
  });
}

function paintFlyingRobotsPresents(
  surface: Surface,
  bounds: FlyingRobotsLogoBounds,
  colors: FlyingRobotsLogoColors,
  time: number,
  opacity: number,
): void {
  const text = PRESENTS_TEXT.slice(0, Math.max(0, surface.width));
  const y = bounds.y + bounds.height + PRESENTS_VERTICAL_GAP_ROWS;
  if (text.length === 0 || isOutsideSurface(y, surface.height)) {
    return;
  }

  const xStart = Math.max(0, Math.floor((surface.width - text.length) / 2));
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char == null) {
      continue;
    }
    paintTitleOverlayCell(surface, xStart + index, y, {
      char,
      fgRGB: flyingRobotsPresentsColor(colors, index, text.length, time),
      bgRGB: colors.surface,
      modifiers: [JEDIT_TEXT_MODIFIER.Dim],
      opacity,
    });
  }
}

function isOutsideSurface(position: number, limit: number): boolean {
  return position < 0 || position >= limit;
}

function readFlyingRobotsLogoSource(): string {
  const distUrl = new URL(FLYINGROBOTS_LOGO_FILE_NAME, import.meta.url);
  if (existsSync(distUrl)) {
    return readFileSync(distUrl, UTF8_ENCODING);
  }
  return readFileSync(join(process.cwd(), SOURCE_ASSET_DIR, SOURCE_ASSET_UI_DIR, FLYINGROBOTS_LOGO_FILE_NAME), UTF8_ENCODING);
}

function parseFlyingRobotsLogo(source: string): readonly (readonly string[])[] {
  return source
    .split(/\r?\n/u)
    .filter((line) => line.length > 0)
    .map((line) => Array.from(line));
}

function sourceIndex(index: number, targetSize: number, sourceSize: number): number {
  if (sourceSize <= 1) {
    return 0;
  }
  return Math.min(sourceSize - 1, Math.floor(((index + 0.5) / Math.max(1, targetSize)) * sourceSize));
}

function isLogoInk(char: string): boolean {
  return char !== BRAILLE_BLANK && char.trim().length > 0;
}

function flyingRobotsLogoColor(
  colors: FlyingRobotsLogoColors,
  col: number,
  width: number,
  row: number,
  time: number,
): Color3 {
  const sourceRatio = col / Math.max(1, width - 1);
  const shimmer = Math.sin((time * LOGO_COLOR_RATE * LOGO_FULL_TURN_RADIANS) + (row * LOGO_COLOR_ROW_PHASE)) * LOGO_COLOR_SWING;
  const accentRatio = clamp(sourceRatio + shimmer);
  const base = mixColor(colors.info, colors.accent, accentRatio);
  const vivid = contrastColor(colors.surface, base, LOGO_COLOR_CONTRAST_BOOST);
  return mixColor(colors.surface, vivid, 1 - LOGO_SURFACE_BLEND);
}

function flyingRobotsPresentsColor(
  colors: FlyingRobotsLogoColors,
  index: number,
  length: number,
  time: number,
): Color3 {
  const sourceRatio = index / Math.max(1, length - 1);
  const shimmer = Math.sin((time * PRESENTS_COLOR_RATE * LOGO_FULL_TURN_RADIANS) + sourceRatio) * PRESENTS_COLOR_SWING;
  const vivid = contrastColor(colors.surface, mixColor(colors.accent, colors.info, clamp(sourceRatio + shimmer)), LOGO_COLOR_CONTRAST_BOOST);
  return mixColor(colors.surface, vivid, 1 - PRESENTS_SURFACE_BLEND);
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

function contrastColor(surface: Color3, color: Color3, boost: number): Color3 {
  return [
    clampChannel(surface[0] + ((color[0] - surface[0]) * boost)),
    clampChannel(surface[1] + ((color[1] - surface[1]) * boost)),
    clampChannel(surface[2] + ((color[2] - surface[2]) * boost)),
  ];
}

function clampChannel(value: number): number {
  return Math.max(RGB_CHANNEL_MIN, Math.min(RGB_CHANNEL_MAX, Math.round(value)));
}
