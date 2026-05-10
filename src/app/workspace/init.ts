import { BijouI18nAdapter } from '../../adapters/bijou-i18n-adapter.js';
import { loadEntries } from '../../adapters/filesystem.js';
import { createTitleCameraState } from '../title-camera-session.js';
import { createFeedbackState } from '../../ui/feedback.js';
import { JEDIT_THEME_ENV, resolveInitialJeditTheme } from '../../ui/jedit-themes.js';
import { titleBunnySceneCameraPlacement, titleSceneCameraPlacement } from '../../ui/title-scene.js';
import { loadStartupTitleMesh } from './title-mesh.js';
import type { FocusPane } from '../../ui/panel-focus.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';

export function createInitialModel(cwd: string, columns: number, rows: number): WorkspaceModel {
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
    ...createFeedbackState<WorkspaceMsg>(),
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
    titleCamera: createTitleCameraState(
      titleMesh == null ? titleSceneCameraPlacement(titleSceneSeed) : titleBunnySceneCameraPlacement(),
    ),
    profiler: {
      active: false,
    },
  };
}
