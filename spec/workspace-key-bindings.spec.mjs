import assert from 'node:assert/strict';
import test from 'node:test';
import {
  importDist,
  mockDeps,
  mockTitleScreenModel,
  noopNotificationTickCmd,
} from './workspace-helpers.mjs';

test('backtick key dispatches a toggle-perf workspace message', async () => {
  const keyBindings = await importDist('app', 'workspace', 'key-bindings.js');
  const [nextModel, commands] = keyBindings.updateFromKey(
    { key: '`' },
    { perfVisible: false },
    () => 0,
    () => [],
    noopNotificationTickCmd,
    mockDeps(),
  );

  assert.equal(nextModel.perfVisible, false);
  assert.equal(commands.length, 1);

  const message = await commands[0]();
  assert.deepEqual(message, { type: 'toggle-perf' });
});

test('ctrl-l opens the title scene picker when no editor is active', async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist('app', 'workspace', 'key-bindings.js'),
    importDist('ui', 'title-screen.js'),
  ]);
  const [nextModel] = keyBindings.updateFromKey(
    { type: 'key', key: 'l', ctrl: true, alt: false, shift: false },
    mockTitleScreenModel(titleScreen, { scenePickerOpen: false }),
    () => 0,
    () => [],
    noopNotificationTickCmd,
    mockDeps(),
  );

  assert.equal(nextModel.scenePickerOpen, true);
});

test('scene picker loads built-in scenes by name without using workspace root paths', async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist('app', 'workspace', 'key-bindings.js'),
    importDist('ui', 'title-screen.js'),
  ]);
  const scene = { camera: { angle: 0, radius: 8.5 }, objects: [] };
  const requestedScenes = [];
  const deps = {
    ...mockDeps(),
    fileSystem: {
      join: () => {
        throw new Error('workspaceRoot path should not be used for built-in scenes');
      },
    },
    titleSceneLoader: {
      loadTitleSceneFromFile: async () => {
        throw new Error('file scene loader should not be used for built-in scenes');
      },
      loadBuiltInTitleScene: async (name) => {
        requestedScenes.push(name);
        return scene;
      },
    },
  };
  const [, commands] = keyBindings.updateFromKey(
    { type: 'key', key: 'enter', ctrl: false, alt: false, shift: false },
    mockTitleScreenModel(titleScreen, {
      workspaceRoot: '/tmp/not-jedit-rays',
      scenePickerOpen: true,
      scenePickerFocusIndex: 0,
      availableScenes: ['bunny.jedit-scene'],
      titleMeshes: {},
    }),
    () => 0,
    () => [],
    noopNotificationTickCmd,
    deps,
  );
  const message = await commands[0]();

  assert.deepEqual(requestedScenes, ['bunny.jedit-scene']);
  assert.deepEqual(message, { type: 'load-scene-result', scene });
});

test('scene picker load failures preserve structured runtime issue detail', async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist('app', 'workspace', 'key-bindings.js'),
    importDist('ui', 'title-screen.js'),
  ]);
  const failure = new Error('scene missing');
  const deps = {
    ...mockDeps(),
    titleSceneLoader: {
      loadTitleSceneFromFile: async () => undefined,
      loadBuiltInTitleScene: async () => {
        throw failure;
      },
    },
  };
  const [, commands] = keyBindings.updateFromKey(
    { type: 'key', key: 'enter', ctrl: false, alt: false, shift: false },
    mockTitleScreenModel(titleScreen, {
      scenePickerOpen: true,
      scenePickerFocusIndex: 0,
      availableScenes: ['missing.jedit-scene'],
      titleMeshes: {},
    }),
    () => 987,
    () => [],
    noopNotificationTickCmd,
    deps,
  );

  const message = await commands[0]();

  assert.equal(message.type, 'runtime-issue');
  assert.equal(message.issue.message, 'scene missing');
  assert.equal(message.issue.stack, failure.stack);
  assert.equal(message.issue.level, 'error');
  assert.equal(message.issue.source, 'command');
  assert.equal(message.issue.atMs, 987);
});

test('scene picker load failures preserve diagnostics for circular thrown values', async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist('app', 'workspace', 'key-bindings.js'),
    importDist('ui', 'title-screen.js'),
  ]);
  const circular = {};
  circular.self = circular;
  const deps = {
    ...mockDeps(),
    titleSceneLoader: {
      loadTitleSceneFromFile: async () => undefined,
      loadBuiltInTitleScene: async () => {
        throw circular;
      },
    },
  };
  const [, commands] = keyBindings.updateFromKey(
    { type: 'key', key: 'enter', ctrl: false, alt: false, shift: false },
    mockTitleScreenModel(titleScreen, {
      scenePickerOpen: true,
      scenePickerFocusIndex: 0,
      availableScenes: ['circular.jedit-scene'],
      titleMeshes: {},
    }),
    () => 654,
    () => [],
    noopNotificationTickCmd,
    deps,
  );

  const message = await commands[0]();

  assert.equal(message.type, 'runtime-issue');
  assert.equal(message.issue.name, 'SceneLoadError');
  assert.equal(message.issue.atMs, 654);
});

test('scene picker keeps focus index non-negative when no scenes are available', async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist('app', 'workspace', 'key-bindings.js'),
    importDist('ui', 'title-screen.js'),
  ]);
  const [nextModel] = keyBindings.updateFromKey(
    { key: 'down' },
    mockTitleScreenModel(titleScreen, {
      scenePickerOpen: true,
      scenePickerFocusIndex: 0,
      availableScenes: [],
    }),
    () => 0,
    () => [],
    noopNotificationTickCmd,
    mockDeps(),
  );

  assert.equal(nextModel.scenePickerFocusIndex, 0);
});
