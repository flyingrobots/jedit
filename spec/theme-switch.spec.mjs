import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { REPO_ROOT, ensureDistBuilt } from "./dist-helpers.mjs";

const THEMES_PATH = path.join(REPO_ROOT, "dist", "ui", "jedit-themes.js");
const STYLE_PATH = path.join(REPO_ROOT, "dist", "ui", "jedit-theme.js");
const TITLE_SCENE_LIGHTING_PATH = path.join(
  REPO_ROOT,
  "dist",
  "ui",
  "title-scene-lighting-tokens.js",
);
const EDITOR_INSPIRED_THEME_NAMES = [
  "monokai",
  "solarized-dark",
  "solarized-light",
  "dracula",
  "nord",
  "catppuccin",
];
const TITLE_LIGHTING_THEME_NAME = "monokai";
const CANONICAL_VARIABLE_NAMES = [
  "accent",
  "info",
  "ink",
  "muted",
  "success",
  "surface",
  "surface.muted",
  "surface.raised",
  "warning",
];
const LUMINANCE_RED_WEIGHT = 0.2126;
const LUMINANCE_GREEN_WEIGHT = 0.7152;
const LUMINANCE_BLUE_WEIGHT = 0.0722;
const MIN_SURFACE_TEXT_CONTRAST = 4.5;
const MIN_ACCENT_TEXT_CONTRAST = 3.0;
const CONTRAST_LUMINANCE_OFFSET = 0.05;
const SRGB_CHANNEL_MAX = 255;
const SRGB_LINEAR_BREAKPOINT = 0.03928;
const SRGB_LINEAR_DIVISOR = 12.92;
const SRGB_LINEAR_OFFSET = 0.055;
const SRGB_LINEAR_SCALE = 1.055;
const SRGB_LINEAR_EXPONENT = 2.4;

async function loadThemesModule() {
  await ensureDistBuilt();

  return {
    themes: await import(pathToFileURL(THEMES_PATH).href),
    style: await import(pathToFileURL(STYLE_PATH).href),
    lighting: await import(pathToFileURL(TITLE_SCENE_LIGHTING_PATH).href),
  };
}

test("built-in jedit themes are data-driven and switchable by name", async () => {
  const { themes } = await loadThemesModule();
  const available = themes.availableJeditThemes();

  assert.ok(available.length >= 2);
  assert.equal(themes.resolveInitialJeditTheme("missing-theme"), available[0]);
  assert.equal(
    themes.resolveInitialJeditTheme(available[1].name),
    available[1],
  );
  assert.equal(themes.nextJeditTheme(available[0]).name, available[1].name);
});

test("built-in jedit themes include editor-inspired palettes", async () => {
  const { themes } = await loadThemesModule();
  const availableNames = themes
    .availableJeditThemes()
    .map((theme) => theme.name);

  assert.deepEqual(availableNames.slice(0, 2), ["graphite", "morning"]);
  for (const themeName of EDITOR_INSPIRED_THEME_NAMES) {
    assert.ok(
      availableNames.includes(themeName),
      `${themeName} should be built in`,
    );
  }
});

test("built-in jedit themes keep unique complete palettes", async () => {
  const { themes, lighting } = await loadThemesModule();
  const available = themes.availableJeditThemes();
  const names = available.map((theme) => theme.name);
  const surfaceKeys = available.map((theme) =>
    theme.surface.workspace.bgRGB.join(","),
  );
  const titleLightingNames = Object.values(
    lighting.TITLE_SCENE_LIGHTING_VARIABLE,
  ).sort();

  assert.equal(new Set(names).size, names.length);
  assert.equal(new Set(surfaceKeys).size, surfaceKeys.length);
  for (const theme of available) {
    assertCompleteBasePalette(theme);
    assert.deepEqual(
      optionalVariableNames(theme),
      expectedOptionalVariables(theme, titleLightingNames),
    );
  }
});

