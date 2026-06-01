import type { Cell } from '@flyingrobots/bijou';
import type { RGB } from './averaging-braille-canvas.js';

type Color3 = RGB;

export interface TitleLogoFadeTiming {
  readonly visibleSeconds: number;
  readonly fadeSeconds: number;
}

export const TITLE_LOGO_OPACITY = {
  Hidden: 0,
  Visible: 1,
} as const;

const RED_INDEX = 0;
const GREEN_INDEX = 1;
const BLUE_INDEX = 2;
const RGB_CHANNEL_MIN = 0;
const RGB_CHANNEL_MAX = 255;

export function titleLogoOpacityAt(time: number, timing: TitleLogoFadeTiming): number {
  const fadeElapsed = time - timing.visibleSeconds;
  if (fadeElapsed <= TITLE_LOGO_OPACITY.Hidden) {
    return TITLE_LOGO_OPACITY.Visible;
  }
  return clampOpacity(TITLE_LOGO_OPACITY.Visible - (fadeElapsed / timing.fadeSeconds));
}

export function titleLogoOverlayCell(
  base: Cell,
  overlay: Cell,
  opacity: number,
  fallbackColor: Color3,
): Cell {
  const clamped = clampOpacity(opacity);
  if (clamped <= TITLE_LOGO_OPACITY.Hidden) {
    return base;
  }
  if (clamped >= TITLE_LOGO_OPACITY.Visible) {
    return overlay;
  }

  const blended: Cell = {
    char: overlay.char,
    fgRGB: mixColor(cellForeground(base, fallbackColor), cellForeground(overlay, fallbackColor), clamped),
    bgRGB: mixColor(cellBackground(base, fallbackColor), cellBackground(overlay, fallbackColor), clamped),
    opacity: clamped,
  };
  if (overlay.modifiers != null) {
    blended.modifiers = [...overlay.modifiers];
  }
  return blended;
}

function cellForeground(cell: Cell, fallbackColor: Color3): Color3 {
  return cell.fgRGB ?? cell.bgRGB ?? fallbackColor;
}

function cellBackground(cell: Cell, fallbackColor: Color3): Color3 {
  return cell.bgRGB ?? fallbackColor;
}

function mixColor(from: Color3, to: Color3, ratio: number): Color3 {
  return [
    mixChannel(from[RED_INDEX], to[RED_INDEX], ratio),
    mixChannel(from[GREEN_INDEX], to[GREEN_INDEX], ratio),
    mixChannel(from[BLUE_INDEX], to[BLUE_INDEX], ratio),
  ];
}

function mixChannel(from: number, to: number, ratio: number): number {
  return clampChannel(from + ((to - from) * ratio));
}

function clampOpacity(value: number): number {
  return Math.max(TITLE_LOGO_OPACITY.Hidden, Math.min(TITLE_LOGO_OPACITY.Visible, value));
}

function clampChannel(value: number): number {
  return Math.max(RGB_CHANNEL_MIN, Math.min(RGB_CHANNEL_MAX, Math.round(value)));
}
