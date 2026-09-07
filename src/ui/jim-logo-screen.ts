import { createSurface, type Surface } from '@flyingrobots/bijou';
import { rasterToGlyphSurface, type RgbaFrame } from '@flyingrobots/bijou-tui';

import type { JeditTheme } from './jedit-theme.js';
import {
  JIM_LOGO_FRAME_SIZE,
  JIM_LOGO_INDICES,
  JIM_LOGO_PALETTE,
} from './jim-logo-frame-data.js';

const MAX_LOGO_ROWS = 18;
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
  const glyphs = rasterToGlyphSurface(JIM_LOGO_FRAME, {
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
  blitInkOnly(surface, glyphs, bounds.x, bounds.y);
  return surface;
}

function fillWithWorkspace(width: number, height: number, theme: JeditTheme): Surface {
  const token = theme.surface.workspace;
  const surface = createSurface(width, height, { char: SURFACE_BLANK, empty: false });
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      surface.set(x, y, {
        ...surface.get(x, y),
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
  const data = new Uint8ClampedArray(size * size * RGBA_CHANNEL_COUNT);
  for (let pixel = 0; pixel < JIM_LOGO_INDICES.length; pixel += 1) {
    const index = JIM_LOGO_INDICES[pixel] ?? TRANSPARENT_INDEX;
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
