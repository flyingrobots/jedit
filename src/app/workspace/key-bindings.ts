import { quit, type KeyMsg } from '@flyingrobots/bijou-tui';
import type { Cmd } from '@flyingrobots/bijou-tui';
import { isFooterToggleKey } from '../../ui/feedback.js';
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
import { cycleFocusPane, hasFocusablePeers } from '../../ui/panel-focus.js';
import { updateJeditSettingsFromKey } from '../settings-session.js';
import { settingsRows, workspaceSettingsHandlers } from './settings.js';
import { updateGraftDrawerFromKey } from './graft-drawer.js';
import { updateTreeFromKey } from './file-tree.js';
import { updateViewerFromKey } from './viewer.js';
import { nextJeditTheme } from '../../ui/jedit-themes.js';
import { TITLE_RENDER_MODE } from '../../ui/title-screen.js';
import { updateTitleCameraFromKey } from '../title-camera-session.js';
import type { FileSystemPort } from '../../ports/file-system.js';
import type { EditorFilePort } from '../../ports/editor-file.js';
import type { GraftSessionPort } from '../../ports/graft-session.js';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import type { TitleSceneLoaderPort } from '../../ports/title-scene-loader.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';

export interface UpdateFromKeyDeps {
  readonly fileSystem: FileSystemPort;
  readonly editorFile: EditorFilePort;
  readonly sourceHighlighter: SourceHighlighter;
  readonly graftSession: GraftSessionPort;
  readonly titleSceneLoader: TitleSceneLoaderPort;
}

export function updateFromKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  nowMs: () => number,
  createDrawerAnimationCmd: CreateDrawerAnimationCmd,
  deps: UpdateFromKeyDeps,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (msg.key === '`') {
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

  if (model.editor == null && msg.key === JEDIT_SCENE_PICKER_TOGGLE_KEY) {
    return [{ ...model, scenePickerOpen: !model.scenePickerOpen }, []];
  }

  if (model.scenePickerOpen) {
    if (msg.key === 'escape') {
      return [{ ...model, scenePickerOpen: false }, []];
    }
    if (msg.key === 'up' || msg.key === 'k') {
      return [{ ...model, scenePickerFocusIndex: Math.max(0, model.scenePickerFocusIndex - 1) }, []];
    }
    if (msg.key === 'down' || msg.key === 'j') {
      return [{
        ...model,
        scenePickerFocusIndex: Math.min(model.availableScenes.length - 1, model.scenePickerFocusIndex + 1),
      }, []];
    }
    if (msg.key === 'enter' || msg.key === 'return') {
      const selected = model.availableScenes[model.scenePickerFocusIndex];
      if (selected != null) {
        return [{ ...model, scenePickerOpen: false }, [
          async () => {
            try {
              const scene = await deps.titleSceneLoader.loadTitleSceneFromFile(
                deps.fileSystem.join(model.workspaceRoot, 'scenes', selected),
                model.titleMesh,
              );
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
    if (msg.key === '1') {
      return [{ ...model, titleRenderMode: TITLE_RENDER_MODE.Braille }, []];
    }
    if (msg.key === '2') {
      return [{ ...model, titleRenderMode: TITLE_RENDER_MODE.Ascii }, []];
    }

    const update = updateTitleCameraFromKey(msg.key, model.titleCamera);
    if (update != null) {
      return [{ ...model, titleCamera: update.state }, update.commands];
    }
  }

  if (msg.ctrl && msg.key === 'c') {
    return [model, [quit<WorkspaceMsg>()]];
  }

  const insertModeActive = model.focusPane === 'editor' && model.viewMode === 'source' && model.editor?.mode === 'insert';
  if (!insertModeActive && isFooterToggleKey(msg)) {
    return [{ ...model, footerVisible: !model.footerVisible }, []];
  }

  if (!insertModeActive && msg.key === 'q') {
    return [model, [quit<WorkspaceMsg>()]];
  }

  if (msg.ctrl && !msg.alt && msg.key === 's' && model.editor != null) {
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
  if (msg.key === 'tab' && hasFocusablePeers(focusState)) {
    return [{ ...model, focusPane: cycleFocusPane(focusState) }, []];
  }

  if (msg.ctrl && !msg.alt && msg.key === 'b') {
    return toggleDrawer(model, 'files', (nextModel, force) => (
      beginGraftRefresh(nextModel, force, deps.graftSession)
    ), createDrawerAnimationCmd);
  }

  if (msg.ctrl && !msg.alt && msg.key === 'g') {
    return toggleDrawer(model, 'graft', (nextModel, force) => (
      beginGraftRefresh(nextModel, force, deps.graftSession)
    ), createDrawerAnimationCmd);
  }

  if (msg.key === 'escape') {
    if (model.focusPane === 'files' && model.fileDrawerOpen) {
      return closeDrawer(model, 'files', createDrawerAnimationCmd);
    }
    if (model.focusPane === 'graft' && model.graftDrawerOpen) {
      return closeDrawer(model, 'graft', createDrawerAnimationCmd);
    }
  }

  if (msg.key === JEDIT_MARKDOWN_PREVIEW_TOGGLE_KEY) {
    return toggleMarkdownPreview(model, deps.sourceHighlighter);
  }

  if (model.focusPane === 'files' && model.fileDrawerOpen) {
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

  if (model.focusPane === 'graft' && model.graftDrawerOpen) {
    return updateGraftDrawerFromKey(msg, model, (nextModel, force) => (
      beginGraftRefresh(nextModel, force, deps.graftSession)
    ));
  }

  return updateViewerFromKey(msg, model, deps.sourceHighlighter);
}
