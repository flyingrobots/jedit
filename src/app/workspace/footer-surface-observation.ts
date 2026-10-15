import type { FooterSurfaceFacts } from './footer-observation.js';
import { FocusPanes, type FocusPane } from '../../ports/workspace-focus.js';
import type { WorkspaceModel } from './model.js';
import { fileSearchEntries } from './file-search.js';
import { ViewModes } from './view-mode.js';


export function footerSurfaceObservation(model: WorkspaceModel, pane: FocusPane): FooterSurfaceFacts {
  const facts = pane === FocusPanes.Files ? filesFacts(model) : pane === FocusPanes.Graft ? graftFacts(model) : viewerFacts(model);
  return { ...facts, active: model.dojoFeedDrawer == null && !model.settingsOpen && !model.startupFileModalOpen && model.focusPane === pane };
}

function filesFacts(model: WorkspaceModel) {
  const entries = fileSearchEntries(model);
  const selected = entries.findIndex(({ index }) => index === model.selectedIndex);
  const mode = model.i18n.t(model.fileSearchEditing ? 'footer.status.filter' : 'footer.status.nav').toUpperCase();
  return {
    label: `${model.i18n.t('footer.mode.files').toUpperCase()} ${mode}`,
    identity: entries[selected]?.entry.path ?? model.cwd, identityIsPath: true,
    detail: `${Math.max(0, selected + 1)}/${entries.length}`,
  };
}

function graftFacts(model: WorkspaceModel) {
  const item = model.graftInfo?.outlineItems[model.graftSelectedIndex];
  return {
    label: `${model.i18n.t('footer.mode.graft').toUpperCase()} ${model.i18n.t('footer.status.nav').toUpperCase()}`,
    identity: item?.name ?? model.graftInfo?.path ?? model.cwd, identityIsPath: item == null,
    detail: model.graftLoading ? model.i18n.t('footer.status.loading')
      : `${item == null ? 0 : model.graftSelectedIndex + 1}/${model.graftInfo?.outlineItems.length ?? 0}`,
  };
}

function viewerFacts(model: WorkspaceModel) {
  if (model.fileExplorerPreview != null && model.focusPane === FocusPanes.Files) return {
    label: model.i18n.t('footer.mode.preview').toUpperCase(), identity: model.fileExplorerPreview.entry.path, identityIsPath: true,
    detail: model.i18n.t('footer.status.read_only'), detailEmphasized: true,
  };
  const editor = model.editor;
  if (editor == null) return {
    label: model.i18n.t('footer.mode.browse').toUpperCase(), identity: model.cwd, identityIsPath: true, detail: model.i18n.t('dojoFeed.open'),
  };
  const mode = model.viewMode === ViewModes.Preview ? model.i18n.t('footer.mode.preview') : model.i18n.t(`footer.mode.${editor.mode}`);
  const flags = [editor.dirty ? model.i18n.t('footer.status.modified') : '', editor.readOnly ? model.i18n.t('footer.status.read_only') : ''].filter(Boolean);
  return {
    label: mode.toUpperCase(), emphasis: [editor.pendingNormal ?? '', ...flags].filter(Boolean).join(' '),
    identity: editor.path, identityIsPath: true,
    detail: `${editor.cursorRow + 1}:${editor.cursorCol + 1}`,
  };
}
