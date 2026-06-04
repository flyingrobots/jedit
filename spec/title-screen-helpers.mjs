import path from "node:path";
import { pathToFileURL } from "node:url";
import { REPO_ROOT, ensureDistBuilt } from "./dist-helpers.mjs";

const DIST_UI_PATH = path.join(REPO_ROOT, "dist", "ui");

const TITLE_SCREEN_PATH = path.join(DIST_UI_PATH, "title-screen.js");
const TITLE_LOGO_PATH = path.join(DIST_UI_PATH, "title-logo.js");
const TITLE_SCENE_PATH = path.join(DIST_UI_PATH, "title-scene.js");
const TITLE_SCENE_ENVIRONMENT_PATH = path.join(
  DIST_UI_PATH,
  "title-scene-environment.js",
);
const TITLE_SCREEN_OPTICS_PATH = path.join(
  DIST_UI_PATH,
  "title-screen-optics.js",
);
const ASCII_CANVAS_PATH = path.join(DIST_UI_PATH, "averaging-ascii-canvas.js");
const BRAILLE_CANVAS_PATH = path.join(
  DIST_UI_PATH,
  "averaging-braille-canvas.js",
);
const THEMES_PATH = path.join(DIST_UI_PATH, "jedit-themes.js");
const STYLE_PATH = path.join(DIST_UI_PATH, "jedit-theme.js");
export const FLYINGROBOTS_LOGO_PATH = path.join(
  REPO_ROOT,
  "src",
  "ui",
  "flyingrobotslogo.txt",
);

const FIXED_TITLE_SEED = 0.417;
const FIXED_TITLE_CAMERA_ANGLE = 0.25;

let titleModulesPromise;

export function fixedTitleRenderOptions(extra = {}) {
  return {
    camAngle: FIXED_TITLE_CAMERA_ANGLE,
    sceneSeed: FIXED_TITLE_SEED,
    ...extra,
  };
}

export function loadTitleModules() {
  titleModulesPromise ??= importTitleModules();
  return titleModulesPromise;
}

export function cells(surface) {
  return Array.from({ length: surface.height }, (_, y) =>
    Array.from({ length: surface.width }, (_, x) => surface.get(x, y)),
  ).flat();
}

export function positionedCells(surface) {
  return Array.from({ length: surface.height }, (_, y) =>
    Array.from({ length: surface.width }, (_, x) => ({
      x,
      y,
      cell: surface.get(x, y),
    })),
  ).flat();
}

export function isBraille(char) {
  const code = char.codePointAt(0) ?? 0;
  return code >= 0x2800 && code <= 0x28ff;
}

async function importTitleModules() {
  await ensureDistBuilt();

  return {
    title: await import(moduleUrl(TITLE_SCREEN_PATH)),
    titleLogo: await import(moduleUrl(TITLE_LOGO_PATH)),
    titleScene: await import(moduleUrl(TITLE_SCENE_PATH)),
    titleSceneEnvironment: await import(
      moduleUrl(TITLE_SCENE_ENVIRONMENT_PATH)
    ),
    titleOptics: await import(moduleUrl(TITLE_SCREEN_OPTICS_PATH)),
    asciiCanvas: await import(moduleUrl(ASCII_CANVAS_PATH)),
    brailleCanvas: await import(moduleUrl(BRAILLE_CANVAS_PATH)),
    themes: await import(moduleUrl(THEMES_PATH)),
    style: await import(moduleUrl(STYLE_PATH)),
  };
}

function moduleUrl(filePath) {
  return pathToFileURL(filePath).href;
}
