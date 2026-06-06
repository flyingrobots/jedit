import type { Surface } from '@flyingrobots/bijou';
import { renderShellQuitOverlay, type Overlay } from '@flyingrobots/bijou-tui';
import {
  renderInlineCompletionPopup,
  resolveInlineCompletionPopupGeometry,
} from '../../ui/inline-completion-popup.js';
import { resolveScenePickerDrawerWidth, renderScenePickerDrawer } from '../../ui/scene-picker-drawer.js';
import { resolveSettingsDrawerWidth, renderSettingsDrawer } from '../../ui/settings-drawer.js';
import { renderStartupFileDrawer } from '../../ui/startup-file-modal.js';
import { workspaceCommandLineCompletionItems } from './command-completion.js';
import type { WorkspaceModel } from './model.js';
import { settingsRows } from './settings.js';
import { startupFileModalRows } from './startup-file-modal.js';
import { FOOTER_ROWS, MIN_COLUMNS, MIN_ROWS } from './viewport.js';

const STARTUP_FILE_MODAL_I18N_KEYS = Object.freeze({
  Title: 'startupFileModal.title',
  Hint: 'startupFileModal.hint',
  InputLabel: 'startupFileModal.input_label',
  CurrentDirectory: 'startupFileModal.current_directory',
  Empty: 'startupFileModal.empty',
  NoMatch: 'startupFileModal.no_match',
} as const);
const COMMAND_COMPLETION_POPUP_MAX_WIDTH = 64;
const COMMAND_COMPLETION_POPUP_EDGE_INSET = 1;
const COMMAND_COMPLETION_POPUP_MAX_HEIGHT = 8;
const COMMAND_COMPLETION_CURSOR_PREFIX_WIDTH = 1;
const COMMAND_COMPLETION_COMMAND_LINE_ROWS = 1;

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
  paintCommandLineCompletionPopup(screen, model);
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

function paintCommandLineCompletionPopup(
  screen: Surface,
  model: WorkspaceModel,
): void {
  if (!shouldRenderCommandLineCompletionPopup(model)) {
    return;
  }

  const items = workspaceCommandLineCompletionItems({
    commandLine: model.commandLine,
    entries: model.entries,
  });
  if (items.length === 0) {
    return;
  }

  const width = commandCompletionPopupWidth(model.columns);
  const anchor = {
    x: model.commandLine.cursorIndex + COMMAND_COMPLETION_CURSOR_PREFIX_WIDTH,
    y: model.rows - FOOTER_ROWS,
    screenWidth: model.columns,
    screenHeight: model.rows - FOOTER_ROWS + COMMAND_COMPLETION_COMMAND_LINE_ROWS,
  };
  const geometry = resolveInlineCompletionPopupGeometry({
    items,
    width,
    maxHeight: COMMAND_COMPLETION_POPUP_MAX_HEIGHT,
    anchor,
  });
  screen.blit(
    renderInlineCompletionPopup({
      items,
      selectedIndex: model.commandLine.selectedCompletionIndex,
      theme: model.jeditTheme,
      width,
      maxHeight: COMMAND_COMPLETION_POPUP_MAX_HEIGHT,
      anchor,
    }),
    geometry.x,
    geometry.y,
  );
}

function shouldRenderCommandLineCompletionPopup(model: WorkspaceModel): boolean {
  return (
    model.commandLine.active &&
    model.footerVisible &&
    model.columns >= MIN_COLUMNS &&
    model.rows >= MIN_ROWS
  );
}

function commandCompletionPopupWidth(columns: number): number {
  return Math.max(
    1,
    Math.min(
      COMMAND_COMPLETION_POPUP_MAX_WIDTH,
      columns - (COMMAND_COMPLETION_POPUP_EDGE_INSET * 2),
    ),
  );
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
