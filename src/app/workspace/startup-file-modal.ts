import { FileEntryKinds, type FileEntry } from "../../ports/file-system.js";
import { FocusPanes } from "../../ui/panel-focus.js";
import type { WorkspaceModel } from "./model.js";
import { clampIndex } from "./viewport.js";

export interface StartupFileModalState {
  readonly startupIntroComplete: boolean;
  readonly startupFileModalOpen: boolean;
  readonly startupFileDrawerProgress: number;
  readonly startupFileModalInput: string;
  readonly startupFileModalSelectedIndex: number;
}

export interface StartupFileModalRow {
  readonly entry: FileEntry;
}

const STARTUP_INTRO_COMPLETE_SECONDS = 7;
const STARTUP_FILE_MODAL_MIN_SELECTION = 0;

export function initialStartupFileModalState(): StartupFileModalState {
  return {
    startupIntroComplete: false,
    startupFileModalOpen: false,
    startupFileDrawerProgress: 0,
    startupFileModalInput: "",
    startupFileModalSelectedIndex: STARTUP_FILE_MODAL_MIN_SELECTION,
  };
}

export function applyStartupIntroTime(model: WorkspaceModel): WorkspaceModel {
  return shouldCompleteStartupIntro(model)
    ? completeStartupIntro(model)
    : model;
}

export function isStartupIntroSkipCandidate(model: WorkspaceModel): boolean {
  return (
    model.editor == null &&
    model.focusPane === FocusPanes.Editor &&
    model.commandLine?.active !== true &&
    !model.scenePickerOpen &&
    !model.settingsOpen &&
    !model.startupIntroComplete &&
    !model.startupFileModalOpen
  );
}

export function isStartupFileModalReopenCandidate(
  model: WorkspaceModel,
): boolean {
  return (
    model.editor == null &&
    model.focusPane === FocusPanes.Editor &&
    model.commandLine?.active !== true &&
    !model.scenePickerOpen &&
    !model.settingsOpen &&
    !model.quitConfirmOpen &&
    model.startupIntroComplete &&
    !model.startupFileModalOpen
  );
}

export function openStartupFileModal(model: WorkspaceModel): WorkspaceModel {
  return {
    ...model,
    startupIntroComplete: true,
    startupFileModalOpen: true,
    startupFileModalSelectedIndex: STARTUP_FILE_MODAL_MIN_SELECTION,
  };
}

export function completeStartupIntro(model: WorkspaceModel): WorkspaceModel {
  return {
    ...model,
    startupIntroComplete: true,
    startupFileModalOpen: false,
  };
}

export function closeStartupFileModal(model: WorkspaceModel): WorkspaceModel {
  return {
    ...model,
    startupFileModalOpen: false,
    startupFileDrawerProgress: 0,
  };
}

export function dismissStartupFileModal(model: WorkspaceModel): WorkspaceModel {
  return {
    ...model,
    startupFileModalOpen: false,
  };
}

export function startupFileModalRows(
  entries: readonly FileEntry[],
): readonly StartupFileModalRow[] {
  return entries
    .filter((entry) => entry.kind !== FileEntryKinds.Parent)
    .map((entry) => ({ entry }));
}

export function startupFileModalSelectedRow(
  model: WorkspaceModel,
): StartupFileModalRow | undefined {
  const rows = startupFileModalRows(model.entries);
  return rows[clampIndex(model.startupFileModalSelectedIndex, rows.length)];
}

export function moveStartupFileModalSelection(
  model: WorkspaceModel,
  delta: number,
): WorkspaceModel {
  const rows = startupFileModalRows(model.entries);
  return {
    ...model,
    startupFileModalSelectedIndex: clampIndex(
      model.startupFileModalSelectedIndex + delta,
      rows.length,
    ),
  };
}

function shouldCompleteStartupIntro(model: WorkspaceModel): boolean {
  return (
    isStartupIntroSkipCandidate(model) &&
    model.time >= STARTUP_INTRO_COMPLETE_SECONDS
  );
}
