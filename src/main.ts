import { createSurface, stringToSurface, perfOverlaySurface, type Surface } from '@flyingrobots/bijou';
import { initDefaultContext } from '@flyingrobots/bijou-node';
import { animate, quit, run, type App, type Cmd, type KeyMsg, type MouseMsg, type NotificationState, type RuntimeIssue } from '@flyingrobots/bijou-tui';
import { dirname } from 'node:path';
import { joinLines, normalizeLines } from './app/editor-lines.js';
import {
  DIRECTORY_ACTION_OPEN,
  DIRECTORY_ACTION_REFRESH,
  describeDirectoryIssue,
  loadEntries,
  type FileEntry,
} from './adapters/filesystem.js';
import { loadEditorFile, saveEditorFile } from './adapters/editor-file.js';
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
import type { JeditStyleToken, JeditTheme } from './ui/jedit-theme.js';
import { paintActivePaneEdge } from './ui/workspace-focus-edge.js';
import { jeditSettingsRows, moveSettingsFocusIndex, toggleSettingsOpen, updateJeditSettingsFromKey } from './app/settings-session.js';
import {
  createTitleCameraState,
  reduceTitleCameraMotion,
  TITLE_CAMERA_MESSAGE,
  updateTitleCameraFromKey,
  type TitleCameraMotionMsg,
  type TitleCameraState,
} from './app/title-camera-session.js';
import { renderSettingsDrawer, resolveSettingsDrawerWidth } from './ui/settings-drawer.js';
import { titleSceneCameraPlacement } from './ui/title-scene.js';
import { renderTitleScreen } from './ui/title-screen.js';

initDefaultContext();

type ViewMode = 'source' | 'preview';
type EditorMode = 'normal' | 'insert';
type PendingNormal = 'c' | 'd' | 'g' | 'y';
type RegisterKind = 'char' | 'line';

interface RegisterState {
  readonly kind: RegisterKind;
  readonly text: string;
}
interface HistoryEntry {
  readonly lines: readonly string[];
  readonly cursorRow: number;
  readonly cursorCol: number;
  readonly scrollRow: number;
  readonly scrollCol: number;
  readonly dirty: boolean;
}
interface EditorState {
  readonly path: string;
  readonly lines: readonly string[];
  readonly cursorRow: number;
  readonly cursorCol: number;
  readonly scrollRow: number;
  readonly scrollCol: number;
  readonly dirty: boolean;
  readonly readOnly: boolean;
  readonly mode: EditorMode;
  readonly pendingNormal?: PendingNormal;
  readonly register?: RegisterState;
  readonly undoStack: readonly HistoryEntry[];
  readonly redoStack: readonly HistoryEntry[];
}

interface Model {
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
  readonly columns: number;
  readonly rows: number;
  readonly time: number;
  readonly perfVisible: boolean;
  readonly lastFrameMs: number;
  readonly frameTimeMs: number;
  readonly frameTimeHistory: readonly number[];
  readonly titleCamera: TitleCameraState;
}

type Msg =
  | { type: 'drawer-progress'; kind: DrawerKind; value: number }
  | { type: 'graft-info'; requestId: number; info: GraftInfo }
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
const THEME_TOGGLE_KEY = 't';
const SETTINGS_TOGGLE_KEY = 'f2';
const MARKDOWN_PREVIEW_TOGGLE_KEY = 'f3';
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
        editor: model.editor == null ? undefined : ensureEditorVisible(model.editor, viewport.width, viewport.height),
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
      return [{
        ...model,
        time: msg.time,
        lastFrameMs: now,
        frameTimeMs: frameTime,
        frameTimeHistory: history,
      }, []];
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

await run(app, JEDIT_TERMINAL_MOUSE_OPTIONS);

