import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();

async function loadWorkspaceKeyBindingsModule() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(build.status, 0, build.stderr || build.stdout);

  return import(pathToFileURL(path.join(REPO_ROOT, 'dist', 'app', 'workspace', 'key-bindings.js')).href);
}

async function loadWorkspaceRuntimeModule() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(build.status, 0, build.stderr || build.stdout);

  return import(pathToFileURL(path.join(REPO_ROOT, 'dist', 'app', 'workspace', 'runtime.js')).href);
}

async function loadWorkspaceInitModule() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(build.status, 0, build.stderr || build.stdout);

  return import(pathToFileURL(path.join(REPO_ROOT, 'dist', 'app', 'workspace', 'init.js')).href);
}

async function loadWorkspaceAppModules() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(build.status, 0, build.stderr || build.stdout);

  const [workspaceApp, themes] = await Promise.all([
    import(pathToFileURL(path.join(REPO_ROOT, 'dist', 'adapters', 'workspace-app.js')).href),
    import(pathToFileURL(path.join(REPO_ROOT, 'dist', 'ui', 'jedit-themes.js')).href),
  ]);
  return { workspaceApp, themes };
}

function mockDeps() {
  return {
    fileSystem: {
      loadEntries: () => [],
      describeDirectoryIssue: () => ({ title: 'test', message: 'not implemented' }),
      dirname: () => '',
      join: (...parts) => parts.join(path.sep),
    },
    editorFile: {
      loadEditorFile: () => ({ lines: [], readOnly: false }),
      saveEditorFile: () => undefined,
    },
    sourceHighlighter: {
      highlight: async () => ({ path: '', partial: false, spans: [] }),
    },
    graftSession: {
      loadGraftInfo: async () => ({
        path: '/repo/main.md',
        relativePath: 'main.md',
        dirty: false,
        outlineItems: [],
        changeLines: [],
      }),
      failedGraftInfo: () => ({
        path: '/repo/main.md',
        relativePath: 'main.md',
        dirty: false,
        outlineItems: [],
        changeLines: [],
      }),
      closeConnection: async () => undefined,
    },
    titleSceneLoader: {
      loadTitleSceneFromFile: async () => undefined,
      loadBuiltInTitleScene: async () => undefined,
    },
  };
}

function mockI18n() {
  return {
    locale: 'en',
    direction: 'ltr',
    t: () => '',
    setLocale: () => undefined,
  };
}

function mockRuntime() {
  return {
    initialColumns: 120,
    initialRows: 24,
    initialWorkingDirectory: '/repo',
    ...mockDeps(),
    profiler: {
      nowMs: () => 0,
      beginTrace: async () => ({ filePath: '/tmp/profile.json', append: async () => undefined, close: async () => undefined }),
      appendTraceFrame: async () => undefined,
      endTrace: async () => undefined,
    },
    createTimeTickCmd: () => () => undefined,
    createDrawerAnimationCmd: () => [],
    initialModel: {
      titleSceneSeed: 0.5,
      jeditTheme: {
        perf: {
          foreground: 'white',
          background: 'black',
        },
      },
      i18n: mockI18n(),
      entries: [],
      nowMs: 0,
    },
    nowMs: () => 0,
  };
}

function mockJeditTheme() {
  return {
    surface: {
      workspace: {
        fg: '#f0f6fc',
        bg: '#0d1117',
      },
    },
    cursor: {
      normal: {
        bg: '#58a6ff',
      },
    },
  };
}

function mockTitleScreenModel(overrides) {
  return {
    editor: undefined,
    columns: 120,
    rows: 24,
    notice: null,
    jeditTheme: mockJeditTheme(),
    titleRenderMode: 'braille',
    titleAsciiPalette: 'dense',
    ...overrides,
  };
}

function notice(title, message) {
  return `${title}: ${message}`;
}

test('backtick key dispatches a toggle-perf workspace message', async () => {
  const keyBindings = await loadWorkspaceKeyBindingsModule();
  const [nextModel, commands] = keyBindings.updateFromKey(
    { key: '`' },
    { perfVisible: false },
    () => 0,
    () => [],
    mockDeps(),
  );

  assert.equal(nextModel.perfVisible, false);
  assert.equal(commands.length, 1);

  const message = await commands[0]();
  assert.deepEqual(message, { type: 'toggle-perf' });
});

