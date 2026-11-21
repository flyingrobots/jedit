import { JEDIT_TEXT_MODIFIER, type JeditTheme, type JeditStyleToken } from './jedit-theme.js';
import { legibleOn } from './theme-contrast.js';
const MIN_SELECTION_CONTRAST = 4.5;
const HEX_RADIX = 16;
const HEX_PAIR_WIDTH = 2;

/** Filled selections use explicit, contrast-corrected colors without cursor inversion. */
export function filledSelectionToken(theme: JeditTheme): JeditStyleToken {
  const background = theme.cursor.normal.bgRGB;
  const foreground = theme.surface.workspace.bgRGB;
  const fgRGB = background == null || foreground == null ? theme.cursor.normal.fgRGB : legibleOn(foreground, [background], MIN_SELECTION_CONTRAST);
  const fg = fgRGB == null ? theme.cursor.normal.fg
    : `#${fgRGB.map((channel) => channel.toString(HEX_RADIX).padStart(HEX_PAIR_WIDTH, '0')).join('')}`;
  return { ...theme.cursor.normal, fg, fgRGB, modifiers: [JEDIT_TEXT_MODIFIER.Bold] };
}
