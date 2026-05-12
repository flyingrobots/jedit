import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  importDist,
  mockI18n,
  mockJeditTheme,
  mockRuntime,
  REPO_ROOT,
  surfaceText,
} from './workspace-helpers.mjs';

test('runtime toggle-perf message flips perf visibility state', async () => {
  const runtimeModule = await importDist('app', 'workspace', 'runtime.js');
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime());

  const [toggledOn] = runtime.update({ type: 'toggle-perf' }, { perfVisible: false });
  const [toggledOff] = runtime.update({ type: 'toggle-perf' }, toggledOn);

  assert.equal(toggledOn.perfVisible, true);
  assert.equal(toggledOff.perfVisible, false);
});

test('workspace runtime exposes message constants for central dispatch', async () => {
  const runtimeModule = await importDist('app', 'workspace', 'runtime.js');
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime());

  assert.equal(runtimeModule.WorkspaceMessageTypes.TogglePerf, 'toggle-perf');
  assert.equal(runtimeModule.WorkspaceInputMessageTypes.Key, 'key');

  const [nextModel] = runtime.update(
    { type: runtimeModule.WorkspaceMessageTypes.TogglePerf },
    { perfVisible: false },
  );

  assert.equal(nextModel.perfVisible, true);
});

test('runtime load-scene-result applies the loaded scene camera to title camera state', async () => {
  const runtimeModule = await importDist('app', 'workspace', 'runtime.js');
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime());
  const scene = {
    camera: {
      angle: 1.25,
      radius: 6.75,
    },
    objects: [],
  };

  const [nextModel] = runtime.update({ type: 'load-scene-result', scene }, {
    sceneOverride: undefined,
    titleCamera: {
      angle: 9,
      angleTarget: 9,
      angleMotionId: 3,
      radius: 9,
      radiusTarget: 9,
      radiusMotionId: 4,
    },
  });

  assert.equal(nextModel.sceneOverride, scene);
  assert.equal(nextModel.titleCamera.angle, scene.camera.angle);
  assert.equal(nextModel.titleCamera.angleTarget, scene.camera.angle);
  assert.equal(nextModel.titleCamera.radius, scene.camera.radius);
  assert.equal(nextModel.titleCamera.radiusTarget, scene.camera.radius);
});

test('workspace app renders perf overlay after toggle when perf starts disabled', async () => {
  const [workspaceApp, themes] = await Promise.all([
    importDist('adapters', 'workspace-app.js'),
    importDist('ui', 'jedit-themes.js'),
  ]);
  const app = workspaceApp.createWorkspaceApp({
    initialColumns: 120,
    initialRows: 24,
    initialWorkingDirectory: '/repo',
    perfEnabled: false,
    nowMs: () => 0,
    random: () => 0.5,
    seed: {
      titleSceneSeed: 0.5,
      jeditTheme: themes.resolveInitialJeditTheme(undefined),
      i18n: mockI18n(),
      entries: [],
      nowMs: 0,
    },
  });

  const [initialModel] = app.init();
  const [visibleModel] = app.update({ type: 'toggle-perf' }, initialModel);
  const surface = app.view({
    ...visibleModel,
    lastFrameMs: 123456789,
    frameTimeMs: 20,
    frameTimeHistory: [16, 20],
  });
  const text = surfaceText(surface);

  assert.match(text, /jedit perf/);
  assert.match(text, /FPS\s+50/);
  assert.match(text, /frame\s+20\.00 ms/);
  assert.match(text, /heap\s+\d+\.\d MB/);
  assert.match(text, /rss\s+\d+\.\d MB/);
});

test('initial workspace scene picker lists authored scene assets that exist on disk', async () => {
  const initModule = await importDist('app', 'workspace', 'init.js');
  const model = initModule.createInitialModel('/repo', 120, 24, {
    titleSceneSeed: 0.5,
    jeditTheme: mockJeditTheme(),
    i18n: mockI18n(),
    entries: [],
    nowMs: 0,
  });

  assert.deepEqual(model.availableScenes, [
    'teapot-cornell.jedit-scene',
    'teapot-gallery.jedit-scene',
    'bunny.jedit-scene',
    'neon-orbit.jedit-scene',
    'mirror-hall.jedit-scene',
    'eclipse-gate.jedit-scene',
    'prism-garden.jedit-scene',
    'aurora-vault.jedit-scene',
    'ember-court.jedit-scene',
    'sphere.jedit-scene',
    'column.jedit-scene',
    'sphere-ground.jedit-scene',
  ]);
  assert.equal(
    model.availableScenes.every((scene) => existsSync(path.join(REPO_ROOT, 'scenes', scene))),
    true,
  );
});

test('runtime trims frame history to the configured window', async () => {
  const runtimeModule = await importDist('app', 'workspace', 'runtime.js');
  const runtime = runtimeModule.createWorkspaceRuntime({
    ...mockRuntime(),
    nowMs: () => 200,
  });
  const [initialModel] = runtime.init();
  const [nextModel] = runtime.update({ type: 'time-tick', time: 2 }, {
    ...initialModel,
    lastFrameMs: 100,
    frameTimeHistory: Array.from({ length: 55 }, (_, index) => index),
  });

  assert.equal(nextModel.frameTimeHistory.length, 50);
  assert.deepEqual(nextModel.frameTimeHistory.slice(-1), [100]);
});

test('stopping a failed profile trace emits only the close failure issue', async () => {
  const profiler = await importDist('app', 'raytracer-profiler.js');
  const activeHandle = {
    filePath: '/tmp/profile.json',
    append: async () => undefined,
    close: async () => undefined,
  };
  const [, commands] = profiler.toggleProfiler({
    active: true,
    filePath: activeHandle.filePath,
    fileHandle: activeHandle,
  }, '/repo', {
    nowMs: () => 123,
    beginTrace: async () => activeHandle,
    appendTraceFrame: async () => undefined,
    endTrace: async () => {
      throw new Error('close failed');
    },
  });

  assert.equal(commands.length, 1);
  const message = await commands[0]();

  assert.equal(message.type, 'runtime-issue');
  assert.equal(message.issue.level, 'error');
  assert.equal(message.issue.source, 'command');
  assert.equal(message.issue.atMs, 123);
});