test('runtime toggle-perf message flips perf visibility state', async () => {
  const runtimeModule = await loadWorkspaceRuntimeModule();
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime());

  const [toggledOn] = runtime.update({ type: 'toggle-perf' }, { perfVisible: false });
  const [toggledOff] = runtime.update({ type: 'toggle-perf' }, toggledOn);

  assert.equal(toggledOn.perfVisible, true);
  assert.equal(toggledOff.perfVisible, false);
});

test('runtime load-scene-result applies the loaded scene camera to title camera state', async () => {
  const runtimeModule = await loadWorkspaceRuntimeModule();
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

test('title screen number keys switch render modes without an editor', async () => {
  const keyBindings = await loadWorkspaceKeyBindingsModule();
  const [asciiModel] = keyBindings.updateFromKey(
    { key: '2' },
    mockTitleScreenModel({ titleRenderMode: 'braille' }),
    () => 0,
    () => [],
    mockDeps(),
  );
  const [brailleModel] = keyBindings.updateFromKey(
    { key: '1' },
    mockTitleScreenModel({ titleRenderMode: 'ascii' }),
    () => 0,
    () => [],
    mockDeps(),
  );

  assert.equal(asciiModel.titleRenderMode, 'ascii');
  assert.equal(brailleModel.titleRenderMode, 'braille');
  assert.equal(asciiModel.notice, notice('Title shader', 'ASCII · Dense'));
  assert.equal(brailleModel.notice, notice('Title shader', 'Braille'));
});

test('period cycles title screen ASCII palettes only when ASCII mode is active without an editor', async () => {
  const keyBindings = await loadWorkspaceKeyBindingsModule();
  const [ignoredModel, ignoredCommands] = keyBindings.updateFromKey(
    { key: '.' },
    mockTitleScreenModel({ titleRenderMode: 'braille', titleAsciiPalette: 'dense' }),
    () => 0,
    () => [],
    mockDeps(),
  );
  const [firstModel] = keyBindings.updateFromKey(
    { key: '.' },
    mockTitleScreenModel({ titleRenderMode: 'ascii', titleAsciiPalette: 'dense' }),
    () => 0,
    () => [],
    mockDeps(),
  );
  const [secondModel] = keyBindings.updateFromKey(
    { key: '.' },
    firstModel,
    () => 0,
    () => [],
    mockDeps(),
  );

  assert.equal(ignoredModel.titleRenderMode, 'braille');
  assert.equal(ignoredModel.titleAsciiPalette, 'dense');
  assert.equal(ignoredModel.notice, null);
  assert.equal(ignoredCommands.length, 0);
  assert.equal(firstModel.titleRenderMode, 'ascii');
  assert.equal(firstModel.titleAsciiPalette, 'minimal');
  assert.equal(secondModel.titleAsciiPalette, 'technical');
  assert.equal(firstModel.notice, notice('ASCII palette', 'Minimal'));
  assert.equal(secondModel.notice, notice('ASCII palette', 'Technical'));
});

test('workspace app renders perf overlay after toggle when perf starts disabled', async () => {
  const { workspaceApp, themes } = await loadWorkspaceAppModules();
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
  const initModule = await loadWorkspaceInitModule();
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

test('ctrl-l opens the title scene picker when no editor is active', async () => {
  const keyBindings = await loadWorkspaceKeyBindingsModule();
  const [nextModel] = keyBindings.updateFromKey(
    { type: 'key', key: 'l', ctrl: true, alt: false, shift: false },
    mockTitleScreenModel({ scenePickerOpen: false }),
    () => 0,
    () => [],
    mockDeps(),
  );

  assert.equal(nextModel.scenePickerOpen, true);
});

test('scene picker loads built-in scenes by name without using workspace root paths', async () => {
  const keyBindings = await loadWorkspaceKeyBindingsModule();
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
    mockTitleScreenModel({
      workspaceRoot: '/tmp/not-jedit-rays',
      scenePickerOpen: true,
      scenePickerFocusIndex: 0,
      availableScenes: ['bunny.jedit-scene'],
      titleMeshes: {},
    }),
    () => 0,
    () => [],
    deps,
  );
  const message = await commands[0]();

  assert.deepEqual(requestedScenes, ['bunny.jedit-scene']);
  assert.deepEqual(message, { type: 'load-scene-result', scene });
});

function surfaceText(surface) {
  const lines = [];
  for (let row = 0; row < surface.height; row += 1) {
    let line = '';
    for (let col = 0; col < surface.width; col += 1) {
      line += surface.get(col, row).char;
    }
    lines.push(line);
  }
  return lines.join('\n');
}
