import type { Cmd, KeyMsg } from "@flyingrobots/bijou-tui";
import { FileEntryKinds } from "../../ports/file-system.js";
import {
  openWorkspaceFileEntry,
  type UpdateTreeFromKeyDeps,
} from "./file-tree.js";
import type { WorkspaceKeyBindingContext } from "./key-binding-context.js";
import type { WorkspaceModel } from "./model.js";
import type { WorkspaceMsg } from "./msg.js";
import {
  appendStartupFileModalInput,
  backspaceStartupFileModalInput,
  closeStartupFileModal,
  completeStartupIntro,
  dismissStartupFileModal,
  isStartupFileModalReopenCandidate,
  isStartupIntroSkipCandidate,
  moveStartupFileModalSelection,
  startupFileModalSelectedRow,
  updateStartupFileModalInput,
} from "./startup-file-modal.js";
import { WorkspaceKeys } from "./workspace-key.js";

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

const STARTUP_FILE_MODAL_SELECTION_STEP = 1;
const STARTUP_FILE_MODAL_EMPTY_INPUT_LENGTH = 0;
const STARTUP_FILE_MODAL_SINGLE_CHAR_LENGTH = 1;

export function updateStartupFileModalKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  if (isStartupIntroSkipKey(msg) && isStartupIntroSkipCandidate(model)) {
    return [completeStartupIntro(model), []];
  }
  if (
    isStartupFileModalReopenKey(msg) &&
    isStartupFileModalReopenCandidate(model)
  ) {
    return [model, []];
  }
  if (!model.startupFileModalOpen || model.editor != null) {
    return undefined;
  }
  return updateOpenStartupFileModalKey(msg, model, context);
}

function updateOpenStartupFileModalKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  if (msg.key === WorkspaceKeys.Escape) {
    return [
      dismissStartupFileModal(model),
      context.createStartupFileDrawerAnimationCmd(
        model.startupFileDrawerProgress,
        0,
      ),
    ];
  }
  if (msg.key === WorkspaceKeys.Backspace) {
    return [backspaceStartupFileModalInput(model), []];
  }
  if (isStartupFileModalNextKey(msg, model)) {
    return [
      moveStartupFileModalSelection(model, STARTUP_FILE_MODAL_SELECTION_STEP),
      [],
    ];
  }
  if (isStartupFileModalPreviousKey(msg, model)) {
    return [
      moveStartupFileModalSelection(model, -STARTUP_FILE_MODAL_SELECTION_STEP),
      [],
    ];
  }
  if (isStartupFileModalAcceptKey(msg)) {
    return acceptStartupFileModalSelection(model, context.deps);
  }
  const inputText = appendableStartupFileModalText(msg);
  return inputText == null
    ? [model, []]
    : [appendStartupFileModalInput(model, inputText), []];
}

function acceptStartupFileModalSelection(
  model: WorkspaceModel,
  deps: UpdateTreeFromKeyDeps,
): KeyBindingResult {
  const row = startupFileModalSelectedRow(model);
  if (row == null) {
    return [model, []];
  }
  const [opened, commands] = openWorkspaceFileEntry(
    model,
    row.entry,
    () => model.time,
    deps,
  );
  return row.entry.kind === FileEntryKinds.File
    ? [closeStartupFileModal(opened), commands]
    : [updateStartupFileModalInput(opened, ""), commands];
}

function isStartupIntroSkipKey(msg: KeyMsg): boolean {
  return (
    !msg.ctrl &&
    !msg.alt &&
    (msg.key === WorkspaceKeys.Enter ||
      msg.key === WorkspaceKeys.Return ||
      msg.key === WorkspaceKeys.Tab)
  );
}

function isStartupFileModalReopenKey(msg: KeyMsg): boolean {
  return (
    !msg.ctrl &&
    !msg.alt &&
    (msg.key === WorkspaceKeys.Enter ||
      msg.key === WorkspaceKeys.Return ||
      msg.key === WorkspaceKeys.Tab ||
      msg.key === WorkspaceKeys.O)
  );
}

function isStartupFileModalAcceptKey(msg: KeyMsg): boolean {
  return (
    !msg.ctrl &&
    !msg.alt &&
    (msg.key === WorkspaceKeys.Enter || msg.key === WorkspaceKeys.Return)
  );
}

function isStartupFileModalNextKey(
  msg: KeyMsg,
  model: WorkspaceModel,
): boolean {
  return (
    !msg.ctrl &&
    !msg.alt &&
    (msg.key === WorkspaceKeys.ArrowDown ||
      (msg.key === WorkspaceKeys.J && modalInputEmpty(model)))
  );
}

function isStartupFileModalPreviousKey(
  msg: KeyMsg,
  model: WorkspaceModel,
): boolean {
  return (
    !msg.ctrl &&
    !msg.alt &&
    (msg.key === WorkspaceKeys.ArrowUp ||
      (msg.key === WorkspaceKeys.K && modalInputEmpty(model)))
  );
}

function modalInputEmpty(model: WorkspaceModel): boolean {
  return (
    model.startupFileModalInput.length === STARTUP_FILE_MODAL_EMPTY_INPUT_LENGTH
  );
}

function appendableStartupFileModalText(msg: KeyMsg): string | undefined {
  return msg.ctrl ||
    msg.alt ||
    msg.key.length !== STARTUP_FILE_MODAL_SINGLE_CHAR_LENGTH
    ? undefined
    : msg.key;
}
