import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";
import { mockKeyBindingContext, mockTitleScreenModel } from "./workspace-helpers.mjs";

// Pressing `m` with no scene loaded used to switch the ray-traced backdrop on
// and toast that a material preset had been applied. Nothing was applied: the
// generated backdrop derives its materials from the theme and never reads
// titleMeshMaterialIndex. It reported a change that could not have happened,
// and switched on an animation loop to do it.

const MATERIAL_KEY = { key: "m", ctrl: false, alt: false, shift: false };

test("the material key does not claim success with no scene loaded", async () => {
  const [keys, titleScreen] = await Promise.all([
    importDist("app", "workspace", "title-screen-key-bindings.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, { sceneOverride: undefined });

  const [next] = keys.updateTitleScreenKey(MATERIAL_KEY, model, mockKeyBindingContext());

  assert.equal(
    next.titleBackdropKind,
    model.titleBackdropKind,
    "the material key must not switch the legacy backdrop on",
  );
  const toast = next.notifications?.items?.at(-1);
  assert.ok(toast != null, "expected the reader to be told why nothing happened");
  assert.match(
    `${toast.title} ${toast.message}`,
    /scene/i,
    `expected a message about loading a scene, got "${toast.message}"`,
  );
});

test("the material key still cycles presets when a scene is loaded", async () => {
  const [keys, titleScreen] = await Promise.all([
    importDist("app", "workspace", "title-screen-key-bindings.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const scene = {
    camera: { position: [0, 0, 1], target: [0, 0, 0], up: [0, 1, 0], fov: 60 },
    objects: [],
    environment: {},
  };
  const model = mockTitleScreenModel(titleScreen, {
    sceneOverride: scene,
    titleMeshMaterialIndex: 0,
  });

  const [next] = keys.updateTitleScreenKey(MATERIAL_KEY, model, mockKeyBindingContext());

  assert.notEqual(
    next.titleMeshMaterialIndex,
    model.titleMeshMaterialIndex,
    "a loaded scene should still cycle the preset",
  );
});
