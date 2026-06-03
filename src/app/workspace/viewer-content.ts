import { createSurface, type Surface } from '@flyingrobots/bijou';
import { paintMarkdownPreview } from '../../ui/markdown-preview.js';
import { renderSourceViewer } from '../../ui/source-viewer.js';
import { renderTitleScreen, type TitleScreenRenderOptions } from '../../ui/title-screen.js';
import type { JeditTheme } from '../../ui/jedit-theme.js';
import type { WorkspaceModel } from './model.js';
import { isWorkspaceMarkdownFile } from './editor-session.js';
import { ViewModes } from './view-mode.js';
import {
  editorFromWorkspaceTextCache,
  isWorkspaceTextAuthorityOpened,
} from './workspace-text-authority.js';
import {
  VIEWER_LEFT_PAD,
  VIEWER_TOP_PAD,
} from './viewport.js';
import { fillSurface } from './surface-fill.js';

const MIN_VIEWPORT_DIMENSION = 1;
const VIEWER_PAD_MULTIPLIER = 2;

interface FrozenTitleBackdrop {
  readonly width: number;
  readonly height: number;
  readonly surface: Surface;
}

export type TitleScreenRenderer = (
  width: number,
  height: number,
  time: number,
  theme: JeditTheme,
  options: TitleScreenRenderOptions,
) => Surface;

let frozenTitleBackdrop: FrozenTitleBackdrop | undefined;

export function renderViewer(model: WorkspaceModel, width: number, height: number): Surface {
  return renderViewerWithTitleRenderer(model, width, height, renderTitleScreen);
}

export function renderViewerWithTitleRenderer(
  model: WorkspaceModel,
  width: number,
  height: number,
  titleRenderer: TitleScreenRenderer,
): Surface {
  const editor = displayEditor(model);
  if (editor == null) {
    return renderTitleBackdrop(model, width, height, titleRenderer);
  }

  const surface = createSurface(width, height);
  fillSurface(surface, model.jeditTheme.surface.workspace);

  if (model.viewMode === ViewModes.Preview && isWorkspaceMarkdownFile(editor.path)) {
    return renderPreview(surface, editor, model.jeditTheme, width, height);
  }

  const viewport = viewerViewport(width, height);
  return renderSourceViewer(surface, editor, model.sourceHighlight?.path === editor.path ? model.sourceHighlight : undefined, {
    viewport,
    leftPad: VIEWER_LEFT_PAD,
    topPad: VIEWER_TOP_PAD,
    theme: model.jeditTheme,
  });
}

export function clearFrozenTitleBackdrop(): void {
  frozenTitleBackdrop = undefined;
}

function renderTitleBackdrop(
  model: WorkspaceModel,
  width: number,
  height: number,
  titleRenderer: TitleScreenRenderer,
): Surface {
  if (model.startupFileModalOpen) {
    const frozen = frozenTitleBackdropFor(width, height);
    if (frozen != null) {
      return copySurface(frozen);
    }
  }

  const rendered = titleRenderer(width, height, model.time, model.jeditTheme, {
      camAngle: model.titleCamera.angle,
      camRadius: model.titleCamera.radius,
      sceneSeed: model.titleSceneSeed,
      mesh: model.titleMeshes.bunny,
      sceneOverride: model.sceneOverride,
      renderMode: model.titleRenderMode,
      asciiPalette: model.titleAsciiPalette,
      textDirection: model.i18n.direction,
  });
  frozenTitleBackdrop = { width, height, surface: rendered };
  return rendered;
}

function frozenTitleBackdropFor(width: number, height: number): Surface | undefined {
  return frozenTitleBackdrop?.width === width && frozenTitleBackdrop.height === height
    ? frozenTitleBackdrop.surface
    : undefined;
}

function copySurface(source: Surface): Surface {
  const copy = createSurface(source.width, source.height);
  copy.blit(source, 0, 0);
  return copy;
}

export function isWorkspaceMarkdownPreviewAvailable(model: WorkspaceModel): boolean {
  const editor = displayEditor(model);
  return editor != null && isWorkspaceMarkdownFile(editor.path);
}

function displayEditor(model: WorkspaceModel): WorkspaceModel['editor'] {
  return isWorkspaceTextAuthorityOpened(model.textAuthority) && model.textAuthority.cache != null
    ? editorFromWorkspaceTextCache(model.textAuthority, model.editor)
    : model.editor;
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
