import type { WorkspaceCommandLineState } from "./command-line.js";
import { invalidateWorkspaceCommandLine } from "./command-line.js";
import {
  workspaceCommandDescriptors,
  type WorkspaceCommandDescriptor,
} from "./command-completion.js";
import type { WorkspaceModel } from "./model.js";
import { WorkspaceCommandNames } from "./workspace-command-names.js";

interface CommandLineToken {
  readonly name: string;
  readonly hasArgument: boolean;
}

const COMMAND_LINE_VALIDATION_EMPTY = "";
const COMMAND_LINE_VALIDATION_NO_WHITESPACE = -1;
const FORCE_QUIT_COMMAND_NAMES = Object.freeze([
  WorkspaceCommandNames.QuitBang,
  WorkspaceCommandNames.QuitBangAlias,
] as const);

export function validateWorkspaceCommandLineInput(
  model: WorkspaceModel,
): WorkspaceModel {
  return commandLineInputInvalid(model.commandLine)
    ? invalidateWorkspaceCommandLine(model)
    : model;
}

export function commandLineInputInvalid(
  commandLine: Pick<WorkspaceCommandLineState, "active" | "input">,
): boolean {
  if (!commandLine.active) {
    return false;
  }

  const token = commandLineToken(commandLine.input);
  return token == null
    ? false
    : commandTokenInvalid(token, workspaceCommandDescriptors());
}

function commandLineToken(input: string): CommandLineToken | undefined {
  const trimmed = input.trimStart();
  if (trimmed.length === 0) {
    return undefined;
  }

  const commandEnd = trimmed.search(/\s/);
  return commandEnd === COMMAND_LINE_VALIDATION_NO_WHITESPACE
    ? { name: trimmed.toLowerCase(), hasArgument: false }
    : {
        name: trimmed.slice(0, commandEnd).toLowerCase(),
        hasArgument:
          trimmed.slice(commandEnd).trim() !== COMMAND_LINE_VALIDATION_EMPTY,
      };
}

function commandTokenInvalid(
  token: CommandLineToken,
  descriptors: readonly WorkspaceCommandDescriptor[],
): boolean {
  return !commandTokenHasKnownPrefix(token, descriptors)
    || commandTokenHasInvalidArgument(token);
}

function commandTokenHasKnownPrefix(
  token: CommandLineToken,
  descriptors: readonly WorkspaceCommandDescriptor[],
): boolean {
  return commandTokenMatchesVisibleDescriptor(token, descriptors) ||
    commandTokenMatchesHiddenCommand(token);
}

function commandTokenMatchesVisibleDescriptor(
  token: CommandLineToken,
  descriptors: readonly WorkspaceCommandDescriptor[],
): boolean {
  return descriptors.some((descriptor) =>
    commandDescriptorMatchesTokenPrefix(descriptor, token.name),
  );
}

function commandTokenMatchesHiddenCommand(token: CommandLineToken): boolean {
  return FORCE_QUIT_COMMAND_NAMES.some((name) => name.startsWith(token.name));
}

function commandDescriptorMatchesTokenPrefix(
  descriptor: WorkspaceCommandDescriptor,
  tokenName: string,
): boolean {
  return descriptor.name.startsWith(tokenName) ||
    descriptor.aliases.some((alias) => alias.startsWith(tokenName));
}

function commandTokenHasInvalidArgument(token: CommandLineToken): boolean {
  return token.hasArgument && !commandTokenAcceptsArgument(token.name);
}

function commandTokenAcceptsArgument(name: string): boolean {
  return name === WorkspaceCommandNames.Edit || name === WorkspaceCommandNames.EditAlias;
}
