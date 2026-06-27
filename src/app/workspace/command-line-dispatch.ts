import { quit, type Cmd } from "@flyingrobots/bijou-tui";
import {
  NotificationPlacements,
  NotificationTones,
  NotificationVariants,
  pushNotificationToast,
} from "../../ui/feedback.js";
import { FileEntryKinds, type FileEntry } from "../../ports/file-system.js";
import { explainLastJeditCommand } from "./command-provenance.js";
import {
  closeWorkspaceCommandLine,
  invalidateWorkspaceCommandLine,
} from "./command-line.js";
import { openWorkspaceFileEntry } from "./file-tree.js";
import type { WorkspaceKeyBindingContext } from "./key-binding-context.js";
import type { WorkspaceModel } from "./model.js";
import type { WorkspaceMsg } from "./msg.js";
import { WorkspaceCommandNames } from "./workspace-command-names.js";
import {
  hasUnresolvedProductionTextIntent,
  saveWorkspace,
} from "./workspace-save-key.js";
import { WorkspaceTextAuthorityKinds } from "./workspace-text-authority.js";
import { dispatchWorldlineCommand } from "./worldline-command-dispatch.js";

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

interface ParsedWorkspaceCommandLine {
  readonly name: string;
  readonly argument: string;
}

const EMPTY_COMMAND_ARGUMENT = "";
const NO_WHITESPACE_INDEX = -1;
const DIRECTORY_LABEL_SUFFIX = "/";
const PARENT_DIRECTORY_LABEL = "../";
const WHY_REPORT_OBSTRUCTION_KIND = "obstruction";

export function dispatchWorkspaceCommandLine(
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  const command = parseWorkspaceCommandLine(model.commandLine.input);
  if (command == null) {
    return [invalidateWorkspaceCommandLine(model), []];
  }
  if (isEditCommand(command.name)) {
    return dispatchEditCommand(model, command.argument, context);
  }
  const worldlineCommand = dispatchWorldlineCommand(model, command);
  if (worldlineCommand != null) {
    return worldlineCommand;
  }
  if (!hasNoArgument(command)) {
    return [invalidateWorkspaceCommandLine(model), []];
  }
  return dispatchNoArgumentCommand(model, command, context);
}

function dispatchNoArgumentCommand(
  model: WorkspaceModel,
  command: ParsedWorkspaceCommandLine,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  if (isWriteCommand(command.name)) {
    return saveWorkspace(closeWorkspaceCommandLine(model), context);
  }
  if (isQuitCommand(command.name)) {
    return dispatchQuitCommand(model);
  }
  if (isForceQuitCommand(command.name)) {
    return [closeWorkspaceCommandLine(model), [quit<WorkspaceMsg>()]];
  }
  if (isWhyCommand(command.name)) {
    return dispatchWhyCommand(model, context);
  }
  return isWriteQuitCommand(command.name)
    ? dispatchWriteQuitCommand(model, context)
    : [invalidateWorkspaceCommandLine(model), []];
}

function dispatchEditCommand(
  model: WorkspaceModel,
  argument: string,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  if (argument.length === 0) {
    return [invalidateWorkspaceCommandLine(model), []];
  }

  return openWorkspaceFileEntry(
    closeWorkspaceCommandLine(model),
    editCommandFileEntry(model, argument, context),
    context.nowMs,
    context.deps,
  );
}

function dispatchQuitCommand(model: WorkspaceModel): KeyBindingResult {
  return [
    {
      ...closeWorkspaceCommandLine(model),
      quitConfirmOpen: true,
    },
    [],
  ];
}

function dispatchWriteQuitCommand(
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  const baseModel = closeWorkspaceCommandLine(model);
  const blocksQuit = hasUnresolvedProductionTextIntent(baseModel);
  const [savedModel, commands] = saveWorkspace(
    baseModel,
    context,
  );
  if (blocksQuit) {
    return [savedModel, commands];
  }
  if (shouldDeferWriteQuit(baseModel, savedModel)) {
    return [
      {
        ...savedModel,
        quitConfirmOpen: false,
        quitAfterSaveRequestId: savedModel.textRequestId,
      },
      commands,
    ];
  }
  return [
    {
      ...savedModel,
      quitConfirmOpen: true,
    },
    commands,
  ];
}

