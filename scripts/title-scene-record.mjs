#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { createTitleSceneLoaderPort } from "../dist/adapters/title-scene-loader.js";
import { loadStartupTitleMeshes } from "../dist/adapters/workspace-title-meshes.js";
import {
  TITLE_SCENE_PREVIEW_RENDER_MODE,
  createTitleScenePreviewModel,
  titleScenePreviewRenderMode,
  titleScenePreviewRenderOptions,
  titleScenePreviewSceneName,
  titleScenePreviewThemeName,
} from "../dist/app/title-scene-preview-session.js";
import { BUILT_IN_TITLE_SCENE_NAMES } from "../dist/ports/title-scene-loader.js";
import { availableJeditThemes } from "../dist/ui/jedit-themes.js";
import { renderTitleScreen } from "../dist/ui/title-screen.js";

const DEFAULT_WIDTH = 96;
const DEFAULT_HEIGHT = 28;
const DEFAULT_FRAME_COUNT = 1;
const DEFAULT_START_SECONDS = 0;
const DEFAULT_STEP_SECONDS = 0.5;
const EXIT_USAGE = 2;
const JSON_INDENT = 2;
const RGB_MIN = 0;
const RGB_MAX = 255;
const FRAME_TIME_DECIMALS = 6;
const RECORD_FORMATS = ["json", "text", "html", "ansi"];

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usageText());
    return;
  }

  const context = await recordingContext(options);
  const frames = recordingFrames(context);
  const document = serializeRecording(context, frames);
  await writeRecording(options.outputPath, document);
}

