import { createSurface, stringToSurface, type Surface } from '@flyingrobots/bijou';
import { fitBlock, formatTreeLine } from '../../ui/workspace-render.js';
import { highlightFileSearchMatches } from '../../ui/file-search-results.js';
import type { WorkspaceModel } from './model.js';
import { fileSearchEntries, fileSearchState } from './file-search.js';
import {
  DRAWER_INNER_PAD, FILE_SEARCH_ROW, FILE_SEARCH_LIST_TOP,
  fileSearchListHeight, listScrollOffset,
} from './viewport.js';
import { applyBackground, fillSurface } from './surface-fill.js';

const PAD_MULTIPLIER = 2;
const MIN_WIDTH = 1;
const SEARCH_EMPTY_KEY = 'fileExplorer.empty';

export { fileSearchInputOptions } from './file-filter-prompt.js';

export function renderFileExplorer(model: WorkspaceModel, width: number, height: number): Surface {
  const surface = createSurface(width, height);
  fillSurface(surface, model.jeditTheme.surface.drawer);
  const innerWidth = Math.max(MIN_WIDTH, width - DRAWER_INNER_PAD * PAD_MULTIPLIER);
  const query = fileSearchState(model).input;
  const header = query.length === 0 ? `${model.i18n.t('footer.mode.files')}  ${model.i18n.t('footer.hints.slash_filter')}`
    : `${model.i18n.t('footer.status.filter')}: ${query}`;
  const title = stringToSurface(fitBlock(header, innerWidth, 1), innerWidth, 1);
  applyBackground(title, model.jeditTheme.surface.drawer);
  surface.blit(title, DRAWER_INNER_PAD, FILE_SEARCH_ROW);
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
  highlightFileSearchMatches(content, entries.slice(offset, offset + height), model.jeditTheme, {
    selectedIndex: model.selectedIndex, hoveredIndex: model.fileHoveredIndex,
  });
  surface.blit(content, DRAWER_INNER_PAD, FILE_SEARCH_LIST_TOP);
}