function shouldDeferWriteQuit(
  beforeSave: WorkspaceModel,
  savedModel: WorkspaceModel,
): boolean {
  return (
    savedModel.textAuthority.kind === WorkspaceTextAuthorityKinds.Opened &&
    savedModel.textRequestId !== beforeSave.textRequestId
  );
}

function dispatchWhyCommand(
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  const report = explainLastJeditCommand(model.editor, model.textAuthority);
  const tone = report.kind === WHY_REPORT_OBSTRUCTION_KIND
    ? NotificationTones.Warning
    : NotificationTones.Info;
  return pushNotificationToast(
    closeWorkspaceCommandLine(model),
    {
      title: report.title,
      message: report.message,
      variant: NotificationVariants.Toast,
      tone,
      placement: NotificationPlacements.LowerRight,
    },
    context.nowMs(),
    context.createNotificationTickCmd,
  );
}

function editCommandFileEntry(
  model: WorkspaceModel,
  argument: string,
  context: WorkspaceKeyBindingContext,
): FileEntry {
  return (
    model.entries.find((entry) => editArgumentMatchesEntry(entry, argument)) ??
    {
      kind: FileEntryKinds.File,
      name: argument,
      path: editCommandFilePath(model.cwd, argument, context),
    }
  );
}

function editArgumentMatchesEntry(entry: FileEntry, argument: string): boolean {
  return (
    entry.path === argument ||
    entry.name === argument ||
    editCommandEntryLabel(entry) === argument
  );
}

function editCommandEntryLabel(entry: FileEntry): string {
  if (entry.kind === FileEntryKinds.Parent) {
    return PARENT_DIRECTORY_LABEL;
  }
  return entry.kind === FileEntryKinds.Directory
    ? `${entry.name}${DIRECTORY_LABEL_SUFFIX}`
    : entry.name;
}

function editCommandFilePath(
  cwd: string,
  argument: string,
  context: WorkspaceKeyBindingContext,
): string {
  return context.deps.fileSystem.resolve(cwd, argument);
}

function parseWorkspaceCommandLine(
  input: string,
): ParsedWorkspaceCommandLine | undefined {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const commandEndIndex = firstWhitespaceIndex(trimmed);
  return commandEndIndex === NO_WHITESPACE_INDEX
    ? { name: trimmed.toLowerCase(), argument: EMPTY_COMMAND_ARGUMENT }
    : {
        name: trimmed.slice(0, commandEndIndex).toLowerCase(),
        argument: trimmed.slice(commandEndIndex).trim(),
      };
}

function firstWhitespaceIndex(input: string): number {
  return input.search(/\s/);
}

function hasNoArgument(command: ParsedWorkspaceCommandLine): boolean {
  return command.argument === EMPTY_COMMAND_ARGUMENT;
}

function isEditCommand(name: string): boolean {
  return (
    name === WorkspaceCommandNames.Edit ||
    name === WorkspaceCommandNames.EditAlias
  );
}

function isWriteCommand(name: string): boolean {
  return (
    name === WorkspaceCommandNames.Write ||
    name === WorkspaceCommandNames.WriteAlias
  );
}

function isQuitCommand(name: string): boolean {
  return (
    name === WorkspaceCommandNames.Quit ||
    name === WorkspaceCommandNames.QuitAlias
  );
}

function isForceQuitCommand(name: string): boolean {
  return (
    name === WorkspaceCommandNames.QuitBang ||
    name === WorkspaceCommandNames.QuitBangAlias
  );
}

function isWriteQuitCommand(name: string): boolean {
  return (
    name === WorkspaceCommandNames.WriteQuit ||
    name === WorkspaceCommandNames.WriteQuitAlias
  );
}

function isWhyCommand(name: string): boolean {
  return name === WorkspaceCommandNames.Why;
}
