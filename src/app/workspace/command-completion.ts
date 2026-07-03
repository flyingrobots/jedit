import {
  INLINE_COMPLETION_ITEM_KIND,
  INLINE_COMPLETION_PREVIEW_KIND,
  type InlineCompletionItem,
  type InlineCompletionPreview,
} from "../../ui/inline-completion-popup.js";
import type { FileEntry } from "../../ports/file-system.js";
import type { I18nPort } from "../../ports/i18n.js";
import type { WorkspaceCommandLineState } from "./command-line.js";
import { workspaceCompletionMatches } from "./workspace-completion-match.js";
import {
  workspaceCommandArgumentDescriptors,
  workspaceCommandDescriptors,
  workspaceCommandHelpLines,
  workspaceCommandHelpTitle,
  type WorkspaceCommandArgumentDescriptor,
  type WorkspaceCommandDescriptor,
} from "./workspace-command-catalog.js";
import { WorkspaceCommandNames } from "./workspace-command-names.js";
import {
  workspaceFileCompletionEntries,
  workspaceFileCompletionItem,
  workspaceFileCompletionItems,
  type WorkspaceFileCompletionContext,
} from "./workspace-file-completion.js";
export type { WorkspaceCommandDescriptor } from "./workspace-command-catalog.js";

export interface WorkspaceCommandCompletionAvailability {
  readonly hasOpenFile?: boolean;
}

export interface WorkspaceCommandLineCompletionContext {
  readonly commandLine: Pick<
    WorkspaceCommandLineState,
    "input" | "cursorIndex"
  >;
  readonly entries: readonly FileEntry[];
  readonly i18n?: WorkspaceCommandCompletionI18n;
  readonly hasOpenFile?: boolean;
}

export interface WorkspaceSelectedCommandLineCompletionContext {
  readonly commandLine: Pick<
    WorkspaceCommandLineState,
    "input" | "cursorIndex" | "selectedCompletionIndex"
  >;
  readonly entries: readonly FileEntry[];
  readonly i18n?: WorkspaceCommandCompletionI18n;
  readonly hasOpenFile?: boolean;
}

export interface WorkspaceSelectedCommandLineFileCompletion {
  readonly item: InlineCompletionItem;
  readonly entry: FileEntry;
}

interface CommandNameCompletionContext {
  readonly query: string;
  readonly replacementStart: number;
  readonly replacementEnd: number;
}

interface CommandArgumentCompletionContext {
  readonly command: string;
  readonly query: string;
  readonly replacementStart: number;
  readonly replacementEnd: number;
}

type WorkspaceCommandCompletionI18n = Pick<I18nPort, "t">;

export const VIM_COMMAND_PROVIDER_ID = "vim-command";
export const VIM_COMMAND_ARGUMENT_PROVIDER_ID = "vim-command-argument";
const COMMAND_COMPLETION_EMPTY_QUERY = "";
const COMMAND_COMPLETION_FIRST_INDEX = 0;
const COMMAND_ARGUMENT_STEP = 1;
const COMMAND_ARGUMENT_ID_MIN_PARTS = 2;

export function workspaceCommandCompletionItems(
  commandLine: Pick<WorkspaceCommandLineState, "input" | "cursorIndex">,
  i18n?: WorkspaceCommandCompletionI18n,
  availability?: WorkspaceCommandCompletionAvailability,
): readonly InlineCompletionItem[] {
  const context = commandNameCompletionContext(commandLine);
  if (context == null) {
    return [];
  }

  return workspaceCommandDescriptors().filter((descriptor) =>
    commandDescriptorAvailable(descriptor, availability) &&
      descriptorMatchesQuery(descriptor, context.query),
  ).map((descriptor) => commandCompletionItem(descriptor, context, i18n));
}

