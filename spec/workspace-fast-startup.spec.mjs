import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";
import { mockI18n, mockJeditTheme, REPO_ROOT } from "./workspace-helpers.mjs";

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

test("a workspace with no open file renders no title backdrop", async () => {
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

  const surface = viewerContent.renderViewer(
    model,
    VIEWER_WIDTH,
    VIEWER_HEIGHT,
  );
  let painted = 0;
  for (let row = 0; row < VIEWER_HEIGHT; row += 1) {
    for (let column = 0; column < VIEWER_WIDTH; column += 1) {
      const cell = surface.get(column, row);
      if (cell?.char != null && cell.char.trim() !== "") {
        painted += 1;
      }
    }
  }

  assert.equal(painted, 0);
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
