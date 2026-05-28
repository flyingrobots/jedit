import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const STATE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-state-port.js');
const RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-runtime.js');
const HOT_RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'in-memory-hot-text-runtime.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');
const BUFFER_KEY = 'notes/state-port.md';
const INITIAL_TEXT = 'hello';

let modulesPromise;

test('jedit contract state port stores and reads contract fact sets', async () => {
  const modules = await loadModules();
  const state = modules.state.createInMemoryJeditContractStatePort();
  const session = createSession(modules);
  const write = modules.state.publishJeditContractSessionFacts(
    state,
    session,
    modules.hash.createHashPort(),
  );
  const read = modules.state.readJeditContractFactSet(state, session.worldline.worldlineId);

  assert.equal(write.status, modules.state.JEDIT_CONTRACT_STATE_WRITE_STORED);
  assert.equal(read.status, modules.state.JEDIT_CONTRACT_STATE_READ_FOUND);
  assert.deepEqual(read.factSet, write.factSet);
});

test('missing jedit contract state is typed', async () => {
  const modules = await loadModules();
  const state = modules.state.createInMemoryJeditContractStatePort();
  const read = modules.state.readJeditContractFactSet(state, 'worldline:missing');

  assert.equal(read.status, modules.state.JEDIT_CONTRACT_STATE_READ_MISSING);
  assert.equal(read.obstruction.code, modules.state.JEDIT_CONTRACT_STATE_MISSING_CODE);
});

function createSession(modules) {
  const runtime = modules.hotRuntime.createInMemoryHotTextRuntime();
  return modules.runtime.createBufferWorldline(runtime, {
    bufferKey: BUFFER_KEY,
    initialText: INITIAL_TEXT,
    projectionPath: BUFFER_KEY,
  }, modules.hash.createHashPort()).nextSession;
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

    const [state, runtime, hotRuntime, hash] = await Promise.all([
      import(pathToFileURL(STATE_MODULE_PATH).href),
      import(pathToFileURL(RUNTIME_MODULE_PATH).href),
      import(pathToFileURL(HOT_RUNTIME_MODULE_PATH).href),
      import(pathToFileURL(HASH_MODULE_PATH).href),
    ]);

    return {
      state,
      runtime,
      hotRuntime,
      hash,
    };
  })();

  return modulesPromise;
}
