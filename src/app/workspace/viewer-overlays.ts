import type { Surface } from '@flyingrobots/bijou';
import { renderShellQuitOverlay, type Overlay } from '@flyingrobots/bijou-tui';
import {
  renderInlineCompletionPopup,
  resolveInlineCompletionPopupGeometry,
} from '../../ui/inline-completion-popup.js';
import { resolveScenePickerDrawerWidth, renderScenePickerDrawer } from '../../ui/scene-picker-drawer.js';
import { resolveSettingsDrawerWidth, renderSettingsDrawer } from '../../ui/settings-drawer.js';
import { renderStartupFileDrawer } from '../../ui/startup-file-modal.js';
import {
  workspaceCommandLineCompletionItems,
} from './command-completion.js';
import { workspaceCommandLineCompletionPreview } from './command-completion-preview.js';
import type { WorkspaceModel } from './model.js';
import { settingsRows } from './settings.js';
import { startupFileModalRows } from './startup-file-modal.js';
import { FOOTER_ROWS, MIN_COLUMNS, MIN_ROWS } from './viewport.js';

const STARTUP_FILE_MODAL_I18N_KEYS = Object.freeze({
  Title: 'startupFileModal.title',
  Hint: 'startupFileModal.hint',
  CurrentDirectory: 'startupFileModal.current_directory',
  Empty: 'startupFileModal.empty',
} as const);
const COMMAND_COMPLETION_POPUP_MAX_WIDTH = 64;
const COMMAND_COMPLETION_POPUP_EDGE_INSET = 1;
const COMMAND_COMPLETION_POPUP_MAX_HEIGHT = 8;
const COMMAND_COMPLETION_CURSOR_PREFIX_WIDTH = 1;
const COMMAND_COMPLETION_DEFAULT_ANCHOR_INDEX = 0;
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

function paintCommandLineCompletionPopup(
  screen: Surface,
  model: WorkspaceModel,
): void {
  if (!shouldRenderCommandLineCompletionPopup(model)) {
    return;
  }

  const popup = commandLineCompletionPopupContext(model);
  if (popup == null) {
    return;
  }

  const geometry = resolveInlineCompletionPopupGeometry({
    items: popup.items,
    width: popup.width,
    maxHeight: COMMAND_COMPLETION_POPUP_MAX_HEIGHT,
    preview: popup.preview,
    anchor: popup.anchor,
  });
  screen.blit(
    renderInlineCompletionPopup({
      items: popup.items,
      selectedIndex: model.commandLine.selectedCompletionIndex,
      theme: model.jeditTheme,
      width: popup.width,
      maxHeight: COMMAND_COMPLETION_POPUP_MAX_HEIGHT,
      preview: popup.preview,
      anchor: popup.anchor,
    }),
    geometry.x,
    geometry.y,
  );
}

function commandLineCompletionPopupContext(model: WorkspaceModel) {
  const items = workspaceCommandLineCompletionItems({
    commandLine: model.commandLine,
    entries: model.entries,
  });
  if (items.length === 0) {
    return undefined;
  }

  return {
    items,
    preview: workspaceCommandLineCompletionPreview({
      commandLine: model.commandLine,
      entries: model.entries,
    }),
    width: commandCompletionPopupWidth(model.columns),
    anchor: commandLineCompletionPopupAnchor(model),
  };
}

function commandLineCompletionPopupAnchor(model: WorkspaceModel) {
  return {
    x: commandLineCompletionAnchorIndex(model) +
      COMMAND_COMPLETION_CURSOR_PREFIX_WIDTH,
    y: model.rows - FOOTER_ROWS,
    screenWidth: model.columns,
    screenHeight: model.rows - FOOTER_ROWS + COMMAND_COMPLETION_COMMAND_LINE_ROWS,
  };
}

function commandLineCompletionAnchorIndex(model: WorkspaceModel): number {
  return (
    model.commandLine.anchorCursorIndex ?? COMMAND_COMPLETION_DEFAULT_ANCHOR_INDEX
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
