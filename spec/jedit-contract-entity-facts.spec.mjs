import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const FACTS_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-entity-facts.js');
const RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-runtime.js');
const HOT_RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'in-memory-hot-text-runtime.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');
const BUFFER_KEY = 'notes/facts.md';
const INITIAL_TEXT = 'hello';
const INSERT_TEXT = ' Echo';

let modulesPromise;

test('jedit session converts to stable contract entity facts', async () => {
  const modules = await loadModules();
  const { session, hash } = createEditedSession(modules);
  const first = modules.facts.jeditContractSessionToFacts(session, hash);
  const second = modules.facts.jeditContractSessionToFacts(session, hash);

  assert.deepEqual(first, second);
  assert.ok(first.facts.some((fact) => fact.kind === modules.facts.JEDIT_CONTRACT_ENTITY_FACT_WORLDLINE));
  assert.ok(first.facts.some((fact) => fact.kind === modules.facts.JEDIT_CONTRACT_ENTITY_FACT_HEAD));
  assert.ok(first.facts.some((fact) => fact.kind === modules.facts.JEDIT_CONTRACT_ENTITY_FACT_ROOT));
  assert.ok(first.facts.some((fact) => fact.kind === modules.facts.JEDIT_CONTRACT_ENTITY_FACT_TICK));
});

test('checkpoint sessions emit checkpoint entity facts', async () => {
  const modules = await loadModules();
  const { runtime, session, hash } = createEditedSession(modules);
  const checkpoint = modules.runtime.createCheckpoint(runtime, session, {
    worldlineId: session.worldline.worldlineId,
    kind: 'MANUAL_SAVE',
    label: 'fact-checkpoint',
  }, hash);
  const factSet = modules.facts.jeditContractSessionToFacts(checkpoint.nextSession, hash);

  assert.ok(factSet.facts.some((fact) => fact.kind === modules.facts.JEDIT_CONTRACT_ENTITY_FACT_CHECKPOINT));
});

function createEditedSession(modules) {
  const runtime = modules.hotRuntime.createInMemoryHotTextRuntime();
  const hash = modules.hash.createHashPort();
  const created = modules.runtime.createBufferWorldline(runtime, {
    bufferKey: BUFFER_KEY,
    initialText: INITIAL_TEXT,
    projectionPath: BUFFER_KEY,
  }, hash);
  const session = modules.runtime.replaceRangeAsTick(runtime, created.nextSession, {
    worldlineId: created.result.worldline.worldlineId,
    baseHeadId: created.result.head.headId,
    startByte: INITIAL_TEXT.length,
    endByte: INITIAL_TEXT.length,
    insertText: INSERT_TEXT,
  }, hash).nextSession;

  return { runtime, session, hash };
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

    const [facts, runtime, hotRuntime, hash] = await Promise.all([
      import(pathToFileURL(FACTS_MODULE_PATH).href),
      import(pathToFileURL(RUNTIME_MODULE_PATH).href),
      import(pathToFileURL(HOT_RUNTIME_MODULE_PATH).href),
      import(pathToFileURL(HASH_MODULE_PATH).href),
    ]);

    return {
      facts,
      runtime,
      hotRuntime,
      hash,
    };
  })();

  return modulesPromise;
}
