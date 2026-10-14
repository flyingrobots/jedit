import { createFeedbackState } from "../../ui/feedback.js";
import { FocusPanes, type FocusPane } from "../../ui/panel-focus.js";
import type { WorkspaceModel } from "./model.js";
import type { WorkspaceMsg } from "./msg.js";
import type { I18nPort } from "../../ports/i18n.js";
import type { JeditTheme } from "../../ui/jedit-theme.js";
import type { FileEntry } from "../../ports/file-system.js";
import { ViewModes } from "./view-mode.js";
import { TEXT_RUNTIME_PROFILE_ECHO_HOSTED } from "../text-runtime-profile.js";
import { createWorkspaceTextAuthority } from "./workspace-text-authority.js";
import { emptyWorkspaceBufferRegistry } from "./workspace-buffer-registry.js";
import {
  initialStartupFileModalState,
  INITIAL_WORKSPACE_CAUSAL_GUTTER_BASIS,
  INITIAL_WORKSPACE_LINE_NUMBER_MODE,
  initialWorkspaceCommandLineState,
} from "./initial-workspace-state.js";

const INITIAL_FOCUS_PANE: FocusPane = FocusPanes.Editor;
const INITIAL_VIEW_MODE = ViewModes.Source;
const INITIAL_LINE_NUMBER_MODE: WorkspaceModel["lineNumberMode"] =
  INITIAL_WORKSPACE_LINE_NUMBER_MODE;

export interface WorkspaceInitialModelSnapshot {
  readonly jeditTheme: JeditTheme;
  readonly i18n: I18nPort;
  readonly entries: readonly FileEntry[];
  readonly nowMs: number;
}

export function createInitialModel(
  cwd: string,
  columns: number,
  rows: number,
  snapshot: WorkspaceInitialModelSnapshot,
): WorkspaceModel {
  const { jeditTheme, i18n, entries, nowMs } = snapshot;
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
    columns,
    rows,
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
  };
}

function initialSettingsState() {
  return {
    lineNumberMode: INITIAL_LINE_NUMBER_MODE,
    gutterDimmed: false,
    causalGutterBasis: INITIAL_WORKSPACE_CAUSAL_GUTTER_BASIS,
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

// Bijou re-renders only when update returns a different model reference, so an
// idle tick must return the model it was given. Rebuilding it on every pulse
// cost a full-surface render 60 times a second to produce identical output.
export function workspaceAnimationIsActive(model: WorkspaceModel): boolean {
  return (
    !model.startupIntroComplete ||
    model.profiler.active ||
    model.perfVisible
  );
}
