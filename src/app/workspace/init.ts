import { createTitleCameraState } from '../title-camera-session.js';
import { createFeedbackState } from '../../ui/feedback.js';
import { titleBunnySceneCameraPlacement, titleSceneCameraPlacement } from '../../ui/title-scene.js';
import { TITLE_ASCII_PALETTE, TITLE_RENDER_MODE } from '../../ui/title-screen.js';
import { FocusPanes, type FocusPane } from '../../ui/panel-focus.js';
import type { TitleMeshLibrary } from '../../ui/title-mesh.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import type { I18nPort } from '../../ports/i18n.js';
import { BUILT_IN_TITLE_SCENE_NAMES } from '../../ports/title-scene-loader.js';
import type { JeditTheme } from '../../ui/jedit-theme.js';
import type { FileEntry } from '../../ports/file-system.js';
import { ViewModes } from './view-mode.js';

const INITIAL_FOCUS_PANE: FocusPane = FocusPanes.Editor;
const INITIAL_VIEW_MODE = ViewModes.Source;

export interface WorkspaceInitialModelSnapshot {
  readonly titleSceneSeed: number;
  readonly jeditTheme: JeditTheme;
  readonly i18n: I18nPort;
  readonly entries: readonly FileEntry[];
  readonly titleMeshes?: TitleMeshLibrary;
  readonly nowMs: number;
}

export function createInitialModel(
  cwd: string,
  columns: number,
  rows: number,
  snapshot: WorkspaceInitialModelSnapshot,
): WorkspaceModel {
  const { titleSceneSeed, jeditTheme, i18n, entries, nowMs } = snapshot;
  const titleMeshes = snapshot.titleMeshes ?? {};
  const focusPane = INITIAL_FOCUS_PANE;
  return {
    i18n,
    workspaceRoot: cwd,
    cwd,
    entries,
    selectedIndex: 0,
    editor: undefined,
    viewMode: INITIAL_VIEW_MODE,
    focusPane,
    fileDrawerOpen: false,
    fileDrawerProgress: 0,
    graftDrawerOpen: false,
    graftDrawerProgress: 0,
    ...createFeedbackState<WorkspaceMsg>(),
    settingsOpen: false,
    settingsFocusIndex: 0,
    jeditTheme,
    graftInfo: undefined,
    graftLoading: false,
    graftRequestId: 0,
    graftSelectedIndex: 0,
    sourceHighlight: undefined,
    sourceHighlightLoading: false,
    sourceHighlightRequestId: 0,
    titleSceneSeed,
    titleMeshes,
    scenePickerOpen: false,
    scenePickerFocusIndex: 0,
    availableScenes: BUILT_IN_TITLE_SCENE_NAMES,
    columns,
    rows,
    time: 0,
    perfVisible: false,
    lastFrameMs: nowMs,
    frameTimeMs: 0,
    frameTimeHistory: [],
    titleCamera: createTitleCameraState(
      titleMeshes.bunny == null ? titleSceneCameraPlacement(titleSceneSeed) : titleBunnySceneCameraPlacement(),
    ),
    titleRenderMode: TITLE_RENDER_MODE.Braille,
    titleAsciiPalette: TITLE_ASCII_PALETTE.Dense,
    profiler: {
      active: false,
    },
  };
}
