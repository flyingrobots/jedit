import { colorHex, type TokenValue } from '@flyingrobots/bijou';
import { quit, type KeyMsg } from '@flyingrobots/bijou-tui';
import type { Cmd } from '@flyingrobots/bijou-tui';
import { isFooterToggleKey, pushNotificationToast } from '../../ui/feedback.js';
import {
  JEDIT_MARKDOWN_PREVIEW_TOGGLE_KEY,
  JEDIT_SCENE_PICKER_TOGGLE_KEY,
  JEDIT_SETTINGS_TOGGLE_KEY,
  JEDIT_THEME_TOGGLE_KEY,
} from '../keybindings.js';
import {
  beginEditorProjectionRefresh,
  beginGraftRefresh,
  saveEditor,
  toggleMarkdownPreview,
} from './editor-session.js';
import { closeDrawer, type CreateDrawerAnimationCmd, toggleDrawer } from './drawer.js';
import { focusCycleState } from './focus.js';
import { cycleFocusPane, FocusPanes, hasFocusablePeers } from '../../ui/panel-focus.js';
import { updateJeditSettingsFromKey } from '../settings-session.js';
import { settingsRows, workspaceSettingsHandlers } from './settings.js';
import { updateGraftDrawerFromKey } from './graft-drawer.js';
import { updateTreeFromKey } from './file-tree.js';
import { updateViewerFromKey } from './viewer.js';
import { nextJeditTheme } from '../../ui/jedit-themes.js';
import {
  nextTitleAsciiPalette,
  TITLE_ASCII_PALETTE,
  TITLE_RENDER_MODE,
  type TitleAsciiPalette,
} from '../../ui/title-screen.js';
import { updateTitleCameraFromKey } from '../title-camera-session.js';
import type { FileSystemPort } from '../../ports/file-system.js';
import type { EditorFilePort } from '../../ports/editor-file.js';
import type { GraftSessionPort } from '../../ports/graft-session.js';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import type { TitleSceneLoaderPort } from '../../ports/title-scene-loader.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { EditorModes } from './editor/mode.js';
import { ViewModes } from './view-mode.js';
import { DrawerKinds } from '../../ui/drawer-layout.js';
import {
  isWorkspaceScenePickerAcceptKey,
  isWorkspaceScenePickerCloseKey,
  isWorkspaceScenePickerNextKey,
  isWorkspaceScenePickerPreviousKey,
  WorkspaceKeys,
} from './workspace-key.js';

export interface UpdateFromKeyDeps {
  readonly fileSystem: FileSystemPort;
  readonly editorFile: EditorFilePort;
  readonly sourceHighlighter: SourceHighlighter;
  readonly graftSession: GraftSessionPort;
  readonly titleSceneLoader: TitleSceneLoaderPort;
}

const TITLE_SHADER_TOAST_TITLE = 'Title shader';
const TITLE_ASCII_PALETTE_TOAST_TITLE = 'ASCII palette';
const TITLE_SHADER_BRAILLE_LABEL = 'Braille';
const TITLE_SHADER_ASCII_LABEL = 'ASCII';
const TITLE_ASCII_PALETTE_DENSE_LABEL = 'Dense';
const TITLE_ASCII_PALETTE_MINIMAL_LABEL = 'Minimal';
const TITLE_ASCII_PALETTE_TECHNICAL_LABEL = 'Technical';
const TITLE_ASCII_PALETTE_HATCHING_LABEL = 'Hatching';
const TITLE_ASCII_PALETTE_MATRIX_LABEL = 'Matrix';
const TITLE_ASCII_PALETTE_BLOCKS_LABEL = 'Blocks';
const TITLE_ASCII_PALETTE_DITHER_LABEL = 'Dither';
const NOTIFICATION_TOAST_VARIANT = 'TOAST';
const NOTIFICATION_INFO_TONE = 'INFO';
const NOTIFICATION_LOWER_RIGHT_PLACEMENT = 'LOWER_RIGHT';
const FALLBACK_TOAST_FOREGROUND = '#e2e7ec';
const FALLBACK_TOAST_BACKGROUND = '#0e1116';
const FALLBACK_TOAST_ACCENT = '#d897ff';
const SCENE_PICKER_MIN_INDEX = 0;
const SCENE_PICKER_STEP = 1;