test("jedit generates opposite light and dark companion themes", async () => {
  const { themes, style } = await loadThemesModule();
  const graphite = themes.resolveInitialJeditTheme("graphite");
  const graphiteCompanion = themes.oppositeJeditTheme(graphite);
  const graphiteRoundTrip = themes.oppositeJeditTheme(graphiteCompanion);

  assert.equal(graphite.mode, style.JEDIT_THEME_MODE.Dark);
  assert.equal(graphiteCompanion.mode, style.JEDIT_THEME_MODE.Light);
  assert.equal(
    graphiteCompanion.variantSource,
    style.JEDIT_THEME_VARIANT_SOURCE.Generated,
  );
  assert.equal(graphiteCompanion.companionThemeName, graphite.name);
  assert.ok(
    colorLuminance(graphiteCompanion.surface.workspace.bgRGB) >
      colorLuminance(graphite.surface.workspace.bgRGB),
  );
  assert.equal(graphiteRoundTrip.name, graphite.name);
});

test("authored light and dark variants override generated companions", async () => {
  const { themes, style } = await loadThemesModule();
  const solarizedDark = themes.resolveInitialJeditTheme("solarized-dark");
  const solarizedLight = themes.oppositeJeditTheme(solarizedDark);
  const solarizedRoundTrip = themes.oppositeJeditTheme(solarizedLight);

  assert.equal(solarizedDark.mode, style.JEDIT_THEME_MODE.Dark);
  assert.equal(solarizedLight.name, "solarized-light");
  assert.equal(solarizedLight.mode, style.JEDIT_THEME_MODE.Light);
  assert.equal(
    solarizedLight.variantSource,
    style.JEDIT_THEME_VARIANT_SOURCE.Authored,
  );
  assert.equal(solarizedRoundTrip.name, "solarized-dark");
});

test("jedit surface text clears contrast for built-in and companion themes", async () => {
  const { themes } = await loadThemesModule();

  for (const theme of themesWithGeneratedCompanions(themes)) {
    for (const [surfaceName, token] of Object.entries(theme.surface)) {
      const ratio = colorContrastRatio(token.fgRGB, token.bgRGB);
      assert.ok(
        ratio >= MIN_SURFACE_TEXT_CONTRAST,
        `${theme.name} ${surfaceName} contrast ratio ${ratio.toFixed(2)}`,
      );
    }
  }
});

test("jedit rendered accent text clears contrast for built-in and companion themes", async () => {
  const { themes } = await loadThemesModule();

  for (const theme of themesWithGeneratedCompanions(themes)) {
    assertTokenGroupContrast(theme.name, "source", theme.source, theme.surface.workspace.bgRGB);
    assertTokenGroupContrast(theme.name, "markdown", theme.markdown, theme.surface.workspace.bgRGB);
    assertObjectTokenContrast(theme.name, "chrome", theme.chrome, theme.surface.workspace.bgRGB);
  }
});

test("built-in jedit theme tokens map back to named variables and effect metadata", async () => {
  const { themes, style } = await loadThemesModule();

  for (const theme of themes.availableJeditThemes()) {
    assert.ok(theme.variables.size > 0);
    assert.ok(
      [...theme.source.values()].every(
        (token) => token.foregroundVariables.length > 0,
      ),
    );
    assert.ok(
      [...theme.markdown.values()].every(
        (token) => token.foregroundVariables.length > 0,
      ),
    );
    assert.ok(
      Object.values(theme.surface).every(
        (token) => token.backgroundVariables.length > 0,
      ),
    );
    assert.equal(theme.chrome.activeEdge.char, "░");
    assert.deepEqual(theme.chrome.activeEdge.foregroundVariables, ["accent"]);
    assert.deepEqual(theme.chrome.titleLogo.foregroundVariables, [
      "accent",
      "info",
    ]);
    assert.deepEqual(theme.chrome.titleLogo.backgroundVariables, ["surface"]);
    assert.deepEqual(theme.chrome.titleLogoShadow.foregroundVariables, [
      "muted",
    ]);
    assert.deepEqual(theme.chrome.titleLogoShadow.backgroundVariables, [
      "surface",
    ]);
    assert.deepEqual(theme.chrome.titleSceneNear.foregroundVariables, ["ink"]);
    assert.deepEqual(theme.chrome.titleSceneNear.backgroundVariables, [
      "surface",
    ]);
    assert.deepEqual(theme.chrome.titleSceneFar.foregroundVariables, ["muted"]);
    assert.deepEqual(theme.chrome.titleSceneFar.backgroundVariables, [
      "surface",
    ]);

    const keyword = theme.source.get(style.JEDIT_SOURCE_TOKEN.Keyword);
    assert.equal(
      keyword.foregroundEffect.kind,
      style.JEDIT_COLOR_EFFECT.Transition,
    );
    assert.equal(keyword.foregroundEffect.easing, style.JEDIT_EASING.EaseIn);
    assert.ok(keyword.gradient.stops.length > 0);
    assert.ok(keyword.spring.stiffness > 0);
  }
});

