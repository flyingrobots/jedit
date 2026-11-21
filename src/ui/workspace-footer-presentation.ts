import { filledSelectionToken } from './filled-selection-token.js';
import { JEDIT_SOURCE_TOKEN } from './jedit-theme.js';
import { displayFilepath } from './filepath-display.js';
import { fileSearchInputOptions } from './workspace-file-filter-prompt.js';
import { fileSearchHasFocus } from '../app/workspace/file-search.js';
import type { FooterPresentation, FooterSurfaceObservation } from './footer-layout-view.js';
import { resolveWorkspaceLayout } from './drawer-layout.js';
import { resolveSettingsDrawerWidth } from './settings-drawer.js';
import { FocusPanes } from './panel-focus.js';
import type { WorkspaceModel } from '../app/workspace/model.js';
import { footerGlobalObservation } from '../app/workspace/footer-global-observation.js';
import { footerSurfaceObservation } from '../app/workspace/footer-surface-observation.js';
import { settingsRows } from '../app/workspace/settings.js';

export function workspaceFooterPresentation(model: WorkspaceModel): FooterPresentation {
  const layout = resolveWorkspaceLayout(model.columns, model.fileDrawerProgress, model.graftDrawerProgress);
  const surfaces = [
    paneObservation(model, FocusPanes.Files, layout.fileDrawer),
    paneObservation(model, FocusPanes.Editor, layout.viewer),
    paneObservation(model, FocusPanes.Graft, layout.graftDrawer),
  ].filter((surface) => surface.width > 0);
  const overlay = focusedOverlay(model);
  const focused = overlay ?? surfaces.find((surface) => surface.active) ?? paneObservation(model, FocusPanes.Editor, layout.viewer);
  return {
    layout: model.footerLayout,
    surfaces: overlay == null ? surfaces : overlaySurfaces(surfaces, overlay),
    focused,
    ...footerGlobalObservation(model),
    workspace: displayFilepath(model.workspaceRoot, model),
    direction: model.i18n.direction,
    activeToken: filledSelectionToken(model.jeditTheme),
    normalToken: model.jeditTheme.surface.footer,
    mutedToken: mutedFooterToken(model),
    filterInput: fileSearchHasFocus(model) ? fileSearchInputOptions(model, model.columns) : undefined,
    hidden: !model.footerVisible,
  };
}

function focusedOverlay(model: WorkspaceModel): FooterSurfaceObservation | undefined {
  if (model.startupFileModalOpen) return {
    label: model.i18n.t('startupFileModal.title').toUpperCase(), identity: displayFilepath(model.cwd, model), detail: '',
    active: true, x: 0, width: model.columns,
  };
  if (!model.settingsOpen) return undefined;
  const row = settingsRows(model)[model.settingsFocusIndex];
  return {
    label: model.i18n.t('footer.mode.settings').toUpperCase(), identity: row?.label ?? '', detail: row?.valueLabel ?? '',
    active: true, x: 0, width: resolveSettingsDrawerWidth(model.columns),
  };
}

function overlaySurfaces(surfaces: readonly FooterSurfaceObservation[], overlay: FooterSurfaceObservation): readonly FooterSurfaceObservation[] {
  return [overlay, ...surfaces.flatMap((surface) => {
    const x = Math.max(surface.x, overlay.x + overlay.width);
    const width = surface.x + surface.width - x;
    return width > 0 ? [{ ...surface, x, width, active: false }] : [];
  })];
}

function mutedFooterToken(model: WorkspaceModel) {
  const comment = model.jeditTheme.source.get(JEDIT_SOURCE_TOKEN.Comment);
  return { ...model.jeditTheme.surface.footer, fg: comment?.fg, fgRGB: comment?.fgRGB };
}

function paneObservation(model: WorkspaceModel, pane: WorkspaceModel['focusPane'], bounds: { x: number; width: number }): FooterSurfaceObservation {
  const facts = footerSurfaceObservation(model, pane);
  return { ...facts, ...bounds, identity: facts.identityIsPath ? displayFilepath(facts.identity, model) : facts.identity };
}
export { renderFooterLayout, type FooterPresentation } from './footer-layout-view.js';
