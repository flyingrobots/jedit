import { createTitleCameraState } from "../title-camera-session.js";
import { createFeedbackState } from "../../ui/feedback.js";
import {
  titleBunnySceneCameraPlacement,
  titleSceneCameraPlacement,
  type TitleScene,
} from "../../ui/title-scene.js";
import {
  TITLE_ASCII_PALETTE,
  TITLE_RENDER_MODE,
} from "../../ui/title-screen.js";
import { FocusPanes, type FocusPane } from "../../ui/panel-focus.js";
import type { TitleMeshLibrary } from "../../ui/title-mesh-library.js";
import type { WorkspaceModel } from "./model.js";
import type { WorkspaceMsg } from "./msg.js";
import type { I18nPort } from "../../ports/i18n.js";
import {
  BUILT_IN_TITLE_SCENE_NAMES,
  type BuiltInTitleSceneName,
} from "../../ports/title-scene-loader.js";
import type { JeditTheme } from "../../ui/jedit-theme.js";
import type { FileEntry } from "../../ports/file-system.js";
import { ViewModes } from "./view-mode.js";
import { TEXT_RUNTIME_PROFILE_ECHO_HOSTED } from "../text-runtime-profile.js";
import {
  unrecoveredJeditWscStartupRecovery,
  type JeditWscStartupRecoveryResult,
} from "../jedit-wsc-startup-recovery.js";
import { createWorkspaceTextAuthority } from "./workspace-text-authority.js";
import { emptyWorkspaceBufferRegistry } from "./workspace-buffer-registry.js";
import {
  initialStartupFileModalState,
  initialWorkspaceCommandLineState,
  initialWorkspaceWorldlineState,
  WorkspaceHistoryDrawerViews,
} from "./initial-workspace-state.js";

export { recoverJeditWorkspaceFromWsc } from "../jedit-wsc-startup-recovery.js";

const INITIAL_FOCUS_PANE: FocusPane = FocusPanes.Editor;
const INITIAL_VIEW_MODE = ViewModes.Source;
const INITIAL_LINE_NUMBER_MODE: WorkspaceModel["lineNumberMode"] = "absolute";

export interface WorkspaceInitialModelSnapshot {
  readonly titleSceneSeed: number;
  readonly jeditTheme: JeditTheme;
  readonly i18n: I18nPort;
  readonly entries: readonly FileEntry[];
  readonly titleMeshes?: TitleMeshLibrary;
  readonly sceneOverride?: TitleScene;
  readonly sceneOverrideName?: BuiltInTitleSceneName;
  readonly nowMs: number;
  readonly wscStartupRecovery?: JeditWscStartupRecoveryResult;
}

export function createInitialModel(
  cwd: string,
  columns: number,
  rows: number,
  snapshot: WorkspaceInitialModelSnapshot,
): WorkspaceModel {
  const { titleSceneSeed, jeditTheme, i18n, entries, nowMs } = snapshot;
  const titleMeshes = snapshot.titleMeshes ?? {};
  const textRuntimeProfile = TEXT_RUNTIME_PROFILE_ECHO_HOSTED;
  return {
    i18n,
    workspaceRoot: cwd,
    cwd,
    entries,
    selectedIndex: 0,
    editor: undefined,
    ...initialBufferRegistryState(),
    textRuntimeProfile,
    textAuthority: createWorkspaceTextAuthority(textRuntimeProfile),
    wscStartupRecovery:
      snapshot.wscStartupRecovery ?? unrecoveredJeditWscStartupRecovery(),
    textRequestId: 0,
    viewMode: INITIAL_VIEW_MODE,
    focusPane: INITIAL_FOCUS_PANE,
    ...initialDrawerState(),
    ...initialStartupFileModalState(),
    commandLine: initialWorkspaceCommandLineState(),
    ...createFeedbackState<WorkspaceMsg>(),
    ...initialShellState(),
    ...initialSettingsState(),
    jeditTheme,
    ...initialGraftState(),
    ...initialSourceHighlightState(),
    ...initialCommandLineFilePreviewState(),
    titleSceneSeed,
    titleMeshes,
    columns,
    rows,
    ...initialSceneStateFromSnapshot(titleSceneSeed, titleMeshes, snapshot),
    ...initialRuntimeState(nowMs),
  };
}

function initialBufferRegistryState() {
  return {
    buffers: emptyWorkspaceBufferRegistry(),
    activeBufferId: undefined,
  };
}

function initialDrawerState() {
  return {
    fileDrawerOpen: false,
    fileDrawerProgress: 0,
    graftDrawerOpen: false,
    graftDrawerProgress: 0,
    historyDrawerOpen: false,
    historyDrawerProgress: 0,
    echoHistory: [],
    echoHistorySelectedIndex: 0,
    historyDrawerView: WorkspaceHistoryDrawerViews.Echo,
    worldline: initialWorkspaceWorldlineState(),
  };
}

function initialSettingsState() {
  return {
    lineNumberMode: INITIAL_LINE_NUMBER_MODE,
    settingsOpen: false,
    settingsFocusIndex: 0,
    settingsDiagnosticsOpen: false,
  };
}

function initialShellState() {
  return {
    quitConfirmOpen: false,
    quitAfterSaveRequestId: undefined,
  };
}

function initialGraftState() {
  return {
    graftDiagnostics: undefined,
    graftDiagnosticsLoading: false,
    graftDiagnosticsRequestId: 0,
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

function initialCommandLineFilePreviewState() {
  return {
    commandLineFilePreview: undefined,
    commandLineFilePreviewRequestId: 0,
    commandLineFilePreviewRequest: undefined,
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

function initialSceneStateFromSnapshot(
  titleSceneSeed: number,
  titleMeshes: TitleMeshLibrary,
  snapshot: WorkspaceInitialModelSnapshot,
) {
  return initialSceneState(
    titleSceneSeed,
    titleMeshes,
    snapshot.sceneOverride,
    snapshot.sceneOverrideName,
  );
}

function initialSceneState(
  titleSceneSeed: number,
  titleMeshes: TitleMeshLibrary,
  sceneOverride?: TitleScene,
  sceneOverrideName?: BuiltInTitleSceneName,
) {
  const cameraPlacement =
    sceneOverride?.camera ??
    (titleMeshes.bunny == null
      ? titleSceneCameraPlacement(titleSceneSeed)
      : titleBunnySceneCameraPlacement());
  return {
    scenePickerOpen: false,
    scenePickerFocusIndex: 0,
    availableScenes: BUILT_IN_TITLE_SCENE_NAMES,
    ...(sceneOverrideName == null ? {} : { titleSceneName: sceneOverrideName }),
    ...(sceneOverride == null ? {} : { sceneOverride }),
    titleCamera: createTitleCameraState(cameraPlacement),
    titleMouseLook: undefined,
    titleRenderMode: TITLE_RENDER_MODE.Braille,
    titleAsciiPalette: TITLE_ASCII_PALETTE.Dense,
    titleMeshMaterialIndex: 0,
  };
}
