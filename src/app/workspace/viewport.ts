import { resolveWorkspaceLayout } from '../../ui/drawer-layout.js';
import { sourceViewerGutterWidth } from '../../ui/source-viewer.js';
import type { WorkspaceModel } from './model.js';

export const MIN_COLUMNS = 60;
export const MIN_ROWS = 12;
export const VIEWER_LEFT_PAD = 4;
export const VIEWER_TOP_PAD = 1;
export const DRAWER_INNER_PAD = 1;
export const HEADER_ROWS = 2;
export const FOOTER_ROWS = 2;

export interface WorkspaceViewport {
  readonly width: number;
  readonly height: number;
}

export interface WorkspaceBodyHeightOptions {
  readonly rows: number;
  readonly footerVisible: boolean;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

export function clampIndex(index: number, size: number): number {
  if (size <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(size - 1, index));
}

export function workspaceBodyHeight(options: WorkspaceBodyHeightOptions): number {
  const footerRows = options.footerVisible ? FOOTER_ROWS : 0;
  return Math.max(1, options.rows - HEADER_ROWS - footerRows);
}

export function viewerViewport(width: number, height: number): WorkspaceViewport {
  return {
    width: Math.max(1, width - (VIEWER_LEFT_PAD * 2)),
    height: Math.max(1, height - (VIEWER_TOP_PAD * 2)),
  };
}

type WorkspaceViewportModel = Pick<
  WorkspaceModel,
  'columns' | 'rows' | 'fileDrawerProgress' | 'graftDrawerProgress' | 'historyDrawerProgress' | 'footerVisible'
> & Partial<Pick<WorkspaceModel, 'editor' | 'lineNumberMode'>>;

export function editorViewport(model: WorkspaceViewportModel): WorkspaceViewport {
  const bodyHeight = workspaceBodyHeight({
    rows: model.rows,
    footerVisible: model.footerVisible,
  });
  const layout = resolveWorkspaceLayout(
    model.columns,
    model.fileDrawerProgress,
    model.graftDrawerProgress,
    model.historyDrawerProgress,
  );
  const viewport = viewerViewport(layout.viewer.width, bodyHeight);
  return {
    ...viewport,
    width: editorTextViewportWidth(model, viewport.width),
  };
}

function editorTextViewportWidth(model: WorkspaceViewportModel, viewerWidth: number): number {
  if (model.editor == null || model.lineNumberMode == null) {
    return viewerWidth;
  }
  const gutterWidth = sourceViewerGutterWidth(
    model.editor.lines.length,
    model.editor.cursorRow,
    model.lineNumberMode,
  );
  return Math.max(1, viewerWidth - gutterWidth);
}
