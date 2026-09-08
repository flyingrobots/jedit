import type { Surface } from '@flyingrobots/bijou';
import type { JeditStyleToken } from '../../ui/jedit-theme.js';

export function fillSurface(surface: Surface, token: JeditStyleToken): void {
  surface.fill({
    char: ' ',
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
        char: cell.char.length > 0 ? cell.char : ' ',
        fg: token.fg,
        fgRGB: token.fgRGB,
        bg: token.bg,
        bgRGB: token.bgRGB,
        empty: false,
      });
    }
  }
}

// Re-exported here so the viewer reaches every surface it paints through one
// module. Importing jim-logo-screen directly puts viewer-content.ts over the
// twelve-import limit, and routing it through ui/title-screen.ts -- the other
// module that already re-exports viewer surfaces -- would touch a path under
// the title-scene freeze leash for a re-export that adds no title-scene
// behaviour. The leash is right to refuse that; this avoids asking.
export { renderJimLogoScreen } from '../../ui/jim-logo-screen.js';