function parseArgs(args) {
  const options = defaultOptions();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--format") {
      options.format = recordFormat(requiredValue(args, (index += 1), arg));
    } else if (arg === "--frames") {
      options.frames = positiveInteger(
        requiredValue(args, (index += 1), arg),
        arg,
      );
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
    } else if (arg === "--start") {
      options.startSeconds = finiteNumber(
        requiredValue(args, (index += 1), arg),
        arg,
      );
    } else if (arg === "--step") {
      options.stepSeconds = finiteNumber(
        requiredValue(args, (index += 1), arg),
        arg,
      );
    } else if (arg === "--scene") {
      options.sceneName = requiredValue(args, (index += 1), arg);
    } else if (arg === "--theme") {
      options.themeName = requiredValue(args, (index += 1), arg);
    } else if (arg === "--render-mode") {
      options.renderMode = requiredValue(args, (index += 1), arg);
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
    } else if (arg === "--output") {
      options.outputPath = requiredValue(args, (index += 1), arg);
    } else {
      usage(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function defaultOptions() {
  return {
    help: false,
    format: "json",
    frames: DEFAULT_FRAME_COUNT,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    startSeconds: DEFAULT_START_SECONDS,
    stepSeconds: DEFAULT_STEP_SECONDS,
    sceneName: undefined,
    themeName: undefined,
    renderMode: undefined,
    cameraAngle: undefined,
    cameraRadius: undefined,
    outputPath: undefined,
  };
}

async function recordingContext(options) {
  const meshes = loadStartupTitleMeshes();
  const loader = createTitleSceneLoaderPort();
  const themes = availableJeditThemes();
  const sceneNames = recordingSceneNames(options.sceneName);
  const themeNames = themes.map((theme) => theme.name);
  const model = createTitleScenePreviewModel({
    sceneNames,
    sceneObjectCounts: placeholderObjectCounts(sceneNames),
    themeNames,
    initialSceneIndex: initialIndex(sceneNames, options.sceneName),
    initialThemeIndex: initialIndex(themeNames, options.themeName),
    initialRenderModeIndex: initialRenderModeIndex(options.renderMode),
    initialTimeSeconds: options.startSeconds,
    initialCameraAngle: options.cameraAngle,
    initialCameraRadius: options.cameraRadius,
  });
  const sceneName = titleScenePreviewSceneName(model);
  const scene = await loadRecordingScene(
    sceneName,
    loader,
    meshes,
    options.sceneName,
  );

  return {
    options,
    model,
    scene,
    sceneName,
    theme: themeByName(themes, titleScenePreviewThemeName(model)),
    themeName: titleScenePreviewThemeName(model),
  };
}

function recordingFrames(context) {
  return Array.from({ length: context.options.frames }, (_, index) => {
    const timeSeconds = frameTime(context.options, index);
    const surface = renderTitleScreen(
      context.options.width,
      context.options.height,
      timeSeconds,
      context.theme,
      {
        ...titleScenePreviewRenderOptions(context.model),
        sceneOverride: context.scene,
      },
    );
    return serializeFrame(surface, index, timeSeconds);
  });
}

function serializeFrame(surface, index, timeSeconds) {
  const rows = Array.from({ length: surface.height }, (_, row) =>
    serializeRow(surface, row),
  );
  return {
    index,
    timeSeconds,
    glyphRows: rows.map((row) => row.glyphs),
    colorRows: rows.map((row) => row.colors),
  };
}

function serializeRow(surface, row) {
  const cells = Array.from({ length: surface.width }, (_, col) =>
    serializeCell(surface.get(col, row)),
  );
  return {
    glyphs: cells.map((cell) => cell.char).join(""),
    colors: cells.map((cell) => ({
      fgRGB: cell.fgRGB,
      bgRGB: cell.bgRGB,
    })),
  };
}

function serializeCell(cell) {
  return {
    char: cell.char,
    fgRGB: normalizeRgb(cell.fgRGB),
    bgRGB: normalizeRgb(cell.bgRGB),
  };
}

function serializeRecording(context, frames) {
  const report = recordingReport(context, frames);
  if (context.options.format === "text") {
    return serializeText(report);
  }
  if (context.options.format === "html") {
    return serializeHtml(report);
  }
  if (context.options.format === "ansi") {
    return serializeAnsi(report);
  }
  return `${JSON.stringify(report, null, JSON_INDENT)}\n`;
}

function recordingReport(context, frames) {
  return {
    recording: {
      format: context.options.format,
      width: context.options.width,
      height: context.options.height,
      frameCount: context.options.frames,
      startSeconds: context.options.startSeconds,
      stepSeconds: context.options.stepSeconds,
      sceneName: context.sceneName,
      themeName: context.themeName,
      renderMode: titleScenePreviewRenderMode(context.model),
      camera: {
        angle: context.model.cameraAngle,
        radius: context.model.cameraRadius,
      },
    },
    frames,
  };
}

function serializeText(report) {
  return `${recordingHeader(report).concat(textFrameLines(report.frames)).join("\n")}\n`;
}

function textFrameLines(frames) {
  return frames.flatMap((frame) => [
    "",
    `frame ${frame.index} time ${formatSeconds(frame.timeSeconds)}s`,
    ...frame.glyphRows,
  ]);
}

function serializeHtml(report) {
  return [
    "<!doctype html>",
    '<meta charset="utf-8">',
    "<title>jedit title scene recording</title>",
    "<style>",
    "body{background:#111;color:#ddd;font:14px ui-monospace,monospace}",
    "pre{line-height:1;margin:0 0 1rem}",
    ".cell{display:inline-block;width:1ch}",
    "</style>",
    "<h1>jedit title scene recording</h1>",
    `<p>${escapeHtml(recordingHeader(report).join(" | "))}</p>`,
    ...htmlFrames(report.frames),
    "",
  ].join("\n");
}

function htmlFrames(frames) {
  return frames.flatMap((frame) => [
    `<h2>frame ${frame.index} time ${formatSeconds(frame.timeSeconds)}s</h2>`,
    "<pre>",
    ...frameHtmlRows(frame),
    "</pre>",
  ]);
}

function frameHtmlRows(frame) {
  return frame.glyphRows.map((row, rowIndex) =>
    Array.from(row)
      .map((char, colIndex) =>
        htmlCell(char, frame.colorRows[rowIndex][colIndex]),
      )
      .join(""),
  );
}

function htmlCell(char, color) {
  return [
    `<span class="cell" style="color:${cssRgb(color.fgRGB)};`,
    `background-color:${cssRgb(color.bgRGB)}">`,
    htmlGlyph(char),
    "</span>",
  ].join("");
}

function serializeAnsi(report) {
  return `${recordingHeader(report).concat(ansiFrameLines(report.frames)).join("\n")}\n`;
}

function ansiFrameLines(frames) {
  return frames.flatMap((frame) => [
    "",
    `frame ${frame.index} time ${formatSeconds(frame.timeSeconds)}s`,
    ...frameAnsiRows(frame),
  ]);
}

function frameAnsiRows(frame) {
  return frame.glyphRows.map((row, rowIndex) =>
    Array.from(row)
      .map((char, colIndex) =>
        ansiCell(char, frame.colorRows[rowIndex][colIndex]),
      )
      .join(""),
  );
}

function ansiCell(char, color) {
  return [
    `\u001b[38;2;${color.fgRGB.join(";")}m`,
    `\u001b[48;2;${color.bgRGB.join(";")}m`,
    char,
    "\u001b[0m",
  ].join("");
}

function recordingHeader(report) {
  const metadata = report.recording;
  return [
    "jedit title scene recording",
    `scene ${metadata.sceneName}  theme ${metadata.themeName}  render ${metadata.renderMode}`,
    `frames ${metadata.frameCount}  size ${metadata.width}x${metadata.height}`,
  ];
}

async function writeRecording(outputPath, document) {
  if (outputPath == null) {
    process.stdout.write(document);
    return;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, document, "utf8");
}

function recordingSceneNames(sceneName) {
  if (sceneName == null || BUILT_IN_TITLE_SCENE_NAMES.includes(sceneName)) {
    return [...BUILT_IN_TITLE_SCENE_NAMES];
  }
  return [basename(sceneName)];
}

async function loadRecordingScene(
  sceneName,
  loader,
  meshes,
  requestedSceneName,
) {
  if (BUILT_IN_TITLE_SCENE_NAMES.includes(sceneName)) {
    return loader.loadBuiltInTitleScene(sceneName, meshes);
  }
  return loader.loadTitleSceneFromFile(requestedSceneName ?? sceneName, meshes);
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

function themeByName(themes, themeName) {
  const match = themes.find((theme) => theme.name === themeName);
  if (match == null) {
    throw new RangeError(`Theme is unavailable: ${themeName}`);
  }
  return match;
}

function placeholderObjectCounts(sceneNames) {
  return sceneNames.map(() => 1);
}

function frameTime(options, index) {
  return Number(
    (options.startSeconds + index * options.stepSeconds).toFixed(
      FRAME_TIME_DECIMALS,
    ),
  );
}

function normalizeRgb(value) {
  if (Array.isArray(value) && value.length === 3) {
    return value.map((channel) =>
      Math.max(RGB_MIN, Math.min(RGB_MAX, Math.round(Number(channel)))),
    );
  }
  return [RGB_MIN, RGB_MIN, RGB_MIN];
}

function cssRgb(value) {
  return `rgb(${value.join(",")})`;
}

function htmlGlyph(char) {
  if (char === " ") {
    return "&nbsp;";
  }
  return escapeHtml(char);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function recordFormat(value) {
  if (RECORD_FORMATS.includes(value)) {
    return value;
  }
  usage(`--format must be one of: ${RECORD_FORMATS.join(", ")}.`);
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

function formatSeconds(value) {
  return value.toFixed(2);
}

function usage(message) {
  process.stderr.write(`${message}\n`);
  process.stderr.write(usageText());
  process.exit(EXIT_USAGE);
}

function usageText() {
  return [
    `Usage: node ${pathToFileURL(process.argv[1]).pathname} [options]`,
    "",
    "Options:",
    "  --format json|text|html|ansi",
    "  --frames count",
    "  --width columns",
    "  --height rows",
    "  --start seconds",
    "  --step seconds",
    "  --scene built-in-or-path",
    "  --theme theme-name",
    "  --render-mode braille|ascii",
    "  --camera-angle radians",
    "  --camera-radius units",
    "  --output path",
    "",
  ].join("\n");
}
