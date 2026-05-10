import { createSurface, stringToSurface, perfOverlaySurface, type Surface } from '@flyingrobots/bijou';
import { initDefaultContext } from '@flyingrobots/bijou-node';
import { animate, quit, run, type App, type Cmd, type KeyMsg, type MouseMsg, type NotificationState, type RuntimeIssue } from '@flyingrobots/bijou-tui';
import { dirname } from 'node:path';
import {
  DIRECTORY_ACTION_OPEN,
  DIRECTORY_ACTION_REFRESH,
  describeDirectoryIssue,
  loadEntries,
  type FileEntry,
} from './adapters/filesystem.js';
import { loadEditorFile, saveEditorFile } from './adapters/editor-file.js';
import { loadTitleBunnyMeshSource } from './adapters/title-bunny-mesh.js';
import { loadInitialTitleMesh, TITLE_MESH_LOAD_RESULT } from './app/title-mesh-loader.js';
import { closeGraftConnection, failedGraftInfo, loadGraftInfo, type GraftInfo } from './adapters/graft-mcp-session.js';
import { paintMarkdownPreview } from './ui/markdown-preview.js';
import {
  applyNotificationState,
  compositeFeedback,
  createFeedbackState,
  createNotificationTickCmd,
  isFooterToggleKey,
  pushErrorToast,
  pushRuntimeIssueToast,
  tickNotificationState,
} from './ui/feedback.js';
import { resolveWorkspaceLayout, type DrawerKind } from './ui/drawer-layout.js';
import { cycleFocusPane, defaultFocusPane, hasFocusablePeers, shouldClearPendingNormalOnPaneChange, type FocusPane, type FocusCycleState } from './ui/panel-focus.js';
import { fitBlock, formatTreeLine, graftVisibleOutlineRows } from './ui/workspace-render.js';
import { activeWorkspaceTitle, centerLine, renderWorkspaceFooter } from './ui/workspace-chrome.js';
import { renderGraftDrawerLines } from './ui/graft-drawer.js';
import { createGraftSourceHighlighter } from './adapters/graft-source-highlighter.js';
import { beginSourceHighlightRefresh, reduceSourceHighlightMsg, shouldRefreshSourceHighlight, SOURCE_HIGHLIGHT_MESSAGE, type SourceHighlightMsg } from './app/source-highlight-session.js';
import { renderSourceViewer } from './ui/source-viewer.js';
import { mouseScrollDeltaRows, scrollIndexByRows, scrollTextViewport } from './ui/mouse-scroll.js';
import { JEDIT_TERMINAL_MOUSE_OPTIONS } from './ui/terminal-mouse.js';
import { JEDIT_THEME_ENV, nextJeditTheme, oppositeJeditTheme, resolveInitialJeditTheme } from './ui/jedit-themes.js';
import { JEDIT_MARKDOWN_PREVIEW_TOGGLE_KEY, JEDIT_SETTINGS_TOGGLE_KEY, JEDIT_THEME_TOGGLE_KEY } from './app/keybindings.js';
import type { JeditStyleToken, JeditTheme } from './ui/jedit-theme.js';
import { paintActivePaneEdge } from './ui/workspace-focus-edge.js';
import {
  jeditSettingsRows,
  moveSettingsFocusIndex,
  toggleSettingsOpen,
  updateJeditSettingsFromKey,
  type JeditSettingsHandlers,
} from './app/settings-session.js';
import {
  createTitleCameraState,
  reduceTitleCameraMotion,
  TITLE_CAMERA_MESSAGE,
  updateTitleCameraFromKey,
  type TitleCameraMotionMsg,
  type TitleCameraState,
} from './app/title-camera-session.js';
import { renderSettingsDrawer, resolveSettingsDrawerWidth } from './ui/settings-drawer.js';
import { renderScenePickerDrawer, resolveScenePickerDrawerWidth } from './ui/scene-picker-drawer.js';
import { titleBunnySceneCameraPlacement, titleSceneCameraPlacement, type TitleScene } from './ui/title-scene.js';
import { loadTitleSceneFromFile } from './adapters/title-scene-loader.js';
import { createTitleBunnyMesh, type TitleMesh } from './ui/title-mesh.js';
import { BijouI18nAdapter } from './adapters/bijou-i18n-adapter.js';
import type { I18nPort } from './ports/i18n.js';
import { renderTitleScreen } from './ui/title-screen.js';
import { updateNormalMode, updateInsertMode } from './app/editor-engine.js';
import {
  reduceProfilerMsg,
  streamProfilerFrame,
  toggleProfiler,
  type ProfilerMsg,
  type ProfilerState,
} from './app/raytracer-profiler.js';

import {
  EditorState,
  type ViewMode,
} from './domain/editor-state.js';

