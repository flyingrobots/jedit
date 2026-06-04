import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";
import { loadTitleModules } from "./title-screen-helpers.mjs";

const THEME_VARIABLE_ACCENT = "accent";
const GRAPHITE_THEME = "graphite";
const MONOKAI_THEME = "monokai";

test("title scene lighting variables preserve accent spotlight fallback", async () => {
  const { title, themes } = await loadTitleModules();
  const lighting = await importLightingTokens();
  const theme = themeByName(themes.availableJeditThemes(), GRAPHITE_THEME);
  const colors = title.titleSceneMaterialColors(theme);

  assert.equal(
    theme.variables.has(lighting.TITLE_SCENE_LIGHTING_VARIABLE.Spotlight),
    false,
  );
  assert.deepEqual(
    colors.spotlight,
    theme.variables.get(THEME_VARIABLE_ACCENT).rgb,
  );
});

test("title scene material colors consume authored theme lighting rig variables", async () => {
  const { title, themes } = await loadTitleModules();
  const lighting = await importLightingTokens();
  const theme = themeByName(themes.availableJeditThemes(), MONOKAI_THEME);
  const colors = title.titleSceneMaterialColors(theme);

  assert.deepEqual(
    colors.spotlight,
    theme.variables.get(lighting.TITLE_SCENE_LIGHTING_VARIABLE.Spotlight).rgb,
  );
  assert.notDeepEqual(
    colors.spotlight,
    theme.variables.get(THEME_VARIABLE_ACCENT).rgb,
  );
  assert.deepEqual(
    colors.floorDark,
    theme.variables.get(lighting.TITLE_SCENE_LIGHTING_VARIABLE.FloorDark).rgb,
  );
  assert.deepEqual(
    colors.floorLight,
    theme.variables.get(lighting.TITLE_SCENE_LIGHTING_VARIABLE.FloorLight).rgb,
  );
  assert.ok(luminance(colors.floorLight) > luminance(colors.floorDark));
});

function themeByName(themes, name) {
  const theme = themes.find((candidate) => candidate.name === name);
  assert.ok(theme, `${name} theme should exist`);
  return theme;
}

function importLightingTokens() {
  return importDist("ui", "title-scene-lighting-tokens.js");
}

function luminance(rgb) {
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