export function updateFromKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  nowMs: () => number,
  createDrawerAnimationCmd: CreateDrawerAnimationCmd,
  createNotificationTickCmd: () => Cmd<WorkspaceMsg>,
  deps: UpdateFromKeyDeps,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (msg.key === WorkspaceKeys.Backtick) {
    return [
      model,
      [() => ({
        type: 'toggle-perf',
      })],
    ];
  }

  if (msg.key === JEDIT_SETTINGS_TOGGLE_KEY) {
    return [{ ...model, settingsOpen: !model.settingsOpen, settingsFocusIndex: 0 }, []];
  }

  if (model.settingsOpen) {
    return updateJeditSettingsFromKey(msg, model, settingsRows(model), workspaceSettingsHandlers);
  }

  if (model.editor == null && msg.ctrl && !msg.alt && msg.key === JEDIT_SCENE_PICKER_TOGGLE_KEY) {
    return [{ ...model, scenePickerOpen: !model.scenePickerOpen }, []];
  }

  if (model.scenePickerOpen) {
    if (isScenePickerCloseKey(msg)) {
      return [{ ...model, scenePickerOpen: false }, []];
    }
    if (isScenePickerPreviousKey(msg)) {
      return [{ ...model, scenePickerFocusIndex: Math.max(SCENE_PICKER_MIN_INDEX, model.scenePickerFocusIndex - SCENE_PICKER_STEP) }, []];
    }
    if (isScenePickerNextKey(msg)) {
      const maxIndex = Math.max(SCENE_PICKER_MIN_INDEX, model.availableScenes.length - SCENE_PICKER_STEP);
      return [{
        ...model,
        scenePickerFocusIndex: Math.min(maxIndex, model.scenePickerFocusIndex + SCENE_PICKER_STEP),
      }, []];
    }
    if (isScenePickerAcceptKey(msg)) {
      const selected = model.availableScenes[model.scenePickerFocusIndex];
      if (selected != null) {
        return [{ ...model, scenePickerOpen: false }, [
          async () => {
            try {
              const scene = await deps.titleSceneLoader.loadBuiltInTitleScene(selected, model.titleMeshes);
              return { type: 'load-scene-result', scene };
            } catch (error) {
              return {
                type: 'runtime-issue',
                issue: {
                  type: 'system',
                  name: 'SceneLoadError',
                  message: String(error),
                  level: 'error',
                  source: 'command',
                  atMs: nowMs(),
                },
              };
            }
          },
        ]];
      }
    }
    return [model, []];
  }

  if (model.editor == null) {
    if (msg.key === WorkspaceKeys.One) {
      return pushTitleScreenToast(
        { ...model, titleRenderMode: TITLE_RENDER_MODE.Braille },
        TITLE_SHADER_TOAST_TITLE,
        TITLE_SHADER_BRAILLE_LABEL,
        nowMs,
        createNotificationTickCmd,
      );
    }
    if (msg.key === WorkspaceKeys.Two) {
      return pushTitleScreenToast(
        { ...model, titleRenderMode: TITLE_RENDER_MODE.Ascii },
        TITLE_SHADER_TOAST_TITLE,
        `${TITLE_SHADER_ASCII_LABEL} · ${titleAsciiPaletteLabel(model.titleAsciiPalette)}`,
        nowMs,
        createNotificationTickCmd,
      );
    }
    if (msg.key === WorkspaceKeys.Period) {
      if (model.titleRenderMode !== TITLE_RENDER_MODE.Ascii) {
        return [model, []];
      }

      const titleAsciiPalette = nextTitleAsciiPalette(model.titleAsciiPalette);
      return pushTitleScreenToast({
        ...model,
        titleAsciiPalette,
      }, TITLE_ASCII_PALETTE_TOAST_TITLE, titleAsciiPaletteLabel(titleAsciiPalette), nowMs, createNotificationTickCmd);
    }

    const update = updateTitleCameraFromKey(msg.key, model.titleCamera);
    if (update != null) {
      return [{ ...model, titleCamera: update.state }, update.commands];
    }
  }

  if (msg.ctrl && msg.key === WorkspaceKeys.C) {
    return [model, [quit<WorkspaceMsg>()]];
  }

  const insertModeActive = model.focusPane === FocusPanes.Editor && model.viewMode === ViewModes.Source && model.editor?.mode === EditorModes.Insert;
  if (!insertModeActive && isFooterToggleKey(msg)) {
    return [{ ...model, footerVisible: !model.footerVisible }, []];
  }

  if (!insertModeActive && msg.key === WorkspaceKeys.Q) {
    return [model, [quit<WorkspaceMsg>()]];
  }

  if (msg.ctrl && !msg.alt && msg.key === WorkspaceKeys.S && model.editor != null) {
    const editor = saveEditor(model.editor, deps.editorFile);
    return beginEditorProjectionRefresh({
      ...model,
      editor,
    }, model.graftDrawerOpen || model.graftInfo?.path === editor.path, {
      editorFile: deps.editorFile,
      sourceHighlighter: deps.sourceHighlighter,
      graftSession: deps.graftSession,
    });
  }

  if (msg.ctrl && !msg.alt && msg.key === JEDIT_THEME_TOGGLE_KEY) {
    return [{ ...model, jeditTheme: nextJeditTheme(model.jeditTheme) }, []];
  }

  const focusState = focusCycleState(model);
  if (msg.key === WorkspaceKeys.Tab && hasFocusablePeers(focusState)) {
    return [{ ...model, focusPane: cycleFocusPane(focusState) }, []];
  }

  if (msg.ctrl && !msg.alt && msg.key === WorkspaceKeys.B) {
    return toggleDrawer(model, DrawerKinds.Files, (nextModel, force) => (
      beginGraftRefresh(nextModel, force, deps.graftSession)
    ), createDrawerAnimationCmd);
  }

  if (msg.ctrl && !msg.alt && msg.key === WorkspaceKeys.G) {
    return toggleDrawer(model, DrawerKinds.Graft, (nextModel, force) => (
      beginGraftRefresh(nextModel, force, deps.graftSession)
    ), createDrawerAnimationCmd);
  }

  if (msg.key === WorkspaceKeys.Escape) {
    if (model.focusPane === FocusPanes.Files && model.fileDrawerOpen) {
      return closeDrawer(model, DrawerKinds.Files, createDrawerAnimationCmd);
    }
    if (model.focusPane === FocusPanes.Graft && model.graftDrawerOpen) {
      return closeDrawer(model, DrawerKinds.Graft, createDrawerAnimationCmd);
    }
  }

  if (msg.key === JEDIT_MARKDOWN_PREVIEW_TOGGLE_KEY) {
    return toggleMarkdownPreview(model, deps.sourceHighlighter);
  }

  if (model.focusPane === FocusPanes.Files && model.fileDrawerOpen) {
    return updateTreeFromKey(
      msg,
      model,
      nowMs,
      {
        fileSystem: deps.fileSystem,
        editorFile: deps.editorFile,
        sourceHighlighter: deps.sourceHighlighter,
        graftSession: deps.graftSession,
      },
    );
  }

  if (model.focusPane === FocusPanes.Graft && model.graftDrawerOpen) {
    return updateGraftDrawerFromKey(msg, model, (nextModel, force) => (
      beginGraftRefresh(nextModel, force, deps.graftSession)
    ));
  }

  return updateViewerFromKey(msg, model, deps.sourceHighlighter);
}

