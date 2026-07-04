import {
  INLINE_COMPLETION_PREVIEW_KIND,
  type InlineCompletionItem,
  type InlineCompletionPreview,
} from "../../ui/inline-completion-popup.js";
import type { Cmd } from "@flyingrobots/bijou-tui";
import {
  isLoadedEditorFile,
  isMissingEditorFile,
  type EditorFilePort,
} from "../../ports/editor-file.js";
import { FileEntryKinds, type FileEntry } from "../../ports/file-system.js";
import {
  selectedWorkspaceCommandLineFileCompletion,
  selectedWorkspaceCommandLineCompletionItem,
  workspaceCommandLineCompletionPreviewForItem,
  type WorkspaceSelectedCommandLineCompletionContext,
} from "./command-completion.js";
import { WORKSPACE_FILE_PROVIDER_ID } from "./workspace-file-completion.js";

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

export type WorkspaceCommandLineFilePreviewIdentity = FileEntry;

export interface WorkspaceCommandLineFilePreviewSelection {
  readonly identity: WorkspaceCommandLineFilePreviewIdentity;
  readonly filePath: string;
}

export interface WorkspaceCommandLineFilePreview
  extends WorkspaceCommandLineFilePreviewSelection {
  readonly result: WorkspaceFilePreviewResult;
}

export interface WorkspaceCommandLineFilePreviewState {
  readonly commandLineFilePreview?: WorkspaceCommandLineFilePreview;
  readonly commandLineFilePreviewRequestId: number;
  readonly commandLineFilePreviewRequest?: WorkspaceCommandLineFilePreviewSelection;
}

export interface WorkspaceCommandLineFilePreviewMsg {
  readonly requestId: number;
  readonly selection: WorkspaceCommandLineFilePreviewSelection;
  readonly result: WorkspaceFilePreviewResult;
}

export type WorkspaceCommandLineFilePreviewMessageMapper<M> = (
  msg: WorkspaceCommandLineFilePreviewMsg,
) => M;

export interface WorkspaceCommandLineFilePreviewCommandRequest<M> {
  readonly requestId: number;
  readonly selection: WorkspaceCommandLineFilePreviewSelection;
  readonly previewSource: WorkspaceFilePreviewSource;
  readonly mapMessage: WorkspaceCommandLineFilePreviewMessageMapper<M>;
}

export interface WorkspaceCommandLineCompletionPreviewContext
  extends WorkspaceSelectedCommandLineCompletionContext {
  readonly filePreview?: WorkspaceCommandLineFilePreview;
  readonly maxPreviewLines?: number;
}

const FILE_COMPLETION_PREVIEW_DEFAULT_MAX_LINES = 5;
const FILE_COMPLETION_PREVIEW_SOURCE_UNAVAILABLE = "Preview unavailable";
const FILE_COMPLETION_PREVIEW_DIRECTORY_UNAVAILABLE =
  "Directory preview unavailable";
const FILE_COMPLETION_PREVIEW_PARENT_UNAVAILABLE =
  "Parent directory preview unavailable";
const FILE_COMPLETION_PREVIEW_UNAVAILABLE_POSTURE = "unavailable";
const FILE_COMPLETION_PREVIEW_LOADED_POSTURE = "loaded";

export function workspaceCommandLineCompletionPreview(
  context: WorkspaceCommandLineCompletionPreviewContext,
): InlineCompletionPreview | undefined {
  const completion = selectedWorkspaceCommandLineFileCompletion(context);
  if (completion == null) {
    return workspaceCommandLineCompletionPreviewForSelectedItem(context);
  }

  const { item, entry } = completion;
  if (entry.kind !== FileEntryKinds.File) {
    return unavailableFileCompletionPreview(
      item,
      unavailableFileCompletionReason(entry),
    );
  }

  const result = previewResultForEntry(context.filePreview, entry);
  if (result.kind === WORKSPACE_FILE_PREVIEW_RESULT_KIND.Unavailable) {
    return unavailableFileCompletionPreview(
      item,
      result.reason,
      result.evidencePosture,
    );
  }

  return loadedFileCompletionPreview(item, result, context.maxPreviewLines);
}

function workspaceCommandLineCompletionPreviewForSelectedItem(
  context: WorkspaceCommandLineCompletionPreviewContext,
): InlineCompletionPreview | undefined {
  const selected = selectedWorkspaceCommandLineCompletionItem(context);
  return selected == null
    ? undefined
    : workspaceCommandLineCompletionPreviewForItem(selected);
}

export function selectedWorkspaceCommandLineFilePreviewSelection(
  context: WorkspaceSelectedCommandLineCompletionContext,
): WorkspaceCommandLineFilePreviewSelection | undefined {
  const completion = selectedWorkspaceCommandLineFileCompletion(context);
  return completion?.entry.kind === FileEntryKinds.File
    ? commandLineFilePreviewSelection(completion.entry)
    : undefined;
}

export function workspaceEditorFilePreviewSource(
  editorFile: Pick<EditorFilePort, "loadEditorFile">,
): WorkspaceFilePreviewSource {
  return {
    loadFilePreview(filePath) {
      const file = editorFile.loadEditorFile(filePath);
      if (isMissingEditorFile(file) || !isLoadedEditorFile(file)) {
        return unavailableFilePreviewResult();
      }
      return {
        kind: WORKSPACE_FILE_PREVIEW_RESULT_KIND.Loaded,
        lines: file.lines,
        evidencePosture: FILE_COMPLETION_PREVIEW_LOADED_POSTURE,
      };
    },
  };
}

export function createWorkspaceCommandLineFilePreviewCmd<M>(
  request: WorkspaceCommandLineFilePreviewCommandRequest<M>,
): Cmd<M> {
  return () =>
    request.mapMessage({
      requestId: request.requestId,
      selection: request.selection,
      result: loadFilePreviewResult(
        request.previewSource,
        request.selection.filePath,
      ),
    });
}

export function applyWorkspaceCommandLineFilePreviewResult<
  Model extends WorkspaceCommandLineFilePreviewState,
>(model: Model, msg: WorkspaceCommandLineFilePreviewMsg): Model {
  return commandLineFilePreviewResultMatchesLiveRequest(model, msg)
    ? {
        ...model,
        commandLineFilePreview: {
          ...msg.selection,
          result: msg.result,
        },
        commandLineFilePreviewRequest: undefined,
      }
    : model;
}

export function clearWorkspaceCommandLineFilePreview<
  Model extends WorkspaceCommandLineFilePreviewState,
>(model: Model): Model {
  return {
    ...model,
    commandLineFilePreview: undefined,
    commandLineFilePreviewRequest: undefined,
  };
}

function commandLineFilePreviewSelection(
  entry: FileEntry,
): WorkspaceCommandLineFilePreviewSelection {
  return {
    identity: entry,
    filePath: entry.path,
  };
}

function commandLineFilePreviewResultMatchesLiveRequest(
  model: WorkspaceCommandLineFilePreviewState,
  msg: WorkspaceCommandLineFilePreviewMsg,
): boolean {
  return (
    msg.requestId === model.commandLineFilePreviewRequestId &&
    model.commandLineFilePreviewRequest?.identity === msg.selection.identity
  );
}

function previewResultForEntry(
  preview: WorkspaceCommandLineFilePreview | undefined,
  entry: FileEntry,
): WorkspaceFilePreviewResult {
  return preview?.identity === entry
    ? preview.result
    : unavailableFilePreviewResult();
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
