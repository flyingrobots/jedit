import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";

// Checked against Ottosson's published reference values rather than against
// this implementation's own output, so a transcription error in a matrix
// constant fails here instead of quietly skewing every colour that uses it.
const REFERENCE = [
  { name: "white", rgb: [255, 255, 255], lightness: 1.0, chroma: 0.0 },
  { name: "black", rgb: [0, 0, 0], lightness: 0.0, chroma: 0.0 },
  { name: "red", rgb: [255, 0, 0], lightness: 0.6279554, chroma: 0.2576833, hue: 29.23 },
  { name: "green", rgb: [0, 255, 0], lightness: 0.8664396, chroma: 0.2948272, hue: 142.5 },
  { name: "blue", rgb: [0, 0, 255], lightness: 0.4520137, chroma: 0.3132143, hue: 264.05 },
];

const LIGHTNESS_TOLERANCE = 0.0005;
const CHROMA_TOLERANCE = 0.0005;
const HUE_TOLERANCE = 0.1;

test("rgbToOklch matches published reference values", async () => {
  const { rgbToOklch } = await importDist("ui", "oklch.js");

  for (const entry of REFERENCE) {
    const actual = rgbToOklch(entry.rgb);
    assert.ok(
      Math.abs(actual.lightness - entry.lightness) < LIGHTNESS_TOLERANCE,
      `${entry.name} lightness ${actual.lightness} != ${entry.lightness}`,
    );
    assert.ok(
      Math.abs(actual.chroma - entry.chroma) < CHROMA_TOLERANCE,
      `${entry.name} chroma ${actual.chroma} != ${entry.chroma}`,
    );
    if (entry.hue !== undefined) {
      assert.ok(
        Math.abs(actual.hue - entry.hue) < HUE_TOLERANCE,
        `${entry.name} hue ${actual.hue} != ${entry.hue}`,
      );
    }
  }
});

test("oklchToRgb round-trips every channel of the sRGB cube", async () => {
  const { rgbToOklch, oklchToRgb } = await importDist("ui", "oklch.js");
  const offenders = [];

  for (let red = 0; red <= 255; red += 17) {
    for (let green = 0; green <= 255; green += 17) {
      for (let blue = 0; blue <= 255; blue += 17) {
        const original = [red, green, blue];
        const [r, g, b] = oklchToRgb(rgbToOklch(original));
        if (Math.abs(r - red) > 1 || Math.abs(g - green) > 1 || Math.abs(b - blue) > 1) {
          offenders.push(`${original} -> ${[r, g, b]}`);
        }
      }
    }
  }

  assert.deepEqual(offenders.slice(0, 5), []);
});

test("mixHue crosses zero the short way round", async () => {
  const { mixHue } = await importDist("ui", "oklch.js");

  assert.ok(Math.abs(mixHue(350, 10, 0.5) - 0) < 0.001, "350 -> 10 should pass through 0");
  assert.ok(Math.abs(mixHue(10, 350, 0.5) - 0) < 0.001, "10 -> 350 should pass through 0");
  assert.ok(Math.abs(mixHue(0, 180, 0.5) - 90) < 0.001);
  assert.equal(mixHue(120, 240, 0), 120);
});
