import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const OBSERVER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-observer-spec.js');
const OBSERVER_RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-observer-runtime.js');
const CONTRACT_RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-runtime.js');
const ADAPTER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'in-memory-hot-text-runtime.js');
const GENERATED_PLAN_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'generated', 'jedit', 'worldlineSnapshot.observer-plan.generated.js');

async function loadModules() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  const [observer, observerRuntime, contractRuntime, adapter, generatedPlan] = await Promise.all([
    import(pathToFileURL(OBSERVER_MODULE_PATH).href),
    import(pathToFileURL(OBSERVER_RUNTIME_MODULE_PATH).href),
    import(pathToFileURL(CONTRACT_RUNTIME_MODULE_PATH).href),
    import(pathToFileURL(ADAPTER_MODULE_PATH).href),
    import(pathToFileURL(GENERATED_PLAN_MODULE_PATH).href),
  ]);

  return { observer, observerRuntime, contractRuntime, adapter, generatedPlan };
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

test('worldlineSnapshot observer plan is compiled by Wesley and consumed at runtime', async () => {
  const { observer, observerRuntime, contractRuntime, adapter, generatedPlan } = await loadModules();
  const runtime = adapter.createInMemoryHotTextRuntime();
  const created = contractRuntime.createBufferWorldline(runtime, {
    bufferKey: 'notes/today.md',
    initialText: 'hello world',
    projectionPath: '/tmp/notes/today.md',
    createInitialCheckpoint: true,
  });
  const authoredSpec = observer.createWorldlineSnapshotObserverSpec();

  assert.equal(generatedPlan.worldlineSnapshotObserverPlan.observerName, authoredSpec.observerName);
  assert.equal(generatedPlan.worldlineSnapshotObserverPlan.kind, authoredSpec.kind);
  assert.equal(generatedPlan.worldlineSnapshotObserverPlan.operationName, authoredSpec.operationName);
  assert.equal(
    generatedPlan.worldlineSnapshotObserverPlan.state.schemaId,
    authoredSpec.state.schemaId,
  );
  assert.equal(
    generatedPlan.worldlineSnapshotObserverPlan.rights.revelationTier,
    authoredSpec.rights.revelationTier,
  );

  const snapshotInput = {
    worldlineId: created.nextSession.worldline.worldlineId,
  };
  const envelope = observerRuntime.readWorldlineSnapshotWithObserverPlan(
    runtime,
    created.nextSession,
    'frontier:wl:notes-today-md:1',
    snapshotInput,
  );

  assert.equal(envelope.planId, generatedPlan.worldlineSnapshotObserverPlan.planId);
  assert.equal(envelope.observerName, generatedPlan.worldlineSnapshotObserverPlan.observerName);
  assert.equal(envelope.operationName, generatedPlan.worldlineSnapshotObserverPlan.operationName);
  assert.equal(envelope.frontierRef, 'frontier:wl:notes-today-md:1');
  assert.equal(envelope.reading.worldline.worldlineId, created.nextSession.worldline.worldlineId);
  assert.equal(envelope.reading.head.headId, created.nextSession.worldline.canonicalHeadId);
  assert.equal(envelope.reading.text, 'hello world');
  assert.equal(envelope.reading.checkpoints[0]?.kind, 'INITIAL');
});

test('worldlineSnapshot observer rejects malformed reading payloads', async () => {
  const { observerRuntime, adapter, contractRuntime } = await loadModules();
  const runtime = adapter.createInMemoryHotTextRuntime();
  const created = contractRuntime.createBufferWorldline(runtime, {
    bufferKey: 'notes/today.md',
    initialText: 'hello world',
    projectionPath: '/tmp/notes/today.md',
    createInitialCheckpoint: false,
  });

  assert.throws(
    () => observerRuntime.readWorldlineSnapshotWithObserverPlan(
      runtime,
      created.nextSession,
      'frontier:bad',
      {},
    ),
    /worldlineId/i,
  );
});
