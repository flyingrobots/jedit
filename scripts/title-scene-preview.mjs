#!/usr/bin/env node

import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { createTitleSceneLoaderPort } from "../dist/adapters/title-scene-loader.js";
import { loadStartupTitleMeshes } from "../dist/adapters/workspace-title-meshes.js";
import {
  TITLE_SCENE_PREVIEW_INPUT,
  TITLE_SCENE_PREVIEW_RENDER_MODE,
  createTitleScenePreviewModel,
  titleScenePreviewInspector,
  titleScenePreviewRenderOptions,
  titleScenePreviewSceneName,
  titleScenePreviewThemeName,
  updateTitleScenePreviewModel,
} from "../dist/app/title-scene-preview-session.js";
import { BUILT_IN_TITLE_SCENE_NAMES } from "../dist/ports/title-scene-loader.js";
import { availableJeditThemes } from "../dist/ui/jedit-themes.js";
import { renderTitleScreen } from "../dist/ui/title-screen.js";

const DEFAULT_WIDTH = 96;
const DEFAULT_HEIGHT = 28;
const EXIT_USAGE = 2;
const JSON_INDENT = 2;
const KEY_INPUTS = new Map([
  ["time+", TITLE_SCENE_PREVIEW_INPUT.TimeForward],
  ["time-", TITLE_SCENE_PREVIEW_INPUT.TimeBack],
  ["angle-", TITLE_SCENE_PREVIEW_INPUT.CameraAngleLeft],
  ["angle+", TITLE_SCENE_PREVIEW_INPUT.CameraAngleRight],
  ["radius-", TITLE_SCENE_PREVIEW_INPUT.CameraRadiusIn],
  ["radius+", TITLE_SCENE_PREVIEW_INPUT.CameraRadiusOut],
  ["theme+", TITLE_SCENE_PREVIEW_INPUT.ThemeNext],
  ["theme-", TITLE_SCENE_PREVIEW_INPUT.ThemePrevious],
  ["render+", TITLE_SCENE_PREVIEW_INPUT.RenderModeNext],
  ["render-", TITLE_SCENE_PREVIEW_INPUT.RenderModePrevious],
  ["scene+", TITLE_SCENE_PREVIEW_INPUT.SceneNext],
  ["scene-", TITLE_SCENE_PREVIEW_INPUT.ScenePrevious],
  ["object+", TITLE_SCENE_PREVIEW_INPUT.ObjectNext],
  ["object-", TITLE_SCENE_PREVIEW_INPUT.ObjectPrevious],
]);

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const meshes = loadStartupTitleMeshes();
  const loader = createTitleSceneLoaderPort();
  const sceneNames = previewSceneNames(options.sceneName);
  const themes = availableJeditThemes();
  let model = createTitleScenePreviewModel({
    sceneNames,
    sceneObjectCounts: placeholderObjectCounts(sceneNames),
    themeNames: themes.map((theme) => theme.name),
    initialSceneIndex: initialIndex(sceneNames, options.sceneName),
    initialThemeIndex: initialIndex(
      themes.map((theme) => theme.name),
      options.themeName,
    ),
    initialRenderModeIndex: initialRenderModeIndex(options.renderMode),
    initialTimeSeconds: options.timeSeconds,
    initialCameraAngle: options.cameraAngle,
    initialCameraRadius: options.cameraRadius,
  });

  for (const key of options.keys) {
    if (!isObjectKey(key)) {
      model = updateTitleScenePreviewModel(model, inputForKey(key));
    }
  }

  const scene = await loadPreviewScene(
    titleScenePreviewSceneName(model),
    loader,
    meshes,
    options.sceneName,
  );
  model = withLoadedSceneObjectCount(model, scene.objects.length);
  for (const key of options.keys) {
    if (isObjectKey(key)) {
      model = updateTitleScenePreviewModel(model, inputForKey(key));
    }
  }

  printPreview({ model, scene, themes, options });
}

