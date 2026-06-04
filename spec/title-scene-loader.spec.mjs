import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { REPO_ROOT, ensureDistBuilt } from "./dist-helpers.mjs";

const TITLE_SCENE_LOADER_PATH = path.join(
  REPO_ROOT,
  "dist",
  "adapters",
  "title-scene-loader.js",
);
const TITLE_SCENE_PATH = path.join(REPO_ROOT, "dist", "ui", "title-scene.js");
const TITLE_MESH_LIBRARY_PATH = path.join(
  REPO_ROOT,
  "dist",
  "ui",
  "title-mesh-library.js",
);
const TITLE_BUNNY_MESH_PATH = path.join(
  REPO_ROOT,
  "dist",
  "adapters",
  "title-bunny-mesh.js",
);
let titleSceneLoaderModulesPromise;

async function loadTitleSceneLoaderModules() {
  if (titleSceneLoaderModulesPromise == null) {
    titleSceneLoaderModulesPromise = Promise.resolve().then(async () => {
      await ensureDistBuilt();
      return {
        loader: await import(pathToFileURL(TITLE_SCENE_LOADER_PATH).href),
        titleScene: await import(pathToFileURL(TITLE_SCENE_PATH).href),
        titleMeshLibrary: await import(
          pathToFileURL(TITLE_MESH_LIBRARY_PATH).href
        ),
        titleBunnyMesh: await import(pathToFileURL(TITLE_BUNNY_MESH_PATH).href),
      };
    });
  }
  return titleSceneLoaderModulesPromise;
}

function normalize(vector) {
  const length = Math.sqrt(
    vector.reduce((sum, component) => sum + component * component, 0),
  );
  return vector.map((component) => component / length);
}

test("loaded mesh scenes do not expose scene-authored mesh position as ray-hit state", async () => {
  const { loader, titleScene, titleMeshLibrary, titleBunnyMesh } =
    await loadTitleSceneLoaderModules();
  const mesh = titleMeshLibrary.createTitleBunnyMesh(
    titleBunnyMesh.loadTitleBunnyMeshSource(),
  );
  const scene = loader.parseTitleSceneJson(
    {
      objects: [
        {
          kind: titleScene.TITLE_SCENE_SHAPE_KIND.Mesh,
          mesh: "bunny",
          position: [100, 100, 100],
          radius: mesh.footprintRadius,
          footprintRadius: mesh.footprintRadius,
          height: mesh.height,
          color: [224, 113, 63],
          reflectivity: 0.18,
        },
      ],
    },
    { bunny: mesh },
  );
  const loadedMesh = scene.objects[0];
  const origin = [-1, 1.1, 4.5];
  const ray = normalize([-0.05, -0.04, -1]);
  const hit = titleScene.nearestTitleSceneObjectHit(origin, ray, scene.objects);

  assert.equal(loadedMesh.kind, titleScene.TITLE_SCENE_SHAPE_KIND.Mesh);
  assert.equal(Object.hasOwn(loadedMesh, "position"), false);
  assert.ok(hit != null);
  assert.equal(hit.object, loadedMesh);
});

test("scene loader decodes bounded optical material fields", async () => {
  const { loader, titleScene } = await loadTitleSceneLoaderModules();
  const scene = loader.parseTitleSceneJson(
    {
      objects: [
        {
          kind: titleScene.TITLE_SCENE_SHAPE_KIND.Sphere,
          position: [0, 1, 0],
          radius: 1,
          color: [120, 220, 255],
          reflectivity: 0.12,
          transparency: 0.64,
          refractiveIndex: 1.45,
        },
      ],
    },
    {},
  );
  const glass = scene.objects[0];

  assert.equal(glass.transparency, 0.64);
  assert.equal(glass.refractiveIndex, 1.45);
  assert.throws(
    () =>
      loader.parseTitleSceneJson(
        {
          objects: [
            {
              kind: titleScene.TITLE_SCENE_SHAPE_KIND.Sphere,
              position: [0, 1, 0],
              radius: 1,
              color: [120, 220, 255],
              reflectivity: 0.12,
              transparency: 1.64,
            },
          ],
        },
        {},
      ),
    (error) =>
      error?.name === "SceneDecodeError" &&
      String(error.message).includes("transparency"),
  );
});

test("built-in scene loader accepts an injected scene directory without mutating dist scenes", async () => {
  const { loader } = await loadTitleSceneLoaderModules();
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "jedit-source-scenes-"),
  );
  const sceneFile = path.join(directory, "bunny.jedit-scene");
  await fs.writeFile(sceneFile, JSON.stringify({ objects: [] }), "utf8");

  try {
    const port = loader.createTitleSceneLoaderPort({
      builtInSceneDirectories: [directory],
    });
    const scene = await port.loadBuiltInTitleScene("bunny.jedit-scene", {});

    assert.equal(scene.objects.length, 0);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("scene loader rejects malformed scene JSON with a decode error", async () => {
  const { loader } = await loadTitleSceneLoaderModules();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "jedit-scene-"));
  const file = path.join(directory, "broken.jedit-scene");
  await fs.writeFile(file, '{ "objects": [', "utf8");

  await assert.rejects(
    () => loader.loadTitleSceneFromFile(file, {}),
    (error) =>
      error?.name === "SceneDecodeError" &&
      String(error.message).includes("malformed"),
  );
});

test("scene loader rejects unknown mesh ids with a decode error", async () => {
  const { loader, titleScene } = await loadTitleSceneLoaderModules();

  assert.throws(
    () =>
      loader.parseTitleSceneJson(
        {
          objects: [
            {
              kind: titleScene.TITLE_SCENE_SHAPE_KIND.Mesh,
              mesh: "armadillo",
              radius: 1,
              color: [224, 113, 63],
              reflectivity: 0.18,
            },
          ],
        },
        {},
      ),
    (error) =>
      error?.name === "SceneDecodeError" &&
      String(error.message).includes("scene.objects[0].mesh"),
  );
});

test("scene loader rejects known mesh ids when the mesh asset is unavailable", async () => {
  const { loader, titleScene } = await loadTitleSceneLoaderModules();

  assert.throws(
    () =>
      loader.parseTitleSceneJson(
        {
          objects: [
            {
              kind: titleScene.TITLE_SCENE_SHAPE_KIND.Mesh,
              mesh: "teapot",
              radius: 1,
              color: [224, 113, 63],
              reflectivity: 0.18,
            },
          ],
        },
        {},
      ),
    (error) =>
      error?.name === "SceneLoadError" &&
      String(error.message).includes("not loaded"),
  );
});
