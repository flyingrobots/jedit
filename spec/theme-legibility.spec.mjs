import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";

// Body text is held to WCAG AA. Secondary chrome (gutter, decorative shadows)
// is deliberately quieter and is not covered by this floor -- see #309 for the
// per-surface reasoning.
const MIN_BODY_TEXT_CONTRAST = 4.5;

function relativeLuminance([red, green, blue]) {
  const channel = (value) => {
    const ratio = value / 255;
    return ratio <= 0.03928
      ? ratio / 12.92
      : Math.pow((ratio + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
  );
}

function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

test("every theme renders editor body text at WCAG AA or better", async () => {
  const themes = await importDist("ui", "jedit-themes.js");
  const offenders = [];

  for (const theme of themes.availableJeditThemes()) {
    const workspace = theme.surface.workspace;
    const ratio = contrastRatio(workspace.fgRGB, workspace.bgRGB);
    if (ratio < MIN_BODY_TEXT_CONTRAST) {
      offenders.push(`${theme.name} (${theme.mode}) ${ratio.toFixed(2)}`);
    }
  }

  assert.deepEqual(offenders, []);
});

test("every theme keeps the current line readable", async () => {
  const themes = await importDist("ui", "jedit-themes.js");
  const offenders = [];

  for (const theme of themes.availableJeditThemes()) {
    const line = theme.surface.currentLine;
    const ratio = contrastRatio(line.fgRGB, line.bgRGB);
    if (ratio < MIN_BODY_TEXT_CONTRAST) {
      offenders.push(`${theme.name} (${theme.mode}) ${ratio.toFixed(2)}`);
    }
  }

  assert.deepEqual(offenders, []);
});
