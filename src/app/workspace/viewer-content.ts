import { renderFileExplorerPreview } from './file-explorer-preview-view.js';
import { createSurface, type Surface } from '@flyingrobots/bijou';
import { paintMarkdownPreview } from '../../ui/markdown-preview.js';
import { renderSourceViewer } from '../../ui/source-viewer.js';
import type { JeditTheme } from '../../ui/jedit-theme.js';
import type { WorkspaceModel } from './model.js';
import { isWorkspaceMarkdownFile } from './editor-session.js';
import { ViewModes } from './view-mode.js';
import { VIEWER_LEFT_PAD, VIEWER_TOP_PAD } from './viewport.js';
import {
  causalSourceGutterDeletionMarkers,
  sourceGutterLineMarkers,
  displayEditorForWorkspaceModel,
  sourceHighlightForWorkspaceProjection,
  sourceWindowForWorkspaceModel,
} from './workspace-source-projection.js';
import { fillSurface, renderJimLogoScreen } from './surface-fill.js';

const MIN_VIEWPORT_DIMENSION = 1;
const VIEWER_PAD_MULTIPLIER = 2;

export interface ViewerContentRenderer {
  renderViewer(model: WorkspaceModel, width: number, height: number): Surface;
}

export function createViewerContentRenderer(): ViewerContentRenderer {
  return { renderViewer };
}

export function renderViewer(model: WorkspaceModel, width: number, height: number): Surface {
  const explorerPreview = renderFileExplorerPreview(model, width, height);
  if (explorerPreview != null) return explorerPreview;
  const editor = displayEditorForWorkspaceModel(model);
  if (editor == null) {
    return renderJimLogoScreen(width, height, model.jeditTheme);
  }

  const surface = createSurface(width, height);
  fillSurface(surface, model.jeditTheme.surface.workspace);

  if (
    model.viewMode === ViewModes.Preview &&
    isWorkspaceMarkdownFile(editor.path)
  ) {
    return renderPreview(surface, editor, model.jeditTheme, width, height);
  }

  const viewport = viewerViewport(width, height);
  return renderSourceViewer(
    surface,
    editor,
    sourceHighlightForWorkspaceProjection(model, editor.path),
    {
      viewport,
      leftPad: VIEWER_LEFT_PAD,
      topPad: VIEWER_TOP_PAD,
      theme: model.jeditTheme,
      lineNumberMode: model.lineNumberMode,
      gutterDimmed: model.gutterDimmed,
      lineMarkers: sourceGutterLineMarkers(model),
      deletionMarkers: causalSourceGutterDeletionMarkers(model),
      reading: sourceWindowForWorkspaceModel(model),
    },
  );
}

export function isWorkspaceMarkdownPreviewAvailable(
  model: WorkspaceModel,
): boolean {
  const editor = displayEditorForWorkspaceModel(model);
  return editor != null && isWorkspaceMarkdownFile(editor.path);
}
function renderPreview(
  surface: Surface,
  editor: WorkspaceModel["editor"],
  theme: JeditTheme,
  width: number,
  height: number,
): Surface {
  const viewport = viewerViewport(width, height);
  paintMarkdownPreview(surface, {
    text: editor?.lines.join("\n") ?? "",
    scrollRow: editor?.scrollRow ?? 0,
    x: VIEWER_LEFT_PAD,
    y: VIEWER_TOP_PAD,
    width: viewport.width,
    height: viewport.height,
    theme,
  });
  return surface;
}

function viewerViewport(
  width: number,
  height: number,
): { width: number; height: number } {
  return {
    width: Math.max(MIN_VIEWPORT_DIMENSION, width - VIEWER_LEFT_PAD * VIEWER_PAD_MULTIPLIER),
    height: Math.max(MIN_VIEWPORT_DIMENSION, height - VIEWER_TOP_PAD * VIEWER_PAD_MULTIPLIER),
  };
}
