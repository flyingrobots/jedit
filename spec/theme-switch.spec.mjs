import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const THEMES_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'jedit-themes.js');
const STYLE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'jedit-theme.js');
const EDITOR_INSPIRED_THEME_NAMES = [
  'monokai',
  'solarized-dark',
  'solarized-light',
  'dracula',
  'nord',
  'catppuccin',
];
const CANONICAL_VARIABLE_NAMES = [
  'accent',
  'info',
  'ink',
  'muted',
  'success',
  'surface',
  'surface.muted',
  'surface.raised',
  'warning',
];
const LUMINANCE_RED_WEIGHT = 0.2126;
const LUMINANCE_GREEN_WEIGHT = 0.7152;
const LUMINANCE_BLUE_WEIGHT = 0.0722;

async function loadThemesModule() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  return {
    themes: await import(pathToFileURL(THEMES_PATH).href),
    style: await import(pathToFileURL(STYLE_PATH).href),
  };
}

test('built-in jedit themes are data-driven and switchable by name', async () => {
  const { themes } = await loadThemesModule();
  const available = themes.availableJeditThemes();

  assert.ok(available.length >= 2);
  assert.equal(themes.resolveInitialJeditTheme('missing-theme'), available[0]);
  assert.equal(themes.resolveInitialJeditTheme(available[1].name), available[1]);
  assert.equal(themes.nextJeditTheme(available[0]).name, available[1].name);
});

test('built-in jedit themes include editor-inspired palettes', async () => {
  const { themes } = await loadThemesModule();
  const availableNames = themes.availableJeditThemes().map((theme) => theme.name);

  assert.deepEqual(availableNames.slice(0, 2), ['graphite', 'morning']);
  for (const themeName of EDITOR_INSPIRED_THEME_NAMES) {
    assert.ok(availableNames.includes(themeName), `${themeName} should be built in`);
  }
});

test('built-in jedit themes keep unique complete palettes', async () => {
  const { themes } = await loadThemesModule();
  const available = themes.availableJeditThemes();
  const names = available.map((theme) => theme.name);
  const surfaceKeys = available.map((theme) => theme.surface.workspace.bgRGB.join(','));

  assert.equal(new Set(names).size, names.length);
  assert.equal(new Set(surfaceKeys).size, surfaceKeys.length);
  for (const theme of available) {
    assert.deepEqual([...theme.variables.keys()].sort(), CANONICAL_VARIABLE_NAMES);
  }
});

test('jedit generates opposite light and dark companion themes', async () => {
  const { themes, style } = await loadThemesModule();
  const graphite = themes.resolveInitialJeditTheme('graphite');
  const graphiteCompanion = themes.oppositeJeditTheme(graphite);
  const graphiteRoundTrip = themes.oppositeJeditTheme(graphiteCompanion);

  assert.equal(graphite.mode, style.JEDIT_THEME_MODE.Dark);
  assert.equal(graphiteCompanion.mode, style.JEDIT_THEME_MODE.Light);
  assert.equal(graphiteCompanion.variantSource, style.JEDIT_THEME_VARIANT_SOURCE.Generated);
  assert.equal(graphiteCompanion.companionThemeName, graphite.name);
  assert.ok(colorLuminance(graphiteCompanion.surface.workspace.bgRGB) > colorLuminance(graphite.surface.workspace.bgRGB));
  assert.equal(graphiteRoundTrip.name, graphite.name);
});

test('authored light and dark variants override generated companions', async () => {
  const { themes, style } = await loadThemesModule();
  const solarizedDark = themes.resolveInitialJeditTheme('solarized-dark');
  const solarizedLight = themes.oppositeJeditTheme(solarizedDark);
  const solarizedRoundTrip = themes.oppositeJeditTheme(solarizedLight);

  assert.equal(solarizedDark.mode, style.JEDIT_THEME_MODE.Dark);
  assert.equal(solarizedLight.name, 'solarized-light');
  assert.equal(solarizedLight.mode, style.JEDIT_THEME_MODE.Light);
  assert.equal(solarizedLight.variantSource, style.JEDIT_THEME_VARIANT_SOURCE.Authored);
  assert.equal(solarizedRoundTrip.name, 'solarized-dark');
});

test('built-in jedit theme tokens map back to named variables and effect metadata', async () => {
  const { themes, style } = await loadThemesModule();

  for (const theme of themes.availableJeditThemes()) {
    assert.ok(theme.variables.size > 0);
    assert.ok([...theme.source.values()].every((token) => token.foregroundVariables.length > 0));
    assert.ok([...theme.markdown.values()].every((token) => token.foregroundVariables.length > 0));
    assert.ok(Object.values(theme.surface).every((token) => token.backgroundVariables.length > 0));
    assert.equal(theme.chrome.activeEdge.char, '░');
    assert.deepEqual(theme.chrome.activeEdge.foregroundVariables, ['accent']);
    assert.deepEqual(theme.chrome.titleLogo.foregroundVariables, ['accent', 'info']);
    assert.deepEqual(theme.chrome.titleLogo.backgroundVariables, ['surface']);
    assert.deepEqual(theme.chrome.titleLogoShadow.foregroundVariables, ['muted']);
    assert.deepEqual(theme.chrome.titleLogoShadow.backgroundVariables, ['surface']);
    assert.deepEqual(theme.chrome.titleSceneNear.foregroundVariables, ['ink']);
    assert.deepEqual(theme.chrome.titleSceneNear.backgroundVariables, ['surface']);
    assert.deepEqual(theme.chrome.titleSceneFar.foregroundVariables, ['muted']);
    assert.deepEqual(theme.chrome.titleSceneFar.backgroundVariables, ['surface']);

    const keyword = theme.source.get(style.JEDIT_SOURCE_TOKEN.Keyword);
    assert.equal(keyword.foregroundEffect.kind, style.JEDIT_COLOR_EFFECT.Transition);
    assert.equal(keyword.foregroundEffect.easing, style.JEDIT_EASING.EaseIn);
    assert.ok(keyword.gradient.stops.length > 0);
    assert.ok(keyword.spring.stiffness > 0);
  }
});

function colorLuminance(color) {
  return (color[0] * LUMINANCE_RED_WEIGHT)
    + (color[1] * LUMINANCE_GREEN_WEIGHT)
    + (color[2] * LUMINANCE_BLUE_WEIGHT);
}