export function workspaceCommandLineCompletionItems(
  context: WorkspaceCommandLineCompletionContext,
): readonly InlineCompletionItem[] {
  const fileContext = editFileCompletionContext(context.commandLine);
  if (fileContext != null) {
    return workspaceFileCompletionItems(context.entries, fileContext);
  }

  const argumentContext = commandArgumentCompletionContext(context.commandLine);
  return argumentContext == null
    ? workspaceCommandCompletionItems(context.commandLine, context.i18n, context)
    : workspaceCommandArgumentCompletionItems(argumentContext);
}

export function selectedWorkspaceCommandCompletionItem(
  commandLine: Pick<
    WorkspaceCommandLineState,
    "input" | "cursorIndex" | "selectedCompletionIndex"
  >,
  availability?: WorkspaceCommandCompletionAvailability,
): InlineCompletionItem | undefined {
  const items = workspaceCommandCompletionItems(
    commandLine,
    undefined,
    availability,
  );
  return items[selectedWorkspaceCommandCompletionIndex(commandLine, items.length)];
}

export function selectedWorkspaceCommandLineCompletionItem(
  context: WorkspaceSelectedCommandLineCompletionContext,
): InlineCompletionItem | undefined {
  const items = workspaceCommandLineCompletionItems(context);
  return items[
    selectedWorkspaceCommandCompletionIndex(
      context.commandLine,
      items.length,
    )
  ];
}

export function selectedWorkspaceCommandLineFileCompletion(
  context: WorkspaceSelectedCommandLineCompletionContext,
): WorkspaceSelectedCommandLineFileCompletion | undefined {
  const fileContext = editFileCompletionContext(context.commandLine);
  if (fileContext == null) {
    return undefined;
  }
  const entries = workspaceFileCompletionEntries(context.entries, fileContext);
  const entry = entries[
    selectedWorkspaceCommandCompletionIndex(
      context.commandLine,
      entries.length,
    )
  ];
  return entry == null
    ? undefined
    : {
        item: workspaceFileCompletionItem(entry, fileContext),
        entry,
      };
}

export function workspaceCommandLineCompletionPreviewForItem(
  item: InlineCompletionItem,
): InlineCompletionPreview | undefined {
  if (
    item.providerId !== VIM_COMMAND_PROVIDER_ID &&
    item.providerId !== VIM_COMMAND_ARGUMENT_PROVIDER_ID
  ) {
    return undefined;
  }
  const command = commandNameFromCompletionItem(item);
  return command == null
    ? undefined
    : {
        id: `preview:${item.id}`,
        kind: INLINE_COMPLETION_PREVIEW_KIND.Documentation,
        title: workspaceCommandHelpTitle(command),
        lines: workspaceCommandHelpLines(command),
        providerId: item.providerId,
      };
}

export function selectedWorkspaceCommandCompletionIndex(
  commandLine: Pick<WorkspaceCommandLineState, "selectedCompletionIndex">,
  completionCount: number,
): number {
  return Math.max(
    COMMAND_COMPLETION_FIRST_INDEX,
    Math.min(
      Math.max(COMMAND_COMPLETION_FIRST_INDEX, completionCount - 1),
      commandLine.selectedCompletionIndex,
    ),
  );
}

function commandCompletionItem(
  descriptor: WorkspaceCommandDescriptor,
  context: CommandNameCompletionContext,
  i18n: WorkspaceCommandCompletionI18n | undefined,
): InlineCompletionItem {
  return {
    id: descriptor.id,
    label: descriptor.name,
    detail: commandCompletionDetail(descriptor, i18n),
    kind: INLINE_COMPLETION_ITEM_KIND.Command,
    providerId: VIM_COMMAND_PROVIDER_ID,
    replacement: {
      start: context.replacementStart,
      end: context.replacementEnd,
      text: commandCompletionReplacementText(descriptor),
    },
  };
}

function workspaceCommandArgumentCompletionItems(
  context: CommandArgumentCompletionContext,
): readonly InlineCompletionItem[] {
  return commandArgumentDescriptorsForContext(context)
    .filter((descriptor) => commandArgumentDescriptorMatchesQuery(descriptor, context.query))
    .map((descriptor) => commandArgumentCompletionItem(descriptor, context));
}

