import type { Cell, Surface } from '@flyingrobots/bijou';
import type { WorkspaceLayout } from './drawer-layout.js';
import { FocusPanes, type FocusPane } from './panel-focus.js';
import type { JeditStyleToken } from './jedit-theme.js';

const MIN_EDGE_HEIGHT = 0;

export interface ActivePaneEdgeState {
  readonly focusPane: FocusPane;
  readonly fileDrawerOpen: boolean;
  readonly graftDrawerOpen: boolean;
  readonly historyDrawerOpen: boolean;
  readonly hasEditor: boolean;
}

export interface ActivePaneEdgeBounds {
  readonly top: number;
  readonly height: number;
}

type CellStyle = Pick<Cell, 'fg' | 'bg' | 'fgRGB' | 'bgRGB' | 'modifiers'>;

export function paintActivePaneEdge(
  surface: Surface,
  layout: WorkspaceLayout,
  state: ActivePaneEdgeState,
  token: JeditStyleToken,
  bounds: ActivePaneEdgeBounds,
): void {
  const x = activePaneEdgeX(layout, state);
  if (x == null || x < 0 || x >= surface.width || token.char == null || token.char.length === 0) {
    return;
  }

  const top = Math.max(0, bounds.top);
  const bottom = Math.min(surface.height, top + Math.max(MIN_EDGE_HEIGHT, bounds.height));
  for (let y = top; y < bottom; y += 1) {
    const cell = surface.get(x, y);
    surface.set(x, y, {
      ...cell,
      char: token.char,
      ...edgeStyle(cell, token),
      empty: false,
    });
  }
}

export function activePaneEdgeX(layout: WorkspaceLayout, state: ActivePaneEdgeState): number | undefined {
  if (state.focusPane === FocusPanes.Files) {
    return visiblePaneEdgeX({ visible: state.fileDrawerOpen, width: layout.fileDrawer.width, x: layout.fileDrawer.x });
  }

  if (state.focusPane === FocusPanes.Graft) {
    return visiblePaneEdgeX({ visible: state.graftDrawerOpen, width: layout.graftDrawer.width, x: layout.graftDrawer.x });
  }

  if (state.focusPane === FocusPanes.History) {
    return visiblePaneEdgeX({ visible: state.historyDrawerOpen, width: layout.historyDrawer.width, x: layout.historyDrawer.x });
  }

  return visiblePaneEdgeX({ visible: state.hasEditor, width: layout.viewer.width, x: layout.viewer.x });
}

function visiblePaneEdgeX(options: { readonly visible: boolean; readonly width: number; readonly x: number }): number | undefined {
  return options.visible && options.width > 0 ? options.x : undefined;
}

function edgeStyle(cell: Cell, token: JeditStyleToken): CellStyle {
  return {
    fg: token.fg ?? cell.fg,
    bg: token.bg ?? cell.bg,
    fgRGB: token.fgRGB ?? cell.fgRGB,
    bgRGB: token.bgRGB ?? cell.bgRGB,
    modifiers: token.modifiers == null ? cell.modifiers : [...token.modifiers],
  };
}
