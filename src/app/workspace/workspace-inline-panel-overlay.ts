import type { Surface } from "@flyingrobots/bijou";
import { resolveWorkspaceLayout } from "../../ui/drawer-layout.js";
import { renderWhyInlinePanel } from "../../ui/why-inline-panel.js";
import { sourceViewerGutterWidth } from "../../ui/source-viewer.js";
import type { WorkspaceModel } from "./model.js";
import {
  VIEWER_LEFT_PAD,
  VIEWER_TOP_PAD,
  viewerViewport,
} from "./viewport.js";

const INLINE_PANEL_MAX_WIDTH = 74;
const INLINE_PANEL_MAX_ROWS = 8;
const INLINE_PANEL_EDGE_INSET = 1;
const INLINE_PANEL_ROW_STEP = 1;
const INLINE_PANEL_MIN_WIDTH = 1;

export function paintWorkspaceInlinePanelOverlay(
  screen: Surface,
  model: WorkspaceModel,
  bodyTop: number,
  bodyHeight: number,
): void {
  if (model.inlinePanel == null || model.editor == null) {
    return;
  }
  const placement = inlinePanelPlacement(model, bodyTop, bodyHeight);
  if (placement == null) {
    return;
  }
  const panel = renderWhyInlinePanel({
    title: model.inlinePanel.title,
    message: model.inlinePanel.message,
    tone: model.inlinePanel.tone,
    theme: model.jeditTheme,
    width: placement.width,
    maxRows: INLINE_PANEL_MAX_ROWS,
  });
  screen.blit(
    panel,
    placement.x,
    inlinePanelY(placement.anchorY, bodyTop, bodyHeight, panel.height),
  );
}

function inlinePanelPlacement(
  model: WorkspaceModel,
  bodyTop: number,
  bodyHeight: number,
): { readonly x: number; readonly anchorY: number; readonly width: number } | undefined {
  const editor = model.editor;
  const panel = model.inlinePanel;
  if (editor == null || panel == null) {
    return undefined;
  }
  const layout = resolveWorkspaceLayout(
    model.columns,
    model.fileDrawerProgress,
    model.graftDrawerProgress,
    model.historyDrawerProgress,
  );
  const viewport = viewerViewport(layout.viewer.width, bodyHeight);
  const anchorViewportRow = panel.anchorRow - editor.scrollRow;
  if (anchorViewportRow < 0 || anchorViewportRow >= viewport.height) {
    return undefined;
  }
  const gutterWidth = sourceViewerGutterWidth(editor.lines.length, panel.anchorRow, model.lineNumberMode);
  const textViewportWidth = Math.max(INLINE_PANEL_MIN_WIDTH, viewport.width - gutterWidth);
  const anchorViewportColumn = panel.anchorColumn - editor.scrollCol;
  if (anchorViewportColumn < 0 || anchorViewportColumn >= textViewportWidth) {
    return undefined;
  }
  const sourceX = layout.viewer.x +
    VIEWER_LEFT_PAD +
    gutterWidth +
    anchorViewportColumn;
  const maxWidth = Math.max(
    INLINE_PANEL_MIN_WIDTH,
    layout.viewer.x + layout.viewer.width - sourceX - INLINE_PANEL_EDGE_INSET,
  );
  return {
    x: sourceX,
    anchorY: bodyTop + VIEWER_TOP_PAD + anchorViewportRow,
    width: Math.min(INLINE_PANEL_MAX_WIDTH, maxWidth),
  };
}

function inlinePanelY(
  anchorY: number,
  bodyTop: number,
  bodyHeight: number,
  panelHeight: number,
): number {
  const belowY = anchorY + INLINE_PANEL_ROW_STEP;
  const bodyBottom = bodyTop + bodyHeight;
  return belowY + panelHeight <= bodyBottom
    ? belowY
    : Math.max(bodyTop, anchorY - panelHeight);
}
