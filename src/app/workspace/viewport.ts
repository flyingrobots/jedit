import { resolveWorkspaceLayout } from '../../ui/drawer-layout.js';
import { sourceViewerGutterWidth } from '../../ui/source-viewer.js';
import type { WorkspaceModel } from './model.js';

export const MIN_COLUMNS = 60;
export const MIN_ROWS = 12;
export const VIEWER_LEFT_PAD = 4;
export const VIEWER_TOP_PAD = 1;
export const DRAWER_INNER_PAD = 1;
// Rows above the workspace body: the title row and its rule. Shared so pointer
// hit-testing and the renderer cannot disagree about where the body starts.
export const WORKSPACE_BODY_TOP_OFFSET = 2;
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

// List selection cycles rather than stopping dead at either end. An empty list
// has no entry to land on, so it stays at zero instead of wrapping onto nothing.
export function wrapIndex(index: number, size: number): number {
  if (size <= 0) {
    return 0;
  }
  return ((index % size) + size) % size;
}

// The drawer list is windowed rather than truncated. Deriving the offset from
// the selection keeps it stateless, so the renderer and pointer hit-testing
// always agree on which entry a row shows without a scroll field in the model.
export function listScrollOffset(
  selectedIndex: number,
  total: number,
  height: number,
): number {
  const visibleRows = Math.max(1, height);
  if (total <= visibleRows) {
    return 0;
  }
  const centred = selectedIndex - Math.floor(visibleRows / 2);
  return Math.max(0, Math.min(total - visibleRows, centred));
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
  'columns' | 'rows' | 'fileDrawerProgress' | 'graftDrawerProgress' | 'footerVisible'
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
