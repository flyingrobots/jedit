import { loadEntries } from '../../adapters/filesystem.js';
import { createTitleCameraState } from '../title-camera-session.js';
import { createFeedbackState } from '../../ui/feedback.js';
import { titleBunnySceneCameraPlacement, titleSceneCameraPlacement } from '../../ui/title-scene.js';
import { loadStartupTitleMesh } from './title-mesh.js';
import type { FocusPane } from '../../ui/panel-focus.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import type { I18nPort } from '../../ports/i18n.js';
import type { JeditTheme } from '../../ui/jedit-theme.js';

export interface WorkspaceInitialModelSnapshot {
  readonly titleSceneSeed: number;
  readonly jeditTheme: JeditTheme;
  readonly i18n: I18nPort;
  readonly nowMs: number;
}

export function createInitialModel(
  cwd: string,
  columns: number,
  rows: number,
  snapshot: WorkspaceInitialModelSnapshot,
): WorkspaceModel {
  const { titleSceneSeed, jeditTheme, i18n, nowMs } = snapshot;
  const titleMesh = loadStartupTitleMesh();
  return {
    i18n,
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
    titleMesh,
    scenePickerOpen: false,
    scenePickerFocusIndex: 0,
    availableScenes: ['bunny.jedit-scene', 'sphere.jedit-scene', 'column.jedit-scene', 'sphere-ground.jedit-scene'],
    columns,
    rows,
    time: 0,
    perfVisible: false,
    lastFrameMs: nowMs,
    frameTimeMs: 0,
    frameTimeHistory: [],
    titleCamera: createTitleCameraState(
      titleMesh == null ? titleSceneCameraPlacement(titleSceneSeed) : titleBunnySceneCameraPlacement(),
    ),
    profiler: {
      active: false,
    },
  };
}
