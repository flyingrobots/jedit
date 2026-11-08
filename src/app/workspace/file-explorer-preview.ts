import type { PreviewHighlighter, SourceHighlightReading } from '../../ports/source-highlighter.js';
import { highlightFilePreview } from './file-preview-syntax.js';
import type { Cmd } from '@flyingrobots/bijou-tui';
import { FilePreviewKinds, FILE_PREVIEW_MAX_LINES, type FilePreviewSource, type FilePreviewResult } from '../../ports/file-preview.js';
import { FileEntryKinds, type FileEntry } from '../../ports/file-system.js';
import { fileExplorerHasFocus, selectedFileSearchEntry } from './file-search.js';
import { findWorkspaceBufferRecordByPath } from './workspace-buffer-registry.js';
import { isWorkspaceTextAuthorityOpened, type WorkspaceTextAuthorityOpened } from './workspace-text-authority.js';
import type { WorkspaceTextReadingCache } from './workspace-text-reading-cache.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from './msg.js';
import type { WorkspaceModel } from './model.js';
import type { EditorState } from './editor/model.js';

export interface FileExplorerPreview {
  readonly requestId: number;
  readonly entry: FileEntry;
  readonly result?: FilePreviewResult;
  readonly highlight?: SourceHighlightReading;
}

export interface FileExplorerPreviewMessage extends FileExplorerPreview {
  readonly result: FilePreviewResult;
}

type Result = [WorkspaceModel, Cmd<WorkspaceMsg>[]];
const FIRST_LINE = 0;
type LoadedFilePreview = Extract<FilePreviewResult, { readonly kind: typeof FilePreviewKinds.Loaded }>;

export function synchronizeFileExplorerPreview(result: Result, source: FilePreviewSource | undefined, highlighter?: PreviewHighlighter): Result {
  const [model, commands] = result;
  const entry = fileExplorerHasFocus(model) ? selectedFileSearchEntry(model) : undefined;
  if (entry?.kind !== FileEntryKinds.File) return clearFileExplorerPreview(result);
  if (model.fileExplorerPreview?.entry === entry) return result;
  const requestId = (model.fileExplorerPreviewRequestId ?? 0) + 1;
  const preview = { requestId, entry, result: bufferPreview(model, entry.path) };
  if (preview.result == null && source == null) return result;
  const next = { ...model, fileExplorerPreviewRequestId: requestId, fileExplorerPreview: preview };
  return [next, [...commands, ...previewLoadCommands(preview, source, highlighter)]];
}

export function applyFileExplorerPreview(model: WorkspaceModel, msg: FileExplorerPreviewMessage): WorkspaceModel {
  return model.fileExplorerPreview?.requestId === msg.requestId &&
    model.fileExplorerPreview.entry === msg.entry && fileExplorerHasFocus(model)
    ? { ...model, fileExplorerPreview: msg }
    : model;
}

function clearFileExplorerPreview(result: Result): Result {
  return result[0].fileExplorerPreview == null
    ? result
    : [{ ...result[0], fileExplorerPreview: undefined }, result[1]];
}

// Open buffers preview their current text-authority reading, not the editor
// projection, which can be a stale opening window. A reading that does not start
// at the first line cannot show the file's head: a clean buffer falls back to the
// saved file, while a modified buffer reports its unsaved state rather than
// silently previewing stale disk text.
function bufferPreview(model: WorkspaceModel, path: string): FilePreviewResult | undefined {
  const buffer = openedBuffer(model, path);
  if (buffer != null) return pendingProjectionPreview(buffer) ?? readingPreview(buffer.authority.cache) ?? unsavedBufferPreview(buffer);
  return model.editor?.path === path ? linesPreview(model.editor.lines, model.editor.lines.length) : undefined;
}

interface OpenedBuffer {
  readonly authority: WorkspaceTextAuthorityOpened;
  readonly projection?: EditorState;
}

function openedBuffer(model: WorkspaceModel, path: string): OpenedBuffer | undefined {
  if (isWorkspaceTextAuthorityOpened(model.textAuthority) && model.textAuthority.filePath === path) {
    return { authority: model.textAuthority, projection: model.editor?.path === path ? model.editor : undefined };
  }
  const record = findWorkspaceBufferRecordByPath(model, path);
  return record == null ? undefined : { authority: record.textAuthority, projection: record.editorProjection };
}

// `dirty` on the authority is the durability view (a pending edit is not yet
// dirty); the editor projection's own flag is also honoured. Disk is only a
// faithful preview when neither reports unsaved text.
// A dirty projection over a clean authority means an edit is still pending: the
// authority's reading, even at the file head, does not contain it yet.
function pendingProjectionPreview(buffer: OpenedBuffer): FilePreviewResult | undefined {
  return buffer.projection?.dirty === true && !buffer.authority.dirty ? { kind: FilePreviewKinds.UnsavedBuffer } : undefined;
}

function unsavedBufferPreview(buffer: OpenedBuffer): FilePreviewResult | undefined {
  return buffer.authority.dirty || buffer.projection?.dirty === true ? { kind: FilePreviewKinds.UnsavedBuffer } : undefined;
}

function readingPreview(cache: WorkspaceTextReadingCache | undefined): FilePreviewResult | undefined {
  if (cache == null || cache.startLine !== FIRST_LINE) return undefined;
  const preview = linesPreview(cache.lines, cache.totalLineCount);
  return cache.truncated ? { ...preview, truncated: true } : preview;
}

function linesPreview(lines: readonly string[], totalLineCount: number): LoadedFilePreview {
  const shown = lines.slice(0, FILE_PREVIEW_MAX_LINES);
  return { kind: FilePreviewKinds.Loaded, lines: shown, truncated: totalLineCount > shown.length };
}

function loadPreviewCmd(preview: FileExplorerPreview, source: FilePreviewSource | undefined, highlighter?: PreviewHighlighter): Cmd<WorkspaceMsg> {
  return async () => {
    let result: FilePreviewResult;
    try { result = preview.result ?? source?.loadFilePreview(preview.entry.path) ?? { kind: FilePreviewKinds.Unavailable }; }
    catch { result = { kind: FilePreviewKinds.Unavailable }; }
    return { type: WorkspaceMessageTypes.FileExplorerPreviewResult, ...preview, result,
      highlight: await highlightFilePreview(preview.entry.path, result, highlighter) };
  };
}

function previewLoadCommands(preview: FileExplorerPreview, source: FilePreviewSource | undefined, highlighter?: PreviewHighlighter): Cmd<WorkspaceMsg>[] {
  return preview.result != null && highlighter == null ? [] : [loadPreviewCmd(preview, source, highlighter)];
}