function pushTitleScreenToast(
  model: WorkspaceModel,
  title: string,
  message: string,
  nowMs: () => number,
  createNotificationTickCmd: () => Cmd<WorkspaceMsg>,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  return pushNotificationToast(model, {
    title,
    message,
    variant: NOTIFICATION_TOAST_VARIANT,
    tone: NOTIFICATION_INFO_TONE,
    placement: NOTIFICATION_LOWER_RIGHT_PLACEMENT,
    bgToken: titleToastBackgroundToken(model),
    accentToken: titleToastAccentToken(model),
  }, nowMs(), createNotificationTickCmd);
}

function titleToastBackgroundToken(model: WorkspaceModel): TokenValue {
  return {
    hex: colorHex(model.jeditTheme.surface.workspace.fg) ?? model.jeditTheme.surface.workspace.hex ?? FALLBACK_TOAST_FOREGROUND,
    bg: colorHex(model.jeditTheme.surface.workspace.bg) ?? FALLBACK_TOAST_BACKGROUND,
  };
}

function titleToastAccentToken(model: WorkspaceModel): TokenValue {
  return {
    hex: colorHex(model.jeditTheme.cursor.normal.bg) ?? model.jeditTheme.cursor.normal.hex ?? FALLBACK_TOAST_ACCENT,
    bg: colorHex(model.jeditTheme.surface.workspace.bg) ?? FALLBACK_TOAST_BACKGROUND,
  };
}

function titleAsciiPaletteLabel(palette: TitleAsciiPalette): string {
  switch (palette) {
    case TITLE_ASCII_PALETTE.Dense:
      return TITLE_ASCII_PALETTE_DENSE_LABEL;
    case TITLE_ASCII_PALETTE.Minimal:
      return TITLE_ASCII_PALETTE_MINIMAL_LABEL;
    case TITLE_ASCII_PALETTE.Technical:
      return TITLE_ASCII_PALETTE_TECHNICAL_LABEL;
    case TITLE_ASCII_PALETTE.Hatching:
      return TITLE_ASCII_PALETTE_HATCHING_LABEL;
    case TITLE_ASCII_PALETTE.Matrix:
      return TITLE_ASCII_PALETTE_MATRIX_LABEL;
    case TITLE_ASCII_PALETTE.Blocks:
      return TITLE_ASCII_PALETTE_BLOCKS_LABEL;
    case TITLE_ASCII_PALETTE.Dither:
      return TITLE_ASCII_PALETTE_DITHER_LABEL;
  }
}

function isScenePickerCloseKey(msg: KeyMsg): boolean {
  return isWorkspaceScenePickerCloseKey(msg);
}

function isScenePickerPreviousKey(msg: KeyMsg): boolean {
  return isWorkspaceScenePickerPreviousKey(msg);
}

function isScenePickerNextKey(msg: KeyMsg): boolean {
  return isWorkspaceScenePickerNextKey(msg);
}

function isScenePickerAcceptKey(msg: KeyMsg): boolean {
  return isWorkspaceScenePickerAcceptKey(msg);
}
