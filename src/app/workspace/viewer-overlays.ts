import type { Surface } from '@flyingrobots/bijou';
import { renderShellQuitOverlay, type Overlay } from '@flyingrobots/bijou-tui';
import {
  renderGraftDiagnosticsPanel,
  resolveGraftDiagnosticsPanelWidth,
} from '../../ui/graft-diagnostics-panel.js';
import { resolveScenePickerDrawerWidth, renderScenePickerDrawer } from '../../ui/scene-picker-drawer.js';
import { resolveSettingsDrawerWidth, renderSettingsDrawer } from '../../ui/settings-drawer.js';
import { renderStartupFileDrawer } from '../../ui/startup-file-modal.js';
import type { WorkspaceModel } from './model.js';
import { settingsRows } from './settings.js';
import { startupFileModalRows } from './startup-file-modal.js';
import {
  MIN_COLUMNS,
  MIN_ROWS,
} from './viewport.js';
import { paintWorkspaceCommandCompletionOverlay } from './workspace-command-completion-overlay.js';
import { paintWorkspaceInlinePanelOverlay } from './workspace-inline-panel-overlay.js';

const STARTUP_FILE_MODAL_I18N_KEYS = Object.freeze({
  Title: 'startupFileModal.title',
  CurrentDirectory: 'startupFileModal.current_directory',
  Empty: 'startupFileModal.empty',
} as const);

export function paintWorkspaceOverlays(
  screen: Surface,
  model: WorkspaceModel,
  bodyTop: number,
  bodyHeight: number,
): void {
  paintSettingsOverlay(screen, model, bodyTop, bodyHeight);

  if (model.scenePickerOpen && model.editor == null) {
    screen.blit(
      renderScenePickerDrawer({
        scenes: model.availableScenes,
        selectedIndex: model.scenePickerFocusIndex,
        theme: model.jeditTheme,
        width: resolveScenePickerDrawerWidth(model.columns),
        height: bodyHeight,
      }),
      0,
      bodyTop,
    );
  }

  paintStartupFileDrawer(screen, model, bodyTop, bodyHeight);
  paintWorkspaceInlinePanelOverlay(screen, model, bodyTop, bodyHeight);
  paintWorkspaceCommandCompletionOverlay(screen, model);
}

function paintSettingsOverlay(
  screen: Surface,
  model: WorkspaceModel,
  bodyTop: number,
  bodyHeight: number,
): void {
  if (!model.settingsOpen) {
    return;
  }
  screen.blit(
    model.settingsDiagnosticsOpen
      ? renderGraftDiagnosticsPanel({
        report: model.graftDiagnostics,
        loading: model.graftDiagnosticsLoading,
        theme: model.jeditTheme,
        width: resolveGraftDiagnosticsPanelWidth(model.columns),
        height: bodyHeight,
      })
      : renderSettingsDrawer({
        rows: settingsRows(model),
        selectedIndex: model.settingsFocusIndex,
        theme: model.jeditTheme,
        width: resolveSettingsDrawerWidth(model.columns),
        height: bodyHeight,
      }),
    0,
    bodyTop,
  );
}

function paintStartupFileDrawer(
  screen: Surface,
  model: WorkspaceModel,
  bodyTop: number,
  bodyHeight: number,
): void {
  if (shouldRenderStartupFileDrawer(model)) {
    screen.blit(
      renderStartupFileDrawer({
        cwd: model.cwd,
        rows: startupFileModalRows(model.entries),
        selectedIndex: model.startupFileModalSelectedIndex,
        copy: startupFileModalCopy(model),
        theme: model.jeditTheme,
        screenWidth: model.columns,
        screenHeight: bodyHeight,
        progress: model.startupFileDrawerProgress,
      }),
      0,
      bodyTop,
    );
  }
}

export function workspaceFeedbackOverlay(model: WorkspaceModel): Overlay | undefined {
  if (model.quitConfirmOpen) {
    return renderShellQuitOverlay(model.columns, model.rows);
  }
  return undefined;
}

function startupFileModalCopy(model: WorkspaceModel) {
  return {
    title: model.i18n.t(STARTUP_FILE_MODAL_I18N_KEYS.Title),
    currentDirectory: model.i18n.t(STARTUP_FILE_MODAL_I18N_KEYS.CurrentDirectory),
    empty: model.i18n.t(STARTUP_FILE_MODAL_I18N_KEYS.Empty),
  };
}

function shouldRenderStartupFileDrawer(model: WorkspaceModel): boolean {
  return (
    model.startupFileDrawerProgress > 0 &&
    model.editor == null &&
    model.columns >= MIN_COLUMNS &&
    model.rows >= MIN_ROWS
  );
}
