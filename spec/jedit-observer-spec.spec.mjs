import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const OBSERVER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-observer-spec.js');
const OBSERVER_PLAN_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-observer-plan.js');
const OBSERVER_RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-observer-runtime.js');
const CONTRACT_RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-runtime.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');
const ADAPTER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'full-snapshot-hot-text-runtime-fixture.js');

async function loadModules() {
  await ensureDistBuilt();

  const [observer, observerPlan, observerRuntime, contractRuntime, hashModule, adapter] = await Promise.all([
    import(pathToFileURL(OBSERVER_MODULE_PATH).href),
    import(pathToFileURL(OBSERVER_PLAN_MODULE_PATH).href),
    import(pathToFileURL(OBSERVER_RUNTIME_MODULE_PATH).href),
    import(pathToFileURL(CONTRACT_RUNTIME_MODULE_PATH).href),
    import(pathToFileURL(HASH_MODULE_PATH).href),
    import(pathToFileURL(ADAPTER_MODULE_PATH).href),
  ]);

  return { observer, observerPlan, observerRuntime, contractRuntime, adapter, hash: hashModule.createHashPort() };
}

test('worldlineSnapshot observer spec is memoryless, canonical-head only, and author-visible', async () => {
  const { observer } = await loadModules();
  const spec = observer.createWorldlineSnapshotObserverSpec();
  const state = observer.createWorldlineSnapshotObserverState();

  assert.equal(spec.observerName, 'worldlineSnapshot');
  assert.equal(spec.kind, 'WORLDLINE_SNAPSHOT');
  assert.equal(spec.aperture.kind, 'CANONICAL_WORLDLINE_SLICE');
  assert.equal(spec.aperture.historyWindow, 'CANONICAL_HEAD_ONLY');
  assert.equal(spec.aperture.maxWorldlines, 1);
  assert.deepEqual(spec.basis.nodeKinds, ['BufferWorldline', 'RopeHead', 'Checkpoint']);
  assert.deepEqual(spec.basis.derivedSurfaces, ['text']);
  assert.equal(spec.state.mode, 'MEMORYLESS');
  assert.equal(spec.update.kind, 'REPLACE_WITH_LATEST_SLICE');
  assert.equal(spec.emit.kind, 'WORLDLINE_SNAPSHOT_READING');
  assert.equal(spec.rights.exposureTier, 'AUTHOR_VISIBLE');
  assert.equal(spec.rights.revelationTier, 'CANONICAL_TEXT_ONLY');
  assert.equal(spec.rights.redactionPolicy, 'HIDE_NON_CANONICAL_LANES');
  assert.equal(state.mode, 'MEMORYLESS');
});

test('worldlineSnapshot observer plan is app-owned and consumed at runtime', async () => {
  const { observer, observerPlan, observerRuntime, contractRuntime, adapter, hash } = await loadModules();
  const runtime = adapter.createFullSnapshotHotTextRuntimeFixture();
  const created = contractRuntime.createBufferWorldline(runtime, {
    bufferKey: 'notes/today.md',
    initialText: 'hello world',
    projectionPath: '/tmp/notes/today.md',
    createInitialCheckpoint: true,
  }, hash);
  const authoredSpec = observer.createWorldlineSnapshotObserverSpec();
  const plan = observerPlan.createWorldlineSnapshotObserverPlan(hash);

  assert.equal(plan.observerName, authoredSpec.observerName);
  assert.equal(plan.kind, authoredSpec.kind);
  assert.equal(plan.operationName, authoredSpec.operationName);
  assert.equal(plan.state.schemaId, authoredSpec.state.schemaId);
  assert.equal(plan.rights.revelationTier, authoredSpec.rights.revelationTier);
  assert.equal(plan.specHash, '655053a4c0e213e2e2c555fab85498c0c51e3a793f528b37b6259b0542af2538');
  assert.equal(plan.planId, 'observer-plan:worldlineSnapshot:655053a4c0e213e2');

  const snapshotInput = {
    worldlineId: created.nextSession.worldline.worldlineId,
  };
  const envelope = observerRuntime.readWorldlineSnapshotWithObserverPlan(
    runtime,
    created.nextSession,
    'frontier:wl:notes-today-md:1',
    snapshotInput,
    hash,
  );

  assert.equal(envelope.planId, plan.planId);
  assert.equal(envelope.observerName, plan.observerName);
  assert.equal(envelope.operationName, plan.operationName);
  assert.equal(envelope.frontierRef, 'frontier:wl:notes-today-md:1');
  assert.equal(envelope.reading.worldline.worldlineId, created.nextSession.worldline.worldlineId);
  assert.equal(envelope.reading.head.headId, created.nextSession.worldline.canonicalHeadId);
  assert.equal(envelope.reading.text, 'hello world');
  assert.equal(envelope.reading.checkpoints[0]?.kind, 'INITIAL');
});

test('worldlineSnapshot observer rejects malformed reading payloads', async () => {
  const { observerRuntime, adapter, contractRuntime, hash } = await loadModules();
  const runtime = adapter.createFullSnapshotHotTextRuntimeFixture();
  const created = contractRuntime.createBufferWorldline(runtime, {
    bufferKey: 'notes/today.md',
    initialText: 'hello world',
    projectionPath: '/tmp/notes/today.md',
    createInitialCheckpoint: false,
  }, hash);

  assert.throws(
    () => observerRuntime.readWorldlineSnapshotWithObserverPlan(
      runtime,
      created.nextSession,
      'frontier:bad',
      {},
      hash,
    ),
    /worldlineId/i,
  );
});
