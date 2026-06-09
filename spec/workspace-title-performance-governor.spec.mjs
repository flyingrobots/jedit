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

test("title scene performance governor keeps startup browser ray tracing live", async () => {
  const governor = await importDist(
    "app",
    "workspace",
    "title-scene-performance-governor.js",
  );

  assert.deepEqual(
    governor.governTitleSceneRender({
      introActive: true,
      idleTitleScreen: false,
      frozenBackdropAvailable: true,
      cacheAgeSeconds: 0,
      lowRateFrozenBackdropActive: true,
      frameTimeMs: SLOW_FRAME_MS,
    }),
    {
      posture: governor.TITLE_SCENE_RENDER_POSTURE.LowRateFrozenBackdrop,
      shouldTraceRays: false,
      shouldUseFrozenBackdrop: true,
      shouldRetainRenderedBackdrop: false,
      inputLatencyPosture: "low-rate-title",
      frameBudgetPosture: "over-budget",
    },
  );

  assert.deepEqual(
    governor.governTitleSceneRender({
      introActive: false,
      idleTitleScreen: false,
      frozenBackdropAvailable: true,
      cacheAgeSeconds: 0.2,
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
      idleTitleScreen: false,
      frozenBackdropAvailable: false,
      frameTimeMs: FAST_FRAME_MS,
    }),
    {
      posture: governor.TITLE_SCENE_RENDER_POSTURE.LiveTrace,
      shouldTraceRays: true,
      shouldUseFrozenBackdrop: false,
      shouldRetainRenderedBackdrop: true,
      inputLatencyPosture: "animated-title",
      frameBudgetPosture: "within-budget",
    },
  );

  assert.deepEqual(
    governor.governTitleSceneRender({
      introActive: false,
      idleTitleScreen: true,
      frozenBackdropAvailable: true,
      cacheAgeSeconds: 0.1,
      lowRateFrozenBackdropActive: true,
      frameTimeMs: FAST_FRAME_MS,
    }).posture,
    governor.TITLE_SCENE_RENDER_POSTURE.LowRateFrozenBackdrop,
  );

  assert.deepEqual(
    governor.governTitleSceneRender({
      introActive: false,
      idleTitleScreen: true,
      frozenBackdropAvailable: true,
      cacheAgeSeconds: 0.1,
      frameTimeMs: SLOW_FRAME_MS,
    }).posture,
    governor.TITLE_SCENE_RENDER_POSTURE.LowRateFrozenBackdrop,
  );
});

test("viewer renderer composites startup intro logos without retracing backdrop", async () => {
  const [viewerContent, titleScreen, governor] = await Promise.all([
    importDist("app", "workspace", "viewer-content.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "title-scene-performance-governor.js"),
  ]);
  const tracedTimes = [];
  const renderedBackdrops = [];
  const renderer = viewerContent.createViewerContentRenderer(
    (width, height, time, theme, options) => {
      assert.equal(options.suppressPresentation, true);
      tracedTimes.push(time);
      const backdrop = stringToSurface(
        `backdrop trace ${tracedTimes.length} time ${time}`,
        width,
        height,
      );
      renderedBackdrops.push(backdrop);
      return backdrop;
    },
  );
  const base = mockTitleScreenModel(titleScreen, {
    time: 2,
    frameTimeMs: SLOW_FRAME_MS,
    startupIntroComplete: false,
    startupFileModalOpen: false,
  });

  const first = renderer.renderViewer(base, 96, 28);
  const backdropText = surfaceText(renderedBackdrops[0]);
  const second = renderer.renderViewer(
    {
      ...base,
      time: 2 + governor.TITLE_SCENE_LOW_RATE_REFRESH_SECONDS * 2,
      frameTimeMs: FAST_FRAME_MS,
    },
    96,
    28,
  );

  assert.deepEqual(tracedTimes, [2]);
  assert.notEqual(first, renderedBackdrops[0]);
  assert.notEqual(second, renderedBackdrops[0]);
  assert.equal(surfaceText(renderedBackdrops[0]), backdropText);
  assert.notEqual(surfaceText(second), backdropText);
  assert.deepEqual(renderer.titleScenePerformanceFacts(), {
    posture: "low-rate-frozen-backdrop",
    tracesRays: false,
    usesFrozenBackdrop: true,
    retainsBackdrop: false,
    inputLatencyPosture: "low-rate-title",
    frameBudgetPosture: "within-budget",
  });
});

test("viewer renderer continues tracing while startup browser is open", async () => {
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

  assert.deepEqual(tracedTimes, [1, 7, 8]);
  assert.notEqual(surfaceText(openModal), surfaceText(live));
  assert.notEqual(surfaceText(typed), surfaceText(openModal));
  assert.deepEqual(renderer.titleScenePerformanceFacts(), {
    posture: "live-trace",
    tracesRays: true,
    usesFrozenBackdrop: false,
    retainsBackdrop: true,
    inputLatencyPosture: "animated-title",
    frameBudgetPosture: "within-budget",
  });
});

test("viewer renderer keeps slow idle title backdrop frozen until state changes", async () => {
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
      time: 10 + governor.TITLE_SCENE_LOW_RATE_REFRESH_SECONDS / 4,
      frameTimeMs: FAST_FRAME_MS,
    },
    TITLE_WIDTH,
    TITLE_HEIGHT,
  );
  const stillReused = renderer.renderViewer(
    {
      ...base,
      time: 10 + governor.TITLE_SCENE_LOW_RATE_REFRESH_SECONDS * 2,
      frameTimeMs: FAST_FRAME_MS,
    },
    TITLE_WIDTH,
    TITLE_HEIGHT,
  );

  assert.deepEqual(tracedTimes, [10]);
  assert.equal(reused, initial);
  assert.equal(stillReused, initial);
  assert.equal(surfaceText(reused), surfaceText(initial));
  assert.equal(surfaceText(stillReused), surfaceText(initial));
  assert.deepEqual(renderer.titleScenePerformanceFacts(), {
    posture: "low-rate-frozen-backdrop",
    tracesRays: false,
    usesFrozenBackdrop: true,
    retainsBackdrop: false,
    inputLatencyPosture: "low-rate-title",
    frameBudgetPosture: "within-budget",
  });
});

test("viewer renderer does not reuse a frozen title backdrop after camera input", async () => {
  const [viewerContent, titleScreen] = await Promise.all([
    importDist("app", "workspace", "viewer-content.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const tracedTimes = [];
  const renderer = viewerContent.createViewerContentRenderer(
    tracingTitleRenderer(tracedTimes, "camera"),
  );
  const base = mockTitleScreenModel(titleScreen, {
    time: 12,
    frameTimeMs: SLOW_FRAME_MS,
    startupIntroComplete: true,
    startupFileModalOpen: false,
  });

  const initial = renderer.renderViewer(base, TITLE_WIDTH, TITLE_HEIGHT);
  const moved = renderer.renderViewer(
    {
      ...base,
      time: 12.1,
      titleCamera: {
        ...base.titleCamera,
        position: [1, 2.65, 8.5],
        target: [1, 0.78, 0],
      },
    },
    TITLE_WIDTH,
    TITLE_HEIGHT,
  );

  assert.deepEqual(tracedTimes, [12, 12.1]);
  assert.notEqual(surfaceText(moved), surfaceText(initial));
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
