import { FileEntryKinds, type FileEntry } from '../../ports/file-system.js';
import { FocusPanes } from '../../ui/panel-focus.js';
import type { WorkspaceModel } from './model.js';
import { clampIndex } from './viewport.js';

export interface StartupFileModalState {
  readonly startupIntroComplete: boolean;
  readonly startupFileModalOpen: boolean;
  readonly startupFileModalInput: string;
  readonly startupFileModalSelectedIndex: number;
}

export interface StartupFileModalRow {
  readonly entry: FileEntry;
}

const STARTUP_INTRO_COMPLETE_SECONDS = 7;
const STARTUP_FILE_MODAL_MIN_SELECTION = 0;
const STARTUP_FILE_MODAL_BACKSPACE_DELETE_COUNT = 1;

export function initialStartupFileModalState(): StartupFileModalState {
  return {
    startupIntroComplete: false,
    startupFileModalOpen: false,
    startupFileModalInput: '',
    startupFileModalSelectedIndex: STARTUP_FILE_MODAL_MIN_SELECTION,
  };
}

export function applyStartupIntroTime(model: WorkspaceModel): WorkspaceModel {
  return shouldAutoOpenStartupFileModal(model)
    ? openStartupFileModal(model)
    : model;
}

export function isStartupIntroSkipCandidate(model: WorkspaceModel): boolean {
  return model.editor == null
    && model.focusPane === FocusPanes.Editor
    && !model.scenePickerOpen
    && !model.settingsOpen
    && !model.startupIntroComplete
    && !model.startupFileModalOpen;
}

export function openStartupFileModal(model: WorkspaceModel): WorkspaceModel {
  return {
    ...model,
    startupIntroComplete: true,
    startupFileModalOpen: true,
    startupFileModalSelectedIndex: STARTUP_FILE_MODAL_MIN_SELECTION,
  };
}

export function closeStartupFileModal(model: WorkspaceModel): WorkspaceModel {
  return {
    ...model,
    startupFileModalOpen: false,
  };
}

export function startupFileModalRows(
  entries: readonly FileEntry[],
  input: string,
): readonly StartupFileModalRow[] {
  const normalizedInput = normalizeStartupFileFilter(input);
  return entries
    .filter((entry) => entry.kind !== FileEntryKinds.Parent)
    .filter((entry) => normalizedInput.length === 0 || normalizeStartupFileFilter(entry.name).includes(normalizedInput))
    .map((entry) => ({ entry }));
}

export function startupFileModalSelectedRow(model: WorkspaceModel): StartupFileModalRow | undefined {
  const rows = startupFileModalRows(model.entries, model.startupFileModalInput);
  return rows[clampIndex(model.startupFileModalSelectedIndex, rows.length)];
}

export function updateStartupFileModalInput(
  model: WorkspaceModel,
  input: string,
): WorkspaceModel {
  return {
    ...model,
    startupFileModalInput: input,
    startupFileModalSelectedIndex: STARTUP_FILE_MODAL_MIN_SELECTION,
  };
}

export function appendStartupFileModalInput(model: WorkspaceModel, text: string): WorkspaceModel {
  return updateStartupFileModalInput(model, `${model.startupFileModalInput}${text}`);
}

export function backspaceStartupFileModalInput(model: WorkspaceModel): WorkspaceModel {
  return updateStartupFileModalInput(
    model,
    model.startupFileModalInput.slice(0, -STARTUP_FILE_MODAL_BACKSPACE_DELETE_COUNT),
  );
}

export function moveStartupFileModalSelection(model: WorkspaceModel, delta: number): WorkspaceModel {
  const rows = startupFileModalRows(model.entries, model.startupFileModalInput);
  return {
    ...model,
    startupFileModalSelectedIndex: clampIndex(model.startupFileModalSelectedIndex + delta, rows.length),
  };
}

function shouldAutoOpenStartupFileModal(model: WorkspaceModel): boolean {
  return isStartupIntroSkipCandidate(model)
    && model.time >= STARTUP_INTRO_COMPLETE_SECONDS;
}

function normalizeStartupFileFilter(value: string): string {
  return value.toLocaleLowerCase();
}