initDefaultContext();
interface Model {
  readonly i18n: I18nPort;
  readonly workspaceRoot: string;
  readonly cwd: string;
  readonly entries: readonly FileEntry[];
  readonly selectedIndex: number;
  readonly editor?: EditorState;
  readonly viewMode: ViewMode;
  readonly focusPane: FocusPane;
  readonly fileDrawerOpen: boolean;
  readonly fileDrawerProgress: number;
  readonly graftDrawerOpen: boolean;
  readonly graftDrawerProgress: number;
  readonly notifications: NotificationState<Msg>;
  readonly notificationLoopActive: boolean;
  readonly footerVisible: boolean;
  readonly settingsOpen: boolean;
  readonly settingsFocusIndex: number;
  readonly jeditTheme: JeditTheme;
  readonly graftInfo?: GraftInfo;
  readonly graftLoading: boolean;
  readonly graftRequestId: number;
  readonly graftSelectedIndex: number;
  readonly sourceHighlight?: import('./ports/source-highlighter.js').SourceHighlightReading;
  readonly sourceHighlightLoading: boolean;
  readonly sourceHighlightRequestId: number;
  readonly titleSceneSeed: number;
  readonly titleMesh?: TitleMesh;
  readonly scenePickerOpen: boolean;
  readonly scenePickerFocusIndex: number;
  readonly availableScenes: readonly string[];
  readonly sceneOverride?: TitleScene;
  readonly columns: number;
  readonly rows: number;
  readonly time: number;
  readonly perfVisible: boolean;
  readonly lastFrameMs: number;
  readonly frameTimeMs: number;
  readonly frameTimeHistory: readonly number[];
  readonly titleCamera: TitleCameraState;
  readonly profiler: ProfilerState;
}

type Msg =
  | { type: 'drawer-progress'; kind: DrawerKind; value: number }
  | { type: 'graft-info'; requestId: number; info: GraftInfo }
  | { type: 'load-scene-result'; scene: TitleScene | undefined }
  | ProfilerMsg
  | { type: 'toggle-profiler' }
  | SourceHighlightMsg
  | TitleCameraMotionMsg
  | { type: 'notification-tick'; atMs: number }
  | { type: 'time-tick'; time: number }
  | { type: 'toggle-perf' }
  | { type: 'runtime-issue'; issue: RuntimeIssue };

const MIN_COLUMNS = 60;
const MIN_ROWS = 12;
const INITIAL_COLUMNS = process.stdout.columns ?? 100;
const INITIAL_ROWS = process.stdout.rows ?? 32;
const DRAWER_DURATION_MS = 160;
const DRAWER_INNER_PAD = 1;
const GRAFT_META_ROWS = 5;
const GRAFT_CHANGE_ROWS = 5;
const VIEWER_LEFT_PAD = 4;
const VIEWER_TOP_PAD = 1;
const sourceHighlighter = createGraftSourceHighlighter();

const app: App<Model, Msg> = {
  init: () => [
    createInitialModel(process.cwd(), INITIAL_COLUMNS, INITIAL_ROWS),
    [
      manageGraftLifecycle(),
      animate<Msg>({
        type: 'tween',
        from: 0,
        to: Number.MAX_SAFE_INTEGER,
        duration: Number.MAX_SAFE_INTEGER,
        onFrame: (v) => ({ type: 'time-tick', time: v / 1000 }),
      }),
    ],
  ],
  routeRuntimeIssue: (issue) => ({ type: 'runtime-issue', issue }),
  update: (msg, model): [Model, Cmd<Msg>[]] => {
    if (msg.type === 'resize') {
      const viewport = editorViewport({
        ...model,
        columns: msg.columns,
        rows: msg.rows,
      });
      const resized = {
        ...model,
        columns: msg.columns,
        rows: msg.rows,
        editor: model.editor == null ? undefined : model.editor.ensureVisible(viewport.width, viewport.height),
      };
      return applyNotificationState(resized, resized.notifications, Date.now(), notificationTickCmd);
    }

    if (msg.type === 'drawer-progress') {
      return [
        {
          ...model,
          ...(msg.kind === 'files'
            ? { fileDrawerProgress: clamp01(msg.value) }
            : { graftDrawerProgress: clamp01(msg.value) }),
        },
        [],
      ];
    }

    if (msg.type === 'graft-info') {
      if (msg.requestId !== model.graftRequestId) {
        return [model, []];
      }

      return [
        {
          ...model,
          graftInfo: msg.info,
          graftLoading: false,
          graftSelectedIndex: clampIndex(model.graftSelectedIndex, msg.info.outlineItems.length),
        },
        [],
      ];
    }

    if (msg.type === 'load-scene-result') {
      return [{ ...model, sceneOverride: msg.scene }, []];
    }

    if (msg.type === 'profiler-started' || msg.type === 'profiler-stopped') {
      return [{ ...model, profiler: reduceProfilerMsg(model.profiler, msg) }, []];
    }

    if (msg.type === SOURCE_HIGHLIGHT_MESSAGE) {
      return [reduceSourceHighlightMsg(model, msg), []];
    }

    if (msg.type === 'notification-tick') {
      return tickNotificationState(model, msg.atMs, notificationTickCmd);
    }

    if (msg.type === 'time-tick') {
      const now = Date.now();
      const frameTime = now - model.lastFrameMs;
      const history = [...model.frameTimeHistory, frameTime].slice(-50);
      const streamCmd = streamProfilerFrame(model.profiler, {
        time: msg.time,
        frameTimeMs: frameTime,
        columns: model.columns,
        rows: model.rows,
      });

      return [{
        ...model,
        time: msg.time,
        lastFrameMs: now,
        frameTimeMs: frameTime,
        frameTimeHistory: history,
      }, streamCmd ? [streamCmd as unknown as Cmd<Msg>] : []];
    }

    if (msg.type === 'toggle-perf') {
      return [{ ...model, perfVisible: !model.perfVisible }, []];
    }

    if (msg.type === 'runtime-issue') {
      return pushRuntimeIssueToast(model, msg.issue, notificationTickCmd);
    }

    if (msg.type === TITLE_CAMERA_MESSAGE.Frame) {
      return [{ ...model, titleCamera: reduceTitleCameraMotion(model.titleCamera, msg) }, []];
    }

    if (msg.type === 'mouse') {
      return updateFromMouse(msg, model);
    }

    if (msg.type !== 'key') {
      return [model, []];
    }

    return updateFromKey(msg, model);
  },
  view: (model) => renderWorkspace(model),
};

