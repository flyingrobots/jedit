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

test("title Braille sampling keeps quarter work when reduced frames remain over budget", async () => {
  const sampling = await importDist(
    "app",
    "workspace",
    "title-braille-sampling.js",
  );

  assert.deepEqual(
    sampling.titleBrailleTraceBudget({
      frameIndex: 7,
      frameTimeMs: MODERATE_FRAME_MS,
      previousStats: activeStats(8, 8),
      previousPhaseCount: 4,
    }),
    {
      phase: 3,
      phaseCount: 4,
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

test("title Braille sampling uses ray pressure even when glyph activity is low", async () => {
  const sampling = await importDist(
    "app",
    "workspace",
    "title-braille-sampling.js",
  );

  assert.deepEqual(
    sampling.titleBrailleTraceBudget({
      frameIndex: 8,
      frameTimeMs: SLOW_FRAME_MS,
      previousStats: rayStats({
        activeSamples: 0,
        rayCount: 8,
        rayIntersectionCount: 3,
      }),
    }),
    {
      phase: 0,
      phaseCount: 4,
    },
  );
});

test("title Braille sampling uses glyph activity when measured ray pressure is low", async () => {
  const sampling = await importDist(
    "app",
    "workspace",
    "title-braille-sampling.js",
  );

  assert.deepEqual(
    sampling.titleBrailleTraceBudget({
      frameIndex: 8,
      frameTimeMs: SLOW_FRAME_MS,
      previousStats: rayStats({
        activeSamples: 8,
        rayCount: 8,
        rayIntersectionCount: 0,
      }),
    }),
    {
      phase: 0,
      phaseCount: 4,
    },
  );
});

test("title Braille sampling holds reduced quality while screen activity remains high", async () => {
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
      previousPhaseCount: 4,
    }),
    {
      phase: 1,
      phaseCount: 4,
    },
  );
});

test("title Braille sampling traces one dot while the camera moves under pressure", async () => {
  const sampling = await importDist(
    "app",
    "workspace",
    "title-braille-sampling.js",
  );

  assert.deepEqual(
    sampling.titleBrailleTraceBudget({
      frameIndex: 10,
      frameTimeMs: FAST_FRAME_MS,
      previousStats: activeStats(8, 8),
      previousPhaseCount: 4,
      cameraMoving: true,
    }),
    {
      phase: 2,
      phaseCount: 8,
    },
  );
});

test("title Braille sampling restores full quality when screen activity drops", async () => {
  const sampling = await importDist(
    "app",
    "workspace",
    "title-braille-sampling.js",
  );

  assert.deepEqual(
    sampling.titleBrailleTraceBudget({
      frameIndex: 5,
      frameTimeMs: FAST_FRAME_MS,
      previousStats: activeStats(1, 8),
      previousPhaseCount: 4,
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
    rayCount: 0,
    rayIntersectionCount: 0,
  };
}

function rayStats(options) {
  return {
    totalSamples: 8,
    tracedSamples: 8,
    reusedSamples: 0,
    activeSamples: options.activeSamples,
    coldMissSamples: 0,
    rayCount: options.rayCount,
    rayIntersectionCount: options.rayIntersectionCount,
  };
}
