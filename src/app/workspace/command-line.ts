import type { InlineCompletionReplacement } from "../../ui/inline-completion-popup.js";
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
  readonly anchorCursorIndex?: number;
  readonly selectedCompletionIndex: number;
  readonly dispatchPosture?: CommandLineDispatchPosture;
}

const COMMAND_LINE_INITIAL_CURSOR_INDEX = 0;
const COMMAND_LINE_INITIAL_COMPLETION_INDEX = 0;
const COMMAND_LINE_BACKSPACE_DELETE_COUNT = 1;
const COMMAND_LINE_COMPLETION_MIN_COUNT = 1;
const COMMAND_LINE_TITLE_SCREEN_OPEN = true;

export function initialWorkspaceCommandLineState(): WorkspaceCommandLineState {
  return inactiveWorkspaceCommandLineState();
}

export function openWorkspaceCommandLine(
  model: WorkspaceModel,
): WorkspaceModel {
  return {
    ...model,
    commandLineFilePreview: undefined,
    commandLineFilePreviewRequest: undefined,
    commandLine: {
      ...inactiveWorkspaceCommandLineState(),
      active: true,
      anchorCursorIndex: COMMAND_LINE_INITIAL_CURSOR_INDEX,
    },
  };
}

export function closeWorkspaceCommandLine(
  model: WorkspaceModel,
): WorkspaceModel {
  return {
    ...model,
    commandLineFilePreview: undefined,
    commandLineFilePreviewRequest: undefined,
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

export function moveWorkspaceCommandLineCompletion(
  model: WorkspaceModel,
  delta: number,
  completionCount: number,
): WorkspaceModel {
  if (completionCount < COMMAND_LINE_COMPLETION_MIN_COUNT) {
    return model;
  }

  return {
    ...model,
    commandLine: {
      ...model.commandLine,
      selectedCompletionIndex: Math.max(
        COMMAND_LINE_INITIAL_COMPLETION_INDEX,
        Math.min(
          completionCount - COMMAND_LINE_COMPLETION_MIN_COUNT,
          model.commandLine.selectedCompletionIndex + delta,
        ),
      ),
    },
  };
}

export function replaceWorkspaceCommandLineInput(
  model: WorkspaceModel,
  replacement: InlineCompletionReplacement,
): WorkspaceModel {
  const next = replacedWorkspaceCommandLineInput(
    model.commandLine.input,
    replacement,
  );
  return updateWorkspaceCommandLineInput(
    model,
    next.input,
    next.cursorIndex,
  );
}

export function workspaceCommandLineReplacementChangesInput(
  model: WorkspaceModel,
  replacement: InlineCompletionReplacement,
): boolean {
  const current = model.commandLine.input;
  const next = replacedWorkspaceCommandLineInput(current, replacement);
  return (
    next.input !== current ||
    next.cursorIndex !== model.commandLine.cursorIndex
  );
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
    canOpenWorkspaceCommandLineSurface(model) &&
    model.focusPane === FocusPanes.Editor &&
    model.viewMode === ViewModes.Source &&
    model.commandLine?.active !== true &&
    !model.quitConfirmOpen &&
    !model.settingsOpen &&
    !model.scenePickerOpen &&
    !model.startupFileModalOpen
  );
}

function canOpenWorkspaceCommandLineSurface(model: WorkspaceModel): boolean {
  return model.editor == null
    ? COMMAND_LINE_TITLE_SCREEN_OPEN
    : model.editor.mode === EditorModes.Normal;
}

function updateWorkspaceCommandLineInput(
  model: WorkspaceModel,
  input: string,
  cursorIndex: number,
): WorkspaceModel {
  return {
    ...model,
    commandLineFilePreview: undefined,
    commandLineFilePreviewRequest: undefined,
    commandLine: {
      active: true,
      input,
      cursorIndex,
      anchorCursorIndex:
        model.commandLine.anchorCursorIndex ?? COMMAND_LINE_INITIAL_CURSOR_INDEX,
      selectedCompletionIndex: COMMAND_LINE_INITIAL_COMPLETION_INDEX,
    },
  };
}

function replacedWorkspaceCommandLineInput(
  input: string,
  replacement: InlineCompletionReplacement,
) {
  const start = Math.max(
    COMMAND_LINE_INITIAL_CURSOR_INDEX,
    Math.min(input.length, replacement.start),
  );
  const end = Math.max(start, Math.min(input.length, replacement.end));
  const nextInput = `${input.slice(0, start)}${replacement.text}${input.slice(end)}`;
  return {
    input: nextInput,
    cursorIndex: start + replacement.text.length,
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
