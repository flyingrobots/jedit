import type { Cmd } from '@flyingrobots/bijou-tui';
import { FilePreviewKinds, FILE_PREVIEW_MAX_LINES, type FilePreviewSource, type FilePreviewResult } from '../../ports/file-preview.js';
import { FileEntryKinds, type FileEntry } from '../../ports/file-system.js';
import { fileExplorerHasFocus, selectedFileSearchEntry } from './file-search.js';
import { findWorkspaceBufferRecordByPath } from './workspace-buffer-registry.js';
import { isWorkspaceTextAuthorityOpened } from './workspace-text-authority.js';
import type { WorkspaceTextReadingCache } from './workspace-text-reading-cache.js';
import { WorkspaceMessageTypes, type WorkspaceMsg } from './msg.js';
import type { WorkspaceModel } from './model.js';

export interface FileExplorerPreview {
  readonly requestId: number;
  readonly entry: FileEntry;
  readonly result?: FilePreviewResult;
}

export interface FileExplorerPreviewMessage extends FileExplorerPreview {
  readonly result: FilePreviewResult;
}

type Result = [WorkspaceModel, Cmd<WorkspaceMsg>[]];
const FIRST_LINE = 0;
type LoadedFilePreview = Extract<FilePreviewResult, { readonly kind: typeof FilePreviewKinds.Loaded }>;

export function synchronizeFileExplorerPreview(result: Result, source: FilePreviewSource | undefined): Result {
  const [model, commands] = result;
  const entry = fileExplorerHasFocus(model) ? selectedFileSearchEntry(model) : undefined;
  if (entry?.kind !== FileEntryKinds.File) return clearFileExplorerPreview(result);
  if (model.fileExplorerPreview?.entry === entry || source == null) return result;
  const requestId = (model.fileExplorerPreviewRequestId ?? 0) + 1;
  const preview = { requestId, entry, result: bufferPreview(model, entry.path) };
  const next = { ...model, fileExplorerPreviewRequestId: requestId, fileExplorerPreview: preview };
  return preview.result != null ? [next, commands] : [next, [...commands, loadPreviewCmd(preview, source)]];
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
// at the first line cannot show the file's head, so the file is read instead.
function bufferPreview(model: WorkspaceModel, path: string): FilePreviewResult | undefined {
  const authority = isWorkspaceTextAuthorityOpened(model.textAuthority) && model.textAuthority.filePath === path
    ? model.textAuthority
    : findWorkspaceBufferRecordByPath(model, path)?.textAuthority;
  if (authority != null) return readingPreview(authority.cache);
  return model.editor?.path === path ? linesPreview(model.editor.lines, model.editor.lines.length) : undefined;
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

function loadPreviewCmd(preview: FileExplorerPreview, source: FilePreviewSource): Cmd<WorkspaceMsg> {
  return () => {
    let result: FilePreviewResult;
    try { result = source.loadFilePreview(preview.entry.path); }
    catch { result = { kind: FilePreviewKinds.Unavailable }; }
    return { type: WorkspaceMessageTypes.FileExplorerPreviewResult, ...preview, result };
  };
}
