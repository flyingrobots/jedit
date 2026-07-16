import type { Surface } from '@flyingrobots/bijou';
import type { JeditStyleToken } from './jedit-theme.js';

const SURFACE_FILL_CHAR = ' ';

export { fitLine } from './fit-line.js';

export function fillSurface(surface: Surface, token: JeditStyleToken): void {
  surface.fill({
    char: SURFACE_FILL_CHAR,
    fg: token.fg,
    fgRGB: token.fgRGB,
    bg: token.bg,
    bgRGB: token.bgRGB,
    empty: false,
  });
}

export function applyBackground(surface: Surface, token: JeditStyleToken): void {
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const cell = surface.get(x, y);
      surface.set(x, y, {
        ...cell,
        char: cell.char.length > 0 ? cell.char : SURFACE_FILL_CHAR,
        fg: token.fg,
        fgRGB: token.fgRGB,
        bg: token.bg,
        bgRGB: token.bgRGB,
        empty: false,
      });
    }
  }
}
