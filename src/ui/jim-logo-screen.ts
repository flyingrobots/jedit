import { createSurface, type Surface } from '@flyingrobots/bijou';
import { rasterToGlyphSurface, type RgbaFrame } from '@flyingrobots/bijou-tui';

import type { JeditTheme } from './jedit-theme.js';
import {
  JIM_LOGO_FRAME_SIZE,
  JIM_LOGO_PACKED_INDICES,
  JIM_LOGO_PALETTE,
} from './jim-logo-frame-data.js';

const MIN_LOGO_ROWS = 4;
const LOGO_COLUMNS_PER_ROW = 2;
const LOGO_HORIZONTAL_MARGIN = 2;
const LOGO_VERTICAL_MARGIN = 2;
const BRAILLE_CELL_ASPECT_RATIO = 0.5;
const BRAILLE_DARKNESS_THRESHOLD = 0.5;
const BRAILLE_BLANK = '⠀';
const SURFACE_BLANK = ' ';
const GLYPH_SURFACE_FIT = 'contain';
// 'fg' keeps each cell's own colour. The previous renderer used 'none', which
// is why the logo was a single flat theme token rather than the artwork.
const GLYPH_SURFACE_COLOR_MODE = 'fg';
const GLYPH_SURFACE_RENDERER_KIND = 'braille';
const RGBA_CHANNEL_COUNT = 4;
const OPAQUE_ALPHA = 255;
const TRANSPARENT_INDEX = 0;
const FULL_OPACITY = 1;

// Built once at module load. The frame is static, so the startup screen renders
// without a frame pulse and without loading any mesh or scene.
const JIM_LOGO_FRAME = createJimLogoFrame();

interface JimLogoBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function renderJimLogoScreen(
  width: number,
  height: number,
  theme: JeditTheme,
): Surface {
  const surface = fillWithWorkspace(width, height, theme);
  const bounds = jimLogoBounds(width, height);
  if (bounds == null) {
    return surface;
  }
  blitInkOnly(surface, glyphsFor(bounds), bounds.x, bounds.y);
  return surface;
}

// Rasterising the 192px frame is the expensive half and depends only on the
// glyph grid, so one cached result per size keeps a resize cheap. Only
// blitInkOnly reads it, and it never writes, so sharing the surface is safe.
let cachedGlyphs: { columns: number; rows: number; surface: Surface } | undefined;

function glyphsFor(bounds: JimLogoBounds): Surface {
  if (
    cachedGlyphs != null
    && cachedGlyphs.columns === bounds.width
    && cachedGlyphs.rows === bounds.height
  ) {
    return cachedGlyphs.surface;
  }
  const surface = rasterToGlyphSurface(JIM_LOGO_FRAME, {
    columns: bounds.width,
    rows: bounds.height,
    fit: GLYPH_SURFACE_FIT,
    cellAspectRatio: BRAILLE_CELL_ASPECT_RATIO,
    colorMode: GLYPH_SURFACE_COLOR_MODE,
    renderer: {
      kind: GLYPH_SURFACE_RENDERER_KIND,
      threshold: BRAILLE_DARKNESS_THRESHOLD,
    },
  });
  cachedGlyphs = { columns: bounds.width, rows: bounds.height, surface };
  return surface;
}

function fillWithWorkspace(width: number, height: number, theme: JeditTheme): Surface {
  const token = theme.surface.workspace;
  const surface = createSurface(width, height, { char: SURFACE_BLANK, empty: false });
  // Written as a literal rather than a spread of surface.get(x, y): every cell
  // starts identical, so re-reading each one only to copy it back costs a full
  // extra pass at full-terminal size.
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      surface.set(x, y, {
        char: SURFACE_BLANK,
        opacity: FULL_OPACITY,
        fg: token.fg,
        fgRGB: token.fgRGB,
        bg: token.bg,
        bgRGB: token.bgRGB,
        empty: false,
      });
    }
  }
  return surface;
}

function jimLogoBounds(width: number, height: number): JimLogoBounds | undefined {
  const availableRows = Math.min(
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

// Blank Braille cells stay transparent so the workspace surface shows through
// rather than the logo painting an opaque rectangle.
function blitInkOnly(
  target: Surface,
  glyphs: Surface,
  originX: number,
  originY: number,
): void {
  for (let y = 0; y < glyphs.height; y += 1) {
    for (let x = 0; x < glyphs.width; x += 1) {
      const glyph = glyphs.get(x, y);
      if (glyph.char === BRAILLE_BLANK || glyph.char === SURFACE_BLANK) {
        continue;
      }
      const cell = target.get(originX + x, originY + y);
      target.set(originX + x, originY + y, {
        ...cell,
        char: glyph.char,
        fg: glyph.fg,
        fgRGB: glyph.fgRGB,
        empty: false,
      });
    }
  }
}

function createJimLogoFrame(): RgbaFrame {
  const size = JIM_LOGO_FRAME_SIZE;
  const indices = unpackIndices(size * size);
  const data = new Uint8ClampedArray(size * size * RGBA_CHANNEL_COUNT);
  for (let pixel = 0; pixel < indices.length; pixel += 1) {
    const index = indices[pixel] ?? TRANSPARENT_INDEX;
    if (index === TRANSPARENT_INDEX) {
      continue;
    }
    const colour = JIM_LOGO_PALETTE[index - 1];
    if (colour == null) {
      continue;
    }
    const offset = pixel * RGBA_CHANNEL_COUNT;
    data[offset] = colour[0];
    data[offset + 1] = colour[1];
    data[offset + 2] = colour[2];
    data[offset + 3] = OPAQUE_ALPHA;
  }
  return { width: size, height: size, data };
}

function unpackIndices(count: number): Uint8Array {
  const packed = Buffer.from(JIM_LOGO_PACKED_INDICES, 'base64');
  const indices = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) {
    const byte = packed[i >> 1] ?? 0;
    indices[i] = (i % 2 === 0 ? byte >> 4 : byte) & 0x0f;
  }
  return indices;
}
