import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { ensureDistBuiltSync, REPO_ROOT } from "./dist-helpers.mjs";

const PREVIEW_SCRIPT = "scripts/title-scene-preview.mjs";
const SPHERE_SCENE = "sphere.jedit-scene";
const SPHERE_SCENE_PATH = "scenes/sphere.jedit-scene";
const PREVIEW_WIDTH = "32";
const PREVIEW_HEIGHT = "12";
const PREBUILT_DIST_ENV = "JEDIT_DIST_PREBUILT";
const PREBUILT_DIST_ENABLED = "1";

test("title-scene preview CLI emits deterministic JSON inspection output", () => {
  ensureDistBuiltSync();
  const result = runPreview([
    "--json",
    "--no-frame",
    "--scene",
    SPHERE_SCENE,
    "--width",
    PREVIEW_WIDTH,
    "--height",
    PREVIEW_HEIGHT,
    "--key",
    "time+",
    "--key",
    "render+",
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);

  assert.equal(report.preview.sceneName, SPHERE_SCENE);
  assert.equal(report.preview.renderMode, "ascii");
  assert.equal(report.preview.timeSeconds, 0.5);
  assert.equal(report.inspector.selectedObject.kind, "sphere");
  assert.equal(report.frame, undefined);
});

test("title-scene preview CLI renders a plain frame with inspector text", () => {
  ensureDistBuiltSync();
  const result = runPreview([
    "--scene",
    SPHERE_SCENE,
    "--width",
    PREVIEW_WIDTH,
    "--height",
    PREVIEW_HEIGHT,
    "--render-mode",
    "ascii",
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /jedit title preview/);
  assert.match(result.stdout, /scene sphere\.jedit-scene/);
  assert.match(result.stdout, /render ascii/);
  assert.ok(result.stdout.replace(/\s/g, "").length > 60);
});

test("title-scene preview CLI loads custom scene paths while reporting basename", () => {
  ensureDistBuiltSync();
  const result = runPreview([
    "--json",
    "--no-frame",
    "--scene",
    SPHERE_SCENE_PATH,
    "--width",
    PREVIEW_WIDTH,
    "--height",
    PREVIEW_HEIGHT,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);

  assert.equal(report.preview.sceneName, SPHERE_SCENE);
  assert.equal(report.inspector.selectedObject.kind, "sphere");
});

function runPreview(args) {
  return spawnSync(process.execPath, [PREVIEW_SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      [PREBUILT_DIST_ENV]: PREBUILT_DIST_ENABLED,
    },
  });
}