function colorLuminance(color) {
  return (
    color[0] * LUMINANCE_RED_WEIGHT +
    color[1] * LUMINANCE_GREEN_WEIGHT +
    color[2] * LUMINANCE_BLUE_WEIGHT
  );
}

function themesWithGeneratedCompanions(themes) {
  const all = new Map();
  for (const theme of themes.availableJeditThemes()) {
    all.set(theme.name, theme);
    const companion = themes.oppositeJeditTheme(theme);
    all.set(companion.name, companion);
  }
  return all.values();
}

function colorContrastRatio(first, second) {
  const firstLuminance = relativeColorLuminance(first);
  const secondLuminance = relativeColorLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + CONTRAST_LUMINANCE_OFFSET) / (darker + CONTRAST_LUMINANCE_OFFSET);
}

function assertTokenGroupContrast(themeName, groupName, tokens, fallbackBackground) {
  for (const [tokenName, token] of tokens) {
    assertRenderedTokenContrast(
      themeName,
      `${groupName}.${tokenName.description ?? String(tokenName)}`,
      token,
      fallbackBackground,
    );
  }
}

function assertObjectTokenContrast(themeName, groupName, tokens, fallbackBackground) {
  for (const [tokenName, token] of Object.entries(tokens)) {
    assertRenderedTokenContrast(
      themeName,
      `${groupName}.${tokenName}`,
      token,
      fallbackBackground,
    );
  }
}

function assertRenderedTokenContrast(themeName, tokenName, token, fallbackBackground) {
  const ratio = colorContrastRatio(token.fgRGB, token.bgRGB ?? fallbackBackground);
  assert.ok(
    ratio >= MIN_ACCENT_TEXT_CONTRAST,
    `${themeName} ${tokenName} contrast ratio ${ratio.toFixed(2)}`,
  );
}

function relativeColorLuminance(color) {
  return (
    linearChannel(color[0]) * LUMINANCE_RED_WEIGHT +
    linearChannel(color[1]) * LUMINANCE_GREEN_WEIGHT +
    linearChannel(color[2]) * LUMINANCE_BLUE_WEIGHT
  );
}

function linearChannel(channel) {
  const scaled = channel / SRGB_CHANNEL_MAX;
  return scaled <= SRGB_LINEAR_BREAKPOINT
    ? scaled / SRGB_LINEAR_DIVISOR
    : ((scaled + SRGB_LINEAR_OFFSET) / SRGB_LINEAR_SCALE) ** SRGB_LINEAR_EXPONENT;
}

function assertCompleteBasePalette(theme) {
  const variableNames = [...theme.variables.keys()];
  for (const variableName of CANONICAL_VARIABLE_NAMES) {
    assert.ok(
      variableNames.includes(variableName),
      `${theme.name} defines ${variableName}`,
    );
  }
}

function optionalVariableNames(theme) {
  return [...theme.variables.keys()]
    .filter((name) => !CANONICAL_VARIABLE_NAMES.includes(name))
    .sort();
}

function expectedOptionalVariables(theme, titleLightingNames) {
  return theme.name === TITLE_LIGHTING_THEME_NAME ? titleLightingNames : [];
}
