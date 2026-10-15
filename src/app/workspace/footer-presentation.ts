import type { FooterPresentation, FooterSurfaceObservation } from '../../ui/footer-layout-view.js';
import { resolveWorkspaceLayout } from '../../ui/drawer-layout.js';
import { resolveSettingsDrawerWidth } from '../../ui/settings-drawer.js';
import { FocusPanes } from '../../ui/panel-focus.js';
import type { WorkspaceModel } from './model.js';
import { footerGlobalObservation } from './footer-global-observation.js';
import { footerSurfaceObservation } from './footer-surface-observation.js';
import { settingsRows } from './settings.js';

export function workspaceFooterPresentation(model: WorkspaceModel): FooterPresentation {
  const layout = resolveWorkspaceLayout(model.columns, model.fileDrawerProgress, model.graftDrawerProgress);
  const surfaces = [
    footerSurfaceObservation(model, FocusPanes.Files, layout.fileDrawer),
    footerSurfaceObservation(model, FocusPanes.Editor, layout.viewer),
    footerSurfaceObservation(model, FocusPanes.Graft, layout.graftDrawer),
  ].filter((surface) => surface.width > 0);
  const overlay = focusedOverlay(model);
  const focused = overlay ?? surfaces.find((surface) => surface.active) ?? footerSurfaceObservation(model, FocusPanes.Editor, layout.viewer);
  return {
    layout: model.footerLayout,
    surfaces: overlay == null ? surfaces : overlaySurfaces(surfaces, overlay),
    focused,
    ...footerGlobalObservation(model),
    activeToken: model.jeditTheme.chrome.activeEdge,
  };
}

function focusedOverlay(model: WorkspaceModel): FooterSurfaceObservation | undefined {
  if (model.startupFileModalOpen) return {
    label: model.i18n.t('startupFileModal.title').toUpperCase(), identity: model.cwd, detail: '',
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