function updateFromKey(msg: KeyMsg, model: Model): [Model, Cmd<Msg>[]] {
  if (msg.key === '`') {
    return [{ ...model, perfVisible: !model.perfVisible }, []];
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

  if (msg.key === SETTINGS_TOGGLE_KEY) {
    return [toggleSettingsOpen(model), []];
  }
  if (model.settingsOpen) {
    return updateJeditSettingsFromKey(msg, model, settingsRows(model), settingsHandlers);
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

  if (msg.ctrl && !msg.alt && msg.key === THEME_TOGGLE_KEY) {
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

  if (msg.key === MARKDOWN_PREVIEW_TOGGLE_KEY) {
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
    jeditTheme: model.jeditTheme,
    footerVisible: model.footerVisible,
    markdownPreviewActive: model.editor != null && isMarkdownFile(model.editor.path),
    viewMode: model.viewMode,
  });
}

const settingsHandlers = {
  cycleTheme: (model: Model): [Model, Cmd<Msg>[]] => [{ ...model, jeditTheme: nextJeditTheme(model.jeditTheme) }, []],
  toggleThemeMode: (model: Model): [Model, Cmd<Msg>[]] => [{ ...model, jeditTheme: oppositeJeditTheme(model.jeditTheme) }, []],
  toggleFooter: (model: Model): [Model, Cmd<Msg>[]] => [{ ...model, footerVisible: !model.footerVisible }, []],
  toggleMarkdownPreview: (model: Model): [Model, Cmd<Msg>[]] => toggleMarkdownPreview(model),
};

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
    const editor = ensureEditorVisible(loadEditor(entry.path), viewport.width, viewport.height);
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
    const editor = ensureEditorVisible({
      ...model.editor,
      cursorRow: Math.max(0, selected.startLine - 1),
      cursorCol: 0,
    }, viewport.width, viewport.height);

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
  return { ...editor, pendingNormal: undefined };
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
  return {
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
    columns,
    rows,
    time: 0,
    perfVisible: false,
    lastFrameMs: Date.now(),
    frameTimeMs: 0,
    frameTimeHistory: [],
    titleCamera: createTitleCameraState(titleSceneCameraPlacement(titleSceneSeed)),
  };
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

    return ensureEditorVisible({
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
    }, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  } catch (error) {
    return {
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
    };
  }
}

function saveEditor(editor: EditorState): EditorState {
  if (editor.readOnly) {
    return editor;
  }

  saveEditorFile(editor.path, editor.lines);
  return {
    ...editor,
    dirty: false,
  };
}

function snapshotEditor(editor: EditorState): HistoryEntry {
  return {
    lines: [...editor.lines],
    cursorRow: editor.cursorRow,
    cursorCol: editor.cursorCol,
    scrollRow: editor.scrollRow,
    scrollCol: editor.scrollCol,
    dirty: editor.dirty,
  };
}

function commitMutation(editor: EditorState, patch: Partial<EditorState>): EditorState {
  return {
    ...editor,
    undoStack: [...editor.undoStack, snapshotEditor(editor)],
    redoStack: [],
    ...patch,
    dirty: patch.dirty ?? true,
    pendingNormal: undefined,
  };
}

function undo(editor: EditorState): EditorState {
  const snapshot = editor.undoStack.at(-1);
  if (snapshot == null) {
    return editor;
  }

  return {
    ...editor,
    lines: snapshot.lines,
    cursorRow: snapshot.cursorRow,
    cursorCol: snapshot.cursorCol,
    scrollRow: snapshot.scrollRow,
    scrollCol: snapshot.scrollCol,
    dirty: snapshot.dirty,
    mode: 'normal',
    pendingNormal: undefined,
    undoStack: editor.undoStack.slice(0, -1),
    redoStack: [...editor.redoStack, snapshotEditor(editor)],
  };
}

function redo(editor: EditorState): EditorState {
  const snapshot = editor.redoStack.at(-1);
  if (snapshot == null) {
    return editor;
  }

  return {
    ...editor,
    lines: snapshot.lines,
    cursorRow: snapshot.cursorRow,
    cursorCol: snapshot.cursorCol,
    scrollRow: snapshot.scrollRow,
    scrollCol: snapshot.scrollCol,
    dirty: snapshot.dirty,
    mode: 'normal',
    pendingNormal: undefined,
    undoStack: [...editor.undoStack, snapshotEditor(editor)],
    redoStack: editor.redoStack.slice(0, -1),
  };
}

function updateInsertMode(editor: EditorState, msg: KeyMsg, viewportWidth: number, viewportHeight: number, allowTabIndent: boolean): EditorState {
  if (editor.readOnly) {
    return editor;
  }
  const viewport = { width: Math.max(1, viewportWidth), height: Math.max(1, viewportHeight) };

  if (msg.key === 'escape') {
    return ensureEditorVisible(enterNormalMode(editor), viewport.width, viewport.height);
  }
  if (msg.key === 'left') {
    return ensureEditorVisible(moveCursorLeftInsert(editor), viewport.width, viewport.height);
  }
  if (msg.key === 'right') {
    return ensureEditorVisible(moveCursorRightInsert(editor), viewport.width, viewport.height);
  }
  if (msg.key === 'up') {
    return ensureEditorVisible(moveCursorVerticalInsert(editor, -1), viewport.width, viewport.height);
  }
  if (msg.key === 'down') {
    return ensureEditorVisible(moveCursorVerticalInsert(editor, 1), viewport.width, viewport.height);
  }
  if (msg.key === 'home') {
    return ensureEditorVisible({ ...editor, cursorCol: 0 }, viewport.width, viewport.height);
  }
  if (msg.key === 'end') {
    return ensureEditorVisible({ ...editor, cursorCol: currentLine(editor).length }, viewport.width, viewport.height);
  }
  if (msg.key === 'pageup') {
    return ensureEditorVisible(moveCursorVerticalInsert(editor, -viewport.height), viewport.width, viewport.height);
  }
  if (msg.key === 'pagedown') {
    return ensureEditorVisible(moveCursorVerticalInsert(editor, viewport.height), viewport.width, viewport.height);
  }
  if (msg.key === 'backspace') {
    return ensureEditorVisible(backspace(editor), viewport.width, viewport.height);
  }
  if (msg.key === 'delete') {
    return ensureEditorVisible(deleteForward(editor), viewport.width, viewport.height);
  }
  if (msg.key === 'enter') {
    return ensureEditorVisible(insertNewline(editor), viewport.width, viewport.height);
  }
  if (allowTabIndent && msg.key === 'tab') {
    return ensureEditorVisible(insertText(editor, '  '), viewport.width, viewport.height);
  }

  const inserted = keyToText(msg);
  if (inserted != null) {
    return ensureEditorVisible(insertText(editor, inserted), viewport.width, viewport.height);
  }

  return ensureEditorVisible(editor, viewport.width, viewport.height);
}

function updateNormalMode(editor: EditorState, msg: KeyMsg, viewportWidth: number, viewportHeight: number): EditorState {
  const viewport = { width: Math.max(1, viewportWidth), height: Math.max(1, viewportHeight) };

  if (msg.key === 'escape') {
    return ensureEditorVisible({ ...editor, pendingNormal: undefined }, viewport.width, viewport.height);
  }

  if (editor.pendingNormal === 'd') {
    const cleared = { ...editor, pendingNormal: undefined };
    const operated = applyPendingOperator(cleared, 'delete', msg);
    if (operated != null) {
      return ensureEditorVisible(operated, viewport.width, viewport.height);
    }
    return updateNormalMode(cleared, msg, viewport.width, viewport.height);
  }

  if (editor.pendingNormal === 'c') {
    const cleared = { ...editor, pendingNormal: undefined };
    const operated = applyPendingOperator(cleared, 'change', msg);
    if (operated != null) {
      return ensureEditorVisible(operated, viewport.width, viewport.height);
    }
    return updateNormalMode(cleared, msg, viewport.width, viewport.height);
  }

  if (editor.pendingNormal === 'y') {
    const cleared = { ...editor, pendingNormal: undefined };
    const operated = applyPendingOperator(cleared, 'yank', msg);
    if (operated != null) {
      return ensureEditorVisible(operated, viewport.width, viewport.height);
    }
    return updateNormalMode(cleared, msg, viewport.width, viewport.height);
  }

  if (editor.pendingNormal === 'g') {
    const cleared = { ...editor, pendingNormal: undefined };
    if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'g') {
      return ensureEditorVisible(moveCursorToTop(cleared), viewport.width, viewport.height);
    }
    return updateNormalMode(cleared, msg, viewport.width, viewport.height);
  }

  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'i') {
    return ensureEditorVisible({ ...editor, mode: 'insert' }, viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'a') {
    return ensureEditorVisible(enterInsertAfterCursor(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.shift && msg.key === 'a') {
    return ensureEditorVisible(enterInsertAtLineEnd(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.shift && msg.key === 'i') {
    return ensureEditorVisible(enterInsertAtFirstNonWhitespace(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'o') {
    return ensureEditorVisible(openLineBelow(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.shift && msg.key === 'o') {
    return ensureEditorVisible(openLineAbove(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'u') {
    return ensureEditorVisible(undo(editor), viewport.width, viewport.height);
  }
  if (msg.ctrl && !msg.alt && !msg.shift && msg.key === 'r') {
    return ensureEditorVisible(redo(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'p') {
    return ensureEditorVisible(pasteRegister(editor, 'after'), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.shift && msg.key === 'p') {
    return ensureEditorVisible(pasteRegister(editor, 'before'), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'x') {
    return ensureEditorVisible(deleteCharUnderCursor(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'w') {
    return ensureEditorVisible(moveCursorToNextWordStart(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'b') {
    return ensureEditorVisible(moveCursorToPreviousWordStart(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'e') {
    return ensureEditorVisible(moveCursorToWordEnd(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === '^') {
    return ensureEditorVisible(moveCursorToFirstNonWhitespace(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'd') {
    return ensureEditorVisible({ ...editor, pendingNormal: 'd' }, viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'c') {
    return ensureEditorVisible({ ...editor, pendingNormal: 'c' }, viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'y') {
    return ensureEditorVisible({ ...editor, pendingNormal: 'y' }, viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'g') {
    return ensureEditorVisible({ ...editor, pendingNormal: 'g' }, viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.shift && msg.key === 'g') {
    return ensureEditorVisible(moveCursorToBottom(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.shift && msg.key === 'd') {
    return ensureEditorVisible(deleteToLineEnd(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.shift && msg.key === 'c') {
    return ensureEditorVisible(changeToLineEnd(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.shift && msg.key === 'y') {
    return ensureEditorVisible(yankCurrentLine(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === '0') {
    return ensureEditorVisible(moveCursorToLineStart(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === '$') {
    return ensureEditorVisible(moveCursorToLineEnd(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && (msg.key === 'h' || msg.key === 'left')) {
    return ensureEditorVisible(moveCursorLeftNormal(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && (msg.key === 'l' || msg.key === 'right')) {
    return ensureEditorVisible(moveCursorRightNormal(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && (msg.key === 'j' || msg.key === 'down')) {
    return ensureEditorVisible(moveCursorVerticalNormal(editor, 1), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && (msg.key === 'k' || msg.key === 'up')) {
    return ensureEditorVisible(moveCursorVerticalNormal(editor, -1), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.key === 'pageup') {
    return ensureEditorVisible(moveCursorVerticalNormal(editor, -viewport.height), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.key === 'pagedown') {
    return ensureEditorVisible(moveCursorVerticalNormal(editor, viewport.height), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.key === 'home') {
    return ensureEditorVisible(moveCursorToLineStart(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.key === 'end') {
    return ensureEditorVisible(moveCursorToLineEnd(editor), viewport.width, viewport.height);
  }

  return ensureEditorVisible(editor, viewport.width, viewport.height);
}

function applyPendingOperator(
  editor: EditorState,
  operator: 'change' | 'delete' | 'yank',
  msg: KeyMsg,
): EditorState | undefined {
  if (msg.ctrl || msg.alt) {
    return undefined;
  }

  if (!msg.shift) {
    if (operator === 'delete' && msg.key === 'd') {
      return deleteCurrentLine(editor);
    }
    if (operator === 'change' && msg.key === 'c') {
      return changeCurrentLine(editor);
    }
    if (operator === 'yank' && msg.key === 'y') {
      return yankCurrentLine(editor);
    }
    if (msg.key === 'w') {
      return applyWordMotionOperator(editor, operator, 'w');
    }
    if (msg.key === 'e') {
      return applyWordMotionOperator(editor, operator, 'e');
    }
    if (msg.key === '0') {
      return applyLineBoundaryOperator(editor, operator, 'start');
    }
  }

  if (msg.key === '$') {
    return applyLineBoundaryOperator(editor, operator, 'end');
  }

  return undefined;
}

function applyWordMotionOperator(
  editor: EditorState,
  operator: 'change' | 'delete' | 'yank',
  motion: 'e' | 'w',
): EditorState {
  const text = editorText(editor);
  if (text.length === 0) {
    return operator === 'change'
      ? { ...editor, mode: 'insert', pendingNormal: undefined }
      : editor;
  }

  const start = normalTextIndex(editor);
  const end = motion === 'w'
    ? nextWordStartIndex(text, start, true)
    : Math.min(text.length, wordEndIndex(text, start) + 1);

  const safeEnd = Math.max(start + 1, end);
  return applyCharwiseOperator(editor, operator, start, Math.min(text.length, safeEnd));
}

function applyLineBoundaryOperator(
  editor: EditorState,
  operator: 'change' | 'delete' | 'yank',
  boundary: 'end' | 'start',
): EditorState {
  const line = currentLine(editor);
  const lineStart = lineStartTextIndex(editor.lines, editor.cursorRow);
  const cursor = normalTextIndex(editor);
  const from = boundary === 'start' ? lineStart : cursor;
  const to = boundary === 'start' ? cursor + 1 : lineStart + line.length;

  if (from >= to) {
    return operator === 'change'
      ? { ...editor, mode: 'insert', pendingNormal: undefined }
      : editor;
  }

  return applyCharwiseOperator(editor, operator, from, to);
}

function applyCharwiseOperator(
  editor: EditorState,
  operator: 'change' | 'delete' | 'yank',
  start: number,
  end: number,
): EditorState {
  if (operator === 'yank') {
    return yankTextRange(editor, start, end, 'char');
  }

  return deleteTextRange(editor, start, end, {
    mode: operator === 'change' ? 'insert' : 'normal',
    register: 'char',
  });
}

function scrollPreview(editor: EditorState, msg: KeyMsg, height: number): EditorState {
  if (msg.key === 'up' || msg.key === 'k') {
    return {
      ...editor,
      scrollRow: Math.max(0, editor.scrollRow - 1),
    };
  }
  if (msg.key === 'down' || msg.key === 'j') {
    return {
      ...editor,
      scrollRow: editor.scrollRow + 1,
    };
  }
  if (msg.key === 'pageup') {
    return {
      ...editor,
      scrollRow: Math.max(0, editor.scrollRow - height),
    };
  }
  if (msg.key === 'pagedown') {
    return {
      ...editor,
      scrollRow: editor.scrollRow + height,
    };
  }
  return editor;
}

function enterNormalMode(editor: EditorState): EditorState {
  const line = currentLine(editor);
  if (line.length === 0) {
    return {
      ...editor,
      mode: 'normal',
      cursorCol: 0,
      pendingNormal: undefined,
    };
  }

  const nextCol = Math.max(0, Math.min(editor.cursorCol - 1, line.length - 1));
  return {
    ...editor,
    mode: 'normal',
    cursorCol: nextCol,
    pendingNormal: undefined,
  };
}

function enterInsertAfterCursor(editor: EditorState): EditorState {
  const line = currentLine(editor);
  const nextCol = line.length === 0 ? 0 : Math.min(editor.cursorCol + 1, line.length);
  return {
    ...editor,
    mode: 'insert',
    cursorCol: nextCol,
    pendingNormal: undefined,
  };
}

function enterInsertAtLineEnd(editor: EditorState): EditorState {
  return {
    ...editor,
    mode: 'insert',
    cursorCol: currentLine(editor).length,
    pendingNormal: undefined,
  };
}

function enterInsertAtFirstNonWhitespace(editor: EditorState): EditorState {
  const line = currentLine(editor);
  const match = line.match(/\S/);
  return {
    ...editor,
    mode: 'insert',
    cursorCol: match == null ? 0 : match.index ?? 0,
    pendingNormal: undefined,
  };
}

function moveCursorLeftInsert(editor: EditorState): EditorState {
  if (editor.cursorCol > 0) {
    return {
      ...editor,
      cursorCol: editor.cursorCol - 1,
      pendingNormal: undefined,
    };
  }

  if (editor.cursorRow === 0) {
    return editor;
  }

  const prevLine = editor.lines[editor.cursorRow - 1] ?? '';
  return {
    ...editor,
    cursorRow: editor.cursorRow - 1,
    cursorCol: prevLine.length,
    pendingNormal: undefined,
  };
}

function moveCursorRightInsert(editor: EditorState): EditorState {
  const line = currentLine(editor);
  if (editor.cursorCol < line.length) {
    return {
      ...editor,
      cursorCol: editor.cursorCol + 1,
      pendingNormal: undefined,
    };
  }

  if (editor.cursorRow >= editor.lines.length - 1) {
    return editor;
  }

  return {
    ...editor,
    cursorRow: editor.cursorRow + 1,
    cursorCol: 0,
    pendingNormal: undefined,
  };
}

function moveCursorVerticalInsert(editor: EditorState, delta: number): EditorState {
  const nextRow = clampIndex(editor.cursorRow + delta, editor.lines.length);
  const nextLine = editor.lines[nextRow] ?? '';
  return {
    ...editor,
    cursorRow: nextRow,
    cursorCol: Math.min(editor.cursorCol, nextLine.length),
    pendingNormal: undefined,
  };
}

function moveCursorLeftNormal(editor: EditorState): EditorState {
  return {
    ...editor,
    cursorCol: Math.max(0, editor.cursorCol - 1),
    pendingNormal: undefined,
  };
}

function moveCursorRightNormal(editor: EditorState): EditorState {
  const line = currentLine(editor);
  const maxCol = line.length === 0 ? 0 : line.length - 1;
  return {
    ...editor,
    cursorCol: Math.min(maxCol, editor.cursorCol + 1),
    pendingNormal: undefined,
  };
}

function moveCursorVerticalNormal(editor: EditorState, delta: number): EditorState {
  const nextRow = clampIndex(editor.cursorRow + delta, editor.lines.length);
  const nextLine = editor.lines[nextRow] ?? '';
  return {
    ...editor,
    cursorRow: nextRow,
    cursorCol: clampNormalCol(editor.cursorCol, nextLine),
    pendingNormal: undefined,
  };
}

function moveCursorToLineStart(editor: EditorState): EditorState {
  return {
    ...editor,
    cursorCol: 0,
    pendingNormal: undefined,
  };
}

function moveCursorToLineEnd(editor: EditorState): EditorState {
  const line = currentLine(editor);
  return {
    ...editor,
    cursorCol: line.length === 0 ? 0 : line.length - 1,
    pendingNormal: undefined,
  };
}

function moveCursorToFirstNonWhitespace(editor: EditorState): EditorState {
  return {
    ...editor,
    cursorCol: leadingWhitespace(currentLine(editor)).length,
    pendingNormal: undefined,
  };
}

function moveCursorToTop(editor: EditorState): EditorState {
  const line = editor.lines[0] ?? '';
  return {
    ...editor,
    cursorRow: 0,
    cursorCol: clampNormalCol(editor.cursorCol, line),
    pendingNormal: undefined,
  };
}

function moveCursorToBottom(editor: EditorState): EditorState {
  const row = Math.max(0, editor.lines.length - 1);
  const line = editor.lines[row] ?? '';
  return {
    ...editor,
    cursorRow: row,
    cursorCol: clampNormalCol(editor.cursorCol, line),
    pendingNormal: undefined,
  };
}

function moveCursorToNextWordStart(editor: EditorState): EditorState {
  const text = editorText(editor);
  if (text.length === 0) {
    return editor;
  }

  const target = nextWordStartIndex(text, normalTextIndex(editor));
  const position = normalPositionAtOrBeforeIndex(editor.lines, target);
  return {
    ...editor,
    cursorRow: position.row,
    cursorCol: position.col,
    pendingNormal: undefined,
  };
}

function moveCursorToPreviousWordStart(editor: EditorState): EditorState {
  const text = editorText(editor);
  if (text.length === 0) {
    return editor;
  }

  const target = previousWordStartIndex(text, normalTextIndex(editor));
  const position = normalPositionAtOrBeforeIndex(editor.lines, target);
  return {
    ...editor,
    cursorRow: position.row,
    cursorCol: position.col,
    pendingNormal: undefined,
  };
}

function moveCursorToWordEnd(editor: EditorState): EditorState {
  const text = editorText(editor);
  if (text.length === 0) {
    return editor;
  }

  const target = wordEndIndex(text, normalTextIndex(editor));
  const position = normalPositionAtOrBeforeIndex(editor.lines, target);
  return {
    ...editor,
    cursorRow: position.row,
    cursorCol: position.col,
    pendingNormal: undefined,
  };
}

function openLineBelow(editor: EditorState): EditorState {
  const index = editor.cursorRow + 1;
  const indent = leadingWhitespace(currentLine(editor));
  return commitMutation(editor, {
    lines: [
      ...editor.lines.slice(0, index),
      indent,
      ...editor.lines.slice(index),
    ],
    cursorRow: index,
    cursorCol: indent.length,
    mode: 'insert',
  });
}

function openLineAbove(editor: EditorState): EditorState {
  const index = editor.cursorRow;
  const indent = leadingWhitespace(currentLine(editor));
  return commitMutation(editor, {
    lines: [
      ...editor.lines.slice(0, index),
      indent,
      ...editor.lines.slice(index),
    ],
    cursorRow: index,
    cursorCol: indent.length,
    mode: 'insert',
  });
}

function deleteCurrentLine(editor: EditorState): EditorState {
  const register: RegisterState = {
    kind: 'line',
    text: currentLine(editor),
  };

  if (editor.lines.length <= 1) {
    return commitMutation(editor, {
      lines: [''],
      cursorRow: 0,
      cursorCol: 0,
      register,
    });
  }

  const nextLines = [
    ...editor.lines.slice(0, editor.cursorRow),
    ...editor.lines.slice(editor.cursorRow + 1),
  ];
  const nextRow = Math.min(editor.cursorRow, nextLines.length - 1);
  const nextLine = nextLines[nextRow] ?? '';

  return commitMutation(editor, {
    lines: nextLines,
    cursorRow: nextRow,
    cursorCol: clampNormalCol(0, nextLine),
    register,
  });
}

function changeCurrentLine(editor: EditorState): EditorState {
  const indent = leadingWhitespace(currentLine(editor));
  return commitMutation(editor, {
    lines: editor.lines.map((line, index) => (index === editor.cursorRow ? indent : line)),
    cursorCol: indent.length,
    mode: 'insert',
    register: {
      kind: 'line',
      text: currentLine(editor),
    },
  });
}

function yankCurrentLine(editor: EditorState): EditorState {
  return {
    ...editor,
    register: {
      kind: 'line',
      text: currentLine(editor),
    },
    pendingNormal: undefined,
  };
}

function deleteToLineEnd(editor: EditorState): EditorState {
  const line = currentLine(editor);
  if (line.length === 0) {
    return editor;
  }

  const lineStart = lineStartTextIndex(editor.lines, editor.cursorRow);
  return deleteTextRange(editor, normalTextIndex(editor), lineStart + line.length, {
    mode: 'normal',
    register: 'char',
  });
}

function changeToLineEnd(editor: EditorState): EditorState {
  const line = currentLine(editor);
  if (line.length === 0) {
    return {
      ...editor,
      mode: 'insert',
      pendingNormal: undefined,
    };
  }

  const lineStart = lineStartTextIndex(editor.lines, editor.cursorRow);
  return deleteTextRange(editor, normalTextIndex(editor), lineStart + line.length, {
    mode: 'insert',
    register: 'char',
  });
}

function deleteCharUnderCursor(editor: EditorState): EditorState {
  const text = editorText(editor);
  if (text.length === 0) {
    return editor;
  }

  const start = normalTextIndex(editor);
  if (start >= text.length) {
    return editor;
  }

  return deleteTextRange(editor, start, start + 1, {
    mode: 'normal',
    register: 'char',
  });
}

function pasteRegister(editor: EditorState, placement: 'after' | 'before'): EditorState {
  const register = editor.register;
  if (register == null || register.text.length === 0) {
    return editor;
  }

  if (register.kind === 'line') {
    const index = placement === 'before' ? editor.cursorRow : editor.cursorRow + 1;
    const inserted = register.text.split('\n');
    return commitMutation(editor, {
      lines: [
        ...editor.lines.slice(0, index),
        ...inserted,
        ...editor.lines.slice(index),
      ],
      cursorRow: index,
      cursorCol: 0,
      mode: 'normal',
    });
  }

  const insertionIndex = placement === 'before'
    ? normalTextIndex(editor)
    : normalTextIndex(editor) + (currentLine(editor).length === 0 ? 0 : 1);
  const text = editorText(editor);
  const nextText = `${text.slice(0, insertionIndex)}${register.text}${text.slice(insertionIndex)}`;
  const nextLines = normalizeLines(nextText);
  const position = normalPositionAtOrBeforeIndex(nextLines, insertionIndex + register.text.length - 1);

  return commitMutation(editor, {
    lines: nextLines,
    cursorRow: position.row,
    cursorCol: position.col,
    mode: 'normal',
  });
}

function yankTextRange(editor: EditorState, start: number, end: number, kind: RegisterKind): EditorState {
  const text = editorText(editor);
  const from = Math.max(0, Math.min(start, end));
  const to = Math.max(from, Math.min(text.length, Math.max(start, end)));

  return {
    ...editor,
    register: {
      kind,
      text: text.slice(from, to),
    },
    pendingNormal: undefined,
  };
}

function deleteTextRange(
  editor: EditorState,
  start: number,
  end: number,
  options: {
    readonly mode: EditorMode;
    readonly register: RegisterKind;
  },
): EditorState {
  const text = editorText(editor);
  const from = Math.max(0, Math.min(start, end));
  const to = Math.max(from, Math.min(text.length, Math.max(start, end)));
  if (from === to) {
    return options.mode === 'insert'
      ? { ...editor, mode: 'insert', pendingNormal: undefined }
      : editor;
  }

  const nextText = `${text.slice(0, from)}${text.slice(to)}`;
  const nextLines = normalizeLines(nextText);
  const position = options.mode === 'insert'
    ? insertPositionAtIndex(nextLines, from)
    : normalPositionAtOrBeforeIndex(nextLines, from);

  return commitMutation(editor, {
    lines: nextLines,
    cursorRow: position.row,
    cursorCol: position.col,
    mode: options.mode,
    register: {
      kind: options.register,
      text: text.slice(from, to),
    },
  });
}

function backspace(editor: EditorState): EditorState {
  if (editor.cursorCol > 0) {
    const line = currentLine(editor);
    const nextLine = `${line.slice(0, editor.cursorCol - 1)}${line.slice(editor.cursorCol)}`;
    return replaceCurrentLine(editor, nextLine, editor.cursorCol - 1, true);
  }

  if (editor.cursorRow === 0) {
    return editor;
  }

  const prevLine = editor.lines[editor.cursorRow - 1] ?? '';
  const line = currentLine(editor);
  const nextLines = [
    ...editor.lines.slice(0, editor.cursorRow - 1),
    `${prevLine}${line}`,
    ...editor.lines.slice(editor.cursorRow + 1),
  ];

  return commitMutation(editor, {
    lines: nextLines,
    cursorRow: editor.cursorRow - 1,
    cursorCol: prevLine.length,
  });
}

function deleteForward(editor: EditorState): EditorState {
  const line = currentLine(editor);
  if (editor.cursorCol < line.length) {
    const nextLine = `${line.slice(0, editor.cursorCol)}${line.slice(editor.cursorCol + 1)}`;
    return replaceCurrentLine(editor, nextLine, editor.cursorCol, true);
  }

  if (editor.cursorRow >= editor.lines.length - 1) {
    return editor;
  }

  const nextLine = editor.lines[editor.cursorRow + 1] ?? '';
  const merged = `${line}${nextLine}`;
  const nextLines = [
    ...editor.lines.slice(0, editor.cursorRow),
    merged,
    ...editor.lines.slice(editor.cursorRow + 2),
  ];

  return commitMutation(editor, {
    lines: nextLines,
  });
}

function insertNewline(editor: EditorState): EditorState {
  const line = currentLine(editor);
  const before = line.slice(0, editor.cursorCol);
  const after = line.slice(editor.cursorCol);
  const nextLines = [
    ...editor.lines.slice(0, editor.cursorRow),
    before,
    after,
    ...editor.lines.slice(editor.cursorRow + 1),
  ];

  return commitMutation(editor, {
    lines: nextLines,
    cursorRow: editor.cursorRow + 1,
    cursorCol: 0,
  });
}

function insertText(editor: EditorState, text: string): EditorState {
  const line = currentLine(editor);
  const nextLine = `${line.slice(0, editor.cursorCol)}${text}${line.slice(editor.cursorCol)}`;
  return replaceCurrentLine(editor, nextLine, editor.cursorCol + text.length, true);
}

function replaceCurrentLine(editor: EditorState, line: string, cursorCol: number, dirty: boolean): EditorState {
  const nextLines = editor.lines.map((value, index) => (index === editor.cursorRow ? line : value));
  return commitMutation(editor, {
    lines: nextLines,
    cursorCol,
    dirty: dirty || editor.dirty,
  });
}

function currentLine(editor: EditorState): string {
  return editor.lines[editor.cursorRow] ?? '';
}

function leadingWhitespace(line: string): string {
  return line.match(/^\s*/)?.[0] ?? '';
}

function editorText(editor: EditorState): string {
  return joinLines(editor.lines);
}

function lineStartTextIndex(lines: readonly string[], row: number): number {
  let index = 0;
  for (let currentRow = 0; currentRow < row; currentRow += 1) {
    index += (lines[currentRow] ?? '').length;
    if (currentRow < lines.length - 1) {
      index += 1;
    }
  }
  return index;
}

function normalTextIndex(editor: EditorState): number {
  return lineStartTextIndex(editor.lines, editor.cursorRow) + clampNormalCol(editor.cursorCol, currentLine(editor));
}

function insertPositionAtIndex(lines: readonly string[], index: number): { row: number; col: number } {
  let remaining = Math.max(0, index);

  for (let row = 0; row < lines.length; row += 1) {
    const line = lines[row] ?? '';
    if (remaining <= line.length) {
      return { row, col: remaining };
    }

    remaining -= line.length;
    if (row < lines.length - 1) {
      remaining -= 1;
    }
  }

  const lastRow = Math.max(0, lines.length - 1);
  return {
    row: lastRow,
    col: (lines[lastRow] ?? '').length,
  };
}

function normalPositionAtOrBeforeIndex(lines: readonly string[], index: number): { row: number; col: number } {
  const position = insertPositionAtIndex(lines, index);
  const line = lines[position.row] ?? '';
  return {
    row: position.row,
    col: line.length === 0 ? 0 : Math.min(position.col, line.length - 1),
  };
}

function nextWordStartIndex(text: string, index: number, allowEnd = false): number {
  if (text.length === 0) {
    return 0;
  }

  let cursor = Math.max(0, Math.min(index, text.length - 1));
  if (classifyWordChar(text[cursor]) === 'space') {
    while (cursor < text.length && classifyWordChar(text[cursor]) === 'space') {
      cursor += 1;
    }
  } else {
    const currentClass = classifyWordChar(text[cursor]);
    while (cursor < text.length && classifyWordChar(text[cursor]) === currentClass) {
      cursor += 1;
    }
    while (cursor < text.length && classifyWordChar(text[cursor]) === 'space') {
      cursor += 1;
    }
  }

  if (allowEnd) {
    return Math.max(0, Math.min(text.length, cursor));
  }

  return Math.max(0, Math.min(text.length - 1, cursor));
}

function previousWordStartIndex(text: string, index: number): number {
  if (text.length === 0) {
    return 0;
  }

  let cursor = Math.max(0, Math.min(index, text.length - 1));
  if (cursor === 0) {
    return 0;
  }

  cursor -= 1;
  while (cursor > 0 && classifyWordChar(text[cursor]) === 'space') {
    cursor -= 1;
  }

  const currentClass = classifyWordChar(text[cursor]);
  while (cursor > 0 && classifyWordChar(text[cursor - 1]) === currentClass) {
    cursor -= 1;
  }

  return cursor;
}

function wordEndIndex(text: string, index: number): number {
  if (text.length === 0) {
    return 0;
  }

  let cursor = Math.max(0, Math.min(index, text.length - 1));
  while (cursor < text.length && classifyWordChar(text[cursor]) === 'space') {
    cursor += 1;
  }
  if (cursor >= text.length) {
    return text.length - 1;
  }

  const currentClass = classifyWordChar(text[cursor]);
  while (cursor < text.length - 1 && classifyWordChar(text[cursor + 1]) === currentClass) {
    cursor += 1;
  }

  return cursor;
}

function classifyWordChar(char: string | undefined): 'punct' | 'space' | 'word' {
  if (char == null || /\s/.test(char)) {
    return 'space';
  }
  if (/[A-Za-z0-9_]/.test(char)) {
    return 'word';
  }
  return 'punct';
}

function keyToText(msg: KeyMsg): string | undefined {
  if (msg.ctrl || msg.alt) {
    return undefined;
  }

  if (msg.key === 'space') {
    return ' ';
  }

  if (msg.key.length !== 1) {
    return undefined;
  }

  if (msg.shift && msg.key >= 'a' && msg.key <= 'z') {
    return msg.key.toUpperCase();
  }

  return msg.key;
}

function ensureEditorVisible(editor: EditorState, width: number, height: number): EditorState {
  const normalized = normalizeEditor(editor);
  const line = currentLine(normalized);
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);

  let scrollRow = normalized.scrollRow;
  let scrollCol = normalized.scrollCol;

  if (normalized.cursorRow < scrollRow) {
    scrollRow = normalized.cursorRow;
  } else if (normalized.cursorRow >= scrollRow + safeHeight) {
    scrollRow = normalized.cursorRow - safeHeight + 1;
  }

  if (normalized.cursorCol < scrollCol) {
    scrollCol = normalized.cursorCol;
  } else if (normalized.cursorCol >= scrollCol + safeWidth) {
    scrollCol = normalized.cursorCol - safeWidth + 1;
  }

  const maxScrollCol = Math.max(0, line.length - safeWidth + 1);

  return {
    ...normalized,
    scrollRow: Math.max(0, scrollRow),
    scrollCol: Math.max(0, Math.min(scrollCol, maxScrollCol)),
  };
}

function normalizeEditor(editor: EditorState): EditorState {
  const row = clampIndex(editor.cursorRow, editor.lines.length);
  const line = editor.lines[row] ?? '';
  const maxCol = editor.mode === 'insert'
    ? line.length
    : clampNormalCol(Number.MAX_SAFE_INTEGER, line);

  return {
    ...editor,
    cursorRow: row,
    cursorCol: Math.max(0, Math.min(editor.cursorCol, maxCol)),
  };
}

function clampNormalCol(cursorCol: number, line: string): number {
  if (line.length === 0) {
    return 0;
  }
  return Math.max(0, Math.min(cursorCol, line.length - 1));
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
    return renderTitleScreen(width, height, model.time, model.jeditTheme, model.titleCamera.angle, model.titleCamera.radius, model.titleSceneSeed);
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
