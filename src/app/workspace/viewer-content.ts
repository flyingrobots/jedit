import { createSurface, type Surface } from '@flyingrobots/bijou';
import { paintMarkdownPreview } from '../../ui/markdown-preview.js';
import { renderSourceViewer } from '../../ui/source-viewer.js';
import { renderTitleScreen } from '../../ui/title-screen.js';
import type { JeditTheme } from '../../ui/jedit-theme.js';
import type { WorkspaceModel } from './model.js';
import { isWorkspaceMarkdownFile } from './editor-session.js';
import { ViewModes } from './view-mode.js';
import {
  VIEWER_LEFT_PAD,
  VIEWER_TOP_PAD,
} from './viewport.js';
import { fillSurface } from './surface-fill.js';

const MIN_VIEWPORT_DIMENSION = 1;
const VIEWER_PAD_MULTIPLIER = 2;

export function renderViewer(model: WorkspaceModel, width: number, height: number): Surface {
  if (model.editor == null) {
    return renderTitleScreen(width, height, model.time, model.jeditTheme, {
      camAngle: model.titleCamera.angle,
      camRadius: model.titleCamera.radius,
      sceneSeed: model.titleSceneSeed,
      mesh: model.titleMeshes.bunny,
      sceneOverride: model.sceneOverride,
      renderMode: model.titleRenderMode,
      asciiPalette: model.titleAsciiPalette,
    });
  }

  const surface = createSurface(width, height);
  fillSurface(surface, model.jeditTheme.surface.workspace);

  if (model.viewMode === ViewModes.Preview && isWorkspaceMarkdownFile(model.editor.path)) {
    return renderPreview(surface, model.editor, model.jeditTheme, width, height);
  }

  const viewport = viewerViewport(width, height);
  return renderSourceViewer(surface, model.editor, model.sourceHighlight?.path === model.editor.path ? model.sourceHighlight : undefined, {
    viewport,
    leftPad: VIEWER_LEFT_PAD,
    topPad: VIEWER_TOP_PAD,
    theme: model.jeditTheme,
  });
}

function renderPreview(surface: Surface, editor: WorkspaceModel['editor'], theme: JeditTheme, width: number, height: number): Surface {
  const viewport = viewerViewport(width, height);
  paintMarkdownPreview(surface, {
    text: editor?.lines.join('\n') ?? '',
    scrollRow: editor?.scrollRow ?? 0,
    x: VIEWER_LEFT_PAD,
    y: VIEWER_TOP_PAD,
    width: viewport.width,
    height: viewport.height,
    theme,
  });
  return surface;
}

function viewerViewport(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.max(MIN_VIEWPORT_DIMENSION, width - (VIEWER_LEFT_PAD * VIEWER_PAD_MULTIPLIER)),
    height: Math.max(MIN_VIEWPORT_DIMENSION, height - (VIEWER_TOP_PAD * VIEWER_PAD_MULTIPLIER)),
  };
}
