import { I18N_TEXT_DIRECTION } from '../ports/i18n.js';
import type { FileSearchInputOptions } from './file-search-input.js';
import { FOOTER_LAYOUT, footerGlobalWidth } from './footer-layout.js';
import type { WorkspaceModel } from '../app/workspace/model.js';
import { fileSearchState, fileSearchHasFocus } from '../app/workspace/file-search.js';
import { footerGlobalObservation } from '../app/workspace/footer-global-observation.js';
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

export function fileFilterPromptX(model: WorkspaceModel): number {
  return model.i18n.direction === I18N_TEXT_DIRECTION.Rtl ? model.columns - fileFilterPromptWidth(model) : 0;
}
