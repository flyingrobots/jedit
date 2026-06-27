import {
  INLINE_COMPLETION_ITEM_KIND,
  type InlineCompletionItem,
} from "../../ui/inline-completion-popup.js";
import { FileEntryKinds, type FileEntry } from "../../ports/file-system.js";
import type { I18nPort } from "../../ports/i18n.js";
import type { WorkspaceCommandLineState } from "./command-line.js";
import { WorkspaceCommandNames } from "./workspace-command-names.js";

export interface WorkspaceCommandDescriptor {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly detail: string;
  readonly detailKey: string;
  readonly requiresOpenFile?: boolean;
}

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

interface EditFileCompletionContext {
  readonly query: string;
  readonly replacementStart: number;
  readonly replacementEnd: number;
}

type WorkspaceCommandCompletionI18n = Pick<I18nPort, "t">;

export const VIM_COMMAND_PROVIDER_ID = "vim-command";
export const WORKSPACE_FILE_PROVIDER_ID = "workspace-file";
const COMMAND_COMPLETION_EMPTY_QUERY = "";
const COMMAND_COMPLETION_FIRST_INDEX = 0;
const COMMAND_ARGUMENT_STEP = 1;
const FILE_COMPLETION_FUZZY_MIN_QUERY_LENGTH = 2;
const FILE_COMPLETION_PARENT_LABEL = "../";
const FILE_COMPLETION_DIRECTORY_SUFFIX = "/";
const FILE_COMPLETION_FILE_DETAIL = "File";
const FILE_COMPLETION_DIRECTORY_DETAIL = "Directory";
const FILE_COMPLETION_PARENT_DETAIL = "Parent directory";
const COMMAND_DETAIL_KEYS = Object.freeze({
  Edit: "footer.command.details.edit",
  Write: "footer.command.details.write",
  Quit: "footer.command.details.quit",
  WriteQuit: "footer.command.details.wq",
  TimeTravelDebugger: "footer.command.details.ttd",
  Strand: "footer.command.details.strand",
  Braid: "footer.command.details.braid",
  Why: "footer.command.details.why",
});
const WORKSPACE_COMMAND_DESCRIPTORS = [
  {
    id: "command:edit",
    name: WorkspaceCommandNames.Edit,
    aliases: [WorkspaceCommandNames.EditAlias],
    detail: "Open a file",
    detailKey: COMMAND_DETAIL_KEYS.Edit,
  },
  {
    id: "command:write",
    name: WorkspaceCommandNames.Write,
    aliases: [WorkspaceCommandNames.WriteAlias],
    detail: "Write the current file",
    detailKey: COMMAND_DETAIL_KEYS.Write,
    requiresOpenFile: true,
  },
  {
    id: "command:quit",
    name: WorkspaceCommandNames.Quit,
    aliases: [WorkspaceCommandNames.QuitAlias],
    detail: "Quit jedit",
    detailKey: COMMAND_DETAIL_KEYS.Quit,
  },
  {
    id: "command:wq",
    name: WorkspaceCommandNames.WriteQuit,
    aliases: [WorkspaceCommandNames.WriteQuitAlias],
    detail: "Write and quit",
    detailKey: COMMAND_DETAIL_KEYS.WriteQuit,
    requiresOpenFile: true,
  },
  {
    id: "command:ttd",
    name: WorkspaceCommandNames.TimeTravelDebugger,
    aliases: [],
    detail: "Observe a causal tick without moving canonical head",
    detailKey: COMMAND_DETAIL_KEYS.TimeTravelDebugger,
  },
  {
    id: "command:strand",
    name: WorkspaceCommandNames.Strand,
    aliases: [],
    detail: "Create, switch, or list copy-on-write strands",
    detailKey: COMMAND_DETAIL_KEYS.Strand,
  },
  {
    id: "command:braid",
    name: WorkspaceCommandNames.Braid,
    aliases: [],
    detail: "View, preview, or admit braid candidates",
    detailKey: COMMAND_DETAIL_KEYS.Braid,
  },
  {
    id: "command:why",
    name: WorkspaceCommandNames.Why,
    aliases: [],
    detail: "Explain the last meaningful command",
    detailKey: COMMAND_DETAIL_KEYS.Why,
  },
] satisfies readonly WorkspaceCommandDescriptor[];

export function workspaceCommandDescriptors(): readonly WorkspaceCommandDescriptor[] {
  return WORKSPACE_COMMAND_DESCRIPTORS;
}

