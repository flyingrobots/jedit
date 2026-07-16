import { createSurface, type Surface } from "@flyingrobots/bijou";
import { paintMarkdownPreview } from "../../ui/markdown-preview.js";
import { renderSourceViewer } from "../../ui/source-viewer.js";
import {
  TITLE_RENDER_MODE,
  paintTitleScreenPresentation,
  renderTitleScreen,
  type TitleScreenRenderOptions,
} from "../../ui/title-screen.js";
import type { JeditTheme } from "../../ui/jedit-theme.js";
import {
  createBrailleSampleCache,
  createBrailleSampleFrameStats,
  type AveragingBrailleCanvasOptions,
  type BrailleSampleCache,
  type BrailleSampleFrameStats,
  type BrailleTraceBudget,
} from "../../ui/averaging-braille-canvas.js";
import type { WorkspaceModel } from "./model.js";
import { isWorkspaceMarkdownFile } from "./editor-session.js";
import { ViewModes } from "./view-mode.js";
import { VIEWER_LEFT_PAD, VIEWER_TOP_PAD } from "./viewport.js";
import {
  causalSourceGutterLineMarkers,
  displayEditorForWorkspaceModel,
  sourceHighlightForWorkspaceProjection,
  sourceWindowForWorkspaceModel,
} from "./workspace-source-projection.js";
import { fillSurface } from "./surface-fill.js";
import {
  governTitleSceneRender,
  titleScenePerformanceFacts,
  TITLE_SCENE_RENDER_POSTURE,
  type TitleScenePerformanceFacts,
} from "./title-scene-performance-governor.js";
import {
  sameTitleBrailleSampleCacheIdentity,
  titleBrailleTraceBudget,
  titleBrailleSampleCacheIdentity,
  type TitleBrailleSampleCacheIdentity,
} from "./title-braille-sampling.js";
const MIN_VIEWPORT_DIMENSION = 1;
const VIEWER_PAD_MULTIPLIER = 2;
const TITLE_CAMERA_MOTION_EPSILON = 0.001;
const TITLE_FRAME_BUDGET_OVER = "over-budget";
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
  readonly identity: TitleBrailleSampleCacheIdentity;
  readonly camera: WorkspaceModel["titleCamera"];
  readonly asciiPalette: WorkspaceModel["titleAsciiPalette"];
  readonly lowRateActive: boolean;
  readonly surface: Surface;
}

interface ViewerContentRendererState {
  frozenTitleBackdrop?: FrozenTitleBackdrop;
  titlePresentationSurface?: Surface;
  lastTitleScenePerformance?: TitleScenePerformanceFacts;
  titleBrailleSampleCache?: BrailleSampleCache;
  titleBrailleSampleCacheIdentity?: TitleBrailleSampleCacheIdentity;
  titleBrailleFrameIndex?: number;
  lastBrailleSampleStats?: BrailleSampleFrameStats;
  lastBrailleTraceBudget?: BrailleTraceBudget;
}

