import { createSurface, type Surface } from '@flyingrobots/bijou';
import { rasterToGlyphSurface, type RgbaFrame } from '@flyingrobots/bijou-tui';

import type { JeditStyleToken, JeditTheme } from './jedit-theme.js';
import {
  JIM_LOGO_RASTER_HEIGHT,
  JIM_LOGO_RASTER_MASK_BASE64,
  JIM_LOGO_RASTER_MASK_BYTES_PER_ROW,
  JIM_LOGO_RASTER_WIDTH,
} from './jim-logo-raster-data.js';

const MAX_LOGO_ROWS = 14;
const MIN_LOGO_ROWS = 4;
const LOGO_COLUMNS_PER_ROW = 2;
const LOGO_HORIZONTAL_MARGIN = 2;
const LOGO_VERTICAL_MARGIN = 2;
const BRAILLE_CELL_ASPECT_RATIO = 0.5;
const BRAILLE_DARKNESS_THRESHOLD = 0.5;
const BRAILLE_BLANK = '\u2800';
const MASK_BITS_PER_BYTE = 8;
const RGBA_CHANNEL_COUNT = 4;
const RGBA_ALPHA_OFFSET = 3;
const OPAQUE_ALPHA = 255;

const JIM_LOGO_FRAME = createJimLogoFrame();

export function renderJimLogoTitleScreen(
  width: number,
  height: number,
  theme: JeditTheme,
): Surface {
  const surface = createStyledSurface(width, height, theme.surface.workspace);
  const bounds = jimLogoBounds(width, height);
  if (bounds == null) {
    return surface;
  }
  const glyphs = rasterToGlyphSurface(JIM_LOGO_FRAME, {
    columns: bounds.width,
    rows: bounds.height,
    fit: 'contain',
    cellAspectRatio: BRAILLE_CELL_ASPECT_RATIO,
    colorMode: 'none',
    renderer: {
      kind: 'braille',
      threshold: BRAILLE_DARKNESS_THRESHOLD,
    },
  });
  paintJimLogo(surface, glyphs, bounds.x, bounds.y, theme.chrome.titleLogo);
  return surface;
}

interface JimLogoBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function jimLogoBounds(width: number, height: number): JimLogoBounds | undefined {
  const availableRows = Math.min(
    MAX_LOGO_ROWS,
    height - (LOGO_VERTICAL_MARGIN * 2),
    Math.floor((width - (LOGO_HORIZONTAL_MARGIN * 2)) / LOGO_COLUMNS_PER_ROW),
  );
  if (availableRows < MIN_LOGO_ROWS) {
    return undefined;
  }
  const logoWidth = availableRows * LOGO_COLUMNS_PER_ROW;
  return {
    x: Math.floor((width - logoWidth) / 2),
    y: Math.floor((height - availableRows) / 2),
    width: logoWidth,
    height: availableRows,
  };
}

function createStyledSurface(
  width: number,
  height: number,
  token: JeditStyleToken,
): Surface {
  const surface = createSurface(width, height, { char: ' ', empty: false });
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const cell = surface.get(x, y);
      surface.set(x, y, {
        ...cell,
        fg: token.fg,
        fgRGB: token.fgRGB,
        bg: token.bg,
        bgRGB: token.bgRGB,
        modifiers: token.modifiers == null ? undefined : [...token.modifiers],
        empty: false,
      });
    }
  }
  return surface;
}

function paintJimLogo(
  target: Surface,
  glyphs: Surface,
  targetX: number,
  targetY: number,
  token: JeditStyleToken,
): void {
  for (let y = 0; y < glyphs.height; y += 1) {
    for (let x = 0; x < glyphs.width; x += 1) {
      const glyph = glyphs.get(x, y);
      if (glyph.char === BRAILLE_BLANK) {
        continue;
      }
      const cell = target.get(targetX + x, targetY + y);
      target.set(targetX + x, targetY + y, {
        ...cell,
        char: glyph.char,
        fg: token.fg,
        fgRGB: token.fgRGB,
        modifiers: token.modifiers == null ? undefined : [...token.modifiers],
        empty: false,
      });
    }
  }
}

function createJimLogoFrame(): RgbaFrame {
  const mask = decodeBase64(JIM_LOGO_RASTER_MASK_BASE64);
  const expectedMaskLength = JIM_LOGO_RASTER_MASK_BYTES_PER_ROW
    * JIM_LOGO_RASTER_HEIGHT;
  if (mask.length !== expectedMaskLength) {
    throw new RangeError('Jim logo raster mask has an invalid byte length.');
  }
  const data = new Uint8ClampedArray(
    JIM_LOGO_RASTER_WIDTH * JIM_LOGO_RASTER_HEIGHT * RGBA_CHANNEL_COUNT,
  );
  for (let y = 0; y < JIM_LOGO_RASTER_HEIGHT; y += 1) {
    for (let x = 0; x < JIM_LOGO_RASTER_WIDTH; x += 1) {
      if (!maskPixelIsSet(mask, x, y)) {
        continue;
      }
      const pixelOffset = ((y * JIM_LOGO_RASTER_WIDTH) + x)
        * RGBA_CHANNEL_COUNT;
      data[pixelOffset + RGBA_ALPHA_OFFSET] = OPAQUE_ALPHA;
    }
  }
  return {
    width: JIM_LOGO_RASTER_WIDTH,
    height: JIM_LOGO_RASTER_HEIGHT,
    data,
  };
}

function maskPixelIsSet(mask: Uint8Array, x: number, y: number): boolean {
  const byte = mask[
    (y * JIM_LOGO_RASTER_MASK_BYTES_PER_ROW)
      + Math.floor(x / MASK_BITS_PER_BYTE)
  ] ?? 0;
  const bit = MASK_BITS_PER_BYTE - 1 - (x % MASK_BITS_PER_BYTE);
  return (byte & (1 << bit)) !== 0;
}

function decodeBase64(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
