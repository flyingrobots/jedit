import { createSurface, stringToSurface, type Surface } from '@flyingrobots/bijou';
import { fitBlock, formatTreeLine } from '../../ui/workspace-render.js';
import { highlightFileSearchMatches } from '../../ui/file-search-results.js';
import { renderFileSearchInput, type FileSearchInputOptions } from '../../ui/file-search-input.js';
import type { WorkspaceModel } from './model.js';
import { fileSearchEntries, fileSearchHasFocus, fileSearchState } from './file-search.js';
import {
  DRAWER_INNER_PAD, FILE_SEARCH_ROW, FILE_SEARCH_SEPARATOR_ROW, FILE_SEARCH_LIST_TOP,
  fileSearchListHeight, listScrollOffset,
} from './viewport.js';
import { applyBackground, fillSurface } from './surface-fill.js';

const PAD_MULTIPLIER = 2;
const MIN_WIDTH = 1;
const SEARCH_LABEL_KEY = 'fileExplorer.search_label';
const SEARCH_PLACEHOLDER_KEY = 'fileExplorer.placeholder';
const SEARCH_EMPTY_KEY = 'fileExplorer.empty';
const INPUT_RULE = '─';

export function fileSearchInputOptions(model: WorkspaceModel, width: number): FileSearchInputOptions {
  return {
    state: fileSearchState(model), label: model.i18n.t(SEARCH_LABEL_KEY),
    placeholder: model.i18n.t(SEARCH_PLACEHOLDER_KEY), focused: fileSearchHasFocus(model),
    width, theme: model.jeditTheme,
  };
}

export function renderFileExplorer(model: WorkspaceModel, width: number, height: number): Surface {
  const surface = createSurface(width, height);
  fillSurface(surface, model.jeditTheme.surface.drawer);
  const innerWidth = Math.max(MIN_WIDTH, width - DRAWER_INNER_PAD * PAD_MULTIPLIER);
  surface.blit(renderFileSearchInput(fileSearchInputOptions(model, innerWidth)), DRAWER_INNER_PAD, FILE_SEARCH_ROW);
  const rule = stringToSurface(INPUT_RULE.repeat(innerWidth), innerWidth, 1);
  applyBackground(rule, model.jeditTheme.surface.drawer);
  surface.blit(rule, DRAWER_INNER_PAD, FILE_SEARCH_SEPARATOR_ROW);
  paintFileSearchResults(surface, model, innerWidth, fileSearchListHeight(height));
  return surface;
}

function paintFileSearchResults(surface: Surface, model: WorkspaceModel, width: number, height: number): void {
  if (height <= 0) return;
  const entries = fileSearchEntries(model);
  const selected = entries.findIndex(({ index }) => index === model.selectedIndex);
  const offset = listScrollOffset(selected, entries.length, height);
  const lines = entries.length === 0
    ? [model.i18n.t(SEARCH_EMPTY_KEY)]
    : entries.slice(offset, offset + height).map(({ entry, index }) => formatTreeLine(entry, {
      selected: index === model.selectedIndex,
    }));
  const content = stringToSurface(fitBlock(lines.join('\n'), width, height), width, height);
  applyBackground(content, model.jeditTheme.surface.drawer);
  highlightFileSearchMatches(content, entries.slice(offset, offset + height), model.jeditTheme);
  surface.blit(content, DRAWER_INNER_PAD, FILE_SEARCH_LIST_TOP);
}
