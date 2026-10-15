import { displayFilepath } from '../../ui/filepath-display.js';
import type { FooterSurfaceObservation } from '../../ui/footer-layout-view.js';
import { FocusPanes, type FocusPane } from '../../ui/panel-focus.js';
import type { WorkspaceModel } from './model.js';
import { fileSearchEntries } from './file-search.js';
import { ViewModes } from './view-mode.js';

interface PaneBounds { readonly x: number; readonly width: number }

export function footerSurfaceObservation(model: WorkspaceModel, pane: FocusPane, bounds: PaneBounds): FooterSurfaceObservation {
  const facts = pane === FocusPanes.Files ? filesFacts(model) : pane === FocusPanes.Graft ? graftFacts(model) : viewerFacts(model);
  return { ...facts, ...bounds, active: !model.settingsOpen && !model.startupFileModalOpen && model.focusPane === pane };
}

function filesFacts(model: WorkspaceModel) {
  const entries = fileSearchEntries(model);
  const selected = entries.findIndex(({ index }) => index === model.selectedIndex);
  const mode = model.i18n.t(model.fileSearchEditing ? 'footer.status.filter' : 'footer.status.nav').toUpperCase();
  return {
    label: `${model.i18n.t('footer.mode.files').toUpperCase()} ${mode}`,
    identity: displayFilepath(entries[selected]?.entry.path ?? model.cwd, model),
    detail: `${Math.max(0, selected + 1)}/${entries.length}`,
  };
}

function graftFacts(model: WorkspaceModel) {
  const item = model.graftInfo?.outlineItems[model.graftSelectedIndex];
  return {
    label: `${model.i18n.t('footer.mode.graft').toUpperCase()} ${model.i18n.t('footer.status.nav').toUpperCase()}`,
    identity: item?.name ?? displayFilepath(model.graftInfo?.path ?? model.cwd, model),
    detail: model.graftLoading ? model.i18n.t('footer.status.loading')
      : `${item == null ? 0 : model.graftSelectedIndex + 1}/${model.graftInfo?.outlineItems.length ?? 0}`,
  };
}

function viewerFacts(model: WorkspaceModel) {
  if (model.fileExplorerPreview != null && model.focusPane === FocusPanes.Files) return {
    label: model.i18n.t('footer.mode.preview').toUpperCase(), identity: displayFilepath(model.fileExplorerPreview.entry.path, model),
    detail: model.i18n.t('footer.status.read_only'), detailEmphasized: true,
  };
  const editor = model.editor;
  if (editor == null) return { label: model.i18n.t('footer.mode.browse').toUpperCase(), identity: displayFilepath(model.cwd, model), detail: '' };
  const mode = model.viewMode === ViewModes.Preview ? model.i18n.t('footer.mode.preview') : model.i18n.t(`footer.mode.${editor.mode}`);
  const flags = [editor.dirty ? model.i18n.t('footer.status.modified') : '', editor.readOnly ? model.i18n.t('footer.status.read_only') : ''].filter(Boolean);
  return {
    label: mode.toUpperCase(), emphasis: [editor.pendingNormal ?? '', ...flags].filter(Boolean).join(' '),
    identity: displayFilepath(editor.path, model),
    detail: `${editor.cursorRow + 1}:${editor.cursorCol + 1}`,
  };
}
