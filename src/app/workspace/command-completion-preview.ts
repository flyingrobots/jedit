import {
  INLINE_COMPLETION_PREVIEW_KIND,
  type InlineCompletionItem,
  type InlineCompletionPreview,
} from "../../ui/inline-completion-popup.js";
import type { EditorFilePort } from "../../ports/editor-file.js";
import { FileEntryKinds, type FileEntry } from "../../ports/file-system.js";
import {
  selectedWorkspaceCommandLineCompletionItem,
  WORKSPACE_FILE_PROVIDER_ID,
  type WorkspaceSelectedCommandLineCompletionContext,
} from "./command-completion.js";

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

const FILE_COMPLETION_PREVIEW_DEFAULT_MAX_LINES = 5;
const FILE_COMPLETION_PREVIEW_SOURCE_UNAVAILABLE = "Preview unavailable";
const FILE_COMPLETION_PREVIEW_DIRECTORY_UNAVAILABLE =
  "Directory preview unavailable";
const FILE_COMPLETION_PREVIEW_PARENT_UNAVAILABLE =
  "Parent directory preview unavailable";
const FILE_COMPLETION_PREVIEW_ENTRY_UNAVAILABLE =
  "Completion entry unavailable";
const FILE_COMPLETION_PREVIEW_UNAVAILABLE_POSTURE = "unavailable";
const FILE_COMPLETION_PREVIEW_LOADED_POSTURE = "loaded";

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

export function workspaceEditorFilePreviewSource(
  editorFile: Pick<EditorFilePort, "loadEditorFile">,
): WorkspaceFilePreviewSource {
  return {
    loadFilePreview(filePath) {
      const file = editorFile.loadEditorFile(filePath);
      return {
        kind: WORKSPACE_FILE_PREVIEW_RESULT_KIND.Loaded,
        lines: file.lines,
        evidencePosture: FILE_COMPLETION_PREVIEW_LOADED_POSTURE,
      };
    },
  };
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
