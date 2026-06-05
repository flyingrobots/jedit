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
const FAST_FRAME_MS = 12;
const SLOW_FRAME_MS = 92;

test("viewer renderer passes adaptive Braille sampling state to live title frames", async () => {
  const [viewerContent, titleScreen] = await Promise.all([
    importDist("app", "workspace", "viewer-content.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const budgets = [];
  const cacheObjects = [];
  const renderer = viewerContent.createViewerContentRenderer(
    (width, height, _time, _theme, options) => {
      budgets.push(options.brailleSampling?.traceBudget);
      cacheObjects.push(options.brailleSampling?.sampleCache);
      markHighActivity(options.brailleSampling?.stats);
      return stringToSurface(`frame ${budgets.length}`, width, height);
    },
  );
  const base = mockTitleScreenModel(titleScreen, {
    frameTimeMs: FAST_FRAME_MS,
    startupIntroComplete: false,
    startupFileModalOpen: false,
  });

  const first = renderer.renderViewer(base, TITLE_WIDTH, TITLE_HEIGHT);
  const second = renderer.renderViewer(
    {
      ...base,
      frameTimeMs: SLOW_FRAME_MS,
      time: 1,
    },
    TITLE_WIDTH,
    TITLE_HEIGHT,
  );

  assert.equal(surfaceText(first).includes("frame 1"), true);
  assert.equal(surfaceText(second).includes("frame 2"), true);
  assert.deepEqual(budgets, [
    {
      phase: 0,
      phaseCount: 1,
    },
    {
      phase: 1,
      phaseCount: 4,
    },
  ]);
  assert.equal(cacheObjects[0], cacheObjects[1]);
});

test("viewer renderer does not allocate Braille sampling for ASCII title frames", async () => {
  const [viewerContent, titleScreen] = await Promise.all([
    importDist("app", "workspace", "viewer-content.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const samplingOptions = [];
  const renderer = viewerContent.createViewerContentRenderer(
    (width, height, _time, _theme, options) => {
      samplingOptions.push(options.brailleSampling);
      return stringToSurface("ascii frame", width, height);
    },
  );

  renderer.renderViewer(
    mockTitleScreenModel(titleScreen, {
      titleRenderMode: titleScreen.TITLE_RENDER_MODE.Ascii,
    }),
    TITLE_WIDTH,
    TITLE_HEIGHT,
  );

  assert.deepEqual(samplingOptions, [undefined]);
});

function markHighActivity(stats) {
  if (stats == null) {
    return;
  }
  stats.totalSamples = 8;
  stats.tracedSamples = 8;
  stats.reusedSamples = 0;
  stats.activeSamples = 8;
  stats.coldMissSamples = 0;
}