interface TitleBrailleSamplingRenderContext {
  readonly options?: AveragingBrailleCanvasOptions;
  readonly stats?: BrailleSampleFrameStats;
  readonly budget?: BrailleTraceBudget;
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
  const editor = displayEditorForWorkspaceModel(model);
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
    sourceHighlightForWorkspaceProjection(model, editor.path),
    {
      viewport,
      leftPad: VIEWER_LEFT_PAD,
      topPad: VIEWER_TOP_PAD,
      theme: model.jeditTheme,
      lineNumberMode: model.lineNumberMode,
      lineMarkers: causalSourceGutterLineMarkers(model),
      reading: sourceWindowForWorkspaceModel(model),
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
  const frozen = frozenTitleBackdropFor(state, model, width, height);
  const decision = governTitleSceneRender(
    titleSceneGovernorInput(model, frozen),
  );
  state.lastTitleScenePerformance = titleScenePerformanceFacts(decision);
  if (decision.shouldUseFrozenBackdrop && frozen != null) {
    state.frozenTitleBackdrop = activateLowRateBackdrop(frozen, decision);
    return titleFrameSurface(frozen.surface, model, width, height, state);
  }

  const rendered = renderLiveTitleBackdrop(
    model,
    width,
    height,
    titleRenderer,
    state,
  );
  if (decision.shouldRetainRenderedBackdrop) {
    state.frozenTitleBackdrop = {
      width,
      height,
      time: model.time,
      identity: titleBrailleSampleCacheIdentity(model, width, height),
      camera: model.titleCamera,
      asciiPalette: model.titleAsciiPalette,
      lowRateActive: shouldActivateLowRateBackdrop(model, decision),
      surface: rendered,
    };
  }
  return titleFrameSurface(rendered, model, width, height, state);
}

function titleSceneGovernorInput(
  model: WorkspaceModel,
  frozen: FrozenTitleBackdrop | undefined,
) {
  return {
    introActive: model.editor == null && !model.startupIntroComplete,
    idleTitleScreen:
      model.editor == null &&
      model.startupIntroComplete &&
      !model.startupFileModalOpen,
    frozenBackdropAvailable: frozen != null,
    lowRateFrozenBackdropActive: frozen?.lowRateActive,
    frameTimeMs: model.frameTimeMs ?? 0,
  };
}

function renderLiveTitleBackdrop(
  model: WorkspaceModel,
  width: number,
  height: number,
  titleRenderer: TitleScreenRenderer,
  state: ViewerContentRendererState,
): Surface {
  const sampling = titleBrailleSamplingRenderContext(
    model,
    width,
    height,
    state,
  );
  const rendered = titleRenderer(width, height, model.time, model.jeditTheme, {
    camAngle: model.titleCamera.angle,
    camRadius: model.titleCamera.radius,
    camera: model.titleCamera,
    sceneSeed: model.titleSceneSeed,
    wallClockMs: model.lastFrameMs,
    mesh: model.titleMeshes.bunny,
    sceneOverride: model.sceneOverride,
    renderMode: model.titleRenderMode,
    asciiPalette: model.titleAsciiPalette,
    textDirection: model.i18n.direction,
    brailleSampling: sampling.options,
    suppressPresentation: true,
  });
  recordTitleBrailleSamplingStats(state, sampling);
  return rendered;
}

function titleFrameSurface(
  backdrop: Surface,
  model: WorkspaceModel,
  width: number,
  height: number,
  state: ViewerContentRendererState,
): Surface {
  if (model.editor != null || model.startupIntroComplete) {
    return backdrop;
  }
  const surface =
    state.titlePresentationSurface?.width === width &&
    state.titlePresentationSurface.height === height
      ? state.titlePresentationSurface
      : createSurface(width, height);
  state.titlePresentationSurface = surface;
  surface.blit(backdrop, 0, 0);
  paintTitleScreenPresentation(surface, {
    cols: width,
    rows: height,
    time: model.time,
    theme: model.jeditTheme,
    textDirection: model.i18n.direction,
  });
  return surface;
}

function titleBrailleSamplingRenderContext(
  model: WorkspaceModel,
  width: number,
  height: number,
  state: ViewerContentRendererState,
): TitleBrailleSamplingRenderContext {
  if (model.titleRenderMode !== TITLE_RENDER_MODE.Braille) {
    clearTitleBrailleSamplingState(state);
    return {};
  }
  const stats = createBrailleSampleFrameStats();
  const cache = titleBrailleSampleCacheFor(model, width, height, state);
  const frameIndex = state.titleBrailleFrameIndex ?? 0;
  const budget = titleBrailleTraceBudget({
    frameIndex,
    frameTimeMs: model.frameTimeMs,
    previousStats: state.lastBrailleSampleStats,
    previousPhaseCount: state.lastBrailleTraceBudget?.phaseCount,
    cameraMoving: titleCameraIsMoving(model.titleCamera),
  });
  state.titleBrailleFrameIndex = frameIndex + 1;
  return {
    stats,
    budget,
    options: {
      sampleCache: cache,
      stats,
      traceBudget: budget,
    },
  };
}

function titleBrailleSampleCacheFor(
  model: WorkspaceModel,
  width: number,
  height: number,
  state: ViewerContentRendererState,
): BrailleSampleCache {
  const identity = titleBrailleSampleCacheIdentity(model, width, height);
  if (
    state.titleBrailleSampleCache == null ||
    state.titleBrailleSampleCacheIdentity == null ||
    !sameTitleBrailleSampleCacheIdentity(
      state.titleBrailleSampleCacheIdentity,
      identity,
    )
  ) {
    state.titleBrailleSampleCache = createBrailleSampleCache(width, height);
    state.titleBrailleSampleCacheIdentity = identity;
    clearTitleBrailleSamplingState(state);
  }
  return state.titleBrailleSampleCache;
}

function clearTitleBrailleSamplingState(
  state: ViewerContentRendererState,
): void {
  state.titleBrailleFrameIndex = 0;
  state.lastBrailleSampleStats = undefined;
  state.lastBrailleTraceBudget = undefined;
}

function titleCameraIsMoving(camera: WorkspaceModel["titleCamera"]): boolean {
  return (
    titleCameraAxisIsMoving(camera.angle, camera.angleTarget) ||
    titleCameraAxisIsMoving(camera.radius, camera.radiusTarget)
  );
}

function titleCameraAxisIsMoving(current: number, target: number): boolean {
  return Math.abs(current - target) > TITLE_CAMERA_MOTION_EPSILON;
}

function recordTitleBrailleSamplingStats(
  state: ViewerContentRendererState,
  context: TitleBrailleSamplingRenderContext,
): void {
  if (context.stats != null && context.stats.totalSamples > 0) {
    state.lastBrailleSampleStats = context.stats;
  }
  if (context.budget != null) {
    state.lastBrailleTraceBudget = context.budget;
  }
}

function frozenTitleBackdropFor(
  state: ViewerContentRendererState,
  model: WorkspaceModel,
  width: number,
  height: number,
): FrozenTitleBackdrop | undefined {
  return state.frozenTitleBackdrop?.width === width &&
    state.frozenTitleBackdrop.height === height &&
    state.frozenTitleBackdrop.camera === model.titleCamera &&
    state.frozenTitleBackdrop.asciiPalette === model.titleAsciiPalette &&
    sameTitleBrailleSampleCacheIdentity(
      state.frozenTitleBackdrop.identity,
      titleBrailleSampleCacheIdentity(model, width, height),
    )
    ? state.frozenTitleBackdrop
    : undefined;
}

function activateLowRateBackdrop(
  frozen: FrozenTitleBackdrop,
  decision: FrameBudgetDecision,
): FrozenTitleBackdrop {
  return decision.frameBudgetPosture === TITLE_FRAME_BUDGET_OVER
    ? { ...frozen, lowRateActive: true }
    : frozen;
}

function shouldActivateLowRateBackdrop(
  model: WorkspaceModel,
  decision: FrameBudgetDecision,
): boolean {
  return (
    model.editor == null &&
    !model.startupFileModalOpen &&
    decision.frameBudgetPosture === TITLE_FRAME_BUDGET_OVER
  );
}

interface FrameBudgetDecision {
  readonly frameBudgetPosture: TitleScenePerformanceFacts["frameBudgetPosture"];
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
