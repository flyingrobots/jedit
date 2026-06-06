#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import { basename } from "node:path";
import { createTitleSceneLoaderPort } from "../dist/adapters/title-scene-loader.js";
import { loadStartupTitleMeshes } from "../dist/adapters/workspace-title-meshes.js";
import {
  TITLE_SCENE_PREVIEW_RENDER_MODE,
  createTitleScenePreviewModel,
  titleScenePreviewRenderOptions,
} from "../dist/app/title-scene-preview-session.js";
import {
  BUILT_IN_TITLE_SCENE_NAMES,
  DEFAULT_BUILT_IN_TITLE_SCENE_NAME,
} from "../dist/ports/title-scene-loader.js";
import { ASCII_SAMPLE_COUNT } from "../dist/ui/averaging-ascii-canvas.js";
import {
  BRAILLE_SAMPLE_COUNT,
  brailleSampleRayPressureRatio,
  createBrailleSampleCache,
  createBrailleSampleFrameStats,
} from "../dist/ui/averaging-braille-canvas.js";
import { availableJeditThemes } from "../dist/ui/jedit-themes.js";
import {
  TITLE_RENDER_MODE,
  renderTitleScreen,
} from "../dist/ui/title-screen.js";

const DEFAULT_SCENE = DEFAULT_BUILT_IN_TITLE_SCENE_NAME;
const DEFAULT_THEME = "graphite";
const DEFAULT_WIDTH = 150;
const DEFAULT_HEIGHT = 43;
const DEFAULT_FRAMES = 24;
const DEFAULT_START_SECONDS = 6.75;
const DEFAULT_STEP_SECONDS = 0.05;
const DEFAULT_CAMERA_STEP_RADIANS = 0.01;
const DEFAULT_WARMUP_FRAMES = 2;
const EXIT_USAGE = 2;
const JSON_INDENT = 2;
const PERCENTILE_HALF = 0.5;
const PERCENTILE_NINETY_FIVE = 0.95;
const BRAILLE_PHASE_COUNTS = Object.freeze([1, 2, 4, 8]);

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await profileTitleScene(options);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, JSON_INDENT)}\n`);
    return;
  }
  process.stdout.write(`${plainReportLines(report).join("\n")}\n`);
}

function parseArgs(args) {
  const options = defaultOptions();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--scene") {
      options.sceneName = requiredValue(args, (index += 1), arg);
    } else if (arg === "--theme") {
      options.themeName = requiredValue(args, (index += 1), arg);
    } else if (arg === "--render-mode") {
      options.renderMode = requiredValue(args, (index += 1), arg);
    } else if (arg === "--width") {
      options.width = positiveInteger(requiredValue(args, (index += 1), arg));
    } else if (arg === "--height") {
      options.height = positiveInteger(requiredValue(args, (index += 1), arg));
    } else if (arg === "--frames") {
      options.frames = positiveInteger(requiredValue(args, (index += 1), arg));
    } else if (arg === "--warmup") {
      options.warmupFrames = nonNegativeInteger(
        requiredValue(args, (index += 1), arg),
      );
    } else if (arg === "--start") {
      options.startSeconds = finiteNumber(
        requiredValue(args, (index += 1), arg),
      );
    } else if (arg === "--step") {
      options.stepSeconds = finiteNumber(
        requiredValue(args, (index += 1), arg),
      );
    } else if (arg === "--camera-angle") {
      options.cameraAngle = finiteNumber(
        requiredValue(args, (index += 1), arg),
      );
    } else if (arg === "--camera-radius") {
      options.cameraRadius = finiteNumber(
        requiredValue(args, (index += 1), arg),
      );
    } else if (arg === "--camera-step") {
      options.cameraStep = finiteNumber(requiredValue(args, (index += 1), arg));
    } else if (arg === "--braille-phase-count") {
      options.braillePhaseCount = braillePhaseCount(
        requiredValue(args, (index += 1), arg),
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
    sceneName: DEFAULT_SCENE,
    themeName: DEFAULT_THEME,
    renderMode: TITLE_RENDER_MODE.Braille,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    frames: DEFAULT_FRAMES,
    warmupFrames: DEFAULT_WARMUP_FRAMES,
    startSeconds: DEFAULT_START_SECONDS,
    stepSeconds: DEFAULT_STEP_SECONDS,
    cameraAngle: undefined,
    cameraRadius: undefined,
    cameraStep: DEFAULT_CAMERA_STEP_RADIANS,
    braillePhaseCount: undefined,
  };
}

async function profileTitleScene(options) {
  const scene = await loadProfileScene(options.sceneName);
  const theme = themeByName(options.themeName);
  const model = createProfilePreviewModel(options, scene);
  const sampling = createProfileBrailleSampling(options);
  warmupTitleScene(options, scene, theme, model, sampling);
  return profileFrames(options, scene, theme, model, sampling);
}

async function loadProfileScene(sceneName) {
  const loader = createTitleSceneLoaderPort();
  const meshes = loadStartupTitleMeshes();
  if (BUILT_IN_TITLE_SCENE_NAMES.includes(sceneName)) {
    return loader.loadBuiltInTitleScene(sceneName, meshes);
  }
  return loader.loadTitleSceneFromFile(sceneName, meshes);
}

function createProfilePreviewModel(options, scene) {
  return createTitleScenePreviewModel({
    sceneNames: [profileSceneReportName(options.sceneName)],
    sceneObjectCounts: [scene.objects.length],
    themeNames: [options.themeName],
    initialSceneIndex: 0,
    initialThemeIndex: 0,
    initialRenderModeIndex: renderModeIndex(options.renderMode),
    initialTimeSeconds: options.startSeconds,
    initialCameraAngle: options.cameraAngle ?? scene.camera.angle,
    initialCameraRadius: options.cameraRadius ?? scene.camera.radius,
  });
}

function warmupTitleScene(options, scene, theme, model, sampling) {
  for (let index = 0; index < options.warmupFrames; index += 1) {
    renderProfileFrame(options, scene, theme, model, sampling, index);
  }
}

function profileFrames(options, scene, theme, model, sampling) {
  const timings = [];
  const sampleStats = createProfileSampleStats();
  let checksum = 0;
  for (let index = 0; index < options.frames; index += 1) {
    const started = performance.now();
    const frame = renderProfileFrame(
      options,
      scene,
      theme,
      model,
      sampling,
      index,
    );
    const elapsed = performance.now() - started;
    timings.push(elapsed);
    checksum += profileFrameChecksum(frame.surface, index);
    recordProfileSampleStats(sampleStats, frame.sampleStats);
  }
  return profileReport(options, scene, timings, checksum, sampleStats);
}

function renderProfileFrame(options, scene, theme, model, sampling, index) {
  const sampleStats =
    sampling == null ? undefined : createBrailleSampleFrameStats();
  const surface = renderTitleScreen(
    options.width,
    options.height,
    frameTime(options, index),
    theme,
    {
      ...titleScenePreviewRenderOptions(model),
      camAngle: model.cameraAngle + index * options.cameraStep,
      camRadius: model.cameraRadius,
      sceneOverride: scene,
      brailleSampling:
        sampling == null
          ? undefined
          : {
              sampleCache: sampling.cache,
              stats: sampleStats,
              traceBudget: {
                phase: index,
                phaseCount: sampling.phaseCount,
              },
            },
    },
  );
  return { surface, sampleStats };
}

function profileReport(options, scene, timings, checksum, sampleStats) {
  const sortedTimings = [...timings].sort((left, right) => left - right);
  return {
    scene: {
      name: profileSceneReportName(options.sceneName),
      objects: scene.objects.length,
      triangles: sceneTriangleCount(scene),
    },
    render: {
      mode: options.renderMode,
      width: options.width,
      height: options.height,
      frames: options.frames,
      warmupFrames: options.warmupFrames,
      primarySamplesPerFrame: primarySamplesPerFrame(options),
      totalPrimarySamples: primarySamplesPerFrame(options) * options.frames,
    },
    sampling:
      sampleStats.totalSamples <= 0
        ? undefined
        : profileSampleStatsReport(options, sampleStats),
    timing: {
      avgMs: average(sortedTimings),
      minMs: sortedTimings[0],
      p50Ms: percentile(sortedTimings, PERCENTILE_HALF),
      p95Ms: percentile(sortedTimings, PERCENTILE_NINETY_FIVE),
      maxMs: sortedTimings[sortedTimings.length - 1],
    },
    checksum,
  };
}

function createProfileBrailleSampling(options) {
  return options.renderMode === TITLE_RENDER_MODE.Braille &&
    options.braillePhaseCount != null
    ? {
        cache: createBrailleSampleCache(options.width, options.height),
        phaseCount: options.braillePhaseCount,
      }
    : undefined;
}

function createProfileSampleStats() {
  return {
    totalSamples: 0,
    tracedSamples: 0,
    reusedSamples: 0,
    activeSamples: 0,
    coldMissSamples: 0,
    rayCount: 0,
    rayIntersectionCount: 0,
  };
}

function recordProfileSampleStats(total, frameStats) {
  if (frameStats == null) {
    return;
  }
  total.totalSamples += frameStats.totalSamples;
  total.tracedSamples += frameStats.tracedSamples;
  total.reusedSamples += frameStats.reusedSamples;
  total.activeSamples += frameStats.activeSamples;
  total.coldMissSamples += frameStats.coldMissSamples;
  total.rayCount += frameStats.rayCount;
  total.rayIntersectionCount += frameStats.rayIntersectionCount;
}

function profileSampleStatsReport(options, stats) {
  return {
    braillePhaseCount: options.braillePhaseCount,
    tracedSamples: stats.tracedSamples,
    reusedSamples: stats.reusedSamples,
    coldMissSamples: stats.coldMissSamples,
    activeSampleRatio:
      stats.totalSamples <= 0 ? 0 : stats.activeSamples / stats.totalSamples,
    rayCount: stats.rayCount,
    rayIntersectionCount: stats.rayIntersectionCount,
    rayPressureRatio: brailleSampleRayPressureRatio(stats) ?? 0,
    tracedSamplesPerFrame: stats.tracedSamples / options.frames,
    reusedSamplesPerFrame: stats.reusedSamples / options.frames,
  };
}

function sceneTriangleCount(scene) {
  return scene.objects.reduce(
    (total, object) =>
      total + (object.kind === "mesh" ? object.mesh.triangles.length : 0),
    0,
  );
}

function primarySamplesPerFrame(options) {
  return (
    options.width *
    options.height *
    (options.renderMode === TITLE_RENDER_MODE.Ascii
      ? ASCII_SAMPLE_COUNT
      : BRAILLE_SAMPLE_COUNT)
  );
}

function frameTime(options, index) {
  return options.startSeconds + index * options.stepSeconds;
}

function profileFrameChecksum(surface, index) {
  const x = index % surface.width;
  const y = index % surface.height;
  return surface.width + surface.height + surface.get(x, y).char.codePointAt(0);
}

function profileSceneReportName(sceneName) {
  return BUILT_IN_TITLE_SCENE_NAMES.includes(sceneName)
    ? sceneName
    : basename(sceneName);
}

function themeByName(themeName) {
  const theme = availableJeditThemes().find(
    (candidate) => candidate.name === themeName,
  );
  if (theme == null) {
    throw new RangeError(`Theme is unavailable: ${themeName}`);
  }
  return theme;
}

function renderModeIndex(renderMode) {
  const renderModes = Object.values(TITLE_SCENE_PREVIEW_RENDER_MODE);
  const index = renderModes.indexOf(renderMode);
  if (index < 0) {
    throw new RangeError(`Render mode is unavailable: ${renderMode}`);
  }
  return index;
}

function average(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function percentile(values, rank) {
  return values[
    Math.min(values.length - 1, Math.floor((values.length - 1) * rank))
  ];
}

function plainReportLines(report) {
  const lines = [
    "jedit title scene profile",
    `scene ${report.scene.name}  objects ${report.scene.objects}  triangles ${report.scene.triangles}`,
    `render ${report.render.mode}  size ${report.render.width}x${report.render.height}  frames ${report.render.frames}`,
    `samples/frame ${report.render.primarySamplesPerFrame}  total samples ${report.render.totalPrimarySamples}`,
    `avg ${formatMs(report.timing.avgMs)}  p50 ${formatMs(report.timing.p50Ms)}  p95 ${formatMs(report.timing.p95Ms)}  max ${formatMs(report.timing.maxMs)}`,
    `checksum ${report.checksum}`,
  ];
  if (report.sampling != null) {
    lines.splice(
      4,
      0,
      `braille phase ${report.sampling.braillePhaseCount}  traced/frame ${formatSampleCount(report.sampling.tracedSamplesPerFrame)}  reused/frame ${formatSampleCount(report.sampling.reusedSamplesPerFrame)}  pressure ${formatPercent(report.sampling.rayPressureRatio)}  active ${formatPercent(report.sampling.activeSampleRatio)}`,
    );
  }
  return lines;
}

function formatMs(value) {
  return `${value.toFixed(2)} ms`;
}

function formatSampleCount(value) {
  return value.toFixed(0);
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function requiredValue(args, index, option) {
  const value = args[index];
  if (value == null) {
    usage(`Missing value for ${option}`);
  }
  return value;
}

function positiveInteger(rawValue) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    usage(`Expected positive integer, got: ${rawValue}`);
  }
  return value;
}

function nonNegativeInteger(rawValue) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 0) {
    usage(`Expected non-negative integer, got: ${rawValue}`);
  }
  return value;
}

function finiteNumber(rawValue) {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    usage(`Expected finite number, got: ${rawValue}`);
  }
  return value;
}

function braillePhaseCount(rawValue) {
  const value = positiveInteger(rawValue);
  if (!BRAILLE_PHASE_COUNTS.includes(value)) {
    usage(`Expected Braille phase count 1, 2, 4, or 8, got: ${rawValue}`);
  }
  return value;
}

function usage(message) {
  process.stderr.write(`${message}\n`);
  process.stderr.write(
    "Usage: title-scene-profile [--json] [--scene name] [--theme name] [--render-mode braille|ascii] [--width n] [--height n] [--frames n] [--warmup n] [--start seconds] [--step seconds] [--camera-angle radians] [--camera-radius n] [--camera-step radians] [--braille-phase-count 1|2|4|8]\n",
  );
  process.exit(EXIT_USAGE);
}