function updateFromKey(msg: KeyMsg, model: Model): [Model, Cmd<Msg>[]] {
  if (msg.key === '`') {
    return [{ ...model, perfVisible: !model.perfVisible }, []];
  }

  if (msg.key === 'f10' && model.editor == null) {
    const [profiler, cmds] = toggleProfiler(model.profiler, model.workspaceRoot);
    return [{ ...model, profiler }, cmds as unknown as Cmd<Msg>[]];
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
    return [model, [quit<Msg>()]];
  }

  const insertModeActive = model.focusPane === 'editor'
    && model.viewMode === 'source'
    && model.editor?.mode === 'insert';
  if (!insertModeActive && isFooterToggleKey(msg)) {
    return [{ ...model, footerVisible: !model.footerVisible }, []];
  }

  if (!insertModeActive && msg.key === 'q') {
    return [model, [quit<Msg>()]];
  }

  if (msg.ctrl && msg.key === 's' && model.editor != null) {
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

function updateFromMouse(msg: MouseMsg, model: Model): [Model, Cmd<Msg>[]] {
  const deltaRows = mouseScrollDeltaRows(msg);
  if (deltaRows === 0) {
    return [model, []];
  }
  if (model.settingsOpen) {
    return [{ ...model, settingsFocusIndex: moveSettingsFocusIndex(model.settingsFocusIndex, deltaRows, settingsRows(model).length) }, []];
  }
  if (model.focusPane === 'files' && model.fileDrawerOpen) {
    return [{ ...model, selectedIndex: scrollIndexByRows(model.selectedIndex, model.entries.length, deltaRows) }, []];
  }
  if (model.focusPane === 'graft' && model.graftDrawerOpen) {
    return [{ ...model, graftSelectedIndex: scrollIndexByRows(model.graftSelectedIndex, model.graftInfo?.outlineItems.length ?? 0, deltaRows) }, []];
  }
  if (model.editor == null) {
    return [model, []];
  }
  const viewport = editorViewport(model);
  const editor = scrollTextViewport(model.editor, deltaRows, viewport.height);
  const next = { ...model, editor };
  return model.viewMode === 'source'
    ? beginSourceHighlightRefresh<Model, Msg>(next, editor, viewport, sourceHighlighter)
    : [next, []];
}

function settingsRows(model: Model) {
  return jeditSettingsRows({
    i18n: model.i18n,
    jeditTheme: model.jeditTheme,
    footerVisible: model.footerVisible,
    markdownPreviewActive: model.editor != null && isMarkdownFile(model.editor.path),
    viewMode: model.viewMode,
  });
}

const settingsHandlers: JeditSettingsHandlers<Model, Msg> = {
  cycleTheme: (model: Model): [Model, Cmd<Msg>[]] => [{ ...model, jeditTheme: nextJeditTheme(model.jeditTheme) }, []],
  toggleThemeMode: (model: Model): [Model, Cmd<Msg>[]] => [{ ...model, jeditTheme: oppositeJeditTheme(model.jeditTheme) }, []],
  toggleFooter: (model: Model): [Model, Cmd<Msg>[]] => [{ ...model, footerVisible: !model.footerVisible }, []],
  toggleMarkdownPreview: (model: Model): [Model, Cmd<Msg>[]] => toggleMarkdownPreview(model),
  toggleLocale: (model: Model): [Model, Cmd<Msg>[]] => {
    const nextLocale = model.i18n.locale === 'en' ? 'me' : 'en';
    const nextDirection = nextLocale === 'me' ? 'rtl' : 'ltr';
    model.i18n.setLocale(nextLocale, nextDirection);
    return [model, []];
  },
};

await run(app, JEDIT_TERMINAL_MOUSE_OPTIONS);

function toggleMarkdownPreview(model: Model): [Model, Cmd<Msg>[]] {
  if (model.editor == null || !isMarkdownFile(model.editor.path)) {
    return [model, []];
  }
  const viewMode: ViewMode = model.viewMode === 'source' ? 'preview' : 'source';
  const next: Model = { ...model, editor: clearPendingNormal(model.editor), viewMode };
  return next.viewMode === 'source'
    ? beginSourceHighlightRefresh<Model, Msg>(next, next.editor, editorViewport(next), sourceHighlighter)
    : [next, []];
}

function manageGraftLifecycle(): Cmd<Msg> {
  return () => () => {
    void closeGraftConnection();
  };
}

function updateTreeFromKey(msg: KeyMsg, model: Model): [Model, Cmd<Msg>[]] {
  if (msg.key === 'r') {
    return changeDirectory(model, model.cwd, DIRECTORY_ACTION_REFRESH);
  }

  if (msg.key === 'backspace' || msg.key === 'left' || msg.key === 'h') {
    const parent = dirname(model.cwd);
    if (parent === model.cwd) {
      return [model, []];
    }

    return changeDirectory(model, parent, DIRECTORY_ACTION_OPEN);
  }

  if (msg.key === 'down' || msg.key === 'j') {
    return [
      {
        ...model,
        selectedIndex: clampIndex(model.selectedIndex + 1, model.entries.length),
      },
      [],
    ];
  }

  if (msg.key === 'up' || msg.key === 'k') {
    return [
      {
        ...model,
        selectedIndex: clampIndex(model.selectedIndex - 1, model.entries.length),
      },
      [],
    ];
  }

  if (msg.key === 'enter' || msg.key === 'right' || msg.key === 'l') {
    const entry = model.entries[model.selectedIndex];
    if (entry == null) {
      return [model, []];
    }

    if (entry.kind === 'dir' || entry.kind === 'parent') {
      return changeDirectory(model, entry.path, DIRECTORY_ACTION_OPEN);
    }

    const viewport = editorViewport(model);
    const editor = loadEditor(entry.path).ensureVisible(viewport.width, viewport.height);
    return beginEditorProjectionRefresh(withFocusPane({
      ...model,
      editor,
      viewMode: 'source',
      graftInfo: undefined,
      graftLoading: false,
      graftSelectedIndex: 0,
    }, 'editor'), model.graftDrawerOpen);
  }

  return [model, []];
}

function updateGraftDrawerFromKey(msg: KeyMsg, model: Model): [Model, Cmd<Msg>[]] {
  if (msg.key === 'r') {
    return beginGraftRefresh(model, true);
  }

  const graftInfo = model.graftInfo;
  if (graftInfo == null || graftInfo.outlineItems.length === 0) {
    return [model, []];
  }

  if (msg.key === 'down' || msg.key === 'j') {
    return [
      {
        ...model,
        graftSelectedIndex: clampIndex(model.graftSelectedIndex + 1, graftInfo.outlineItems.length),
      },
      [],
    ];
  }

  if (msg.key === 'up' || msg.key === 'k') {
    return [
      {
        ...model,
        graftSelectedIndex: clampIndex(model.graftSelectedIndex - 1, graftInfo.outlineItems.length),
      },
      [],
    ];
  }

  const visible = graftVisibleOutlineRows(
    workspaceBodyHeight(model.rows, model.footerVisible),
    DRAWER_INNER_PAD,
    GRAFT_META_ROWS,
    GRAFT_CHANGE_ROWS,
  );
  if (msg.key === 'pageup') {
    return [
      {
        ...model,
        graftSelectedIndex: clampIndex(model.graftSelectedIndex - visible, graftInfo.outlineItems.length),
      },
      [],
    ];
  }

  if (msg.key === 'pagedown') {
    return [
      {
        ...model,
        graftSelectedIndex: clampIndex(model.graftSelectedIndex + visible, graftInfo.outlineItems.length),
      },
      [],
    ];
  }

  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'g') {
    return [
      {
        ...model,
        graftSelectedIndex: 0,
      },
      [],
    ];
  }

  if (!msg.ctrl && !msg.alt && msg.shift && msg.key === 'g') {
    return [
      {
        ...model,
        graftSelectedIndex: graftInfo.outlineItems.length - 1,
      },
      [],
    ];
  }

  if (msg.key === 'enter' && model.editor != null) {
    const selected = graftInfo.outlineItems[model.graftSelectedIndex];
    if (selected == null) {
      return [model, []];
    }

    const viewport = editorViewport(model);
    const editor = model.editor.with({
      cursorRow: Math.max(0, selected.startLine - 1),
      cursorCol: 0,
    }).ensureVisible(viewport.width, viewport.height);

    return [
      withFocusPane({
        ...model,
        editor,
      }, 'editor'),
      [],
    ];
  }

  return [model, []];
}

function updateViewerFromKey(msg: KeyMsg, model: Model): [Model, Cmd<Msg>[]] {
  if (model.editor == null) {
    return [model, []];
  }

  const viewport = editorViewport(model);

  if (model.viewMode === 'preview') {
    return [
      {
        ...model,
        editor: scrollPreview(model.editor, msg, viewport.height),
      },
      [],
    ];
  }

  const editor = model.editor.mode === 'insert'
    ? updateInsertMode(model.editor, msg, viewport.width, viewport.height, !hasFocusablePeers(focusCycleState(model)))
    : updateNormalMode(model.editor, msg, viewport.width, viewport.height);
  const next = { ...model, editor };
  return shouldRefreshSourceHighlight(model.editor, editor)
    ? beginSourceHighlightRefresh<Model, Msg>(next, editor, viewport, sourceHighlighter)
    : [next, []];
}

function openDrawer(model: Model, kind: DrawerKind): [Model, Cmd<Msg>[]] {
  if (kind === 'graft') {
    const [next, cmds] = beginGraftRefresh(withFocusPane({
      ...model,
      graftDrawerOpen: true,
    }, 'graft'), false);

    if (model.graftDrawerOpen) {
      return [next, cmds];
    }

    return [
      next,
      [...drawerAnimation('graft', model.graftDrawerProgress, 1), ...cmds],
    ];
  }

  const next = withFocusPane({
    ...model,
    fileDrawerOpen: true,
  }, 'files');

  if (model.fileDrawerOpen) {
    return [next, []];
  }

  return [
    next,
    drawerAnimation('files', model.fileDrawerProgress, 1),
  ];
}

function toggleDrawer(model: Model, kind: DrawerKind): [Model, Cmd<Msg>[]] {
  if ((kind === 'files' && model.fileDrawerOpen) || (kind === 'graft' && model.graftDrawerOpen)) {
    return closeDrawer(model, kind);
  }

  return openDrawer(model, kind);
}

function closeDrawer(model: Model, kind: DrawerKind): [Model, Cmd<Msg>[]] {
  const next = kind === 'files'
    ? {
        ...model,
        fileDrawerOpen: false,
      }
    : {
        ...model,
        graftDrawerOpen: false,
      };
  const focusPane = defaultFocusPane({
    fileDrawerOpen: kind === 'files' ? false : next.fileDrawerOpen,
    graftDrawerOpen: kind === 'graft' ? false : next.graftDrawerOpen,
    hasEditor: next.editor != null,
  });

  return [
    withFocusPane(next, focusPane),
    drawerAnimation(kind, kind === 'files' ? model.fileDrawerProgress : model.graftDrawerProgress, 0),
  ];
}

function focusCycleState(model: Pick<Model, 'fileDrawerOpen' | 'graftDrawerOpen' | 'editor' | 'focusPane'>): FocusCycleState {
  return { fileDrawerOpen: model.fileDrawerOpen, graftDrawerOpen: model.graftDrawerOpen, hasEditor: model.editor != null, focusPane: model.focusPane };
}

function withFocusPane(model: Model, focusPane: FocusPane): Model {
  if (model.focusPane === focusPane) {
    return model;
  }
  if (model.editor == null || !shouldClearPendingNormalOnPaneChange(model.focusPane, focusPane)) {
    return { ...model, focusPane };
  }
  return { ...model, focusPane, editor: clearPendingNormal(model.editor) };
}

function clearPendingNormal(editor: EditorState): EditorState {
  if (editor.pendingNormal == null) {
    return editor;
  }
  return editor.with({ pendingNormal: undefined });
}

function drawerAnimation(kind: DrawerKind, from: number, to: number): Cmd<Msg>[] {
  return [
    animate<Msg>({
      type: 'tween',
      from,
      to,
      duration: DRAWER_DURATION_MS,
      onFrame: (value) => ({ type: 'drawer-progress', kind, value }),
    }),
  ];
}

function createInitialModel(cwd: string, columns: number, rows: number): Model {
  const titleSceneSeed = Math.random();
  const titleMesh = loadStartupTitleMesh();
  return {
    i18n: new BijouI18nAdapter('en', 'ltr'),
    workspaceRoot: cwd,
    cwd,
    entries: loadEntries(cwd),
    selectedIndex: 0,
    editor: undefined,
    viewMode: 'source',
    focusPane: 'editor' as FocusPane,
    fileDrawerOpen: false,
    fileDrawerProgress: 0,
    graftDrawerOpen: false,
    graftDrawerProgress: 0,
    ...createFeedbackState<Msg>(),
    settingsOpen: false,
    settingsFocusIndex: 0,
    jeditTheme: resolveInitialJeditTheme(process.env[JEDIT_THEME_ENV]),
    graftInfo: undefined,
    graftLoading: false,
    graftRequestId: 0,
    graftSelectedIndex: 0,
    sourceHighlight: undefined,
    sourceHighlightLoading: false,
    sourceHighlightRequestId: 0,
    titleSceneSeed,
    titleMesh,
    scenePickerOpen: false,
    scenePickerFocusIndex: 0,
    availableScenes: ['bunny.jedit-scene', 'sphere.jedit-scene', 'column.jedit-scene', 'sphere-ground.jedit-scene'],
    columns,
    rows,
    time: 0,
    perfVisible: false,
    lastFrameMs: Date.now(),
    frameTimeMs: 0,
    frameTimeHistory: [],
    titleCamera: createTitleCameraState(titleMesh == null ? titleSceneCameraPlacement(titleSceneSeed) : titleBunnySceneCameraPlacement()),
    profiler: {
      active: false,
    },
  };
}

function loadStartupTitleMesh(): TitleMesh | undefined {
  const result = loadInitialTitleMesh({
    loadSource: loadTitleBunnyMeshSource,
    createMesh: createTitleBunnyMesh,
  });

  if (result.kind === TITLE_MESH_LOAD_RESULT.Failed) {
    process.stderr.write(`jedit title mesh unavailable: ${result.error}\n`);
    return undefined;
  }

  return result.mesh;
}

function openDirectory(model: Model, cwd: string): Model {
  return {
    ...model,
    cwd,
    entries: loadEntries(cwd),
    selectedIndex: 0,
  };
}

function changeDirectory(model: Model, cwd: string, action: typeof DIRECTORY_ACTION_OPEN | typeof DIRECTORY_ACTION_REFRESH): [Model, Cmd<Msg>[]] {
  try {
    return [openDirectory(model, cwd), []];
  } catch (cause) {
    const issue = describeDirectoryIssue(action, cwd, cause instanceof Error ? cause : String(cause));
    return pushErrorToast(model, issue.title, issue.message, Date.now(), notificationTickCmd);
  }
}

function beginEditorProjectionRefresh(model: Model, refreshGraft: boolean): [Model, Cmd<Msg>[]] {
  const [withGraft, graftCmds] = beginGraftRefresh(model, refreshGraft);
  const [withHighlight, highlightCmds] = beginSourceHighlightRefresh<Model, Msg>(withGraft, withGraft.editor, editorViewport(withGraft), sourceHighlighter);
  return [withHighlight, [...graftCmds, ...highlightCmds]];
}

function beginGraftRefresh(model: Model, force: boolean): [Model, Cmd<Msg>[]] {
  if (model.editor == null) {
    return [
      {
        ...model,
        graftInfo: undefined,
        graftLoading: false,
        graftSelectedIndex: 0,
      },
      [],
    ];
  }

  if (!force && model.graftInfo?.path === model.editor.path && model.graftInfo.dirty === model.editor.dirty) {
    return [model, []];
  }

  const requestId = model.graftRequestId + 1;
  const sameFile = model.graftInfo?.path === model.editor.path;

  return [
    {
      ...model,
      graftLoading: true,
      graftRequestId: requestId,
      graftInfo: sameFile ? model.graftInfo : undefined,
      graftSelectedIndex: sameFile ? model.graftSelectedIndex : 0,
    },
    [requestGraftInfoCmd(requestId, model.workspaceRoot, model.editor.path, model.editor.dirty)],
  ];
}

function requestGraftInfoCmd(requestId: number, workspaceRoot: string, filePath: string, dirty: boolean): Cmd<Msg> {
  return async () => {
    try {
      return {
        type: 'graft-info',
        requestId,
        info: await loadGraftInfo(workspaceRoot, filePath, dirty),
      };
    } catch (cause) {
      return {
        type: 'graft-info',
        requestId,
        info: failedGraftInfo(workspaceRoot, filePath, dirty, cause instanceof Error ? cause.message : String(cause)),
      };
    }
  };
}

function loadEditor(filePath: string): EditorState {
  try {
    const file = loadEditorFile(filePath);

    return EditorState.from({
      path: filePath,
      lines: file.lines,
      cursorRow: 0,
      cursorCol: 0,
      scrollRow: 0,
      scrollCol: 0,
      dirty: false,
      readOnly: file.readOnly,
      mode: 'normal',
      undoStack: [],
      redoStack: [],
    }).ensureVisible(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  } catch (error) {
    return EditorState.from({
      path: filePath,
      lines: [String(error)],
      cursorRow: 0,
      cursorCol: 0,
      scrollRow: 0,
      scrollCol: 0,
      dirty: false,
      readOnly: true,
      mode: 'normal',
      undoStack: [],
      redoStack: [],
    });
  }
}

function saveEditor(editor: EditorState): EditorState {
  if (editor.readOnly) {
    return editor;
  }

  saveEditorFile(editor.path, editor.lines);
  return editor.with({
    dirty: false,
  });
}

function scrollPreview(editor: EditorState, msg: KeyMsg, height: number): EditorState {
  if (msg.key === 'up' || msg.key === 'k') {
    return editor.with({
      scrollRow: Math.max(0, editor.scrollRow - 1),
    });
  }
  if (msg.key === 'down' || msg.key === 'j') {
    return editor.with({
      scrollRow: editor.scrollRow + 1,
    });
  }
  if (msg.key === 'pageup') {
    return editor.with({
      scrollRow: Math.max(0, editor.scrollRow - height),
    });
  }
  if (msg.key === 'pagedown') {
    return editor.with({
      scrollRow: editor.scrollRow + height,
    });
  }
  return editor;
}

function editorViewport(model: Pick<Model, 'columns' | 'rows' | 'fileDrawerProgress' | 'graftDrawerProgress' | 'footerVisible'>) {
  const bodyHeight = workspaceBodyHeight(model.rows, model.footerVisible);
  const layout = resolveWorkspaceLayout(model.columns, model.fileDrawerProgress, model.graftDrawerProgress);
  return viewerViewport(layout.viewer.width, bodyHeight);
}

function workspaceBodyHeight(rows: number, footerVisible: boolean): number {
  const footerRows = footerVisible ? 2 : 0;
  return Math.max(1, rows - 2 - footerRows);
}

function viewerViewport(width: number, height: number) {
  return {
    width: Math.max(1, width - (VIEWER_LEFT_PAD * 2)),
    height: Math.max(1, height - (VIEWER_TOP_PAD * 2)),
  };
}

function renderWorkspace(model: Model) {
  const screen = createSurface(model.columns, model.rows);
  fillSurface(screen, model.jeditTheme.surface.workspace);

  if (model.columns < MIN_COLUMNS || model.rows < MIN_ROWS) {
    const message = [
      '',
      'jedit',
      '',
      `need at least ${MIN_COLUMNS} columns x ${MIN_ROWS} rows`,
      `current terminal: ${model.columns} x ${model.rows}`,
    ].join('\n');
    screen.blit(stringToSurface(fitBlock(message, model.columns, model.rows), model.columns, model.rows), 0, 0);
    return compositeFeedback(screen, model.notifications, model.columns, model.rows);
  }

  const title = centerLine(activeWorkspaceTitle({
    cwd: model.cwd,
    editorPath: model.editor?.path,
    editorDirty: model.editor?.dirty ?? false,
    selectedEntry: model.entries[model.selectedIndex],
  }), model.columns);
  const bodyTop = 2;
  const bodyHeight = workspaceBodyHeight(model.rows, model.footerVisible);
  const layout = resolveWorkspaceLayout(model.columns, model.fileDrawerProgress, model.graftDrawerProgress);

  screen.blit(stringToSurface(title, model.columns, 1), 0, 0);
  screen.blit(renderViewer(model, layout.viewer.width, bodyHeight), layout.viewer.x, bodyTop);

  if (layout.fileDrawer.width > 0) {
    screen.blit(renderDrawer('files', model, layout.fileDrawer.width, bodyHeight), layout.fileDrawer.x, bodyTop);
  }

  if (layout.graftDrawer.width > 0) {
    screen.blit(renderDrawer('graft', model, layout.graftDrawer.width, bodyHeight), layout.graftDrawer.x, bodyTop);
  }

  paintActivePaneEdge(screen, layout, {
    focusPane: model.focusPane,
    fileDrawerOpen: model.fileDrawerOpen,
    graftDrawerOpen: model.graftDrawerOpen,
    hasEditor: model.editor != null,
  }, model.jeditTheme.chrome.activeEdge, {
    top: bodyTop,
    height: bodyHeight,
  });

  if (model.footerVisible) {
    screen.blit(renderWorkspaceFooter({
      i18n: model.i18n,
      focusPane: model.focusPane,
      fileDrawerOpen: model.fileDrawerOpen,
      graftDrawerOpen: model.graftDrawerOpen,
      viewMode: model.viewMode,
      markdownPreviewActive: model.editor != null && isMarkdownFile(model.editor.path),
      editorMode: model.editor?.mode,
      pendingNormal: model.editor?.pendingNormal,
      settingsOpen: model.settingsOpen,
      cwd: model.cwd,
      selectedEntry: model.entries[model.selectedIndex],
      editorPath: model.editor?.path,
      graftPath: model.graftInfo?.path,
      graftSelection: selectedGraftSelection(model),
    }, model.columns, model.jeditTheme.surface.footer), 0, model.rows - 2);
  }

  if (model.settingsOpen) {
    screen.blit(renderSettingsDrawer({
      rows: settingsRows(model),
      selectedIndex: model.settingsFocusIndex,
      theme: model.jeditTheme,
      width: resolveSettingsDrawerWidth(model.columns),
      height: bodyHeight,
    }), 0, bodyTop);
  }

  if (model.scenePickerOpen && model.editor == null) {
    screen.blit(renderScenePickerDrawer({
      scenes: model.availableScenes,
      selectedIndex: model.scenePickerFocusIndex,
      theme: model.jeditTheme,
      width: resolveScenePickerDrawerWidth(model.columns),
      height: bodyHeight,
    }), 0, bodyTop);
  }

  if (model.perfVisible) {
    const perf = perfOverlaySurface({
      fps: 1000 / (model.frameTimeMs || 16.67),
      frameTimeMs: model.frameTimeMs,
      frameTimeHistory: model.frameTimeHistory,
      width: model.columns,
      height: model.rows,
    }, { width: 30 });
    screen.blit(perf, model.columns - perf.width - 2, 2);
  }

  return compositeFeedback(screen, model.notifications, model.columns, model.rows);
}

function notificationTickCmd(): Cmd<Msg> { return createNotificationTickCmd((atMs) => ({ type: 'notification-tick', atMs })); }

function renderViewer(model: Model, width: number, height: number) {
  if (model.editor == null) {
    return renderTitleScreen(width, height, model.time, model.jeditTheme, {
      camAngle: model.titleCamera.angle,
      camRadius: model.titleCamera.radius,
      sceneSeed: model.titleSceneSeed,
      mesh: model.titleMesh,
      sceneOverride: model.sceneOverride,
    });
  }

  const surface = createSurface(width, height);
  fillSurface(surface, model.jeditTheme.surface.workspace);

  if (model.viewMode === 'preview' && isMarkdownFile(model.editor.path)) {
    return renderPreview(surface, model.editor, model.jeditTheme, width, height);
  }

  return renderSourceViewer(surface, model.editor, model.sourceHighlight?.path === model.editor.path ? model.sourceHighlight : undefined, {
    viewport: viewerViewport(width, height),
    leftPad: VIEWER_LEFT_PAD,
    topPad: VIEWER_TOP_PAD,
    theme: model.jeditTheme,
  });
}

function renderPreview(surface: Surface, editor: EditorState, theme: JeditTheme, width: number, height: number) {
  const viewport = viewerViewport(width, height);
  paintMarkdownPreview(surface, editor.lines.join('\n'), editor.scrollRow, VIEWER_LEFT_PAD, VIEWER_TOP_PAD, viewport.width, viewport.height, theme);
  return surface;
}

function renderDrawer(kind: DrawerKind, model: Model, width: number, height: number) {
  if (kind === 'graft') {
    return renderGraftDrawer(model, width, height);
  }

  const surface = createSurface(width, height);
  const background = model.jeditTheme.surface.drawer;
  fillSurface(surface, background);

  const listWidth = Math.max(1, width - (DRAWER_INNER_PAD * 2));
  const listHeight = Math.max(1, height - (DRAWER_INNER_PAD * 2));
  const lines = model.entries.map((entry, index) => formatTreeLine(entry, index === model.selectedIndex));
  const content = stringToSurface(fitBlock(lines.join('\n'), listWidth, listHeight), listWidth, listHeight);

  applyBackground(content, background);
  surface.blit(content, DRAWER_INNER_PAD, DRAWER_INNER_PAD);
  return surface;
}

function renderGraftDrawer(model: Model, width: number, height: number) {
  const surface = createSurface(width, height);
  const background = model.jeditTheme.surface.drawer;
  fillSurface(surface, background);

  const innerWidth = Math.max(1, width - (DRAWER_INNER_PAD * 2));
  const innerHeight = Math.max(1, height - (DRAWER_INNER_PAD * 2));
  const lines = renderGraftDrawerLines(model, innerWidth, innerHeight);
  const content = stringToSurface(fitBlock(lines.join('\n'), innerWidth, innerHeight), innerWidth, innerHeight);

  applyBackground(content, background);
  surface.blit(content, DRAWER_INNER_PAD, DRAWER_INNER_PAD);
  return surface;
}

function selectedGraftSelection(model: Model): { kind: string; name: string; startLine: number } | undefined {
  const selected = model.graftInfo?.outlineItems[model.graftSelectedIndex];
  if (selected == null) {
    return undefined;
  }

  return {
    kind: selected.kind,
    name: selected.name,
    startLine: selected.startLine,
  };
}

function fillSurface(surface: Surface, token: JeditStyleToken) {
  surface.fill({
    char: ' ',
    fg: token.fg,
    fgRGB: token.fgRGB,
    bg: token.bg,
    bgRGB: token.bgRGB,
    empty: false,
  });
}

function applyBackground(surface: Surface, token: JeditStyleToken) {
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const cell = surface.get(x, y);
      surface.set(x, y, {
        ...cell,
        char: cell.char.length > 0 ? cell.char : ' ',
        fg: token.fg,
        fgRGB: token.fgRGB,
        bg: token.bg,
        bgRGB: token.bgRGB,
        empty: false,
      });
    }
  }
}

function clampIndex(index: number, size: number): number {
  if (size <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(size - 1, index));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function isMarkdownFile(path: string): boolean {
  return path.endsWith('.md') || path.endsWith('.markdown');
}
