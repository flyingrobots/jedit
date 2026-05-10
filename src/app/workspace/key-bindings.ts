import { animate, type App, type Cmd, type KeyMsg, type MouseMsg } from '@flyingrobots/bijou-tui';
import { createInitialModel } from './init.js';
import { manageGraftLifecycle } from './graft.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import {
  pushRuntimeIssueToast,
  tickNotificationState,
} from '../../ui/feedback.js';
import {
  SOURCE_HIGHLIGHT_MESSAGE,
  reduceSourceHighlightMsg,
} from '../source-highlight-session.js';
import {
  TITLE_CAMERA_MESSAGE,
  reduceTitleCameraMotion,
} from '../title-camera-session.js';
import { clamp01, clampIndex } from '../../main.js';
import { updateFromKey } from './key-bindings.js';
import { updateFromMouse } from './mouse.js';
import { renderWorkspace } from '../../ui/workspace-render.js';
import {
  type EditorState,
  type HistoryEntry,
  type PendingNormal,
  type RegisterKind,
  type RegisterState,
} from './editor/model.js';
import { type EditorMode } from './editor/mode.js';
import { type ViewMode } from './view-mode.js';
import { loadEditor, saveEditor } from '../../main.js';
import { toggleMarkdownPreview } from '../../main.js';
import { updateTreeFromKey } from './file-tree.js';
import { updateGraftDrawerFromKey } from './graft-drawer.js';
import { updateViewerFromKey } from './viewer.js';
import { openDrawer, toggleDrawer, closeDrawer, type DrawerKind } from '../../ui/drawer-layout.js';
import { focusCycleState, withFocusPane, cycleFocusPane, hasFocusablePeers } from '../../ui/panel-focus.js';
import { beginEditorProjectionRefresh } from '../../main.js';
import { loadTitleSceneFromFile } from '../../adapters/title-scene-loader.js';
import { join } from 'node:path';
import { type JeditSettingsHandlers } from '../settings-session.js';
import { settingsRows, moveSettingsFocusIndex, toggleSettingsOpen, updateJeditSettingsFromKey } from '../settings-session.js';

export function updateFromKey(msg: KeyMsg, model: WorkspaceModel): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (msg.key === '`') {
    return [{ ...model, perfVisible: !model.perfVisible }, []];
  }

  if (msg.key === JEDIT_SETTINGS_TOGGLE_KEY) {
    return [toggleSettingsOpen(model), []];
  }
  if (model.settingsOpen) {
    return updateJeditSettingsFromKey(msg, model, settingsRows(model), settingsHandlers);
  }

  if (model.editor == null && msg.key === 'f5') {
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
      return [{ ...model, scenePickerFocusIndex: Math.min(model.availableScenes.length - 1, model.scenePickerFocusIndex + 1) }, []];
    }
    if (msg.key === 'enter' || msg.key === 'return') {
      const selected = model.availableScenes[model.scenePickerFocusIndex];
      if (selected != null) {
        return [{ ...model, scenePickerOpen: false }, [
          async () => {
            try {
              const { join } = await import('node:path');
              const scene = await loadTitleSceneFromFile(join(model.workspaceRoot, 'scenes', selected), model.titleMesh);
              return { type: 'load-scene-result', scene };
            } catch (err) {
              return {
                type: 'runtime-issue',
                issue: {
                  type: 'system',
                  name: 'SceneLoadError',
                  message: String(err),
                  level: 'error',
                  source: 'command',
                  atMs: Date.now(),
                },
              };
            }
          }
        ]];
      }
    }
    return [model, []];
  }

  if (model.editor == null) {
    const cameraUpdate = updateTitleCameraFromKey(msg.key, model.titleCamera);
    if (cameraUpdate != null) {
      return [{ ...model, titleCamera: cameraUpdate.state }, cameraUpdate.commands];
    }
  }

  if (msg.ctrl && msg.key === 'c') {
    return [model, [quit<WorkspaceMsg>()]];
  }

  const insertModeActive = model.focusPane === 'editor'
    && model.viewMode === 'source'
    && model.editor?.mode === 'insert';
  if (!insertModeActive && isFooterToggleKey(msg)) {
    return [{ ...model, footerVisible: !model.footerVisible }, []];
  }

  if (!insertModeActive && msg.key === 'q') {
    return [model, [quit<WorkspaceMsg>()]];
  }

  if (msg.ctrl && !msg.alt && msg.key === 's' && model.editor != null) {
    const editor = saveEditor(model.editor);
    return beginEditorProjectionRefresh({
      ...model,
      editor,
    }, model.graftDrawerOpen || model.graftInfo?.path === editor.path);
  }

  if (msg.ctrl && !msg.alt && msg.key === JEDIT_THEME_TOGGLE_KEY) {
    return [{ ...model, jeditTheme: nextJeditTheme(model.jeditTheme) }, []];
  }

  const focusState = focusCycleState(model);
  if (msg.key === 'tab' && hasFocusablePeers(focusState)) {
    return [
      withFocusPane(model, cycleFocusPane(focusState)),
      [],
    ];
  }

  if (msg.ctrl && !msg.alt && msg.key === 'b') {
    return toggleDrawer(model, 'files');
  }

  if (msg.ctrl && !msg.alt && msg.key === 'g') {
    return toggleDrawer(model, 'graft');
  }

  if (msg.key === 'escape') {
    if (model.focusPane === 'files' && model.fileDrawerOpen) {
      return closeDrawer(model, 'files');
    }
    if (model.focusPane === 'graft' && model.graftDrawerOpen) {
      return closeDrawer(model, 'graft');
    }
  }

  if (msg.key === JEDIT_MARKDOWN_PREVIEW_TOGGLE_KEY) {
    return toggleMarkdownPreview(model);
  }

  if (model.focusPane === 'files' && model.fileDrawerOpen) {
    return updateTreeFromKey(msg, model);
  }

  if (model.focusPane === 'graft' && model.graftDrawerOpen) {
    return updateGraftDrawerFromKey(msg, model);
  }

  return updateViewerFromKey(msg, model);
}
