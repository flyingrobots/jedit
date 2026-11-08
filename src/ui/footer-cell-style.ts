import type { Surface } from '@flyingrobots/bijou';
import type { JeditStyleToken } from './jedit-theme.js';
import { visibleLineLength } from './fit-line.js';
export interface FooterCellRange { readonly row: number; readonly x: number; readonly width: number }
export function applyFooterRange(surface: Surface, range: FooterCellRange, token: JeditStyleToken): void {
  for (let x = range.x; x < Math.min(surface.width, range.x + range.width); x += 1) {
    const cell = surface.get(x, range.row);
    surface.set(x, range.row, { ...cell, fg: token.fg, fgRGB: token.fgRGB, bg: token.bg, bgRGB: token.bgRGB,
      modifiers: token.modifiers == null ? undefined : [...token.modifiers], empty: false });
  }
}
export function emphasizeFooterPhrases(surface: Surface, range: FooterCellRange, phrases: readonly string[], token: JeditStyleToken): void {
  const text = Array.from({ length: range.width }, (_, x) => surface.get(x + range.x, range.row).char).join('');
  for (const phrase of phrases) {
    const index = text.indexOf(phrase);
    if (index >= 0) applyFooterRange(surface, { ...range, x: range.x + visibleLineLength(text.slice(0, index)), width: visibleLineLength(phrase) }, token);
  }
}
