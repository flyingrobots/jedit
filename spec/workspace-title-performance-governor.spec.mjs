import assert from "node:assert/strict";
import test from "node:test";
import { stringToSurface } from "@flyingrobots/bijou";
import {
  importDist,
  mockTitleScreenModel,
  surfaceText,
} from "./workspace-helpers.mjs";

const TITLE_WIDTH = 44;
const TITLE_HEIGHT = 6;
const SLOW_FRAME_MS = 90;
const FAST_FRAME_MS = 12;

test("title scene performance governor names trace and frozen backdrop decisions", async () => {
  const governor = await importDist(
    "app",
    "workspace",
    "title-scene-performance-governor.js",
  );

  assert.deepEqual(
    governor.governTitleSceneRender({
      introActive: true,
      startupFileModalOpen: false,
      idleTitleScreen: false,
      frozenBackdropAvailable: true,
      cacheAgeSeconds: 0,
      frameTimeMs: SLOW_FRAME_MS,
    }),
    {
      posture: governor.TITLE_SCENE_RENDER_POSTURE.LiveTrace,
      shouldTraceRays: true,
      shouldUseFrozenBackdrop: false,
      shouldRetainRenderedBackdrop: true,
      inputLatencyPosture: "animated-title",
      frameBudgetPosture: "over-budget",
    },
  );

  assert.deepEqual(
    governor.governTitleSceneRender({
      introActive: false,
      startupFileModalOpen: true,
      idleTitleScreen: false,
      frozenBackdropAvailable: true,
      cacheAgeSeconds: 0.2,
      frameTimeMs: SLOW_FRAME_MS,
    }),
    {
      posture: governor.TITLE_SCENE_RENDER_POSTURE.ModalFrozenBackdrop,
      shouldTraceRays: false,
      shouldUseFrozenBackdrop: true,
      shouldRetainRenderedBackdrop: false,
      inputLatencyPosture: "hot-input",
      frameBudgetPosture: "over-budget",
    },
  );

  assert.deepEqual(
    governor.governTitleSceneRender({
      introActive: false,
      startupFileModalOpen: true,
      idleTitleScreen: false,
      frozenBackdropAvailable: false,
      frameTimeMs: FAST_FRAME_MS,
    }),
    {
      posture: governor.TITLE_SCENE_RENDER_POSTURE.ModalFallbackTrace,
      shouldTraceRays: true,
      shouldUseFrozenBackdrop: false,
      shouldRetainRenderedBackdrop: true,
      inputLatencyPosture: "hot-input",
      frameBudgetPosture: "within-budget",
    },
  );

  assert.deepEqual(
    governor.governTitleSceneRender({
      introActive: false,
      startupFileModalOpen: false,
      idleTitleScreen: true,
      frozenBackdropAvailable: true,
      cacheAgeSeconds: 0.1,
      frameTimeMs: SLOW_FRAME_MS,
    }).posture,
    governor.TITLE_SCENE_RENDER_POSTURE.LowRateFrozenBackdrop,
  );
});

test("viewer renderer exposes modal frozen and fallback performance facts", async () => {
  const [viewerContent, titleScreen] = await Promise.all([
    importDist("app", "workspace", "viewer-content.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const tracedTimes = [];
  const renderer = viewerContent.createViewerContentRenderer(
    tracingTitleRenderer(tracedTimes, "modal"),
  );
  const base = mockTitleScreenModel(titleScreen, {
    time: 1,
    frameTimeMs: FAST_FRAME_MS,
    startupIntroComplete: false,
    startupFileModalOpen: false,
  });

  const live = renderer.renderViewer(base, TITLE_WIDTH, TITLE_HEIGHT);
  const openModal = renderer.renderViewer(
    {
      ...base,
      time: 7,
      startupIntroComplete: true,
      startupFileModalOpen: true,
    },
    TITLE_WIDTH,
    TITLE_HEIGHT,
  );
  const typed = renderer.renderViewer(
    {
      ...base,
      time: 8,
      startupIntroComplete: true,
      startupFileModalOpen: true,
      startupFileModalInput: "read",
    },
    TITLE_WIDTH,
    TITLE_HEIGHT,
  );

  assert.deepEqual(tracedTimes, [1]);
  assert.equal(surfaceText(openModal), surfaceText(live));
  assert.equal(surfaceText(typed), surfaceText(live));
  assert.deepEqual(renderer.titleScenePerformanceFacts(), {
    posture: "modal-frozen-backdrop",
    tracesRays: false,
    usesFrozenBackdrop: true,
    retainsBackdrop: false,
    inputLatencyPosture: "hot-input",
    frameBudgetPosture: "within-budget",
  });

  const fallbackTimes = [];
  const fallbackRenderer = viewerContent.createViewerContentRenderer(
    tracingTitleRenderer(fallbackTimes, "fallback"),
  );
  const fallback = fallbackRenderer.renderViewer(
    {
      ...base,
      time: 7,
      startupIntroComplete: true,
      startupFileModalOpen: true,
    },
    TITLE_WIDTH,
    TITLE_HEIGHT,
  );

  assert.deepEqual(fallbackTimes, [7]);
  assert.match(surfaceText(fallback), /fallback trace 1 time 7/);
  assert.equal(
    fallbackRenderer.titleScenePerformanceFacts().posture,
    "modal-fallback-trace",
  );
});

test("viewer renderer low-rate reuses slow idle title backdrop until refresh window expires", async () => {
  const [viewerContent, titleScreen, governor] = await Promise.all([
    importDist("app", "workspace", "viewer-content.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "title-scene-performance-governor.js"),
  ]);
  const tracedTimes = [];
  const renderer = viewerContent.createViewerContentRenderer(
    tracingTitleRenderer(tracedTimes, "idle"),
  );
  const base = mockTitleScreenModel(titleScreen, {
    time: 10,
    frameTimeMs: SLOW_FRAME_MS,
    startupIntroComplete: true,
    startupFileModalOpen: false,
  });

  const initial = renderer.renderViewer(base, TITLE_WIDTH, TITLE_HEIGHT);
  const reused = renderer.renderViewer(
    {
      ...base,
      time: 10 + governor.TITLE_SCENE_LOW_RATE_REFRESH_SECONDS / 2,
    },
    TITLE_WIDTH,
    TITLE_HEIGHT,
  );
  const refreshed = renderer.renderViewer(
    {
      ...base,
      time: 10 + governor.TITLE_SCENE_LOW_RATE_REFRESH_SECONDS + 0.01,
    },
    TITLE_WIDTH,
    TITLE_HEIGHT,
  );

  assert.deepEqual(tracedTimes, [
    10,
    10 + governor.TITLE_SCENE_LOW_RATE_REFRESH_SECONDS + 0.01,
  ]);
  assert.equal(surfaceText(reused), surfaceText(initial));
  assert.notEqual(surfaceText(refreshed), surfaceText(initial));
  assert.deepEqual(renderer.titleScenePerformanceFacts(), {
    posture: "live-trace",
    tracesRays: true,
    usesFrozenBackdrop: false,
    retainsBackdrop: true,
    inputLatencyPosture: "animated-title",
    frameBudgetPosture: "over-budget",
  });
});

function tracingTitleRenderer(tracedTimes, label) {
  return (width, height, time) => {
    tracedTimes.push(time);
    return stringToSurface(
      `${label} trace ${tracedTimes.length} time ${time}`,
      width,
      height,
    );
  };
}
