import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";

test("title allocation facts contract accepts a Braille posture report", async () => {
  const factsModule = await importDist("ui", "title-allocation-facts.js");
  const titleModule = await importDist("ui", "title-screen.js");

  const facts = factsModule.createTitleRayAllocationFacts({
    width: 24,
    height: 10,
    renderMode: titleModule.TITLE_RENDER_MODE.Braille,
    warmupFrames: 2,
    measuredFrames: 4,
    posture: factsModule.TITLE_RAY_ALLOCATION_POSTURE.Unmeasured,
    notes: ["instrumentation unavailable"],
  });

  assert.deepEqual(facts, {
    renderer: factsModule.TITLE_RAY_ALLOCATION_RENDERER,
    width: 24,
    height: 10,
    renderMode: titleModule.TITLE_RENDER_MODE.Braille,
    warmupFrames: 2,
    measuredFrames: 4,
    posture: factsModule.TITLE_RAY_ALLOCATION_POSTURE.Unmeasured,
    notes: ["instrumentation unavailable"],
  });
});

test("title allocation facts contract rejects impossible dimensions and frames", async () => {
  const factsModule = await importDist("ui", "title-allocation-facts.js");
  const titleModule = await importDist("ui", "title-screen.js");

  assert.throws(
    () =>
      factsModule.createTitleRayAllocationFacts({
        width: 0,
        height: 10,
        renderMode: titleModule.TITLE_RENDER_MODE.Braille,
        warmupFrames: 0,
        measuredFrames: 1,
        posture: factsModule.TITLE_RAY_ALLOCATION_POSTURE.Unmeasured,
      }),
    /width must be a positive integer/,
  );
  assert.throws(
    () =>
      factsModule.createTitleRayAllocationFacts({
        width: 10,
        height: 10,
        renderMode: titleModule.TITLE_RENDER_MODE.Braille,
        warmupFrames: 0,
        measuredFrames: 0,
        posture: factsModule.TITLE_RAY_ALLOCATION_POSTURE.Unmeasured,
      }),
    /measuredFrames must be a positive integer/,
  );
  assert.throws(
    () =>
      factsModule.createTitleRayAllocationFacts({
        width: 10,
        height: 10,
        renderMode: titleModule.TITLE_RENDER_MODE.Ascii,
        warmupFrames: 0,
        measuredFrames: 1,
        posture: factsModule.TITLE_RAY_ALLOCATION_POSTURE.Unmeasured,
      }),
    /only support Braille mode/,
  );
});
