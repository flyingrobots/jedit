import type { Cmd, KeyMsg } from "@flyingrobots/bijou-tui";
import {
  INLINE_COMPLETION_ITEM_KIND,
  type InlineCompletionItem,
} from "../../ui/inline-completion-popup.js";
import { FileEntryKinds } from "../../ports/file-system.js";
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
  selectedWorkspaceCommandLineFileCompletion,
  selectedWorkspaceCommandLineCompletionItem,
  workspaceCommandLineCompletionItems,
} from "./command-completion.js";
import {
  clearWorkspaceCommandLineFilePreview,
  createWorkspaceCommandLineFilePreviewCmd,
  selectedWorkspaceCommandLineFilePreviewSelection,
  type WorkspaceCommandLineFilePreviewSelection,
  workspaceEditorFilePreviewSource,
} from "./command-completion-preview.js";
import { validateWorkspaceCommandLineInput } from "./command-line-validation.js";
import type { WorkspaceKeyBindingContext } from "./key-binding-context.js";
import type { WorkspaceModel } from "./model.js";
import {
  workspaceCommandLineFilePreviewMessage,
  type WorkspaceMsg,
} from "./msg.js";
import { openWorkspaceFileEntry } from "./file-tree.js";
import { WorkspaceKeys } from "./workspace-key.js";
import { workspaceHasOpenFile } from "./workspace-model-query.js";

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
  const result = model.commandLine?.active === true
    ? updateCommandLineCloseKey(msg, model)
      ?? updateCommandLineBackspaceKey(msg, model)
      ?? updateCommandLineCursorKey(msg, model)
      ?? updateCommandLineCompletionKey(msg, model, context)
      ?? updateCommandLineDispatchKey(msg, model, context)
      ?? updateCommandLineTextKey(msg, model)
    : undefined;
  return result == null
    ? undefined
    : withCommandLineFilePreviewRefresh(result, context);
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
    ? [
        validateWorkspaceCommandLineInput(
          backspaceWorkspaceCommandLineInput(model),
        ),
        [],
      ]
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
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  const completions = workspaceCommandLineCompletionItems({
    commandLine: model.commandLine,
    entries: model.entries,
    hasOpenFile: workspaceHasOpenFile(model),
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
    return commitCommandLineCompletion(model, context);
  }

  return undefined;
}

function acceptCommandLineCompletion(
  model: WorkspaceModel,
): KeyBindingResult {
  const selected = selectedWorkspaceCommandLineCompletionItem({
    commandLine: model.commandLine,
    entries: model.entries,
    hasOpenFile: workspaceHasOpenFile(model),
  });
  return selected == null
    ? [model, []]
    : [replaceWorkspaceCommandLineInput(model, selected.replacement), []];
}

function commitCommandLineCompletion(
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  return openSelectedEditDirectoryCompletion(model, context)
    ?? acceptChangingCommandLineCompletion(model);
}

function openSelectedEditDirectoryCompletion(
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  const selected = selectedWorkspaceCommandLineFileCompletion({
    commandLine: model.commandLine,
    entries: model.entries,
    hasOpenFile: workspaceHasOpenFile(model),
  });
  if (
    selected == null ||
    (
      selected.entry.kind !== FileEntryKinds.Directory &&
      selected.entry.kind !== FileEntryKinds.Parent
    )
  ) {
    return undefined;
  }

  return openWorkspaceFileEntry(
    clearEditCommandLineArgument(model, selected.item),
    selected.entry,
    context.nowMs,
    context.deps,
  );
}

function clearEditCommandLineArgument(
  model: WorkspaceModel,
  selected: InlineCompletionItem,
): WorkspaceModel {
  return replaceWorkspaceCommandLineInput(model, {
    ...selected.replacement,
    text: "",
  });
}

function acceptChangingCommandLineCompletion(
  model: WorkspaceModel,
): KeyBindingResult | undefined {
  const selected = selectedWorkspaceCommandLineCompletionItem({
    commandLine: model.commandLine,
    entries: model.entries,
    hasOpenFile: workspaceHasOpenFile(model),
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
    !commandCompletionOnlyChangesCase(model, selected) &&
    shouldAcceptCommandLineCompletionOnEnter(model, selected)
  );
}

function commandCompletionOnlyChangesCase(
  model: WorkspaceModel,
  selected: InlineCompletionItem,
): boolean {
  if (selected.kind !== INLINE_COMPLETION_ITEM_KIND.Command) {
    return false;
  }
  const input = model.commandLine.input;
  const start = Math.max(
    0,
    Math.min(input.length, selected.replacement.start),
  );
  const end = Math.max(start, Math.min(input.length, selected.replacement.end));
  const current = input.slice(start, end);
  return current !== selected.replacement.text &&
    current.toLowerCase() === selected.replacement.text.toLowerCase();
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
    : [
        validateWorkspaceCommandLineInput(
          appendWorkspaceCommandLineInput(model, text),
        ),
        [],
      ];
}

function withCommandLineFilePreviewRefresh(
  result: KeyBindingResult,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  const [model, commands] = result;
  if (!model.commandLine.active) {
    return [clearWorkspaceCommandLineFilePreview(model), commands];
  }

  const selection = selectedWorkspaceCommandLineFilePreviewSelection({
    commandLine: model.commandLine,
    entries: model.entries,
    hasOpenFile: workspaceHasOpenFile(model),
  });
  if (selection == null) {
    return [clearWorkspaceCommandLineFilePreview(model), commands];
  }
  return commandLineFilePreviewAlreadyRequested(model, selection)
    ? result
    : requestCommandLineFilePreview(model, commands, selection, context);
}

function commandLineFilePreviewAlreadyRequested(
  model: WorkspaceModel,
  selection: WorkspaceCommandLineFilePreviewSelection,
): boolean {
  return (
    model.commandLineFilePreview?.identity === selection.identity ||
    model.commandLineFilePreviewRequest?.identity === selection.identity
  );
}

function requestCommandLineFilePreview(
  model: WorkspaceModel,
  commands: readonly Cmd<WorkspaceMsg>[],
  selection: WorkspaceCommandLineFilePreviewSelection,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  const requestId = model.commandLineFilePreviewRequestId + 1;
  return [
    {
      ...model,
      commandLineFilePreview: undefined,
      commandLineFilePreviewRequestId: requestId,
      commandLineFilePreviewRequest: selection,
    },
    [
      ...commands,
      createWorkspaceCommandLineFilePreviewCmd({
        requestId,
        selection,
        previewSource: workspaceEditorFilePreviewSource(
          context.deps.editorFile,
        ),
        mapMessage: workspaceCommandLineFilePreviewMessage,
      }),
    ],
  ];
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
