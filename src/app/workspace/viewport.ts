import { footerLayoutRows, type FooterLayout } from '../../ui/footer-layout.js';
export { wrapIndex } from '../list-index.js';
import { resolveWorkspaceLayout } from '../../ui/drawer-layout.js';
import { sourceViewerGutterWidth } from '../../ui/source-viewer.js';
import type { WorkspaceModel } from './model.js';

export const MIN_COLUMNS = 60;
export const MIN_ROWS = 12;
export const VIEWER_LEFT_PAD = 4;
export const VIEWER_TOP_PAD = 1;
export const DRAWER_INNER_PAD = 1;
export const FILE_SEARCH_ROW = DRAWER_INNER_PAD;
export const FILE_SEARCH_SEPARATOR_ROW = FILE_SEARCH_ROW + 1;
export const FILE_SEARCH_LIST_TOP = FILE_SEARCH_SEPARATOR_ROW + 1;

export function fileSearchListHeight(height: number): number {
  return Math.max(0, height - FILE_SEARCH_LIST_TOP - DRAWER_INNER_PAD);
}
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
  readonly footerLayout?: FooterLayout;
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

export function workspaceFooterRows(options: Pick<WorkspaceBodyHeightOptions, 'footerVisible' | 'footerLayout'>): number {
  return options.footerVisible ? footerLayoutRows(options.footerLayout) : 0;
}

export function workspaceBodyHeight(options: WorkspaceBodyHeightOptions): number {
  const footerRows = workspaceFooterRows(options);
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
> & Partial<Pick<WorkspaceModel, 'editor' | 'lineNumberMode' | 'footerLayout'>>;

export function editorViewport(model: WorkspaceViewportModel): WorkspaceViewport {
  const bodyHeight = workspaceBodyHeight(model);
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
