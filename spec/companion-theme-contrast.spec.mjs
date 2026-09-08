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

// A syntax foreground keeps its colour when the current line repaints the
// background beneath it, and the settings drawer reuses the comment foreground
// over the drawer background. Checking only the workspace background passed
// tokens that were then rendered somewhere darker: monokai's light companion
// reported 3.03:1 on the workspace while sitting at 2.75:1 on the current line
// and 2.51:1 in the drawer.
function renderingSurfaces(theme) {
  return [
    ["workspace", theme.surface.workspace.bgRGB],
    ["currentLine", theme.surface.currentLine.bgRGB],
    ["drawer", theme.surface.drawer.bgRGB],
    ["header", theme.surface.header.bgRGB],
    ["footer", theme.surface.footer.bgRGB],
  ];
}

test("every generated companion keeps its tokens legible on every surface it renders on", async () => {
  const offenders = [];

  for (const companion of await generatedCompanions()) {
    for (const [name, background] of renderingSurfaces(companion)) {
      for (const [token, style] of companion.source) {
        const ratio = contrastRatio(style.fgRGB, background);
        if (ratio < MIN_TOKEN_CONTRAST) {
          offenders.push(`${companion.name} ${String(token)} on ${name} ${ratio.toFixed(2)}`);
        }
      }
      for (const [token, style] of companion.markdown) {
        if (style.fgRGB == null) {
          continue;
        }
        const ratio = contrastRatio(style.fgRGB, background);
        if (ratio < MIN_TOKEN_CONTRAST) {
          offenders.push(`${companion.name} ${String(token)} on ${name} ${ratio.toFixed(2)}`);
        }
      }
    }
  }

  assert.deepEqual(offenders, []);
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

test("the correction searches both directions, not just away from the surface", async () => {
  const contrast = await importDist("ui", "theme-contrast.js");

  // A token darker than a mid-dark surface. Walking darker tops out at 3.00
  // against this surface even at pure black, so a correction that commits to
  // "away from the ground" by luminance alone can never reach the 4.5 floor --
  // while walking lighter reaches 7.00 comfortably.
  const surface = [89, 89, 89];   // relative luminance 0.100
  const ink = [63, 63, 63];       // relative luminance 0.050, ratio 1.50

  const adjusted = contrast.contrastAdjustedPalette({
    ink,
    muted: ink,
    accent: ink,
    info: ink,
    warning: ink,
    success: ink,
    surface,
    surfaceRaised: surface,
    surfaceMuted: surface,
  });

  const ratio = contrastRatio(adjusted.ink, surface);
  assert.ok(
    ratio >= 4.5,
    `ink should have been corrected to clear 4.5:1, got ${ratio.toFixed(2)} at ${adjusted.ink}`,
  );
});

test("the correction takes the smaller lightness change when both directions pass", async () => {
  const contrast = await importDist("ui", "theme-contrast.js");
  const { rgbToOklch, oklchToRgb } = await importDist("ui", "oklch.js");

  // Mid grey surface: both black and white clear 3:1, so "walk away from the
  // ground" is not a sufficient answer -- the correction has to pick the nearer
  // side. Asserting merely "it got darker" would also pass for a correction
  // that darkened all the way to black, so the expected landing point is
  // computed here independently of the implementation.
  const surface = [128, 128, 128];
  const ink = [110, 110, 110];
  const MIN_ACCENT_CONTRAST = 3;

  const origin = rgbToOklch(ink);
  const passesAt = (lightness) =>
    contrastRatio(oklchToRgb({ ...origin, lightness }), surface) >= MIN_ACCENT_CONTRAST;

  // Finest-grain scan outward from the origin, both sides, independent of the
  // implementation's step size.
  const GRAIN = 0.001;
  let optimalDelta;
  for (let delta = 0; delta <= 1 && optimalDelta === undefined; delta += GRAIN) {
    if (passesAt(Math.max(0, origin.lightness - delta))
      || passesAt(Math.min(1, origin.lightness + delta))) {
      optimalDelta = delta;
    }
  }
  assert.ok(optimalDelta !== undefined, "a passing colour should exist on this surface");

  const adjusted = contrast.contrastAdjustedPalette({
    ink: [0, 0, 0],
    muted: ink,
    accent: ink,
    info: ink,
    warning: ink,
    success: ink,
    surface,
    surfaceRaised: surface,
    surfaceMuted: surface,
  });

  const actualDelta = Math.abs(rgbToOklch(adjusted.accent).lightness - origin.lightness);

  assert.ok(
    contrastRatio(adjusted.accent, surface) >= MIN_ACCENT_CONTRAST,
    `accent should clear ${MIN_ACCENT_CONTRAST}:1, got ${contrastRatio(adjusted.accent, surface).toFixed(2)}`,
  );
  // One search step of slack: the walk samples a grid, so it can overshoot the
  // true optimum by at most the step it moves in.
  const STEP_SLACK = 0.025;
  assert.ok(
    actualDelta <= optimalDelta + STEP_SLACK,
    `expected a change near the ${optimalDelta.toFixed(3)} optimum, moved ${actualDelta.toFixed(3)}`,
  );
  assert.ok(
    rgbToOklch(adjusted.accent).lightness < origin.lightness,
    `expected the nearer (darker) solution, got ${adjusted.accent}`,
  );
});
