import type { Cmd, KeyMsg } from "@flyingrobots/bijou-tui";
import {
  appendWorkspaceCommandLineInput,
  backspaceWorkspaceCommandLineInput,
  canOpenWorkspaceCommandLine,
  closeWorkspaceCommandLine,
  invalidateWorkspaceCommandLine,
  moveWorkspaceCommandLineCursor,
  openWorkspaceCommandLine,
} from "./command-line.js";
import type { WorkspaceModel } from "./model.js";
import type { WorkspaceMsg } from "./msg.js";
import { WorkspaceKeys } from "./workspace-key.js";

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

const COMMAND_LINE_SINGLE_TEXT_KEY_LENGTH = 1;
const COMMAND_LINE_CURSOR_LEFT_DELTA = -1;
const COMMAND_LINE_CURSOR_RIGHT_DELTA = 1;

export function updateCommandLineKey(
  msg: KeyMsg,
  model: WorkspaceModel,
): KeyBindingResult | undefined {
  return updateCommandLineOpenKey(msg, model)
    ?? updateActiveCommandLineKey(msg, model);
}

function updateCommandLineOpenKey(
  msg: KeyMsg,
  model: WorkspaceModel,
): KeyBindingResult | undefined {
  if (isCommandLineOpenKey(msg) && canOpenWorkspaceCommandLine(model)) {
    return [openWorkspaceCommandLine(model), []];
  }
  return undefined;
}

function updateActiveCommandLineKey(
  msg: KeyMsg,
  model: WorkspaceModel,
): KeyBindingResult | undefined {
  return model.commandLine?.active === true
    ? updateCommandLineCloseKey(msg, model)
      ?? updateCommandLineBackspaceKey(msg, model)
      ?? updateCommandLineCursorKey(msg, model)
      ?? updateCommandLineDispatchKey(msg, model)
      ?? updateCommandLineTextKey(msg, model)
    : undefined;
}

function updateCommandLineCloseKey(
  msg: KeyMsg,
  model: WorkspaceModel,
): KeyBindingResult | undefined {
  return msg.key === WorkspaceKeys.Escape
    ? [closeWorkspaceCommandLine(model), []]
    : undefined;
}

function updateCommandLineBackspaceKey(
  msg: KeyMsg,
  model: WorkspaceModel,
): KeyBindingResult | undefined {
  return msg.key === WorkspaceKeys.Backspace
    ? [backspaceWorkspaceCommandLineInput(model), []]
    : undefined;
}

function updateCommandLineCursorKey(
  msg: KeyMsg,
  model: WorkspaceModel,
): KeyBindingResult | undefined {
  if (msg.key === WorkspaceKeys.ArrowLeft) {
    return [moveWorkspaceCommandLineCursor(model, COMMAND_LINE_CURSOR_LEFT_DELTA), []];
  }
  return msg.key === WorkspaceKeys.ArrowRight
    ? [moveWorkspaceCommandLineCursor(model, COMMAND_LINE_CURSOR_RIGHT_DELTA), []]
    : undefined;
}

function updateCommandLineDispatchKey(
  msg: KeyMsg,
  model: WorkspaceModel,
): KeyBindingResult | undefined {
  return isCommandLineDispatchKey(msg)
    ? [invalidateWorkspaceCommandLine(model), []]
    : undefined;
}

function updateCommandLineTextKey(
  msg: KeyMsg,
  model: WorkspaceModel,
): KeyBindingResult {
  const text = commandLineInputText(msg);
  return text == null
    ? [model, []]
    : [appendWorkspaceCommandLineInput(model, text), []];
}

function isCommandLineOpenKey(msg: KeyMsg): boolean {
  return !msg.ctrl && !msg.alt && msg.key === WorkspaceKeys.Colon;
}

function isCommandLineDispatchKey(msg: KeyMsg): boolean {
  return (
    !msg.ctrl &&
    !msg.alt &&
    (msg.key === WorkspaceKeys.Enter || msg.key === WorkspaceKeys.Return)
  );
}

function commandLineInputText(msg: KeyMsg): string | undefined {
  return msg.ctrl ||
    msg.alt ||
    msg.key.length !== COMMAND_LINE_SINGLE_TEXT_KEY_LENGTH
    ? undefined
    : msg.key;
}
