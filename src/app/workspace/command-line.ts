import { FocusPanes } from "../../ui/panel-focus.js";
import type { WorkspaceModel } from "./model.js";
import { EditorModes } from "./editor/mode.js";
import { ViewModes } from "./view-mode.js";

export const CommandLineDispatchPostureKinds = Object.freeze({
  Invalid: "invalid",
} as const);

export type CommandLineDispatchPostureKind =
  (typeof CommandLineDispatchPostureKinds)[keyof typeof CommandLineDispatchPostureKinds];

export interface CommandLineInvalidDispatchPosture {
  readonly kind: typeof CommandLineDispatchPostureKinds.Invalid;
  readonly input: string;
}

export type CommandLineDispatchPosture = CommandLineInvalidDispatchPosture;

export interface WorkspaceCommandLineState {
  readonly active: boolean;
  readonly input: string;
  readonly cursorIndex: number;
  readonly selectedCompletionIndex: number;
  readonly dispatchPosture?: CommandLineDispatchPosture;
}

const COMMAND_LINE_INITIAL_CURSOR_INDEX = 0;
const COMMAND_LINE_INITIAL_COMPLETION_INDEX = 0;
const COMMAND_LINE_BACKSPACE_DELETE_COUNT = 1;

export function initialWorkspaceCommandLineState(): WorkspaceCommandLineState {
  return inactiveWorkspaceCommandLineState();
}

export function openWorkspaceCommandLine(
  model: WorkspaceModel,
): WorkspaceModel {
  return {
    ...model,
    commandLine: {
      ...inactiveWorkspaceCommandLineState(),
      active: true,
    },
  };
}

export function closeWorkspaceCommandLine(
  model: WorkspaceModel,
): WorkspaceModel {
  return {
    ...model,
    commandLine: inactiveWorkspaceCommandLineState(),
  };
}

export function appendWorkspaceCommandLineInput(
  model: WorkspaceModel,
  text: string,
): WorkspaceModel {
  const before = model.commandLine.input.slice(
    0,
    model.commandLine.cursorIndex,
  );
  const after = model.commandLine.input.slice(model.commandLine.cursorIndex);
  return updateWorkspaceCommandLineInput(
    model,
    `${before}${text}${after}`,
    model.commandLine.cursorIndex + text.length,
  );
}

export function backspaceWorkspaceCommandLineInput(
  model: WorkspaceModel,
): WorkspaceModel {
  if (model.commandLine.cursorIndex === COMMAND_LINE_INITIAL_CURSOR_INDEX) {
    return model;
  }
  const nextCursorIndex =
    model.commandLine.cursorIndex - COMMAND_LINE_BACKSPACE_DELETE_COUNT;
  return updateWorkspaceCommandLineInput(
    model,
    `${model.commandLine.input.slice(0, nextCursorIndex)}${model.commandLine.input.slice(model.commandLine.cursorIndex)}`,
    nextCursorIndex,
  );
}

export function moveWorkspaceCommandLineCursor(
  model: WorkspaceModel,
  delta: number,
): WorkspaceModel {
  return {
    ...model,
    commandLine: {
      ...model.commandLine,
      cursorIndex: Math.max(
        COMMAND_LINE_INITIAL_CURSOR_INDEX,
        Math.min(
          model.commandLine.input.length,
          model.commandLine.cursorIndex + delta,
        ),
      ),
    },
  };
}

export function invalidateWorkspaceCommandLine(
  model: WorkspaceModel,
): WorkspaceModel {
  return {
    ...model,
    commandLine: {
      ...model.commandLine,
      dispatchPosture: {
        kind: CommandLineDispatchPostureKinds.Invalid,
        input: model.commandLine.input,
      },
    },
  };
}

export function canOpenWorkspaceCommandLine(model: WorkspaceModel): boolean {
  return (
    model.editor?.mode === EditorModes.Normal &&
    model.focusPane === FocusPanes.Editor &&
    model.viewMode === ViewModes.Source &&
    model.commandLine?.active !== true &&
    !model.quitConfirmOpen &&
    !model.settingsOpen &&
    !model.scenePickerOpen &&
    !model.startupFileModalOpen
  );
}

function updateWorkspaceCommandLineInput(
  model: WorkspaceModel,
  input: string,
  cursorIndex: number,
): WorkspaceModel {
  return {
    ...model,
    commandLine: {
      active: true,
      input,
      cursorIndex,
      selectedCompletionIndex: COMMAND_LINE_INITIAL_COMPLETION_INDEX,
    },
  };
}

function inactiveWorkspaceCommandLineState(): WorkspaceCommandLineState {
  return {
    active: false,
    input: "",
    cursorIndex: COMMAND_LINE_INITIAL_CURSOR_INDEX,
    selectedCompletionIndex: COMMAND_LINE_INITIAL_COMPLETION_INDEX,
  };
}
