import { resolveWorkspaceLayout } from '../../ui/drawer-layout.js';
import type { WorkspaceModel } from './model.js';

export const MIN_COLUMNS = 60;
export const MIN_ROWS = 12;
export const VIEWER_LEFT_PAD = 4;
export const VIEWER_TOP_PAD = 1;
export const DRAWER_INNER_PAD = 1;

export interface WorkspaceViewport {
  readonly width: number;
  readonly height: number;
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

export function workspaceBodyHeight(rows: number, footerVisible: boolean): number {
  const footerRows = footerVisible ? 2 : 0;
  return Math.max(1, rows - 2 - footerRows);
}

export function viewerViewport(width: number, height: number): WorkspaceViewport {
  return {
    width: Math.max(1, width - (VIEWER_LEFT_PAD * 2)),
    height: Math.max(1, height - (VIEWER_TOP_PAD * 2)),
  };
}

export function editorViewport(model: Pick<WorkspaceModel, 'columns' | 'rows' | 'fileDrawerProgress' | 'graftDrawerProgress' | 'footerVisible'>): WorkspaceViewport {
  const bodyHeight = workspaceBodyHeight(model.rows, model.footerVisible);
  const layout = resolveWorkspaceLayout(model.columns, model.fileDrawerProgress, model.graftDrawerProgress);
  return viewerViewport(layout.viewer.width, bodyHeight);
}
