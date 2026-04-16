import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const OBSERVER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-observer-spec.js');
const CONTRACT_RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-runtime.js');
const ADAPTER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'in-memory-hot-text-runtime.js');

async function loadModules() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  const [observer, contractRuntime, adapter] = await Promise.all([
    import(pathToFileURL(OBSERVER_MODULE_PATH).href),
    import(pathToFileURL(CONTRACT_RUNTIME_MODULE_PATH).href),
    import(pathToFileURL(ADAPTER_MODULE_PATH).href),
  ]);

  return { observer, contractRuntime, adapter };
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

test('worldlineSnapshot observer input and reading are validated through generated schemas', async () => {
  const { observer, contractRuntime, adapter } = await loadModules();
  const runtime = adapter.createInMemoryHotTextRuntime();
  const created = contractRuntime.createBufferWorldline(runtime, {
    bufferKey: 'notes/today.md',
    initialText: 'hello world',
    projectionPath: '/tmp/notes/today.md',
    createInitialCheckpoint: true,
  });
  const snapshotInput = observer.parseWorldlineSnapshotObserverInput({
    worldlineId: created.nextSession.worldline.worldlineId,
  });
  const snapshot = contractRuntime.readWorldlineSnapshot(runtime, created.nextSession, snapshotInput);
  const envelope = observer.emitWorldlineSnapshotReading(
    'frontier:wl:notes-today-md:1',
    snapshot,
  );

  assert.equal(envelope.observerName, 'worldlineSnapshot');
  assert.equal(envelope.frontierRef, 'frontier:wl:notes-today-md:1');
  assert.equal(envelope.reading.worldline.worldlineId, created.nextSession.worldline.worldlineId);
  assert.equal(envelope.reading.head.headId, created.nextSession.worldline.canonicalHeadId);
  assert.equal(envelope.reading.text, 'hello world');
  assert.equal(envelope.reading.checkpoints[0]?.kind, 'INITIAL');
});

test('worldlineSnapshot observer rejects malformed reading payloads', async () => {
  const { observer } = await loadModules();

  assert.throws(
    () => observer.emitWorldlineSnapshotReading('frontier:bad', {
      worldline: {
        worldlineId: 'wl:one',
        bufferKey: 'notes/today.md',
        projectionPath: '/tmp/notes/today.md',
        canonicalHeadId: 'head:one',
      },
      head: {
        headId: 'head:one',
        worldlineId: 'wl:one',
        rootNodeId: 'root:one',
        byteLength: 11,
        lineCount: 1,
        utf16Length: 11,
        equivalenceDigest: 'digest:one',
      },
      checkpoints: [],
    }),
    /text/i,
  );
});
