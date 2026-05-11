import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
    },
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
    createNotificationTickCmd: () => () => undefined,
    createDrawerAnimationCmd: () => [],
    initialModel: {
      titleSceneSeed: 0.5,
      jeditTheme: {
        perf: {
          foreground: 'white',
          background: 'black',
        },
      },
      i18n: {
        locale: 'en',
        direction: 'ltr',
        t: () => '',
        setLocale: () => undefined,
      },
      entries: [],
      nowMs: 0,
    },
    nowMs: () => 0,
  };
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
