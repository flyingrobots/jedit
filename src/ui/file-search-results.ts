import type { Surface } from '@flyingrobots/bijou';
import type { FileSearchEntry } from '../app/workspace/file-search.js';
import { filledSelectionToken } from './filled-selection-token.js';
import type { JeditTheme } from './jedit-theme.js';
import { JEDIT_TEXT_MODIFIER } from './jedit-theme.js';
import { visibleLineLength } from './fit-line.js';

const ENTRY_PREFIX_WIDTH = 2;
const CHARACTER_STEP = 1;

export function highlightFileSearchMatches(surface: Surface, entries: readonly FileSearchEntry[], theme: JeditTheme, selection: FileSearchSelection): void {
  entries.forEach(({ entry, matchIndexes, index: sourceIndex }, row) => {
    const selected = sourceIndex === selection.selectedIndex;
    paintFileSearchRow(surface, row, theme, { selected, hovered: sourceIndex === selection.hoveredIndex });
    const characters = Array.from(entry.name);
    for (const index of matchIndexes) {
      const column = ENTRY_PREFIX_WIDTH + visibleLineLength(characters.slice(0, index).join(''));
      const width = visibleLineLength(characters[index] ?? '');
      for (let x = column; x < Math.min(surface.width, column + width); x += CHARACTER_STEP) {
        const cell = surface.get(x, row);
        surface.set(x, row, {
          ...cell, fg: selected ? cell.fg : theme.chrome.activeEdge.fg,
          fgRGB: selected ? cell.fgRGB : theme.chrome.activeEdge.fgRGB,
          modifiers: [...(cell.modifiers ?? []), JEDIT_TEXT_MODIFIER.Bold],
        });
      }
    }
  });
}

export interface FileSearchSelection {
  readonly selectedIndex: number;
  readonly hoveredIndex?: number;
}

interface FileSearchRowState {
  readonly selected: boolean;
  readonly hovered: boolean;
}

function paintFileSearchRow(surface: Surface, row: number, theme: JeditTheme, state: FileSearchRowState): void {
  if (!state.selected && !state.hovered) return;
  const token = state.selected ? filledSelectionToken(theme) : theme.surface.currentLine;
  for (let x = 0; x < surface.width; x += CHARACTER_STEP) {
    const cell = surface.get(x, row);
    surface.set(x, row, { ...cell, fg: token.fg, fgRGB: token.fgRGB, bg: token.bg, bgRGB: token.bgRGB });
  }
}
