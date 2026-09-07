// Recolours the baked logo artwork into a theme's own colours.
//
// The generated palette in jim-logo-frame-data.ts is the reference layer: the
// artwork's own ink, which is near-black and deep navy because it was drawn as
// ink on paper. Painted literally it disappears on a dark terminal -- five of
// its fifteen entries sit at a contrast ratio under 1.2 against the graphite
// background.
//
// So the artwork supplies structure and the theme supplies colour. Each colour
// keeps its rank in the artwork's own lightness order and is re-sited on a ramp
// between the theme's titleLogoShadow and titleLogo tokens, which is why the
// logo reads as part of whichever theme is loaded instead of as a pasted-in
// bitmap. Hue is retained in proportion to how colourful the original was, so
// the diamond stays distinguishable from the J rather than the whole mark
// collapsing onto one hue.
//
// This runs on the rasterised glyph cells, not on the frame that feeds the
// rasteriser. The Braille renderer decides which dots to light by darkness
// against a white ground, so recolouring the frame itself would extinguish the
// whole mark on any theme whose ink ends up light. Recolouring afterwards
// leaves the mask exactly as the artwork drew it.

import { JIM_LOGO_PALETTE } from './jim-logo-frame-data.js';
import { JEDIT_THEME_MODE, type JeditTheme } from './jedit-theme.js';
import { mixHue, oklchToRgb, rgbToOklch, type Oklch, type Rgb } from './oklch.js';

// WCAG 1.4.11 puts non-text graphics at 3:1, which is also the floor the theme
// suite already holds other chrome to.
const MIN_CONTRAST = 3;
const CONTRAST_STEP = 0.02;
const MAX_CONTRAST_STEPS = 40;
// Above this the artwork counts as fully coloured; the navy sits near 0.13.
const ARTWORK_CHROMA_REFERENCE = 0.12;
// How much of its own hue a fully coloured artwork entry keeps. Low enough
// that the theme leads, high enough that the diamond stays its own colour.
const HUE_RETENTION = 0.4;
// Neutral artwork still takes most of the theme's chroma so the mark reads as
// tinted rather than as grey pasted onto a coloured theme.
const MIN_CHROMA_SHARE = 0.55;
const SRGB_MAX = 255;
const CONTRAST_OFFSET = 0.05;
const ZERO = 0;
const ONE = 1;
// A theme may leave a token's true-colour value unset and rely on the palette
// index alone. The logo needs real channels to interpolate, so the mode picks
// the sane extreme rather than the code asserting the value is present.
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
// A theme whose two logo tokens are the same colour would flatten the mark to a
// silhouette, losing the artwork's internal shading. Below this separation the
// ramp is widened away from the background instead, so the structure survives
// any theme rather than only the ones that happen to differentiate the tokens.
const MIN_RAMP_SPAN = 0.18;

interface LogoRamp {
  readonly shadow: Oklch;
  readonly ink: Oklch;
  readonly ground: Rgb;
  readonly darkest: number;
  readonly span: number;
}

// Returns the mapping rather than a fixed palette because rasterising averages
// several artwork pixels into one cell, so cells carry blends that are not
// palette entries. The transform is defined for any colour, so the blends are
// mapped as faithfully as the pure entries.
export function themeLogoInk(theme: JeditTheme): (artwork: Rgb) => Rgb {
  const ramp = logoRamp(theme);
  const cache = new Map<number, Rgb>();
  return (artwork: Rgb) => {
    const key = (artwork[0] << 16) | (artwork[1] << 8) | artwork[2];
    const hit = cache.get(key);
    if (hit != null) {
      return hit;
    }
    const mapped = recolour(rgbToOklch(artwork), ramp);
    cache.set(key, mapped);
    return mapped;
  };
}

function logoRamp(theme: JeditTheme): LogoRamp {
  const lightnesses = JIM_LOGO_PALETTE.map((entry) => rgbToOklch(entry).lightness);
  const darkest = Math.min(...lightnesses);
  const lightest = Math.max(...lightnesses);
  const foreground = theme.mode === JEDIT_THEME_MODE.Dark ? WHITE : BLACK;
  const background = theme.mode === JEDIT_THEME_MODE.Dark ? BLACK : WHITE;
  const ground = theme.surface.workspace.bgRGB ?? background;
  const ink = rgbToOklch(theme.chrome.titleLogo.fgRGB ?? foreground);
  return {
    shadow: separated(rgbToOklch(theme.chrome.titleLogoShadow.fgRGB ?? foreground), ink, ground),
    ink,
    ground,
    darkest,
    span: lightest - darkest,
  };
}

function separated(shadow: Oklch, ink: Oklch, ground: Rgb): Oklch {
  if (Math.abs(ink.lightness - shadow.lightness) >= MIN_RAMP_SPAN) {
    return shadow;
  }
  const away = ink.lightness >= rgbToOklch(ground).lightness ? ONE : -ONE;
  return { ...shadow, lightness: clamp(ink.lightness - (away * MIN_RAMP_SPAN)) };
}

function recolour(artwork: Oklch, ramp: LogoRamp): Rgb {
  const rank = ramp.span === ZERO ? ZERO : (artwork.lightness - ramp.darkest) / ramp.span;
  const colourfulness = Math.min(ONE, artwork.chroma / ARTWORK_CHROMA_REFERENCE);
  const themeHue = mixHue(ramp.shadow.hue, ramp.ink.hue, rank);
  const chromaShare = MIN_CHROMA_SHARE + ((ONE - MIN_CHROMA_SHARE) * colourfulness);
  return legibleAgainst({
    lightness: lerp(ramp.shadow.lightness, ramp.ink.lightness, rank),
    chroma: lerp(ramp.shadow.chroma, ramp.ink.chroma, rank) * chromaShare,
    hue: mixHue(themeHue, artwork.hue, HUE_RETENTION * colourfulness),
  }, ramp.ground);
}

// Lightness is what carries contrast, so a colour short of the floor is walked
// away from the background's lightness rather than desaturated or clipped --
// that keeps its hue, which clipping RGB channels would not.
function legibleAgainst(colour: Oklch, ground: Rgb): Rgb {
  const groundLightness = rgbToOklch(ground).lightness;
  const direction = colour.lightness >= groundLightness ? ONE : -ONE;
  let candidate = colour;
  for (let step = ZERO; step < MAX_CONTRAST_STEPS; step += 1) {
    const rgb = oklchToRgb(candidate);
    if (contrastRatio(rgb, ground) >= MIN_CONTRAST) {
      return rgb;
    }
    candidate = {
      ...candidate,
      lightness: clamp(candidate.lightness + (direction * CONTRAST_STEP)),
    };
  }
  return oklchToRgb(candidate);
}

function lerp(from: number, to: number, amount: number): number {
  return from + ((to - from) * amount);
}

function clamp(value: number): number {
  return Math.min(ONE, Math.max(ZERO, value));
}

function contrastRatio(foreground: Rgb, background: Rgb): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const high = Math.max(first, second);
  const low = Math.min(first, second);
  return (high + CONTRAST_OFFSET) / (low + CONTRAST_OFFSET);
}

function relativeLuminance(rgb: Rgb): number {
  const [red, green, blue] = rgb.map(channelLuminance);
  return (0.2126 * (red ?? ZERO)) + (0.7152 * (green ?? ZERO)) + (0.0722 * (blue ?? ZERO));
}

function channelLuminance(channel: number): number {
  const ratio = channel / SRGB_MAX;
  return ratio <= 0.03928 ? ratio / 12.92 : Math.pow((ratio + 0.055) / 1.055, 2.4);
}
