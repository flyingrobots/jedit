import {
  INLINE_COMPLETION_ITEM_KIND,
  INLINE_COMPLETION_PREVIEW_KIND,
  type InlineCompletionItem,
  type InlineCompletionPreview,
} from "../../ui/inline-completion-popup.js";
import { FileEntryKinds, type FileEntry } from "../../ports/file-system.js";
import type { WorkspaceCommandLineState } from "./command-line.js";

export interface WorkspaceCommandDescriptor {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly detail: string;
}

export interface WorkspaceCommandLineCompletionContext {
  readonly commandLine: Pick<
    WorkspaceCommandLineState,
    "input" | "cursorIndex"
  >;
  readonly entries: readonly FileEntry[];
}

export interface WorkspaceSelectedCommandLineCompletionContext {
  readonly commandLine: Pick<
    WorkspaceCommandLineState,
    "input" | "cursorIndex" | "selectedCompletionIndex"
  >;
  readonly entries: readonly FileEntry[];
}

export const WORKSPACE_FILE_PREVIEW_RESULT_KIND = Object.freeze({
  Loaded: "loaded",
  Unavailable: "unavailable",
} as const);

export type WorkspaceFilePreviewResultKind =
  (typeof WORKSPACE_FILE_PREVIEW_RESULT_KIND)[keyof typeof WORKSPACE_FILE_PREVIEW_RESULT_KIND];

export interface WorkspaceLoadedFilePreviewResult {
  readonly kind: typeof WORKSPACE_FILE_PREVIEW_RESULT_KIND.Loaded;
  readonly lines: readonly string[];
  readonly evidencePosture?: string;
}

export interface WorkspaceUnavailableFilePreviewResult {
  readonly kind: typeof WORKSPACE_FILE_PREVIEW_RESULT_KIND.Unavailable;
  readonly reason: string;
  readonly evidencePosture?: string;
}

export type WorkspaceFilePreviewResult =
  | WorkspaceLoadedFilePreviewResult
  | WorkspaceUnavailableFilePreviewResult;

export interface WorkspaceFilePreviewSource {
  loadFilePreview(filePath: string): WorkspaceFilePreviewResult;
}

