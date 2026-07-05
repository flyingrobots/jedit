import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const FACTS_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-entity-facts.js');
const RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-runtime.js');
const HOT_RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'full-snapshot-hot-text-runtime-fixture.js');
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

test('historical checkpoint roots are represented by root facts', async () => {
  const modules = await loadModules();
  const runtime = modules.hotRuntime.createFullSnapshotHotTextRuntimeFixture();
  const hash = modules.hash.createHashPort();
  const created = modules.runtime.createBufferWorldline(runtime, {
    bufferKey: BUFFER_KEY,
    initialText: INITIAL_TEXT,
    projectionPath: BUFFER_KEY,
    createInitialCheckpoint: true,
  }, hash);
  const edited = modules.runtime.replaceRangeAsTick(runtime, created.nextSession, {
    worldlineId: created.result.worldline.worldlineId,
    baseHeadId: created.result.head.headId,
    startByte: INITIAL_TEXT.length,
    endByte: INITIAL_TEXT.length,
    insertText: INSERT_TEXT,
  }, hash).nextSession;
  const factSet = modules.facts.jeditContractSessionToFacts(edited, hash);
  const rootFactIds = new Set(
    factSet.facts
      .filter((fact) => fact.kind === modules.facts.JEDIT_CONTRACT_ENTITY_FACT_ROOT)
      .map((fact) => fact.rootId),
  );
  const referencedRootIds = factSet.facts
    .filter((fact) => fact.kind !== modules.facts.JEDIT_CONTRACT_ENTITY_FACT_WORLDLINE)
    .map((fact) => fact.rootId);

  assert.ok(rootFactIds.size > 1);
  for (const rootId of referencedRootIds) {
    assert.equal(rootFactIds.has(rootId), true, `missing root fact for referenced root ${rootId}`);
  }
});

function createEditedSession(modules) {
  const runtime = modules.hotRuntime.createFullSnapshotHotTextRuntimeFixture();
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
