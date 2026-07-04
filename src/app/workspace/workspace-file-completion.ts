import {
  INLINE_COMPLETION_ITEM_KIND,
  type InlineCompletionItem,
} from "../../ui/inline-completion-popup.js";
import { FileEntryKinds, type FileEntry } from "../../ports/file-system.js";
import { workspaceCompletionMatches } from "./workspace-completion-match.js";

export interface WorkspaceFileCompletionContext {
  readonly query: string;
  readonly replacementStart: number;
  readonly replacementEnd: number;
}

export const WORKSPACE_FILE_PROVIDER_ID = "workspace-file";
const FILE_COMPLETION_PARENT_LABEL = "../";
const FILE_COMPLETION_DIRECTORY_SUFFIX = "/";
const FILE_COMPLETION_FILE_DETAIL = "File";
const FILE_COMPLETION_DIRECTORY_DETAIL = "Directory";
const FILE_COMPLETION_PARENT_DETAIL = "Parent directory";

export function workspaceFileCompletionItems(
  entries: readonly FileEntry[],
  context: WorkspaceFileCompletionContext,
): readonly InlineCompletionItem[] {
  return workspaceFileCompletionEntries(entries, context)
    .map((entry) => workspaceFileCompletionItem(entry, context));
}

export function workspaceFileCompletionEntries(
  entries: readonly FileEntry[],
  context: WorkspaceFileCompletionContext,
): readonly FileEntry[] {
  return entries.filter((entry) =>
    workspaceCompletionMatches(fileCompletionLabel(entry), context.query)
  );
}

export function workspaceFileCompletionItem(
  entry: FileEntry,
  context: WorkspaceFileCompletionContext,
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
