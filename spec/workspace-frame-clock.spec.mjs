import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";
import { mockRuntime } from "./workspace-helpers.mjs";

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

// The idle gate returns the same model so nothing re-renders, which also means
// lastFrameMs stops advancing while the workspace sits still. If animation is
// later switched back on, the first active tick would otherwise bill the whole
// idle interval as a single frame: instantly over budget, which trips the
// backdrop's low-rate flag and leaves the animation frozen on every frame after.

const IDLE_MS = 30_000;
const PLAUSIBLE_FRAME_MS = 100;

async function runtimeAt(clock) {
  const runtimeModule = await importDist("app", "workspace", "runtime.js");
  return runtimeModule.createWorkspaceRuntime({
    ...mockRuntime(),
    nowMs: () => clock.now,
  });
}

test("resuming animation after an idle gap starts a fresh frame clock", async () => {
  const titleScreen = await importDist("ui", "title-screen.js");
  const clock = { now: 0 };
  const runtime = await runtimeAt(clock);

  const idle = {
    ...idleWorkspaceModel(titleScreen),
    perfVisible: false,
    lastFrameMs: 0,
  };

  // Sit idle. Ticks keep arriving; the gate returns the same model each time.
  clock.now = IDLE_MS;
  const [stillIdle] = runtime.update({ type: "time-tick", time: 1 }, idle);
  assert.equal(stillIdle, idle, "an idle tick must not produce a new model");

  // The user switches the perf overlay on, which reactivates animation.
  const [watching] = runtime.update({ type: "toggle-perf" }, stillIdle);
  assert.equal(watching.perfVisible, true);

  // The next tick is the first active frame.
  clock.now = IDLE_MS + 16;
  const [animating] = runtime.update({ type: "time-tick", time: 2 }, watching);

  assert.ok(
    animating.frameTimeMs < PLAUSIBLE_FRAME_MS,
    `first resumed frame billed ${animating.frameTimeMs}ms of idle time as one frame`,
  );
});

test("frame timing is untouched while animation stays active", async () => {
  const titleScreen = await importDist("ui", "title-screen.js");
  const clock = { now: 0 };
  const runtime = await runtimeAt(clock);

  const watching = {
    ...idleWorkspaceModel(titleScreen),
    perfVisible: true,
    lastFrameMs: 0,
  };

  clock.now = 16;
  const [first] = runtime.update({ type: "time-tick", time: 1 }, watching);
  assert.equal(first.frameTimeMs, 16);

  clock.now = 33;
  const [second] = runtime.update({ type: "time-tick", time: 2 }, first);
  assert.equal(second.frameTimeMs, 17, "an ordinary frame must be measured normally");
});
