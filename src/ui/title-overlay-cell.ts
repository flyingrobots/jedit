import { type Cell, type Surface } from '@flyingrobots/bijou';

import { type RGB } from './averaging-braille-canvas.js';
import { type JeditTextModifier } from './jedit-theme.js';

export interface TitleOverlayCell {
  readonly char: string;
  readonly fgRGB: RGB;
  readonly bgRGB: RGB;
  readonly modifiers?: readonly JeditTextModifier[];
  readonly opacity: number;
}

const ZERO_OPACITY = 0;
const FULL_OPACITY = 1;
const RED_CHANNEL = 0;
const GREEN_CHANNEL = 1;
const BLUE_CHANNEL = 2;

export function paintTitleOverlayCell(
  surface: Surface,
  x: number,
  y: number,
  cell: TitleOverlayCell,
): void {
  const opacity = clampTitleOverlayRatio(cell.opacity);
  if (opacity <= ZERO_OPACITY || isOutsideSurface(x, surface.width) || isOutsideSurface(y, surface.height)) {
    return;
  }

  const baseCell = surface.get(x, y);
  surface.set(x, y, {
    char: cell.char,
    fgRGB: mixTitleOverlayColor(baseCellForeground(baseCell, cell.bgRGB), cell.fgRGB, opacity),
    bgRGB: mixTitleOverlayColor(baseCellBackground(baseCell, cell.bgRGB), cell.bgRGB, opacity),
    modifiers: cell.modifiers == null ? undefined : [...cell.modifiers],
  });
}

export function mixTitleOverlayColor(from: RGB, to: RGB, ratio: number): RGB {
  const clamped = clampTitleOverlayRatio(ratio);
  return [
    Math.round(from[RED_CHANNEL] + ((to[RED_CHANNEL] - from[RED_CHANNEL]) * clamped)),
    Math.round(from[GREEN_CHANNEL] + ((to[GREEN_CHANNEL] - from[GREEN_CHANNEL]) * clamped)),
    Math.round(from[BLUE_CHANNEL] + ((to[BLUE_CHANNEL] - from[BLUE_CHANNEL]) * clamped)),
  ];
}

export function clampTitleOverlayRatio(value: number): number {
  return Math.max(ZERO_OPACITY, Math.min(FULL_OPACITY, value));
}

function baseCellForeground(cell: Cell, fallback: RGB): RGB {
  return cell.fgRGB ?? cell.bgRGB ?? fallback;
}

function baseCellBackground(cell: Cell, fallback: RGB): RGB {
  return cell.bgRGB ?? fallback;
}

function isOutsideSurface(position: number, limit: number): boolean {
  return position < 0 || position >= limit;
}
