import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { ensureDistBuiltSync, REPO_ROOT } from "./dist-helpers.mjs";

const PROFILE_SCRIPT = "scripts/title-scene-profile.mjs";
const SPHERE_SCENE = "sphere.jedit-scene";
const PROFILE_WIDTH = "24";
const PROFILE_HEIGHT = "10";
const PROFILE_FRAMES = "2";
const PREBUILT_DIST_ENV = "JEDIT_DIST_PREBUILT";
const PREBUILT_DIST_ENABLED = "1";

test("title-scene profile CLI emits JSON timing and sample facts", () => {
  ensureDistBuiltSync();
  const result = runProfile([
    "--json",
    "--scene",
    SPHERE_SCENE,
    "--theme",
    "graphite",
    "--render-mode",
    "ascii",
    "--width",
    PROFILE_WIDTH,
    "--height",
    PROFILE_HEIGHT,
    "--frames",
    PROFILE_FRAMES,
    "--warmup",
    "0",
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);

  assert.equal(report.scene.name, SPHERE_SCENE);
  assert.equal(report.scene.objects, 1);
  assert.equal(report.render.mode, "ascii");
  assert.equal(report.render.width, Number(PROFILE_WIDTH));
  assert.equal(report.render.height, Number(PROFILE_HEIGHT));
  assert.equal(report.render.frames, Number(PROFILE_FRAMES));
  assert.equal(report.render.primarySamplesPerFrame, 960);
  assert.equal(report.render.totalPrimarySamples, 1920);
  assert.ok(report.timing.avgMs >= 0);
  assert.ok(report.timing.maxMs >= report.timing.minMs);
  assert.ok(report.checksum > 0);
});

test("title-scene profile CLI emits a plain report", () => {
  ensureDistBuiltSync();
  const result = runProfile([
    "--scene",
    SPHERE_SCENE,
    "--width",
    PROFILE_WIDTH,
    "--height",
    PROFILE_HEIGHT,
    "--frames",
    "1",
    "--warmup",
    "0",
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /jedit title scene profile/);
  assert.match(result.stdout, /scene sphere\.jedit-scene/);
  assert.match(result.stdout, /samples\/frame/);
});

test("title-scene profile CLI reports temporal Braille sampling facts", () => {
  ensureDistBuiltSync();
  const result = runProfile([
    "--json",
    "--scene",
    SPHERE_SCENE,
    "--theme",
    "graphite",
    "--render-mode",
    "braille",
    "--width",
    PROFILE_WIDTH,
    "--height",
    PROFILE_HEIGHT,
    "--frames",
    PROFILE_FRAMES,
    "--warmup",
    "1",
    "--braille-phase-count",
    "8",
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);

  assert.equal(report.sampling.braillePhaseCount, 8);
  assert.equal(report.sampling.tracedSamplesPerFrame, 240);
  assert.equal(report.sampling.reusedSamplesPerFrame, 1680);
  assert.equal(report.sampling.coldMissSamples, 0);
  assert.ok(report.sampling.rayCount > 0);
  assert.ok(report.sampling.rayIntersectionCount >= 0);
  assert.ok(report.sampling.rayPressureRatio >= 0);
  assert.equal(report.allocation.posture, "unmeasured");
  assert.match(report.allocation.notes.join("\n"), /--expose-gc/);
});

test("title-scene profile CLI witnesses allocation posture with exposed GC", () => {
  ensureDistBuiltSync();
  const result = runProfile([
    "--json",
    "--theme",
    "graphite",
    "--render-mode",
    "braille",
    "--width",
    "16",
    "--height",
    "6",
    "--frames",
    "1",
    "--warmup",
    "1",
  ], { exposeGc: true });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);

  assert.equal(report.scene.name, "bunny.jedit-scene");
  assert.equal(report.allocation.renderer, "title-braille-bunny");
  assert.equal(report.allocation.width, 16);
  assert.equal(report.allocation.height, 6);
  assert.equal(report.allocation.renderMode, "braille");
  assert.equal(report.allocation.warmupFrames, 1);
  assert.equal(report.allocation.measuredFrames, 1);
  assert.ok(["allocating", "bounded-after-warmup"].includes(
    report.allocation.posture,
  ));
  assert.equal(typeof report.allocation.allocatedBytes, "number");
  assert.equal(typeof report.allocation.allocationEvents, "number");
  assert.match(report.allocation.notes.join("\n"), /forced GC/);
});

function runProfile(args, options = {}) {
  const nodeArgs = options.exposeGc
    ? ["--expose-gc", PROFILE_SCRIPT, ...args]
    : [PROFILE_SCRIPT, ...args];
  return spawnSync(process.execPath, nodeArgs, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      [PREBUILT_DIST_ENV]: PREBUILT_DIST_ENABLED,
    },
  });
}
