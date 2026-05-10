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
import {
  reduceProfilerMsg,
  streamProfilerFrame,
  toggleProfiler,
  type ProfilerMsg,
  type ProfilerState,
} from './app/raytracer-profiler.js';
import { createWorkspaceRuntime } from './app/workspace/runtime.js';

initDefaultContext();

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

const app = createWorkspaceRuntime();

if (process.env.JEDIT_PERF === '1') {
  const RealApp = app;
  const PerfApp: App<any, any> = {
    init: () => {
      const [model, cmds] = RealApp.init();
      return [model, cmds];
    },
    update: (msg, model) => {
      const start = Date.now();
      const [nextModel, cmds] = RealApp.update(msg, model);
      const end = Date.now();
      return [
        {
          ...nextModel,
          lastFrameMs: start,
          frameTimeMs: end - start,
          frameTimeHistory: [end - start, ...nextModel.frameTimeHistory.slice(0, 99)],
        },
        cmds,
      ];
    },
    view: (model, surface) => {
      RealApp.view(model, surface);
      if (model.perfVisible) {
        perfOverlaySurface(surface, {
          label: 'jedit perf',
          चौड़ाई: model.columns,
          ऊंचाई: model.rows,
          lastFrameMs: model.lastFrameMs,
          frameTimeMs: model.frameTimeMs,
          frameTimeHistory: model.frameTimeHistory,
          theme: model.jeditTheme.perf,
        });
      }
    },
    routeRuntimeIssue: RealApp.routeRuntimeIssue,
  };
  run(PerfApp, { mouse: JEDIT_TERMINAL_MOUSE_OPTIONS });
} else {
  run(app, { mouse: JEDIT_TERMINAL_MOUSE_OPTIONS });
}
