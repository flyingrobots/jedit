import { createSurface, type Surface } from "@flyingrobots/bijou";
import { paintMarkdownPreview } from "../../ui/markdown-preview.js";
import { renderSourceViewer } from "../../ui/source-viewer.js";
import {
  TITLE_RENDER_MODE,
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
import type { TitleMesh } from "../../ui/title-mesh.js";
import type { TitleScene } from "../../ui/title-scene.js";
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
import { titleBrailleTraceBudget } from "./title-braille-sampling.js";

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
  lastTitleScenePerformance?: TitleScenePerformanceFacts;
  titleBrailleSampleCache?: BrailleSampleCache;
  titleBrailleSampleCacheIdentity?: TitleBrailleSampleCacheIdentity;
  titleBrailleFrameIndex?: number;
  lastBrailleSampleStats?: BrailleSampleFrameStats;
  lastBrailleTraceBudget?: BrailleTraceBudget;
}

interface TitleBrailleSampleCacheIdentity {
  readonly width: number;
  readonly height: number;
  readonly themeName: string;
  readonly titleRenderMode: WorkspaceModel["titleRenderMode"];
  readonly titleSceneSeed: number;
  readonly titleSceneName?: WorkspaceModel["titleSceneName"];
  readonly sceneOverride?: TitleScene;
  readonly mesh?: TitleMesh;
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
  const frozen = frozenTitleBackdropFor(state, model, width, height);
  const decision = governTitleSceneRender(
    titleSceneGovernorInput(model, frozen),
  );
  state.lastTitleScenePerformance = titleScenePerformanceFacts(decision);
  if (decision.shouldUseFrozenBackdrop && frozen != null) {
    state.frozenTitleBackdrop = activateLowRateBackdrop(frozen, decision);
    return frozen.surface;
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
  return rendered;
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
    suppressPresentation: model.startupIntroComplete,
  });
  recordTitleBrailleSamplingStats(state, sampling);
  return rendered;
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

function titleBrailleSampleCacheIdentity(
  model: WorkspaceModel,
  width: number,
  height: number,
): TitleBrailleSampleCacheIdentity {
  return {
    width,
    height,
    themeName: model.jeditTheme.name,
    titleRenderMode: model.titleRenderMode,
    titleSceneSeed: model.titleSceneSeed,
    titleSceneName: model.titleSceneName,
    sceneOverride: model.sceneOverride,
    mesh: model.titleMeshes.bunny,
  };
}

function sameTitleBrailleSampleCacheIdentity(
  left: TitleBrailleSampleCacheIdentity,
  right: TitleBrailleSampleCacheIdentity,
): boolean {
  return (
    left.width === right.width &&
    left.height === right.height &&
    left.themeName === right.themeName &&
    left.titleRenderMode === right.titleRenderMode &&
    left.titleSceneSeed === right.titleSceneSeed &&
    left.titleSceneName === right.titleSceneName &&
    left.sceneOverride === right.sceneOverride &&
    left.mesh === right.mesh
  );
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
    model.startupIntroComplete &&
    !model.startupFileModalOpen &&
    decision.frameBudgetPosture === TITLE_FRAME_BUDGET_OVER
  );
}

interface FrameBudgetDecision {
  readonly frameBudgetPosture: TitleScenePerformanceFacts["frameBudgetPosture"];
}

function titleBackdropAgeSeconds(
  currentTime: number,
  frozenTime: number,
): number {
  return Math.max(0, currentTime - frozenTime);
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
