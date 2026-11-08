import type { FooterSurfaceFacts } from './footer-observation.js';
import { FocusPanes, type FocusPane } from '../../ports/workspace-focus.js';
import type { WorkspaceModel } from './model.js';
import { fileSearchEntries, fileSearchHasFocus } from './file-search.js';
import { ViewModes } from './view-mode.js';
import { EditorModes, type EditorMode } from './editor/mode.js';

const COPY = Object.freeze({
  Files: 'footer.mode.files', Graft: 'footer.mode.graft', Preview: 'footer.mode.preview', Browse: 'footer.mode.browse',
  Filter: 'footer.status.filter', Nav: 'footer.status.nav', Loading: 'footer.status.loading',
  ReadOnly: 'footer.status.read_only', Modified: 'footer.status.modified',
} as const);
const EDITOR_MODE_COPY: Readonly<Record<EditorMode, string>> = Object.freeze({
  [EditorModes.Insert]: 'footer.mode.insert',
  [EditorModes.Normal]: 'footer.mode.normal',
});
const RANK_SEPARATOR = '/';
const FLAG_SEPARATOR = ' ';

export function footerSurfaceObservation(model: WorkspaceModel, pane: FocusPane): FooterSurfaceFacts {
  const facts = pane === FocusPanes.Files ? filesFacts(model) : pane === FocusPanes.Graft ? graftFacts(model) : viewerFacts(model);
  return { ...facts, active: !model.settingsOpen && !model.startupFileModalOpen && model.focusPane === pane };
}

function filesFacts(model: WorkspaceModel) {
  const entries = fileSearchEntries(model);
  const selected = entries.findIndex(({ index }) => index === model.selectedIndex);
  const mode = model.i18n.t(fileSearchHasFocus(model) ? COPY.Filter : COPY.Nav).toUpperCase();
  return {
    label: `${model.i18n.t(COPY.Files).toUpperCase()} ${mode}`,
    identity: entries[selected]?.entry.path ?? model.cwd, identityIsPath: true,
    detail: `${Math.max(0, selected + 1)}${RANK_SEPARATOR}${entries.length}`,
  };
}

function graftFacts(model: WorkspaceModel) {
  const item = model.graftInfo?.outlineItems[model.graftSelectedIndex];
  return {
    label: `${model.i18n.t(COPY.Graft).toUpperCase()} ${model.i18n.t(COPY.Nav).toUpperCase()}`,
    identity: item?.name ?? model.graftInfo?.path ?? model.cwd, identityIsPath: item == null,
    detail: model.graftLoading ? model.i18n.t(COPY.Loading)
      : `${item == null ? 0 : model.graftSelectedIndex + 1}${RANK_SEPARATOR}${model.graftInfo?.outlineItems.length ?? 0}`,
  };
}

function viewerFacts(model: WorkspaceModel) {
  if (model.fileExplorerPreview != null && model.focusPane === FocusPanes.Files) return {
    label: model.i18n.t(COPY.Preview).toUpperCase(), identity: model.fileExplorerPreview.entry.path, identityIsPath: true,
    detail: model.i18n.t(COPY.ReadOnly), detailEmphasized: true,
  };
  const editor = model.editor;
  if (editor == null) return { label: model.i18n.t(COPY.Browse).toUpperCase(), identity: model.cwd, identityIsPath: true, detail: '' };
  const mode = model.i18n.t(model.viewMode === ViewModes.Preview ? COPY.Preview : EDITOR_MODE_COPY[editor.mode]);
  const flags = [editor.dirty ? model.i18n.t(COPY.Modified) : '', editor.readOnly ? model.i18n.t(COPY.ReadOnly) : ''].filter(Boolean);
  return {
    label: mode.toUpperCase(), emphasis: [editor.pendingNormal ?? '', ...flags].filter(Boolean).join(FLAG_SEPARATOR),
    identity: editor.path, identityIsPath: true,
    detail: `${editor.cursorRow + 1}:${editor.cursorCol + 1}`,
  };
}
