import { paintPreviewSyntax } from '../../ui/file-preview-syntax.js';
import { filePreviewSourceLines } from './file-preview-syntax.js';
import { createSurface, stringToSurface, type Surface } from '@flyingrobots/bijou';
import { FilePreviewKinds, type FilePreviewResult } from '../../ports/file-preview.js';
import { fitBlock } from '../../ui/workspace-render.js';
import { fileExplorerHasFocus, selectedFileSearchEntry } from './file-search.js';
import { FileEntryKinds } from '../../ports/file-system.js';
import type { WorkspaceModel } from './model.js';
import { applyBackground, fillSurface } from './surface-fill.js';

const PREVIEW_PAD = 1;
const PAD_MULTIPLIER = 2;
const PREVIEW_BODY_TOP = 3;
const PREVIEW_LABEL = 'fileExplorer.preview_label';
const PREVIEW_LOADING = 'fileExplorer.preview_loading';
const PREVIEW_BINARY = 'fileExplorer.preview_binary';
const PREVIEW_UNAVAILABLE = 'fileExplorer.preview_unavailable';
const PREVIEW_TRUNCATED = 'fileExplorer.preview_truncated';

export function renderFileExplorerPreview(model: WorkspaceModel, width: number, height: number): Surface | undefined {
  if (!fileExplorerHasFocus(model)) return undefined;
  const entry = selectedFileSearchEntry(model);
  if (entry?.kind !== FileEntryKinds.File) return undefined;
  const surface = createSurface(width, height);
  fillSurface(surface, model.jeditTheme.surface.workspace);
  const innerWidth = Math.max(0, width - PREVIEW_PAD * PAD_MULTIPLIER);
  const header = `${model.i18n.t(PREVIEW_LABEL)} · ${entry.name}`;
  const label = stringToSurface(fitBlock(header, innerWidth, 1), innerWidth, 1);
  applyBackground(label, model.jeditTheme.surface.header);
  surface.blit(label, PREVIEW_PAD, PREVIEW_PAD);
  const result = model.fileExplorerPreview?.entry === entry ? model.fileExplorerPreview.result : undefined;
  const lines = previewLines(model, result);
  const bodyHeight = Math.max(0, height - PREVIEW_BODY_TOP - PREVIEW_PAD);
  const body = stringToSurface(fitBlock(lines.join('\n'), innerWidth, bodyHeight), innerWidth, bodyHeight);
  applyBackground(body, model.jeditTheme.surface.workspace);
  surface.blit(body, PREVIEW_PAD, PREVIEW_BODY_TOP);
  if (result?.kind === FilePreviewKinds.Loaded) {
    const offset = result.truncated ? 1 : 0;
    paintPreviewSyntax(surface, filePreviewSourceLines(result.lines), model.fileExplorerPreview?.highlight, {
      x: PREVIEW_PAD, y: PREVIEW_BODY_TOP + offset, width: innerWidth, height: Math.max(0, bodyHeight - offset), theme: model.jeditTheme,
    });
  }
  return surface;
}

function previewLines(model: WorkspaceModel, result: FilePreviewResult | undefined): readonly string[] {
  if (result == null) return [model.i18n.t(PREVIEW_LOADING)];
  if (result.kind === FilePreviewKinds.Binary) return [model.i18n.t(PREVIEW_BINARY)];
  if (result.kind === FilePreviewKinds.Unavailable) return [model.i18n.t(PREVIEW_UNAVAILABLE)];
  const lines = filePreviewSourceLines(result.lines);
  return result.truncated ? [model.i18n.t(PREVIEW_TRUNCATED), ...lines] : lines;
}
