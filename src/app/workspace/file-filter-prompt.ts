import type { FileSearchInputOptions } from '../../ui/file-search-input.js';
import { FOOTER_LAYOUT } from '../../ui/footer-layout.js';
import { visibleLineLength } from '../../ui/fit-line.js';
import type { WorkspaceModel } from './model.js';
import { fileSearchState, fileSearchHasFocus } from './file-search.js';
import { footerGlobalObservation } from './footer-global-observation.js';
const GLOBAL_GAP_WIDTH = 2;
export function fileSearchInputOptions(model: WorkspaceModel, width: number): FileSearchInputOptions {
  return {
    state: fileSearchState(model), label: '/', placeholder: model.i18n.t('fileExplorer.placeholder'),
    focused: fileSearchHasFocus(model), width, theme: model.jeditTheme,
  };
}
export function fileFilterPromptWidth(model: WorkspaceModel): number {
  if (model.footerVisible && model.footerLayout !== FOOTER_LAYOUT.Compact) return model.columns;
  const global = footerGlobalObservation(model).globalCompact;
  return model.columns - Math.min(visibleLineLength(global) + GLOBAL_GAP_WIDTH, Math.floor(model.columns / 2));
}
