import type { Cmd, KeyMsg } from "@flyingrobots/bijou-tui";
import {
  INLINE_COMPLETION_ITEM_KIND,
  type InlineCompletionItem,
} from "../../ui/inline-completion-popup.js";
import {
  appendWorkspaceCommandLineInput,
  backspaceWorkspaceCommandLineInput,
  canOpenWorkspaceCommandLine,
  closeWorkspaceCommandLine,
  moveWorkspaceCommandLineCompletion,
  moveWorkspaceCommandLineCursor,
  openWorkspaceCommandLine,
  replaceWorkspaceCommandLineInput,
  workspaceCommandLineReplacementChangesInput,
} from "./command-line.js";
import { dispatchWorkspaceCommandLine } from "./command-line-dispatch.js";
import {
  selectedWorkspaceCommandLineCompletionItem,
  workspaceCommandLineCompletionItems,
} from "./command-completion.js";
import type { WorkspaceKeyBindingContext } from "./key-binding-context.js";
import type { WorkspaceModel } from "./model.js";
import type { WorkspaceMsg } from "./msg.js";
import { WorkspaceKeys } from "./workspace-key.js";

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

const COMMAND_LINE_SINGLE_TEXT_KEY_LENGTH = 1;
const COMMAND_LINE_CURSOR_LEFT_DELTA = -1;
const COMMAND_LINE_CURSOR_RIGHT_DELTA = 1;
const COMMAND_LINE_COMPLETION_PREVIOUS_DELTA = -1;
const COMMAND_LINE_COMPLETION_NEXT_DELTA = 1;
const COMMAND_LINE_SPACE_TEXT = " ";

export function updateCommandLineKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  return updateCommandLineOpenKey(msg, model)
    ?? updateActiveCommandLineKey(msg, model, context);
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
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  return model.commandLine?.active === true
    ? updateCommandLineCloseKey(msg, model)
      ?? updateCommandLineBackspaceKey(msg, model)
      ?? updateCommandLineCursorKey(msg, model)
      ?? updateCommandLineCompletionKey(msg, model)
      ?? updateCommandLineDispatchKey(msg, model, context)
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

function updateCommandLineCompletionKey(
  msg: KeyMsg,
  model: WorkspaceModel,
): KeyBindingResult | undefined {
  const completions = workspaceCommandLineCompletionItems({
    commandLine: model.commandLine,
    entries: model.entries,
  });
  if (isCommandLineCompletionPreviousKey(msg)) {
    return [
      moveWorkspaceCommandLineCompletion(
        model,
        COMMAND_LINE_COMPLETION_PREVIOUS_DELTA,
        completions.length,
      ),
      [],
    ];
  }

  if (isCommandLineCompletionNextKey(msg)) {
    return [
      moveWorkspaceCommandLineCompletion(
        model,
        COMMAND_LINE_COMPLETION_NEXT_DELTA,
        completions.length,
      ),
      [],
    ];
  }

  if (isCommandLineCompletionAcceptKey(msg)) {
    return acceptCommandLineCompletion(model);
  }

  if (isCommandLineCompletionCommitKey(msg)) {
    return acceptChangingCommandLineCompletion(model);
  }

  return undefined;
}

function acceptCommandLineCompletion(
  model: WorkspaceModel,
): KeyBindingResult {
  const selected = selectedWorkspaceCommandLineCompletionItem({
    commandLine: model.commandLine,
    entries: model.entries,
  });
  return selected == null
    ? [model, []]
    : [replaceWorkspaceCommandLineInput(model, selected.replacement), []];
}

function acceptChangingCommandLineCompletion(
  model: WorkspaceModel,
): KeyBindingResult | undefined {
  const selected = selectedWorkspaceCommandLineCompletionItem({
    commandLine: model.commandLine,
    entries: model.entries,
  });
  return selected != null &&
    shouldAcceptChangingCommandLineCompletion(model, selected)
    ? [replaceWorkspaceCommandLineInput(model, selected.replacement), []]
    : undefined;
}

function shouldAcceptChangingCommandLineCompletion(
  model: WorkspaceModel,
  selected: InlineCompletionItem,
): boolean {
  return (
    workspaceCommandLineReplacementChangesInput(model, selected.replacement) &&
    shouldAcceptCommandLineCompletionOnEnter(model, selected)
  );
}

function shouldAcceptCommandLineCompletionOnEnter(
  model: WorkspaceModel,
  selected: InlineCompletionItem,
): boolean {
  return selected.kind !== INLINE_COMPLETION_ITEM_KIND.Command ||
    selected.replacement.text.endsWith(COMMAND_LINE_SPACE_TEXT) ||
    model.commandLine.input.trim().length > COMMAND_LINE_SINGLE_TEXT_KEY_LENGTH;
}

function updateCommandLineDispatchKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  return isCommandLineDispatchKey(msg)
    ? dispatchWorkspaceCommandLine(model, context)
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

function isCommandLineCompletionPreviousKey(msg: KeyMsg): boolean {
  return !msg.ctrl && !msg.alt && msg.key === WorkspaceKeys.ArrowUp;
}

function isCommandLineCompletionNextKey(msg: KeyMsg): boolean {
  return !msg.ctrl && !msg.alt && msg.key === WorkspaceKeys.ArrowDown;
}

function isCommandLineCompletionAcceptKey(msg: KeyMsg): boolean {
  return !msg.ctrl && !msg.alt && msg.key === WorkspaceKeys.Tab;
}

function isCommandLineCompletionCommitKey(msg: KeyMsg): boolean {
  return isCommandLineDispatchKey(msg);
}

function commandLineInputText(msg: KeyMsg): string | undefined {
  if (!msg.ctrl && !msg.alt && msg.key === WorkspaceKeys.Space) {
    return COMMAND_LINE_SPACE_TEXT;
  }
  return msg.ctrl ||
    msg.alt ||
    msg.key.length !== COMMAND_LINE_SINGLE_TEXT_KEY_LENGTH
    ? undefined
    : msg.key;
}
