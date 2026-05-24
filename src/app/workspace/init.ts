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
import type { TextRuntimeProfile } from '../text-runtime-profile.js';
import { TEXT_RUNTIME_PROFILE_ECHO_HOSTED } from '../text-runtime-profile.js';
import { createWorkspaceTextAuthority } from './workspace-text-authority.js';

const INITIAL_FOCUS_PANE: FocusPane = FocusPanes.Editor;
const INITIAL_VIEW_MODE = ViewModes.Source;

export interface WorkspaceInitialModelSnapshot {
  readonly titleSceneSeed: number;
  readonly jeditTheme: JeditTheme;
  readonly i18n: I18nPort;
  readonly entries: readonly FileEntry[];
  readonly titleMeshes?: TitleMeshLibrary;
  readonly nowMs: number;
  readonly textRuntimeProfile?: TextRuntimeProfile;
}

export function createInitialModel(
  cwd: string,
  columns: number,
  rows: number,
  snapshot: WorkspaceInitialModelSnapshot,
): WorkspaceModel {
  const { titleSceneSeed, jeditTheme, i18n, entries, nowMs } = snapshot;
  const titleMeshes = snapshot.titleMeshes ?? {};
  const textRuntimeProfile = snapshot.textRuntimeProfile ?? TEXT_RUNTIME_PROFILE_ECHO_HOSTED;
  return {
    i18n,
    workspaceRoot: cwd,
    cwd,
    entries,
    selectedIndex: 0,
    editor: undefined,
    textRuntimeProfile,
    textAuthority: createWorkspaceTextAuthority(textRuntimeProfile),
    viewMode: INITIAL_VIEW_MODE,
    focusPane: INITIAL_FOCUS_PANE,
    ...initialDrawerState(),
    ...createFeedbackState<WorkspaceMsg>(),
    ...initialSettingsState(),
    jeditTheme,
    ...initialGraftState(),
    ...initialSourceHighlightState(),
    titleSceneSeed,
    titleMeshes,
    columns,
    rows,
    ...initialSceneState(titleSceneSeed, titleMeshes),
    ...initialRuntimeState(nowMs),
  };
}

function initialDrawerState() {
  return {
    fileDrawerOpen: false,
    fileDrawerProgress: 0,
    graftDrawerOpen: false,
    graftDrawerProgress: 0,
  };
}

function initialSettingsState() {
  return {
    settingsOpen: false,
    settingsFocusIndex: 0,
  };
}

function initialGraftState() {
  return {
    graftInfo: undefined,
    graftLoading: false,
    graftRequestId: 0,
    graftSelectedIndex: 0,
  };
}

function initialSourceHighlightState() {
  return {
    sourceHighlight: undefined,
    sourceHighlightLoading: false,
    sourceHighlightRequestId: 0,
  };
}

function initialRuntimeState(nowMs: number) {
  return {
    time: 0,
    perfVisible: false,
    lastFrameMs: nowMs,
    frameTimeMs: 0,
    frameTimeHistory: [],
    profiler: {
      active: false,
    },
  };
}

function initialSceneState(titleSceneSeed: number, titleMeshes: TitleMeshLibrary) {
  return {
    scenePickerOpen: false,
    scenePickerFocusIndex: 0,
    availableScenes: BUILT_IN_TITLE_SCENE_NAMES,
    titleCamera: createTitleCameraState(
      titleMeshes.bunny == null ? titleSceneCameraPlacement(titleSceneSeed) : titleBunnySceneCameraPlacement(),
    ),
    titleRenderMode: TITLE_RENDER_MODE.Braille,
    titleAsciiPalette: TITLE_ASCII_PALETTE.Dense,
  };
}
