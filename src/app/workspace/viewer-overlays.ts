import type { Surface } from '@flyingrobots/bijou';
import { renderShellQuitOverlay, type Overlay } from '@flyingrobots/bijou-tui';
import { resolveScenePickerDrawerWidth, renderScenePickerDrawer } from '../../ui/scene-picker-drawer.js';
import { resolveSettingsDrawerWidth, renderSettingsDrawer } from '../../ui/settings-drawer.js';
import { renderStartupFileModal } from '../../ui/startup-file-modal.js';
import type { WorkspaceModel } from './model.js';
import { settingsRows } from './settings.js';
import { startupFileModalRows } from './startup-file-modal.js';
import { MIN_COLUMNS, MIN_ROWS } from './viewport.js';

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
}

export function workspaceFeedbackOverlay(model: WorkspaceModel): Overlay | undefined {
  if (model.quitConfirmOpen) {
    return renderShellQuitOverlay(model.columns, model.rows);
  }
  if (shouldRenderStartupFileModal(model)) {
    return renderStartupFileModal({
      cwd: model.cwd,
      input: model.startupFileModalInput,
      rows: startupFileModalRows(model.entries, model.startupFileModalInput),
      selectedIndex: model.startupFileModalSelectedIndex,
      theme: model.jeditTheme,
      screenWidth: model.columns,
      screenHeight: model.rows,
    });
  }
  return undefined;
}

function shouldRenderStartupFileModal(model: WorkspaceModel): boolean {
  return model.startupFileModalOpen
    && model.editor == null
    && model.columns >= MIN_COLUMNS
    && model.rows >= MIN_ROWS;
}