function commandArgumentDescriptorsForContext(
  context: CommandArgumentCompletionContext,
): readonly WorkspaceCommandArgumentDescriptor[] {
  return context.command === WorkspaceCommandNames.Help
    ? workspaceCommandDescriptors().map((descriptor) => ({
        id: `command-arg:help:${descriptor.name}`,
        commandName: WorkspaceCommandNames.Help,
        label: descriptor.name,
        detail: descriptor.detail,
        replacementText: descriptor.name,
        help: descriptor.help,
      }))
    : workspaceCommandArgumentDescriptors(context.command);
}

function commandArgumentCompletionItem(
  descriptor: WorkspaceCommandArgumentDescriptor,
  context: CommandArgumentCompletionContext,
): InlineCompletionItem {
  return {
    id: descriptor.id,
    label: descriptor.label,
    detail: descriptor.detail,
    kind: INLINE_COMPLETION_ITEM_KIND.Documentation,
    providerId: VIM_COMMAND_ARGUMENT_PROVIDER_ID,
    replacement: {
      start: context.replacementStart,
      end: context.replacementEnd,
      text: descriptor.replacementText,
    },
  };
}

function commandCompletionDetail(
  descriptor: WorkspaceCommandDescriptor,
  i18n: WorkspaceCommandCompletionI18n | undefined,
): string {
  const detail = localizedCommandDetail(descriptor, i18n);
  return descriptor.aliases.length === 0
    ? detail
    : `${detail} (${descriptor.aliases.join(", ")})`;
}

function localizedCommandDetail(
  descriptor: WorkspaceCommandDescriptor,
  i18n: WorkspaceCommandCompletionI18n | undefined,
): string {
  return i18n?.t(descriptor.detailKey) ?? descriptor.detail;
}

function commandCompletionReplacementText(
  descriptor: WorkspaceCommandDescriptor,
): string {
  return commandAcceptsCompletionArgument(descriptor.name)
    ? `${descriptor.name} `
    : descriptor.name;
}

function commandAcceptsCompletionArgument(name: string): boolean {
  return name === WorkspaceCommandNames.Edit ||
    name === WorkspaceCommandNames.TimeTravelDebugger ||
    name === WorkspaceCommandNames.Strand ||
    name === WorkspaceCommandNames.Braid ||
    name === WorkspaceCommandNames.Help;
}

function commandDescriptorAvailable(
  descriptor: WorkspaceCommandDescriptor,
  availability: WorkspaceCommandCompletionAvailability | undefined,
): boolean {
  return (
    descriptor.requiresOpenFile !== true ||
    availability?.hasOpenFile !== false
  );
}

function descriptorMatchesQuery(
  descriptor: WorkspaceCommandDescriptor,
  query: string,
): boolean {
  const normalized = query.toLowerCase();
  return (
    normalized === COMMAND_COMPLETION_EMPTY_QUERY ||
    descriptor.name.startsWith(normalized) ||
    descriptor.aliases.some((alias) => alias.startsWith(normalized))
  );
}

function commandNameCompletionContext(
  commandLine: Pick<WorkspaceCommandLineState, "input" | "cursorIndex">,
): CommandNameCompletionContext | undefined {
  const input = commandLine.input;
  const cursorIndex = Math.max(
    COMMAND_COMPLETION_FIRST_INDEX,
    Math.min(input.length, commandLine.cursorIndex),
  );
  const replacementStart = firstCommandNameIndex(input);
  const replacementEnd = commandNameEndIndex(input, replacementStart);

  if (cursorIndex < replacementStart || cursorIndex > replacementEnd) {
    return undefined;
  }

  const query = input.slice(replacementStart, cursorIndex);
  return /\s/.test(query)
    ? undefined
    : {
        query,
        replacementStart,
        replacementEnd,
      };
}