function parseArgs(args) {
  const options = defaultOptions();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--no-frame") {
      options.frame = false;
    } else if (arg === "--key") {
      options.keys.push(requiredValue(args, (index += 1), arg));
    } else if (arg === "--scene") {
      options.sceneName = requiredValue(args, (index += 1), arg);
    } else if (arg === "--theme") {
      options.themeName = requiredValue(args, (index += 1), arg);
    } else if (arg === "--render-mode") {
      options.renderMode = requiredValue(args, (index += 1), arg);
    } else if (arg === "--width") {
      options.width = positiveInteger(
        requiredValue(args, (index += 1), arg),
        arg,
      );
    } else if (arg === "--height") {
      options.height = positiveInteger(
        requiredValue(args, (index += 1), arg),
        arg,
      );
    } else if (arg === "--time") {
      options.timeSeconds = finiteNumber(
        requiredValue(args, (index += 1), arg),
        arg,
      );
    } else if (arg === "--camera-angle") {
      options.cameraAngle = finiteNumber(
        requiredValue(args, (index += 1), arg),
        arg,
      );
    } else if (arg === "--camera-radius") {
      options.cameraRadius = finiteNumber(
        requiredValue(args, (index += 1), arg),
        arg,
      );
    } else {
      usage(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function defaultOptions() {
  return {
    json: false,
    frame: true,
    keys: [],
    sceneName: undefined,
    themeName: undefined,
    renderMode: undefined,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    timeSeconds: undefined,
    cameraAngle: undefined,
    cameraRadius: undefined,
  };
}

function previewSceneNames(sceneName) {
  if (sceneName == null || BUILT_IN_TITLE_SCENE_NAMES.includes(sceneName)) {
    return [...BUILT_IN_TITLE_SCENE_NAMES];
  }

  return [basename(sceneName)];
}

async function loadPreviewScene(sceneName, loader, meshes, requestedSceneName) {
  if (BUILT_IN_TITLE_SCENE_NAMES.includes(sceneName)) {
    return loader.loadBuiltInTitleScene(sceneName, meshes);
  }
  return loader.loadTitleSceneFromFile(requestedSceneName ?? sceneName, meshes);
}

function printPreview(context) {
  const sceneName = titleScenePreviewSceneName(context.model);
  const themeName = titleScenePreviewThemeName(context.model);
  const theme = themeByName(context.themes, themeName);
  const inspector = titleScenePreviewInspector(context.model, {
    scene: context.scene,
    sceneName,
    themeName,
  });
  const frame = context.options.frame
    ? renderFrame(context.model, context.scene, theme, context.options)
    : undefined;

  if (context.options.json) {
    process.stdout.write(
      `${JSON.stringify(previewReport(context, inspector, frame), null, JSON_INDENT)}\n`,
    );
    return;
  }

  if (frame != null) {
    process.stdout.write(`${frame.join("\n")}\n\n`);
  }
  process.stdout.write(`${plainInspector(inspector).join("\n")}\n`);
}

function previewReport(context, inspector, frame) {
  return {
    preview: {
      sceneName: inspector.sceneName,
      themeName: inspector.themeName,
      renderMode: inspector.renderMode,
      timeSeconds: inspector.timeSeconds,
      cameraAngle: inspector.camera.angle,
      cameraRadius: inspector.camera.radius,
      selectedObjectIndex: context.model.selectedObjectIndex,
      width: context.options.width,
      height: context.options.height,
    },
    inspector,
    ...(frame == null ? {} : { frame }),
  };
}

function renderFrame(model, scene, theme, options) {
  const surface = renderTitleScreen(
    options.width,
    options.height,
    model.timeSeconds,
    theme,
    {
      ...titleScenePreviewRenderOptions(model),
      sceneOverride: scene,
    },
  );
  return surfaceRows(surface);
}

function surfaceRows(surface) {
  return Array.from({ length: surface.height }, (_, row) =>
    Array.from(
      { length: surface.width },
      (_, col) => surface.get(col, row).char,
    ).join(""),
  );
}

function plainInspector(inspector) {
  return [
    "jedit title preview",
    `scene ${inspector.sceneName}  theme ${inspector.themeName}  render ${inspector.renderMode}`,
    `time ${formatNumber(inspector.timeSeconds)}s  camera angle ${formatNumber(inspector.camera.angle)}  radius ${formatNumber(inspector.camera.radius)}`,
    objectInspectorLine(inspector),
  ];
}

function objectInspectorLine(inspector) {
  if (inspector.selectedObject == null) {
    return "object none";
  }
  const object = inspector.selectedObject;
  return `object ${object.index + 1}/${object.count} ${object.kind}  radius ${formatNumber(object.radius)}  reflectivity ${formatNumber(object.reflectivity)}  color ${object.color.join(",")}`;
}

function themeByName(themes, themeName) {
  const match = themes.find((theme) => theme.name === themeName);
  if (match == null) {
    throw new RangeError(`Theme is unavailable: ${themeName}`);
  }
  return match;
}

function inputForKey(key) {
  const input = KEY_INPUTS.get(key);
  if (input == null) {
    usage(`Unknown preview key: ${key}`);
  }
  return input;
}

function isObjectKey(key) {
  return key === "object+" || key === "object-";
}

function placeholderObjectCounts(sceneNames) {
  return sceneNames.map(() => 1);
}

function withLoadedSceneObjectCount(model, objectCount) {
  return createTitleScenePreviewModel({
    sceneNames: model.sceneNames,
    sceneObjectCounts: model.sceneObjectCounts.map((count, index) =>
      index === model.sceneIndex ? objectCount : count,
    ),
    themeNames: model.themeNames,
    renderModes: model.renderModes,
    initialSceneIndex: model.sceneIndex,
    initialThemeIndex: model.themeIndex,
    initialRenderModeIndex: model.renderModeIndex,
    initialSelectedObjectIndex: model.selectedObjectIndex,
    initialTimeSeconds: model.timeSeconds,
    initialCameraAngle: model.cameraAngle,
    initialCameraRadius: model.cameraRadius,
  });
}

function initialIndex(names, requestedName) {
  const index = requestedName == null ? 0 : names.indexOf(requestedName);
  return index < 0 ? 0 : index;
}

function initialRenderModeIndex(renderMode) {
  if (renderMode === TITLE_SCENE_PREVIEW_RENDER_MODE.Ascii) {
    return 1;
  }
  return 0;
}

function requiredValue(args, index, flag) {
  const value = args[index];
  if (value == null) {
    usage(`${flag} requires a value.`);
  }
  return value;
}

function positiveInteger(value, flag) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    usage(`${flag} requires a positive integer.`);
  }
  return number;
}

function finiteNumber(value, flag) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    usage(`${flag} requires a finite number.`);
  }
  return number;
}

function formatNumber(value) {
  return value.toFixed(2);
}

function usage(message) {
  process.stderr.write(`${message}\n`);
  process.stderr.write(
    `Usage: node ${pathToFileURL(process.argv[1]).pathname} [--json] [--scene name-or-path] [--key time+]\n`,
  );
  process.exit(EXIT_USAGE);
}
