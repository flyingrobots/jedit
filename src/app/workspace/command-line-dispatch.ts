import { quit, type Cmd } from "@flyingrobots/bijou-tui";
import { FileEntryKinds, type FileEntry } from "../../ports/file-system.js";
import {
  closeWorkspaceCommandLine,
  invalidateWorkspaceCommandLine,
} from "./command-line.js";
import { openWorkspaceFileEntry } from "./file-tree.js";
import type { WorkspaceKeyBindingContext } from "./key-binding-context.js";
import type { WorkspaceModel } from "./model.js";
import type { WorkspaceMsg } from "./msg.js";
import { saveWorkspace } from "./workspace-save-key.js";

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

interface ParsedWorkspaceCommandLine {
  readonly name: string;
  readonly argument: string;
}

const WORKSPACE_COMMAND_NAMES = Object.freeze({
  Edit: "edit",
  EditAlias: "e",
  Write: "write",
  WriteAlias: "w",
  Quit: "quit",
  QuitAlias: "q",
  QuitBang: "quit!",
  QuitBangAlias: "q!",
  WriteQuit: "wq",
  WriteQuitAlias: "x",
} as const);

const EMPTY_COMMAND_ARGUMENT = "";
const NO_WHITESPACE_INDEX = -1;
const ABSOLUTE_PATH_PREFIX = "/";
const DIRECTORY_LABEL_SUFFIX = "/";
const PARENT_DIRECTORY_LABEL = "../";

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
  if (!hasNoArgument(command)) {
    return [invalidateWorkspaceCommandLine(model), []];
  }
  if (isWriteCommand(command.name)) {
    return saveWorkspace(closeWorkspaceCommandLine(model), context);
  }
  if (isQuitCommand(command.name)) {
    return dispatchQuitCommand(model);
  }
  if (isForceQuitCommand(command.name)) {
    return [closeWorkspaceCommandLine(model), [quit<WorkspaceMsg>()]];
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
  const [savedModel, commands] = saveWorkspace(
    closeWorkspaceCommandLine(model),
    context,
  );
  return [
    {
      ...savedModel,
      quitConfirmOpen: true,
    },
    commands,
  ];
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
  return argument.startsWith(ABSOLUTE_PATH_PREFIX)
    ? argument
    : context.deps.fileSystem.join(cwd, argument);
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
    name === WORKSPACE_COMMAND_NAMES.Edit ||
    name === WORKSPACE_COMMAND_NAMES.EditAlias
  );
}

function isWriteCommand(name: string): boolean {
  return (
    name === WORKSPACE_COMMAND_NAMES.Write ||
    name === WORKSPACE_COMMAND_NAMES.WriteAlias
  );
}

function isQuitCommand(name: string): boolean {
  return (
    name === WORKSPACE_COMMAND_NAMES.Quit ||
    name === WORKSPACE_COMMAND_NAMES.QuitAlias
  );
}

function isForceQuitCommand(name: string): boolean {
  return (
    name === WORKSPACE_COMMAND_NAMES.QuitBang ||
    name === WORKSPACE_COMMAND_NAMES.QuitBangAlias
  );
}

function isWriteQuitCommand(name: string): boolean {
  return (
    name === WORKSPACE_COMMAND_NAMES.WriteQuit ||
    name === WORKSPACE_COMMAND_NAMES.WriteQuitAlias
  );
}
