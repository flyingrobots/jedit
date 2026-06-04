#!/usr/bin/env node

import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const ASSETS = [
  {
    source: join("src", "ui", "bunny.obj"),
    destination: join("dist", "ui", "bunny.obj"),
  },
  {
    source: join("src", "ui", "flyingrobotslogo.txt"),
    destination: join("dist", "ui", "flyingrobotslogo.txt"),
  },
  {
    source: join("src", "ui", "utah_teapot.obj"),
    destination: join("dist", "ui", "utah_teapot.obj"),
  },
  {
    source: join("src", "ui", "stanford_dragon_res4.obj"),
    destination: join("dist", "ui", "stanford_dragon_res4.obj"),
  },
];

for (const asset of ASSETS) {
  mkdirSync(dirname(asset.destination), { recursive: true });
  copyFileSync(asset.source, asset.destination);
}

const SCENE_SOURCE_DIR = "scenes";
const SCENE_DESTINATION_DIR = join("dist", "scenes");

mkdirSync(SCENE_DESTINATION_DIR, { recursive: true });
for (const sceneName of readdirSync(SCENE_SOURCE_DIR).filter((entry) =>
  entry.endsWith(".jedit-scene"),
)) {
  copyFileSync(
    join(SCENE_SOURCE_DIR, sceneName),
    join(SCENE_DESTINATION_DIR, sceneName),
  );
}
