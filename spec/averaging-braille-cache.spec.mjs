import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";

test("Braille sample cache reuses inactive temporal phase samples", async () => {
  const brailleCanvas = await importDist("ui", "averaging-braille-canvas.js");
  const cache = brailleCanvas.createBrailleSampleCache(1, 1);

  brailleCanvas.averagingBrailleCanvas(1, 1, litSample, 0, {
    sampleCache: cache,
  });

  const stats = brailleCanvas.createBrailleSampleFrameStats();
  const shaderCalls = { count: 0 };
  const surface = brailleCanvas.averagingBrailleCanvas(
    1,
    1,
    () => {
      shaderCalls.count += 1;
      return litSample();
    },
    0,
    {
      sampleCache: cache,
      stats,
      traceBudget: {
        phase: 0,
        phaseCount: 2,
      },
    },
  );

  assert.equal(shaderCalls.count, 4);
  assert.equal(stats.totalSamples, 8);
  assert.equal(stats.tracedSamples, 4);
  assert.equal(stats.reusedSamples, 4);
  assert.equal(stats.activeSamples, 8);
  assert.equal(surface.get(0, 0).char, String.fromCodePoint(0x28ff));
});

test("Braille temporal phase count four traces two dots after cache warmup", async () => {
  const brailleCanvas = await importDist("ui", "averaging-braille-canvas.js");
  const cache = brailleCanvas.createBrailleSampleCache(1, 1);

  brailleCanvas.averagingBrailleCanvas(1, 1, litSample, 0, {
    sampleCache: cache,
  });

  const stats = brailleCanvas.createBrailleSampleFrameStats();
  const shaderCalls = { count: 0 };
  brailleCanvas.averagingBrailleCanvas(
    1,
    1,
    () => {
      shaderCalls.count += 1;
      return litSample();
    },
    0,
    {
      sampleCache: cache,
      stats,
      traceBudget: {
        phase: 1,
        phaseCount: 4,
      },
    },
  );

  assert.equal(shaderCalls.count, 2);
  assert.equal(stats.tracedSamples, 2);
  assert.equal(stats.reusedSamples, 6);
});

test("Braille sample cache resets when render dimensions change", async () => {
  const brailleCanvas = await importDist("ui", "averaging-braille-canvas.js");
  const cache = brailleCanvas.createBrailleSampleCache(1, 1);

  brailleCanvas.averagingBrailleCanvas(1, 1, litSample, 0, {
    sampleCache: cache,
  });

  const stats = brailleCanvas.createBrailleSampleFrameStats();
  const shaderCalls = { count: 0 };
  brailleCanvas.averagingBrailleCanvas(
    2,
    1,
    () => {
      shaderCalls.count += 1;
      return litSample();
    },
    0,
    {
      sampleCache: cache,
      stats,
      traceBudget: {
        phase: 0,
        phaseCount: 2,
      },
    },
  );

  assert.equal(shaderCalls.count, 16);
  assert.equal(stats.totalSamples, 16);
  assert.equal(stats.tracedSamples, 16);
  assert.equal(stats.reusedSamples, 0);
});

function litSample() {
  return {
    on: true,
    fgRGB: [200, 210, 220],
    bgRGB: [0, 0, 0],
  };
}
