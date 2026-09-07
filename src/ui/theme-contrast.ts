// Contrast measurement and correction for theme palettes.
//
// Split out of jedit-themes.ts, which owns what a theme *is*; this owns the one
// question of whether a colour can actually be read on the surface behind it.

import type { RgbTuple, ThemePalette } from './jedit-theme-palettes.js';
import { oklchToRgb, rgbToOklch } from './oklch.js';

const COLOR_CHANNEL_MAX = 255;
// WCAG AA for body text; 3:1 is the non-text and large-text floor, which is
// what accents and syntax tokens are held to.
const MIN_SURFACE_TEXT_CONTRAST_RATIO = 4.5;
const MIN_ACCENT_CONTRAST_RATIO = 3;
const CONTRAST_LIGHTNESS_STEP = 0.02;
const MAX_CONTRAST_STEPS = 60;
const CONTRAST_LUMINANCE_OFFSET = 0.05;
const SRGB_LINEAR_THRESHOLD = 0.04045;
const SRGB_LINEAR_DIVISOR = 12.92;
const SRGB_OFFSET = 0.055;
const SRGB_SCALE = 1.055;
const SRGB_EXPONENT = 2.4;
const LUMINANCE_RED_WEIGHT = 0.2126;
const LUMINANCE_GREEN_WEIGHT = 0.7152;
const LUMINANCE_BLUE_WEIGHT = 0.0722;
const LIGHTNESS_FLOOR = 0;
const LIGHTNESS_CEILING = 1;
const DARKER = -1;
const LIGHTER = 1;

export function contrastAdjustedPalette(palette: ThemePalette): ThemePalette {
  const surfaces = [palette.surface, palette.surfaceRaised, palette.surfaceMuted];
  const raised = [palette.surface, palette.surfaceRaised];
  return {
    ink: legibleOn(palette.ink, surfaces, MIN_SURFACE_TEXT_CONTRAST_RATIO),
    muted: legibleOn(palette.muted, [palette.surface], MIN_ACCENT_CONTRAST_RATIO),
    accent: legibleOn(palette.accent, [palette.surface], MIN_ACCENT_CONTRAST_RATIO),
    info: legibleOn(palette.info, raised, MIN_ACCENT_CONTRAST_RATIO),
    warning: legibleOn(palette.warning, raised, MIN_ACCENT_CONTRAST_RATIO),
    success: legibleOn(palette.success, [palette.surface], MIN_ACCENT_CONTRAST_RATIO),
    surface: palette.surface,
    surfaceRaised: palette.surfaceRaised,
    surfaceMuted: palette.surfaceMuted,
  };
}

// Contrast is carried by lightness, so a colour short of the floor is walked
// away from the surfaces it sits on with its hue and chroma held. Blending
// toward black or white instead -- the obvious approach -- desaturates as it
// goes and drags the hue with it, so a theme's amber warning arrives washed out
// and slightly wrong rather than simply lighter.
function legibleOn(
  color: RgbTuple,
  backgrounds: readonly RgbTuple[],
  minContrastRatio: number,
): RgbTuple {
  const ground = averageLuminance(backgrounds);
  const direction = relativeLuminance(color) >= ground ? LIGHTER : DARKER;
  let candidate = rgbToOklch(color);
  for (let step = 0; step < MAX_CONTRAST_STEPS; step += 1) {
    const rgb = oklchToRgb(candidate);
    if (passesContrast(rgb, backgrounds, minContrastRatio)) {
      return rgb;
    }
    candidate = {
      ...candidate,
      lightness: clampLightness(candidate.lightness + (direction * CONTRAST_LIGHTNESS_STEP)),
    };
  }
  return oklchToRgb(candidate);
}

function clampLightness(value: number): number {
  return Math.min(LIGHTNESS_CEILING, Math.max(LIGHTNESS_FLOOR, value));
}

function averageLuminance(colors: readonly RgbTuple[]): number {
  const total = colors.reduce((sum, color) => sum + relativeLuminance(color), 0);
  return total / colors.length;
}

function passesContrast(
  color: RgbTuple,
  backgrounds: readonly RgbTuple[],
  minContrastRatio: number,
): boolean {
  return backgrounds.every(
    (background) => contrastRatio(color, background) >= minContrastRatio,
  );
}

export function contrastRatio(foreground: RgbTuple, background: RgbTuple): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + CONTRAST_LUMINANCE_OFFSET) / (darker + CONTRAST_LUMINANCE_OFFSET);
}

function relativeLuminance(color: RgbTuple): number {
  const red = linearizedColorChannel(color[0]);
  const green = linearizedColorChannel(color[1]);
  const blue = linearizedColorChannel(color[2]);
  return red * LUMINANCE_RED_WEIGHT
    + green * LUMINANCE_GREEN_WEIGHT
    + blue * LUMINANCE_BLUE_WEIGHT;
}

function linearizedColorChannel(channel: number): number {
  const normalized = channel / COLOR_CHANNEL_MAX;
  return normalized <= SRGB_LINEAR_THRESHOLD
    ? normalized / SRGB_LINEAR_DIVISOR
    : ((normalized + SRGB_OFFSET) / SRGB_SCALE) ** SRGB_EXPONENT;
}
