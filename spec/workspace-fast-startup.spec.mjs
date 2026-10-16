import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";
import { mockI18n, mockJeditTheme, mockRuntime, REPO_ROOT } from "./workspace-helpers.mjs";

const VIEWER_WIDTH = 120;
const VIEWER_HEIGHT = 32;
const FIXED_SEED = 0.5;
const STARTUP_NOW_MS = 0;

test("startup snapshot loads no title meshes", async () => {
  const adapter = await importDist(
    "adapters",
    "workspace-initial-model-snapshot.js",
  );

  const snapshot = adapter.createInitialModelSnapshot(
    STARTUP_NOW_MS,
    REPO_ROOT,
    () => FIXED_SEED,
  );

  assert.deepEqual(Object.keys(snapshot.titleMeshes ?? {}), []);
});

test("startup snapshot preloads no title scene", async () => {
  const adapter = await importDist(
    "adapters",
    "workspace-initial-model-snapshot.js",
  );

  const snapshot = adapter.createInitialModelSnapshot(
    STARTUP_NOW_MS,
    REPO_ROOT,
    () => FIXED_SEED,
  );

  assert.equal(snapshot.sceneOverride == null, true);
  assert.equal(snapshot.sceneOverrideName == null, true);
});

test("a workspace with no open file renders the Jim logo", async () => {
  const [init, viewerContent] = await Promise.all([
    importDist("app", "workspace", "init.js"),
    importDist("app", "workspace", "viewer-content.js"),
  ]);
  const model = init.createInitialModel(REPO_ROOT, VIEWER_WIDTH, VIEWER_HEIGHT, {
    entries: [],
    titleSceneSeed: FIXED_SEED,
    jeditTheme: mockJeditTheme(),
    i18n: mockI18n(),
    nowMs: STARTUP_NOW_MS,
  });

  const surface = viewerContent.renderViewer(model, VIEWER_WIDTH, VIEWER_HEIGHT);
  let braille = 0;
  for (let row = 0; row < VIEWER_HEIGHT; row += 1) {
    for (let column = 0; column < VIEWER_WIDTH; column += 1) {
      const char = surface.get(column, row)?.char ?? " ";
      if (char >= "\u2801" && char <= "\u28ff") {
        braille += 1;
      }
    }
  }

  assert.ok(braille > 40, `expected Braille logo ink, saw ${braille} cells`);
});

test("the startup logo carries its own colours, not one flat token", async () => {
  const [init, viewerContent] = await Promise.all([
    importDist("app", "workspace", "init.js"),
    importDist("app", "workspace", "viewer-content.js"),
  ]);
  const model = init.createInitialModel(REPO_ROOT, VIEWER_WIDTH, VIEWER_HEIGHT, {
    entries: [],
    titleSceneSeed: FIXED_SEED,
    jeditTheme: mockJeditTheme(),
    i18n: mockI18n(),
    nowMs: STARTUP_NOW_MS,
  });

  const surface = viewerContent.renderViewer(model, VIEWER_WIDTH, VIEWER_HEIGHT);
  const inkColours = new Set();
  for (let row = 0; row < VIEWER_HEIGHT; row += 1) {
    for (let column = 0; column < VIEWER_WIDTH; column += 1) {
      const cell = surface.get(column, row);
      const char = cell?.char ?? " ";
      if (char >= "\u2801" && char <= "\u28ff" && cell?.fgRGB != null) {
        inkColours.add(cell.fgRGB.join(","));
      }
    }
  }

  assert.ok(inkColours.size > 3, `expected multiple ink colours, saw ${inkColours.size}`);
});

test("no title scene stats are reported when no backdrop is drawn", async () => {
  const [init, stats] = await Promise.all([
    importDist("app", "workspace", "init.js"),
    importDist("app", "workspace", "title-scene-performance-stats.js"),
  ]);
  const model = init.createInitialModel(REPO_ROOT, VIEWER_WIDTH, VIEWER_HEIGHT, {
    entries: [],
    titleSceneSeed: FIXED_SEED,
    jeditTheme: mockJeditTheme(),
    i18n: mockI18n(),
    nowMs: STARTUP_NOW_MS,
  });

  assert.equal(stats.titleScenePerformanceStats(model), undefined);
});

test("title scene stats are reported once the legacy backdrop is selected", async () => {
  const [init, stats, titleScreen] = await Promise.all([
    importDist("app", "workspace", "init.js"),
    importDist("app", "workspace", "title-scene-performance-stats.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const model = init.createInitialModel(REPO_ROOT, VIEWER_WIDTH, VIEWER_HEIGHT, {
    entries: [],
    titleSceneSeed: FIXED_SEED,
    jeditTheme: mockJeditTheme(),
    i18n: mockI18n(),
    nowMs: STARTUP_NOW_MS,
  });

  const reported = stats.titleScenePerformanceStats({
    ...model,
    titleBackdropKind: titleScreen.TITLE_BACKDROP_KIND.LegacyScene,
  });

  assert.notEqual(reported, undefined);
  assert.ok(reported.rayCount > 0);
});

test("an idle time tick returns the same model so nothing re-renders", async () => {
  const [runtimeModule, titleScreen] = await Promise.all([
    importDist("app", "workspace", "runtime.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime());
  const idle = {
    ...idleWorkspaceModel(titleScreen),
    perfVisible: false,
  };

  const [next, commands] = runtime.update({ type: "time-tick", time: 1 }, idle);

  assert.equal(next, idle);
  assert.deepEqual(commands, []);
});

test("a time tick still animates while the perf overlay is visible", async () => {
  const [runtimeModule, titleScreen] = await Promise.all([
    importDist("app", "workspace", "runtime.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime());
  const watching = {
    ...idleWorkspaceModel(titleScreen),
    perfVisible: true,
  };

  const [next] = runtime.update({ type: "time-tick", time: 1 }, watching);

  assert.notEqual(next, watching);
  assert.equal(next.time, 1);
});

test("a time tick still animates while the legacy title backdrop is drawn", async () => {
  const [runtimeModule, titleScreen] = await Promise.all([
    importDist("app", "workspace", "runtime.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime());
  const tracing = {
    ...idleWorkspaceModel(titleScreen),
    titleBackdropKind: titleScreen.TITLE_BACKDROP_KIND.LegacyScene,
  };

  const [next] = runtime.update({ type: "time-tick", time: 1 }, tracing);

  assert.notEqual(next, tracing);
});

function idleWorkspaceModel(titleScreen) {
  return {
    time: 0,
    lastFrameMs: 0,
    frameTimeMs: 0,
    frameTimeHistory: [],
    startupIntroComplete: true,
    perfVisible: false,
    profiler: { active: false },
    titleBackdropKind: titleScreen.TITLE_BACKDROP_KIND.StaticLogo,
  };
}
