import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";

// A companion theme is produced by inverting an authored palette, and inversion
// does not preserve contrast: an accent picked to read on a dark surface can
// land far too close to the inverted light one. Monokai's generated light
// companion sat at 1.30 before this floor existed -- effectively invisible.
//
// Authored palettes are deliberately not covered here. Those are an author's
// choice and are held to their own standard in theme-legibility.spec.mjs; this
// file only governs the palettes jedit generates on the author's behalf.

const MIN_TOKEN_CONTRAST = 3;

function channelLuminance(channel) {
  const ratio = channel / 255;
  return ratio <= 0.04045 ? ratio / 12.92 : Math.pow((ratio + 0.055) / 1.055, 2.4);
}

function relativeLuminance(color) {
  return 0.2126 * channelLuminance(color[0])
    + 0.7152 * channelLuminance(color[1])
    + 0.0722 * channelLuminance(color[2]);
}

function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

async function generatedCompanions() {
  const themes = await importDist("ui", "jedit-themes.js");
  const companions = [];
  for (const theme of themes.availableJeditThemes()) {
    const companion = themes.oppositeJeditTheme(theme);
    if (companion.variantSource === "generated") {
      companions.push(companion);
    }
  }
  return companions;
}

test("generated companion themes exist to be checked", async () => {
  const companions = await generatedCompanions();
  assert.ok(companions.length > 0, "expected at least one generated companion theme");
});

test("every generated companion keeps its syntax tokens legible", async () => {
  const offenders = [];

  for (const companion of await generatedCompanions()) {
    const background = companion.surface.workspace.bgRGB;
    for (const [token, style] of companion.source) {
      const ratio = contrastRatio(style.fgRGB, background);
      if (ratio < MIN_TOKEN_CONTRAST) {
        offenders.push(`${companion.name} ${String(token)} ${ratio.toFixed(2)}`);
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test("every generated companion keeps its markdown tokens legible", async () => {
  const offenders = [];

  for (const companion of await generatedCompanions()) {
    const background = companion.surface.workspace.bgRGB;
    for (const [token, style] of companion.markdown) {
      if (style.fgRGB == null) {
        continue;
      }
      const ratio = contrastRatio(style.fgRGB, background);
      if (ratio < MIN_TOKEN_CONTRAST) {
        offenders.push(`${companion.name} ${String(token)} ${ratio.toFixed(2)}`);
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test("the contrast floor leaves an already-legible colour alone", async () => {
  // catppuccin's companion cleared the floor before the adjustment existed, so
  // a correction that fired unconditionally would show up as a changed colour
  // here rather than as a contrast failure anywhere.
  const companions = await generatedCompanions();
  const catppuccin = companions.find((theme) => theme.name.startsWith("catppuccin"));
  assert.ok(catppuccin != null, "expected a generated catppuccin companion");

  const background = catppuccin.surface.workspace.bgRGB;
  let worst = Infinity;
  for (const [, style] of catppuccin.source) {
    worst = Math.min(worst, contrastRatio(style.fgRGB, background));
  }
  assert.ok(worst > 4, `expected catppuccin to stay comfortably legible, got ${worst.toFixed(2)}`);
});

test("reaching the contrast floor does not wash a colour out to grey", async () => {
  const { rgbToOklch } = await importDist("ui", "oklch.js");
  const themes = await importDist("ui", "jedit-themes.js");

  // Blending toward black or white -- the obvious way to hit a contrast floor --
  // desaturates as it goes, so a theme's colours arrive muddied. Walking
  // lightness in OKLCH holds chroma instead. Tokens that are already neutral in
  // the authored theme (ink-derived ones such as variable and property) are
  // meant to stay neutral, so only chromatic tokens are checked.
  const CHROMATIC = 0.05;
  const offenders = [];

  for (const theme of themes.availableJeditThemes()) {
    const companion = themes.oppositeJeditTheme(theme);
    if (companion.variantSource !== "generated") {
      continue;
    }
    for (const [token, style] of theme.source) {
      if (rgbToOklch(style.fgRGB).chroma < CHROMATIC) {
        continue;
      }
      const companionStyle = companion.source.get(token);
      const { chroma } = rgbToOklch(companionStyle.fgRGB);
      if (chroma < CHROMATIC) {
        offenders.push(`${companion.name} ${String(token)} fell to chroma ${chroma.toFixed(3)}`);
      }
    }
  }

  assert.deepEqual(offenders, []);
});
