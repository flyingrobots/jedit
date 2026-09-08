// Contrast measurement and correction for theme palettes.
//
// Split out of jedit-themes.ts, which owns what a theme *is*; this owns the one
// question of whether a colour can actually be read on the surface behind it.

import type { RgbTuple, ThemePalette } from './jedit-theme-palettes.js';
import { oklchToRgb, rgbToOklch, type Oklch } from './oklch.js';

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

export // Every token is held against every surface it can be drawn on, not just the
// workspace background. A syntax foreground keeps its colour when the current
// line repaints the background beneath it, and the settings drawer reuses the
// comment foreground over the drawer background, so checking only
// palette.surface passed tokens that were then rendered somewhere darker --
// monokai's light companion sat at 2.75:1 on the current line and 2.51:1 in
// the drawer while reporting 3.03:1 on the workspace.
function contrastAdjustedPalette(palette: ThemePalette): ThemePalette {
  const surfaces = [palette.surface, palette.surfaceRaised, palette.surfaceMuted];
  return {
    ink: legibleOn(palette.ink, surfaces, MIN_SURFACE_TEXT_CONTRAST_RATIO),
    muted: legibleOn(palette.muted, surfaces, MIN_ACCENT_CONTRAST_RATIO),
    accent: legibleOn(palette.accent, surfaces, MIN_ACCENT_CONTRAST_RATIO),
    info: legibleOn(palette.info, surfaces, MIN_ACCENT_CONTRAST_RATIO),
    warning: legibleOn(palette.warning, surfaces, MIN_ACCENT_CONTRAST_RATIO),
    success: legibleOn(palette.success, surfaces, MIN_ACCENT_CONTRAST_RATIO),
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
export function legibleOn(
  color: RgbTuple,
  backgrounds: readonly RgbTuple[],
  minContrastRatio: number,
): RgbTuple {
  const origin = rgbToOklch(color);
  if (passesContrast(color, backgrounds, minContrastRatio)) {
    return color;
  }
  // Both directions are searched rather than only the one leading away from the
  // background's luminance. Picking a direction from the background alone can
  // choose a dead end: a token at luminance 0.05 on a 0.10 surface only reaches
  // 3.0 at pure black, but 7.0 going the other way. Whichever side clears the
  // floor first wins, so the answer is also the smallest change that works.
  for (let step = 1; step <= MAX_CONTRAST_STEPS; step += 1) {
    const offset = step * CONTRAST_LIGHTNESS_STEP;
    const nearer = nearestPassing(origin, offset, backgrounds, minContrastRatio);
    if (nearer != null) {
      return nearer;
    }
  }
  return furthestFrom(origin, backgrounds);
}

function nearestPassing(
  origin: Oklch,
  offset: number,
  backgrounds: readonly RgbTuple[],
  minContrastRatio: number,
): RgbTuple | undefined {
  for (const direction of [DARKER, LIGHTER]) {
    const lightness = clampLightness(origin.lightness + (direction * offset));
    const rgb = oklchToRgb({ ...origin, lightness });
    if (passesContrast(rgb, backgrounds, minContrastRatio)) {
      return rgb;
    }
  }
  return undefined;
}

// Nothing on either side cleared the floor, which happens when the surfaces
// themselves are too close together to admit a passing colour. Returning the
// end with the most contrast available is the honest best effort; the spec
// suite is what catches a theme this actually bites.
function furthestFrom(origin: Oklch, backgrounds: readonly RgbTuple[]): RgbTuple {
  const darkest = oklchToRgb({ ...origin, lightness: LIGHTNESS_FLOOR });
  const lightest = oklchToRgb({ ...origin, lightness: LIGHTNESS_CEILING });
  return worstContrast(darkest, backgrounds) >= worstContrast(lightest, backgrounds)
    ? darkest
    : lightest;
}

function worstContrast(color: RgbTuple, backgrounds: readonly RgbTuple[]): number {
  return backgrounds.reduce(
    (worst, background) => Math.min(worst, contrastRatio(color, background)),
    Number.POSITIVE_INFINITY,
  );
}

function clampLightness(value: number): number {
  return Math.min(LIGHTNESS_CEILING, Math.max(LIGHTNESS_FLOOR, value));
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