function editFileCompletionContext(
  commandLine: Pick<WorkspaceCommandLineState, "input" | "cursorIndex">,
): WorkspaceFileCompletionContext | undefined {
  const input = commandLine.input;
  const cursorIndex = clampedCommandCursorIndex(commandLine);
  const commandStart = firstCommandNameIndex(input);
  const commandEnd = commandNameEndIndex(input, commandStart);
  const command = input.slice(commandStart, commandEnd);
  const replacementStart = commandArgumentStartIndex(input, commandEnd);
  const replacementEnd = commandArgumentEndIndex(input, replacementStart);

  if (
    !isEditCommand(command) ||
    replacementStart <= commandEnd ||
    cursorIndex < replacementStart ||
    cursorIndex > replacementEnd
  ) {
    return undefined;
  }

  return {
    query: input.slice(replacementStart, cursorIndex),
    replacementStart,
    replacementEnd,
  };
}

function commandArgumentCompletionContext(
  commandLine: Pick<WorkspaceCommandLineState, "input" | "cursorIndex">,
): CommandArgumentCompletionContext | undefined {
  const input = commandLine.input;
  const cursorIndex = clampedCommandCursorIndex(commandLine);
  const commandStart = firstCommandNameIndex(input);
  const commandEnd = commandNameEndIndex(input, commandStart);
  const command = input.slice(commandStart, commandEnd).toLowerCase();
  const replacementStart = commandArgumentStartIndex(input, commandEnd);
  const replacementEnd = commandArgumentEndIndex(input, replacementStart);

  if (
    !commandAcceptsCompletionArgument(command) ||
    isEditCommand(command) ||
    replacementStart <= commandEnd ||
    cursorIndex < replacementStart ||
    cursorIndex > replacementEnd
  ) {
    return undefined;
  }

  return {
    command,
    query: input.slice(replacementStart, cursorIndex).toLowerCase(),
    replacementStart,
    replacementEnd,
  };
}

function commandArgumentDescriptorMatchesQuery(
  descriptor: WorkspaceCommandArgumentDescriptor,
  query: string,
): boolean {
  return workspaceCompletionMatches(descriptor.label, query);
}

function isEditCommand(command: string): boolean {
  const normalized = command.toLowerCase();
  return normalized === WorkspaceCommandNames.Edit ||
    normalized === WorkspaceCommandNames.EditAlias;
}

function commandNameFromCompletionItem(
  item: InlineCompletionItem,
): string | undefined {
  if (item.providerId === VIM_COMMAND_PROVIDER_ID) {
    return item.label;
  }
  if (item.providerId !== VIM_COMMAND_ARGUMENT_PROVIDER_ID) {
    return undefined;
  }
  const prefix = `command-arg:help:`;
  return item.id.startsWith(prefix)
    ? item.id.slice(prefix.length)
    : commandNameFromArgumentCompletionId(item.id);
}

function commandNameFromArgumentCompletionId(id: string): string | undefined {
  const parts = id.split(":");
  return parts.length >= COMMAND_ARGUMENT_ID_MIN_PARTS ? parts[1] : undefined;
}

function commandArgumentStartIndex(input: string, commandEnd: number): number {
  let index = commandEnd;
  while (index < input.length && /\s/.test(input[index] ?? "")) {
    index += COMMAND_ARGUMENT_STEP;
  }
  return index;
}

function commandArgumentEndIndex(input: string, argumentStart: number): number {
  const rest = input.slice(argumentStart);
  const whitespaceIndex = rest.search(/\s/);
  return whitespaceIndex < 0 ? input.length : argumentStart + whitespaceIndex;
}

function clampedCommandCursorIndex(
  commandLine: Pick<WorkspaceCommandLineState, "input" | "cursorIndex">,
): number {
  return Math.max(
    COMMAND_COMPLETION_FIRST_INDEX,
    Math.min(commandLine.input.length, commandLine.cursorIndex),
  );
}

function firstCommandNameIndex(input: string): number {
  const match = /\S/.exec(input);
  return match?.index ?? input.length;
}

function commandNameEndIndex(input: string, start: number): number {
  const rest = input.slice(start);
  const whitespaceIndex = rest.search(/\s/);
  return whitespaceIndex < 0 ? input.length : start + whitespaceIndex;
}
