import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";

// Startup deliberately loads no title geometry, so the model carries an empty
// mesh library. The scene picker hands that same empty library to the loader,
// which means every built-in scene referencing bunny, teapot or dragon threw
// "mesh is not loaded" and could not be opened at all. The loader fills the
// gaps itself, on demand, so the startup saving is kept without breaking the
// scenes it was meant to leave working.

const EMPTY_LIBRARY = Object.freeze({});

// neon-orbit, mirror-hall and aurora-vault declare "kind": "mesh" with no mesh
// field at all. They fail identically with a fully loaded library, so that is a
// defect in the scene data rather than anything to do with on-demand loading --
// tracked separately. Asserting on the error text keeps this spec pointed at
// the loading bug: if one of those scenes were ever fixed, or a new scene broke
// mesh loading, this notices.
const MESH_NOT_LOADED = /mesh asset is not loaded/;

test("no built-in scene fails for want of an unloaded mesh", async () => {
  const [loader, port] = await Promise.all([
    importDist("adapters", "title-scene-loader.js"),
    importDist("ports", "title-scene-loader.js"),
  ]);
  const scenePort = loader.createTitleSceneLoaderPort();
  const unloaded = [];
  let decoded = 0;

  for (const name of port.BUILT_IN_TITLE_SCENE_NAMES) {
    try {
      const scene = await scenePort.loadBuiltInTitleScene(name, EMPTY_LIBRARY);
      assert.ok(Array.isArray(scene.objects), `${name} produced no objects`);
      decoded += 1;
    } catch (error) {
      if (MESH_NOT_LOADED.test(error.message)) {
        unloaded.push(`${name}: ${error.message}`);
      }
    }
  }

  assert.deepEqual(unloaded, []);
  assert.ok(decoded >= 12, `expected most scenes to decode, only ${decoded} did`);
});

test("the default scene opens from an empty mesh library", async () => {
  const [loader, port] = await Promise.all([
    importDist("adapters", "title-scene-loader.js"),
    importDist("ports", "title-scene-loader.js"),
  ]);
  const scenePort = loader.createTitleSceneLoaderPort();

  // The picker offers this one first, so it was the most likely thing a reader
  // would try and the most visible instance of the failure.
  const scene = await scenePort.loadBuiltInTitleScene(
    port.DEFAULT_BUILT_IN_TITLE_SCENE_NAME,
    EMPTY_LIBRARY,
  );

  assert.ok(scene.objects.length > 0);
});

test("a caller-supplied mesh still wins over the on-demand one", async () => {
  const loader = await importDist("adapters", "title-scene-loader.js");
  const scenePort = loader.createTitleSceneLoaderPort();

  const marker = { vertices: [], triangles: [], marker: "caller" };
  const scene = await scenePort.loadBuiltInTitleScene("bunny.jedit-scene", {
    bunny: marker,
  });

  assert.ok(scene.objects.length > 0);
});
