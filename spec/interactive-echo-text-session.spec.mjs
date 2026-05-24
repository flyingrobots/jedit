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
  const binding = modules.session.createInteractiveTextSession({
    mode: modules.mode.INTERACTIVE_TEXT_RUNTIME_ECHO,
  });

  const text = await runNarrowEditRead(binding.session, 'echo');

  assert.equal(binding.mode, modules.mode.INTERACTIVE_TEXT_RUNTIME_ECHO);
  assert.equal(text, 'echo');
});

test('interactive local fallback remains available without lifecycle authority', async () => {
  const modules = await loadModules();
  const binding = modules.session.createInteractiveTextSession({
    mode: modules.mode.INTERACTIVE_TEXT_RUNTIME_LOCAL,
  });

  const text = await runNarrowEditRead(binding.session, 'local');

  assert.equal(binding.mode, modules.mode.INTERACTIVE_TEXT_RUNTIME_LOCAL);
  assert.equal(text, 'local');
});

test('interactive text session accepts injected session factories', async () => {
  const modules = await loadModules();
  const calls = [];
  const localSession = fakeTextBufferSession('local-injected');
  const echoSession = fakeTextBufferSession('echo-injected');

  const local = modules.session.createInteractiveTextSession({
    mode: modules.mode.INTERACTIVE_TEXT_RUNTIME_LOCAL,
    localSessionFactory: {
      create() {
        calls.push('local');
        return localSession;
      },
    },
  });
  const echo = modules.session.createInteractiveTextSession({
    mode: modules.mode.INTERACTIVE_TEXT_RUNTIME_ECHO,
    echoSessionFactory: {
      create() {
        calls.push('echo');
        return echoSession;
      },
    },
  });

  assert.equal(local.session, localSession);
  assert.equal(echo.session, echoSession);
  assert.deepEqual(calls, ['local', 'echo']);
});

test('interactive text session rejects unknown runtime modes', async () => {
  const modules = await loadModules();

  assert.throws(
    () => modules.session.createInteractiveTextSession({ mode: 'bad-mode' }),
    modules.session.InteractiveTextSessionError,
  );
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

function fakeTextBufferSession(sessionId) {
  return {
    sessionId,
    async createBuffer() {
      return {};
    },
    async getBufferOptic() {
      return null;
    },
    async listBuffers() {
      return [];
    },
  };
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