export interface WorkspaceCommandLineCompletionPreviewContext
  extends WorkspaceSelectedCommandLineCompletionContext {
  readonly previewSource?: WorkspaceFilePreviewSource;
  readonly maxPreviewLines?: number;
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

const VIM_COMMAND_PROVIDER_ID = "vim-command";
const WORKSPACE_FILE_PROVIDER_ID = "workspace-file";
const COMMAND_COMPLETION_EMPTY_QUERY = "";
const COMMAND_COMPLETION_FIRST_INDEX = 0;
const COMMAND_ARGUMENT_STEP = 1;
const EDIT_COMMAND_NAME = "edit";
const EDIT_COMMAND_ALIAS = "e";
const FILE_COMPLETION_PARENT_LABEL = "../";
const FILE_COMPLETION_DIRECTORY_SUFFIX = "/";
const FILE_COMPLETION_FILE_DETAIL = "File";
const FILE_COMPLETION_DIRECTORY_DETAIL = "Directory";
const FILE_COMPLETION_PARENT_DETAIL = "Parent directory";
const FILE_COMPLETION_PREVIEW_DEFAULT_MAX_LINES = 5;
const FILE_COMPLETION_PREVIEW_SOURCE_UNAVAILABLE = "Preview unavailable";
const FILE_COMPLETION_PREVIEW_DIRECTORY_UNAVAILABLE = "Directory preview unavailable";
const FILE_COMPLETION_PREVIEW_PARENT_UNAVAILABLE =
  "Parent directory preview unavailable";
const FILE_COMPLETION_PREVIEW_ENTRY_UNAVAILABLE =
  "Completion entry unavailable";
const FILE_COMPLETION_PREVIEW_UNAVAILABLE_POSTURE = "unavailable";

const WORKSPACE_COMMAND_DESCRIPTORS = [
  {
    id: "command:edit",
    name: EDIT_COMMAND_NAME,
    aliases: [EDIT_COMMAND_ALIAS],
    detail: "Open a file",
  },
  {
    id: "command:write",
    name: "write",
    aliases: ["w"],
    detail: "Write the current file",
  },
  {
    id: "command:quit",
    name: "quit",
    aliases: ["q"],
    detail: "Quit jedit",
  },
  {
    id: "command:wq",
    name: "wq",
    aliases: ["x"],
    detail: "Write and quit",
  },
] satisfies readonly WorkspaceCommandDescriptor[];

export function workspaceCommandDescriptors(): readonly WorkspaceCommandDescriptor[] {
  return WORKSPACE_COMMAND_DESCRIPTORS;
}

export function workspaceCommandCompletionItems(
  commandLine: Pick<WorkspaceCommandLineState, "input" | "cursorIndex">,
): readonly InlineCompletionItem[] {
  const context = commandNameCompletionContext(commandLine);
  if (context == null) {
    return [];
  }

  return WORKSPACE_COMMAND_DESCRIPTORS.filter((descriptor) =>
    descriptorMatchesQuery(descriptor, context.query),
  ).map((descriptor) => commandCompletionItem(descriptor, context));
}

export function workspaceCommandLineCompletionItems(
  context: WorkspaceCommandLineCompletionContext,
): readonly InlineCompletionItem[] {
  const fileContext = editFileCompletionContext(context.commandLine);
  return fileContext == null
    ? workspaceCommandCompletionItems(context.commandLine)
    : workspaceFileCompletionItems(context.entries, fileContext);
}

export function selectedWorkspaceCommandCompletionItem(
  commandLine: Pick<
    WorkspaceCommandLineState,
    "input" | "cursorIndex" | "selectedCompletionIndex"
  >,
): InlineCompletionItem | undefined {
  const items = workspaceCommandCompletionItems(commandLine);
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

export function workspaceCommandLineCompletionPreview(
  context: WorkspaceCommandLineCompletionPreviewContext,
): InlineCompletionPreview | undefined {
  const item = selectedWorkspaceCommandLineCompletionItem(context);
  if (item == null || item.providerId !== WORKSPACE_FILE_PROVIDER_ID) {
    return undefined;
  }

  const entry = fileEntryForCompletionItem(context.entries, item);
  if (entry == null) {
    return unavailableFileCompletionPreview(
      item,
      FILE_COMPLETION_PREVIEW_ENTRY_UNAVAILABLE,
    );
  }
  if (entry.kind !== FileEntryKinds.File) {
    return unavailableFileCompletionPreview(
      item,
      unavailableFileCompletionReason(entry),
    );
  }

  const result = loadFilePreviewResult(context.previewSource, entry.path);
  if (result.kind === WORKSPACE_FILE_PREVIEW_RESULT_KIND.Unavailable) {
    return unavailableFileCompletionPreview(
      item,
      result.reason,
      result.evidencePosture,
    );
  }

  return loadedFileCompletionPreview(item, result, context.maxPreviewLines);
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
): InlineCompletionItem {
  return {
    id: descriptor.id,
    label: descriptor.name,
    detail: commandCompletionDetail(descriptor),
    kind: INLINE_COMPLETION_ITEM_KIND.Command,
    providerId: VIM_COMMAND_PROVIDER_ID,
    replacement: {
      start: context.replacementStart,
      end: context.replacementEnd,
      text: descriptor.name,
    },
  };
}

function workspaceFileCompletionItems(
  entries: readonly FileEntry[],
  context: EditFileCompletionContext,
): readonly InlineCompletionItem[] {
  return entries
    .filter((entry) => fileEntryMatchesQuery(entry, context.query))
    .map((entry) => fileCompletionItem(entry, context));
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
): string {
  return descriptor.aliases.length === 0
    ? descriptor.detail
    : `${descriptor.detail} (${descriptor.aliases.join(", ")})`;
}

function fileEntryForCompletionItem(
  entries: readonly FileEntry[],
  item: InlineCompletionItem,
): FileEntry | undefined {
  return entries.find((entry) => entry.path === item.previewRequestId);
}

function loadFilePreviewResult(
  source: WorkspaceFilePreviewSource | undefined,
  filePath: string,
): WorkspaceFilePreviewResult {
  if (source == null) {
    return unavailableFilePreviewResult();
  }

  try {
    return source.loadFilePreview(filePath);
  } catch {
    return unavailableFilePreviewResult();
  }
}

function unavailableFilePreviewResult(): WorkspaceUnavailableFilePreviewResult {
  return {
    kind: WORKSPACE_FILE_PREVIEW_RESULT_KIND.Unavailable,
    reason: FILE_COMPLETION_PREVIEW_SOURCE_UNAVAILABLE,
    evidencePosture: FILE_COMPLETION_PREVIEW_UNAVAILABLE_POSTURE,
  };
}

function loadedFileCompletionPreview(
  item: InlineCompletionItem,
  result: WorkspaceLoadedFilePreviewResult,
  maxLines: number | undefined,
): InlineCompletionPreview {
  return {
    id: `preview:${item.id}`,
    kind: INLINE_COMPLETION_PREVIEW_KIND.File,
    title: item.label,
    lines: boundedFilePreviewLines(result.lines, maxLines),
    providerId: WORKSPACE_FILE_PROVIDER_ID,
    evidencePosture: result.evidencePosture,
  };
}

function unavailableFileCompletionPreview(
  item: InlineCompletionItem,
  reason: string,
  evidencePosture = FILE_COMPLETION_PREVIEW_UNAVAILABLE_POSTURE,
): InlineCompletionPreview {
  return {
    id: `preview:${item.id}`,
    kind: INLINE_COMPLETION_PREVIEW_KIND.Unavailable,
    title: item.label,
    lines: [reason],
    providerId: WORKSPACE_FILE_PROVIDER_ID,
    evidencePosture,
  };
}

function unavailableFileCompletionReason(entry: FileEntry): string {
  return entry.kind === FileEntryKinds.Parent
    ? FILE_COMPLETION_PREVIEW_PARENT_UNAVAILABLE
    : FILE_COMPLETION_PREVIEW_DIRECTORY_UNAVAILABLE;
}

function boundedFilePreviewLines(
  lines: readonly string[],
  maxLines: number | undefined,
): readonly string[] {
  const resolvedMaxLines = Math.max(
    0,
    Math.floor(maxLines ?? FILE_COMPLETION_PREVIEW_DEFAULT_MAX_LINES),
  );
  return lines.slice(0, resolvedMaxLines);
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
    normalizeFileCompletionText(fileCompletionLabel(entry)).startsWith(
      normalizedQuery,
    )
  );
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
  return normalized === EDIT_COMMAND_NAME || normalized === EDIT_COMMAND_ALIAS;
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
