import type { FileSearchInputOptions } from '../../ui/file-search-input.js';
import { FOOTER_LAYOUT, footerGlobalWidth } from '../../ui/footer-layout.js';
import type { WorkspaceModel } from './model.js';
import { fileSearchState, fileSearchHasFocus } from './file-search.js';
import { footerGlobalObservation } from './footer-global-observation.js';
export function fileSearchInputOptions(model: WorkspaceModel, width: number): FileSearchInputOptions {
  return {
    state: fileSearchState(model), label: '/', placeholder: model.i18n.t('fileExplorer.placeholder'),
    focused: fileSearchHasFocus(model), width, theme: model.jeditTheme,
  };
}
export function fileFilterPromptWidth(model: WorkspaceModel): number {
  if (model.footerVisible && model.footerLayout !== FOOTER_LAYOUT.Compact) return model.columns;
  const global = footerGlobalObservation(model).globalCompact;
  return model.columns - footerGlobalWidth({ width: model.columns, summary: global, compact: true });
}
