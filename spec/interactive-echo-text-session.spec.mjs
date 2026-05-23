import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const SESSION_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'interactive-echo-text-session.js');
const MODE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'interactive-text-runtime-mode.js');

let modulesPromise;

test('interactive Echo text mode drives a narrow edit/read path through Echo-backed session', async () => {
  const modules = await loadModules();
  const lifecycleRequests = [];
  const binding = modules.session.createInteractiveTextSession({
    mode: modules.mode.INTERACTIVE_TEXT_RUNTIME_ECHO,
    lifecycle: lifecycle(lifecycleRequests),
    cycleLimit: 6,
  });

  const text = await runNarrowEditRead(binding.session, 'echo');

  assert.equal(binding.mode, modules.mode.INTERACTIVE_TEXT_RUNTIME_ECHO);
  assert.equal(text, 'echo');
  assert.deepEqual(lifecycleRequests, [6, 6]);
});

test('interactive local fallback remains available without lifecycle authority', async () => {
  const modules = await loadModules();
  const lifecycleRequests = [];
  const binding = modules.session.createInteractiveTextSession({
    mode: modules.mode.INTERACTIVE_TEXT_RUNTIME_LOCAL,
    lifecycle: lifecycle(lifecycleRequests),
    cycleLimit: 6,
  });

  const text = await runNarrowEditRead(binding.session, 'local');

  assert.equal(binding.mode, modules.mode.INTERACTIVE_TEXT_RUNTIME_LOCAL);
  assert.equal(text, 'local');
  assert.deepEqual(lifecycleRequests, []);
});

test('interactive text runtime mode parser defaults to local unless explicitly opted in', async () => {
  const modules = await loadModules();

  assert.equal(
    modules.mode.parseInteractiveTextRuntimeMode(undefined),
    modules.mode.INTERACTIVE_TEXT_RUNTIME_LOCAL,
  );
  assert.equal(
    modules.mode.parseInteractiveTextRuntimeMode('echo'),
    modules.mode.INTERACTIVE_TEXT_RUNTIME_ECHO,
  );
});

test('workspace initial model carries the interactive text runtime mode', async () => {
  const modules = await loadModules();
  const workspace = await import(pathToFileURL(path.join(
    REPO_ROOT,
    'dist',
    'app',
    'workspace',
    'init.js',
  )).href);
  const model = workspace.createInitialModel('/tmp/jedit', 80, 24, {
    entries: [],
    titleSceneSeed: 0.5,
    jeditTheme: {
      name: 'test',
      mode: 'dark',
      colors: {},
    },
    i18n: {},
    nowMs: 0,
    interactiveTextRuntimeMode: modules.mode.INTERACTIVE_TEXT_RUNTIME_ECHO,
  });

  assert.equal(model.interactiveTextRuntimeMode, modules.mode.INTERACTIVE_TEXT_RUNTIME_ECHO);
});

function lifecycle(lifecycleRequests) {
  return {
    requestRunUntilIdle(request) {
      lifecycleRequests.push(request.cycleLimit);
      return {
        accepted: true,
        lastRunCompletion: 'quiesced',
      };
    },
  };
}

async function runNarrowEditRead(session, text) {
  const optic = await session.createBuffer({
    bufferKey: `${text}.md`,
    initialText: '',
    projectionPath: `${text}.md`,
  });
  await optic.applyIntent({
    kind: 'replaceRange',
    startByte: 0,
    endByte: 0,
    insertText: text,
  });
  const observed = await optic.textWindow(optic.currentReadBasis(), {
    cursorLine: 0,
    beforeLines: 0,
    viewportLineCount: 1,
    afterLines: 0,
    maxBytes: 80,
  });
  return observed.value.lines.map((line) => line.text).join('\n');
}

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
    const build = spawnSync('npm', ['run', '--silent', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.equal(build.status, 0, build.stderr || build.stdout);
    const [session, mode] = await Promise.all([
      import(pathToFileURL(SESSION_MODULE_PATH).href),
      import(pathToFileURL(MODE_MODULE_PATH).href),
    ]);
    return { session, mode };
  })();

  return modulesPromise;
}
