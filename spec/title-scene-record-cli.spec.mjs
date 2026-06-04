import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = discoverRepoRoot(SPEC_DIR);
const RECORD_SCRIPT = "scripts/title-scene-record.mjs";
const SPHERE_SCENE = "sphere.jedit-scene";
const RECORD_WIDTH = "32";
const RECORD_HEIGHT = "12";
const PREBUILT_DIST_ENV = "JEDIT_DIST_PREBUILT";
const PREBUILT_DIST_ENABLED = "1";
const DIST_MAIN_PATH = path.join(REPO_ROOT, "dist", "main.js");
const FIXED_RECORD_ARGS = [
  "--scene",
  SPHERE_SCENE,
  "--theme",
  "graphite",
  "--render-mode",
  "ascii",
  "--width",
  RECORD_WIDTH,
  "--height",
  RECORD_HEIGHT,
  "--frames",
  "2",
  "--start",
  "0",
  "--step",
  "0.5",
];

test("title-scene record CLI emits deterministic JSON frames with color metadata", () => {
  ensureDistBuiltSync();
  const first = runRecord(["--format", "json", ...FIXED_RECORD_ARGS]);
  const second = runRecord(["--format", "json", ...FIXED_RECORD_ARGS]);

  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.equal(first.stdout, second.stdout);

  const report = JSON.parse(first.stdout);
  assert.equal(report.recording.format, "json");
  assert.equal(report.recording.sceneName, SPHERE_SCENE);
  assert.equal(report.recording.themeName, "graphite");
  assert.equal(report.recording.renderMode, "ascii");
  assert.equal(report.recording.width, 32);
  assert.equal(report.recording.height, 12);
  assert.equal(report.recording.frameCount, 2);
  assert.equal(report.frames.length, 2);
  assert.equal(report.frames[0].timeSeconds, 0);
  assert.equal(report.frames[1].timeSeconds, 0.5);
  assert.equal(report.frames[0].glyphRows.length, 12);
  assert.equal(report.frames[0].glyphRows[0].length, 32);
  assert.equal(report.frames[0].colorRows.length, 12);
  assert.equal(report.frames[0].colorRows[0].length, 32);
  assertRgb(report.frames[0].colorRows[0][0].fgRGB);
  assertRgb(report.frames[0].colorRows[0][0].bgRGB);
});

test("title-scene record CLI emits plain text frame labels and glyph rows", () => {
  ensureDistBuiltSync();
  const result = runRecord(["--format", "text", ...FIXED_RECORD_ARGS]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /jedit title scene recording/);
  assert.match(result.stdout, /frame 0 time 0\.00s/);
  assert.match(result.stdout, /frame 1 time 0\.50s/);
  assert.ok(result.stdout.replace(/\s/g, "").length > 40);
});

test("title-scene record CLI writes explicit artifacts without stdout noise", () => {
  ensureDistBuiltSync();
  const tempDir = mkdtempSync(path.join(tmpdir(), "jedit-title-record-"));
  const outputPath = path.join(tempDir, "title.html");

  try {
    const result = runRecord([
      "--format",
      "html",
      "--output",
      outputPath,
      ...FIXED_RECORD_ARGS,
    ]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.stdout, "");
    const html = readFileSync(outputPath, "utf8");
    assert.match(html, /<!doctype html>/i);
    assert.match(html, /jedit title scene recording/);
    assert.match(html, /frame 0 time 0\.00s/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function runRecord(args) {
  return spawnSync(process.execPath, [RECORD_SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      [PREBUILT_DIST_ENV]: PREBUILT_DIST_ENABLED,
    },
  });
}

function ensureDistBuiltSync() {
  if (process.env[PREBUILT_DIST_ENV] === PREBUILT_DIST_ENABLED) {
    assert.ok(
      existsSync(DIST_MAIN_PATH),
      `${DIST_MAIN_PATH} should exist when ${PREBUILT_DIST_ENV}=1`,
    );
    return;
  }
  const build = spawnSync("npm", ["run", "build"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  assert.equal(build.status, 0, build.stderr || build.stdout);
}

function discoverRepoRoot(cwd) {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function assertRgb(value) {
  assert.equal(value.length, 3);
  for (const channel of value) {
    assert.equal(Number.isInteger(channel), true);
    assert.equal(channel >= 0, true);
    assert.equal(channel <= 255, true);
  }
}
