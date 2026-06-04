import { createSurface, type Surface } from "@flyingrobots/bijou";
import { paintMarkdownPreview } from "../../ui/markdown-preview.js";
import { renderSourceViewer } from "../../ui/source-viewer.js";
import {
  renderTitleScreen,
  type TitleScreenRenderOptions,
} from "../../ui/title-screen.js";
import type { JeditTheme } from "../../ui/jedit-theme.js";
import type { WorkspaceModel } from "./model.js";
import { isWorkspaceMarkdownFile } from "./editor-session.js";
import { ViewModes } from "./view-mode.js";
import {
  editorFromWorkspaceTextCache,
  isWorkspaceTextAuthorityOpened,
} from "./workspace-text-authority.js";
import { VIEWER_LEFT_PAD, VIEWER_TOP_PAD } from "./viewport.js";
import { fillSurface } from "./surface-fill.js";
import {
  governTitleSceneRender,
  titleScenePerformanceFacts,
  TITLE_SCENE_RENDER_POSTURE,
  type TitleScenePerformanceFacts,
} from "./title-scene-performance-governor.js";

const MIN_VIEWPORT_DIMENSION = 1;
const VIEWER_PAD_MULTIPLIER = 2;
const INITIAL_TITLE_SCENE_PERFORMANCE_FACTS: TitleScenePerformanceFacts = {
  posture: TITLE_SCENE_RENDER_POSTURE.LiveTrace,
  tracesRays: true,
  usesFrozenBackdrop: false,
  retainsBackdrop: true,
  inputLatencyPosture: "animated-title",
  frameBudgetPosture: "within-budget",
};

interface FrozenTitleBackdrop {
  readonly width: number;
  readonly height: number;
  readonly time: number;
  readonly surface: Surface;
}

interface ViewerContentRendererState {
  frozenTitleBackdrop?: FrozenTitleBackdrop;
  lastTitleScenePerformance?: TitleScenePerformanceFacts;
}

export type TitleScreenRenderer = (
  width: number,
  height: number,
  time: number,
  theme: JeditTheme,
  options: TitleScreenRenderOptions,
) => Surface;

export interface ViewerContentRenderer {
  renderViewer(model: WorkspaceModel, width: number, height: number): Surface;
  clearFrozenTitleBackdrop(): void;
  titleScenePerformanceFacts(): TitleScenePerformanceFacts;
}

export function createViewerContentRenderer(
  titleRenderer: TitleScreenRenderer = renderTitleScreen,
): ViewerContentRenderer {
  const state: ViewerContentRendererState = {};
  return {
    renderViewer(model, width, height) {
      return renderViewerWithState(model, width, height, titleRenderer, state);
    },
    clearFrozenTitleBackdrop() {
      state.frozenTitleBackdrop = undefined;
    },
    titleScenePerformanceFacts() {
      return (
        state.lastTitleScenePerformance ?? INITIAL_TITLE_SCENE_PERFORMANCE_FACTS
      );
    },
  };
}

export function renderViewer(
  model: WorkspaceModel,
  width: number,
  height: number,
): Surface {
  return createViewerContentRenderer().renderViewer(model, width, height);
}

export function renderViewerWithTitleRenderer(
  model: WorkspaceModel,
  width: number,
  height: number,
  titleRenderer: TitleScreenRenderer,
): Surface {
  return createViewerContentRenderer(titleRenderer).renderViewer(
    model,
    width,
    height,
  );
}

function renderViewerWithState(
  model: WorkspaceModel,
  width: number,
  height: number,
  titleRenderer: TitleScreenRenderer,
  state: ViewerContentRendererState,
): Surface {
  const editor = displayEditor(model);
  if (editor == null) {
    return renderTitleBackdrop(model, width, height, titleRenderer, state);
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
    model.sourceHighlight?.path === editor.path
      ? model.sourceHighlight
      : undefined,
    {
      viewport,
      leftPad: VIEWER_LEFT_PAD,
      topPad: VIEWER_TOP_PAD,
      theme: model.jeditTheme,
    },
  );
}

function renderTitleBackdrop(
  model: WorkspaceModel,
  width: number,
  height: number,
  titleRenderer: TitleScreenRenderer,
  state: ViewerContentRendererState,
): Surface {
  const frozen = frozenTitleBackdropFor(state, width, height);
  const decision = governTitleSceneRender(
    titleSceneGovernorInput(model, frozen),
  );
  state.lastTitleScenePerformance = titleScenePerformanceFacts(decision);
  if (decision.shouldUseFrozenBackdrop && frozen != null) {
    return copySurface(frozen.surface);
  }

  const rendered = renderLiveTitleBackdrop(model, width, height, titleRenderer);
  if (decision.shouldRetainRenderedBackdrop) {
    state.frozenTitleBackdrop = {
      width,
      height,
      time: model.time,
      surface: rendered,
    };
  }
  return rendered;
}

function titleSceneGovernorInput(
  model: WorkspaceModel,
  frozen: FrozenTitleBackdrop | undefined,
) {
  return {
    introActive: model.editor == null && !model.startupIntroComplete,
    startupFileModalOpen: model.startupFileModalOpen,
    idleTitleScreen:
      model.editor == null &&
      model.startupIntroComplete &&
      !model.startupFileModalOpen,
    frozenBackdropAvailable: frozen != null,
    cacheAgeSeconds:
      frozen == null
        ? undefined
        : titleBackdropAgeSeconds(model.time, frozen.time),
    frameTimeMs: model.frameTimeMs ?? 0,
  };
}

function renderLiveTitleBackdrop(
  model: WorkspaceModel,
  width: number,
  height: number,
  titleRenderer: TitleScreenRenderer,
): Surface {
  return titleRenderer(width, height, model.time, model.jeditTheme, {
    camAngle: model.titleCamera.angle,
    camRadius: model.titleCamera.radius,
    sceneSeed: model.titleSceneSeed,
    mesh: model.titleMeshes.bunny,
    sceneOverride: model.sceneOverride,
    renderMode: model.titleRenderMode,
    asciiPalette: model.titleAsciiPalette,
    textDirection: model.i18n.direction,
  });
}

function frozenTitleBackdropFor(
  state: ViewerContentRendererState,
  width: number,
  height: number,
): FrozenTitleBackdrop | undefined {
  return state.frozenTitleBackdrop?.width === width &&
    state.frozenTitleBackdrop.height === height
    ? state.frozenTitleBackdrop
    : undefined;
}

function titleBackdropAgeSeconds(
  currentTime: number,
  frozenTime: number,
): number {
  return Math.max(0, currentTime - frozenTime);
}

function copySurface(source: Surface): Surface {
  const copy = createSurface(source.width, source.height);
  copy.blit(source, 0, 0);
  return copy;
}

export function isWorkspaceMarkdownPreviewAvailable(
  model: WorkspaceModel,
): boolean {
  const editor = displayEditor(model);
  return editor != null && isWorkspaceMarkdownFile(editor.path);
}

function displayEditor(model: WorkspaceModel): WorkspaceModel["editor"] {
  return isWorkspaceTextAuthorityOpened(model.textAuthority) &&
    model.textAuthority.cache != null
    ? editorFromWorkspaceTextCache(model.textAuthority, model.editor)
    : model.editor;
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
    width: Math.max(
      MIN_VIEWPORT_DIMENSION,
      width - VIEWER_LEFT_PAD * VIEWER_PAD_MULTIPLIER,
    ),
    height: Math.max(
      MIN_VIEWPORT_DIMENSION,
      height - VIEWER_TOP_PAD * VIEWER_PAD_MULTIPLIER,
    ),
  };
}