export function workspaceCommandCompletionItems(
  commandLine: Pick<WorkspaceCommandLineState, "input" | "cursorIndex">,
  i18n?: WorkspaceCommandCompletionI18n,
  availability?: WorkspaceCommandCompletionAvailability,
): readonly InlineCompletionItem[] {
  const context = commandNameCompletionContext(commandLine);
  if (context == null) {
    return [];
  }

  return WORKSPACE_COMMAND_DESCRIPTORS.filter((descriptor) =>
    commandDescriptorAvailable(descriptor, availability) &&
      descriptorMatchesQuery(descriptor, context.query),
  ).map((descriptor) => commandCompletionItem(descriptor, context, i18n));
}

export function workspaceCommandLineCompletionItems(
  context: WorkspaceCommandLineCompletionContext,
): readonly InlineCompletionItem[] {
  const fileContext = editFileCompletionContext(context.commandLine);
  return fileContext == null
    ? workspaceCommandCompletionItems(context.commandLine, context.i18n, context)
    : workspaceFileCompletionItems(context.entries, fileContext);
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
        item: fileCompletionItem(entry, fileContext),
        entry,
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

function workspaceFileCompletionItems(
  entries: readonly FileEntry[],
  context: EditFileCompletionContext,
): readonly InlineCompletionItem[] {
  return workspaceFileCompletionEntries(entries, context)
    .map((entry) => fileCompletionItem(entry, context));
}

function workspaceFileCompletionEntries(
  entries: readonly FileEntry[],
  context: EditFileCompletionContext,
): readonly FileEntry[] {
  return entries.filter((entry) => fileEntryMatchesQuery(entry, context.query));
}

function fileCompletionItem(
  entry: FileEntry,
  context: EditFileCompletionContext,
): InlineCompletionItem {
  return {
    id: `file:${entry.path}`,
    label: fileCompletionLabel(entry),
    detail: fileCompletionDetail(entry),
    kind: fileCompletionKind(entry),
    providerId: WORKSPACE_FILE_PROVIDER_ID,
    previewRequestId: entry.path,
    replacement: {
      start: context.replacementStart,
      end: context.replacementEnd,
      text: fileCompletionReplacement(entry),
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
    name === WorkspaceCommandNames.Braid;
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
): EditFileCompletionContext | undefined {
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

function fileEntryMatchesQuery(entry: FileEntry, query: string): boolean {
  const normalizedQuery = normalizeFileCompletionText(query);
  return (
    normalizedQuery.length === 0 ||
    fuzzyFileCompletionMatch(
      normalizeFileCompletionText(fileCompletionLabel(entry)),
      normalizedQuery,
    )
  );
}

function fuzzyFileCompletionMatch(label: string, query: string): boolean {
  if (query.length < FILE_COMPLETION_FUZZY_MIN_QUERY_LENGTH) {
    return label.startsWith(query);
  }

  let labelIndex = 0;
  for (const character of query) {
    const nextIndex = label.indexOf(character, labelIndex);
    if (nextIndex < 0) {
      return false;
    }
    labelIndex = nextIndex + COMMAND_ARGUMENT_STEP;
  }
  return true;
}

function fileCompletionLabel(entry: FileEntry): string {
  if (entry.kind === FileEntryKinds.Parent) {
    return FILE_COMPLETION_PARENT_LABEL;
  }
  if (entry.kind === FileEntryKinds.Directory) {
    return `${entry.name}${FILE_COMPLETION_DIRECTORY_SUFFIX}`;
  }
  return entry.name;
}

function fileCompletionReplacement(entry: FileEntry): string {
  return fileCompletionLabel(entry);
}

function fileCompletionDetail(entry: FileEntry): string {
  if (entry.kind === FileEntryKinds.Parent) {
    return FILE_COMPLETION_PARENT_DETAIL;
  }
  return entry.kind === FileEntryKinds.Directory
    ? FILE_COMPLETION_DIRECTORY_DETAIL
    : FILE_COMPLETION_FILE_DETAIL;
}

function fileCompletionKind(entry: FileEntry): InlineCompletionItem["kind"] {
  return entry.kind === FileEntryKinds.File
    ? INLINE_COMPLETION_ITEM_KIND.File
    : INLINE_COMPLETION_ITEM_KIND.Directory;
}

function isEditCommand(command: string): boolean {
  const normalized = command.toLowerCase();
  return normalized === WorkspaceCommandNames.Edit ||
    normalized === WorkspaceCommandNames.EditAlias;
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

function normalizeFileCompletionText(value: string): string {
  return value.toLowerCase();
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
