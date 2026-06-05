import type { Surface } from '@flyingrobots/bijou';
import { renderShellQuitOverlay, type Overlay } from '@flyingrobots/bijou-tui';
import { resolveScenePickerDrawerWidth, renderScenePickerDrawer } from '../../ui/scene-picker-drawer.js';
import { resolveSettingsDrawerWidth, renderSettingsDrawer } from '../../ui/settings-drawer.js';
import { renderStartupFileDrawer } from '../../ui/startup-file-modal.js';
import type { WorkspaceModel } from './model.js';
import { settingsRows } from './settings.js';
import { startupFileModalRows } from './startup-file-modal.js';
import { MIN_COLUMNS, MIN_ROWS } from './viewport.js';

const STARTUP_FILE_MODAL_I18N_KEYS = Object.freeze({
  Title: 'startupFileModal.title',
  Hint: 'startupFileModal.hint',
  InputLabel: 'startupFileModal.input_label',
  CurrentDirectory: 'startupFileModal.current_directory',
  Empty: 'startupFileModal.empty',
  NoMatch: 'startupFileModal.no_match',
} as const);

export function paintWorkspaceOverlays(
  screen: Surface,
  model: WorkspaceModel,
  bodyTop: number,
  bodyHeight: number,
): void {
  if (model.settingsOpen) {
    screen.blit(
      renderSettingsDrawer({
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
        input: model.startupFileModalInput,
        rows: startupFileModalRows(model.entries, model.startupFileModalInput),
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
    hint: model.i18n.t(STARTUP_FILE_MODAL_I18N_KEYS.Hint),
    inputLabel: model.i18n.t(STARTUP_FILE_MODAL_I18N_KEYS.InputLabel),
    currentDirectory: model.i18n.t(STARTUP_FILE_MODAL_I18N_KEYS.CurrentDirectory),
    empty: model.i18n.t(STARTUP_FILE_MODAL_I18N_KEYS.Empty),
    noMatch: model.i18n.t(STARTUP_FILE_MODAL_I18N_KEYS.NoMatch),
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
