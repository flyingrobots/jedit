import type { Surface } from '@flyingrobots/bijou';
import type { FileSearchEntry } from '../app/workspace/file-search.js';
import type { JeditTheme } from './jedit-theme.js';
import { JEDIT_TEXT_MODIFIER } from './jedit-theme.js';
import { visibleLineLength } from './fit-line.js';

const ENTRY_PREFIX_WIDTH = 2;
const CHARACTER_STEP = 1;

export function highlightFileSearchMatches(surface: Surface, entries: readonly FileSearchEntry[], theme: JeditTheme): void {
  entries.forEach(({ entry, matchIndexes }, row) => {
    const characters = Array.from(entry.name);
    for (const index of matchIndexes) {
      const column = ENTRY_PREFIX_WIDTH + visibleLineLength(characters.slice(0, index).join(''));
      const width = visibleLineLength(characters[index] ?? '');
      for (let x = column; x < Math.min(surface.width, column + width); x += CHARACTER_STEP) {
        const cell = surface.get(x, row);
        surface.set(x, row, {
          ...cell, fg: theme.chrome.activeEdge.fg, fgRGB: theme.chrome.activeEdge.fgRGB,
          modifiers: [...(cell.modifiers ?? []), JEDIT_TEXT_MODIFIER.Bold],
        });
      }
    }
  });
}
