import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";

const FAST_FRAME_MS = 12;
const MODERATE_FRAME_MS = 48;
const SLOW_FRAME_MS = 92;

test("title Braille sampling keeps full quality without previous pressure facts", async () => {
  const sampling = await importDist(
    "app",
    "workspace",
    "title-braille-sampling.js",
  );

  assert.deepEqual(
    sampling.titleBrailleTraceBudget({
      frameIndex: 7,
      frameTimeMs: SLOW_FRAME_MS,
    }),
    {
      phase: 0,
      phaseCount: 1,
    },
  );
});

test("title Braille sampling ramps down when slow frames have high screen activity", async () => {
  const sampling = await importDist(
    "app",
    "workspace",
    "title-braille-sampling.js",
  );

  assert.deepEqual(
    sampling.titleBrailleTraceBudget({
      frameIndex: 9,
      frameTimeMs: SLOW_FRAME_MS,
      previousStats: activeStats(8, 8),
    }),
    {
      phase: 1,
      phaseCount: 4,
    },
  );
});

test("title Braille sampling treats close-mesh activity as pressure", async () => {
  const sampling = await importDist(
    "app",
    "workspace",
    "title-braille-sampling.js",
  );

  assert.deepEqual(
    sampling.titleBrailleTraceBudget({
      frameIndex: 6,
      frameTimeMs: SLOW_FRAME_MS,
      previousStats: activeStats(2, 8),
    }),
    {
      phase: 2,
      phaseCount: 4,
    },
  );
});

test("title Braille sampling only halves work for moderate pressure", async () => {
  const sampling = await importDist(
    "app",
    "workspace",
    "title-braille-sampling.js",
  );

  assert.deepEqual(
    sampling.titleBrailleTraceBudget({
      frameIndex: 3,
      frameTimeMs: MODERATE_FRAME_MS,
      previousStats: activeStats(8, 8),
    }),
    {
      phase: 1,
      phaseCount: 2,
    },
  );
});

test("title Braille sampling stays full quality when screen activity is low", async () => {
  const sampling = await importDist(
    "app",
    "workspace",
    "title-braille-sampling.js",
  );

  assert.deepEqual(
    sampling.titleBrailleTraceBudget({
      frameIndex: 4,
      frameTimeMs: SLOW_FRAME_MS,
      previousStats: activeStats(1, 8),
    }),
    {
      phase: 0,
      phaseCount: 1,
    },
  );
});

test("title Braille sampling restores full quality after frame time recovers", async () => {
  const sampling = await importDist(
    "app",
    "workspace",
    "title-braille-sampling.js",
  );

  assert.deepEqual(
    sampling.titleBrailleTraceBudget({
      frameIndex: 5,
      frameTimeMs: FAST_FRAME_MS,
      previousStats: activeStats(8, 8),
    }),
    {
      phase: 0,
      phaseCount: 1,
    },
  );
});

function activeStats(activeSamples, totalSamples) {
  return {
    totalSamples,
    tracedSamples: totalSamples,
    reusedSamples: 0,
    activeSamples,
    coldMissSamples: 0,
  };
}
