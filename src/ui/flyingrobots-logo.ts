import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Surface } from '@flyingrobots/bijou';

import { type RGB } from './averaging-braille-canvas.js';
import { JEDIT_TEXT_MODIFIER } from './jedit-theme.js';

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
const LOGO_COLOR_RATE = 0.5;
const LOGO_COLOR_ROW_PHASE = 0.37;
const LOGO_COLOR_SWING = 0.14;
const LOGO_SURFACE_BLEND = 0.26;
const LOGO_FULL_TURN_RADIANS = Math.PI * 2;
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
): void {
  if (bounds == null) {
    return;
  }

  for (let row = 0; row < bounds.height; row++) {
    const y = bounds.y + row;
    if (y < 0 || y >= surface.height) {
      continue;
    }
    const sourceY = sourceIndex(row, bounds.height, FLYINGROBOTS_LOGO_HEIGHT);
    const sourceLine = FLYINGROBOTS_LOGO_LINES[sourceY];
    if (sourceLine == null) {
      continue;
    }

    for (let col = 0; col < bounds.width; col++) {
      const x = bounds.x + col;
      if (x < 0 || x >= surface.width) {
        continue;
      }

      const sourceX = sourceIndex(col, bounds.width, sourceLine.length);
      const char = sourceLine[sourceX];
      if (char == null || !isLogoInk(char)) {
        continue;
      }

      surface.set(x, y, {
        char,
        fgRGB: flyingRobotsLogoColor(colors, col, bounds.width, row, time),
        bgRGB: colors.surface,
        modifiers: [JEDIT_TEXT_MODIFIER.Dim],
      });
    }
  }
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
  return mixColor(colors.surface, mixColor(colors.info, colors.accent, accentRatio), 1 - LOGO_SURFACE_BLEND);
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
