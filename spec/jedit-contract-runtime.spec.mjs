import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const CONTRACT_APP_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-runtime.js');
const CONTRACT_ID_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-runtime-id.js');
const ADAPTER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'in-memory-hot-text-runtime.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');

async function loadModules() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  const [contractApp, contractIds, adapter, hashAdapter] = await Promise.all([
    import(pathToFileURL(CONTRACT_APP_MODULE_PATH).href),
    import(pathToFileURL(CONTRACT_ID_MODULE_PATH).href),
    import(pathToFileURL(ADAPTER_MODULE_PATH).href),
    import(pathToFileURL(HASH_MODULE_PATH).href),
  ]);

  return { contractApp, contractIds, adapter, hash: hashAdapter.createHashPort() };
}

test('createBufferWorldline returns contract-shaped worldline and head data', async () => {
  const { contractApp, adapter, hash } = await loadModules();
  const runtime = adapter.createInMemoryHotTextRuntime();

  const created = contractApp.createBufferWorldline(runtime, {
    bufferKey: 'notes/today.md',
    initialText: 'hello world',
    projectionPath: '/tmp/notes/today.md',
    createInitialCheckpoint: false,
  }, hash);

  assert.equal(created.result.worldline.bufferKey, 'notes/today.md');
  assert.equal(created.result.worldline.projectionPath, '/tmp/notes/today.md');
  assert.equal(created.result.worldline.canonicalHeadId, created.result.head.headId);
  assert.equal(created.result.head.worldlineId, created.result.worldline.worldlineId);
  assert.equal(created.result.head.byteLength, 11);
  assert.equal(created.result.head.lineCount, 1);
  assert.equal(created.result.checkpoint, undefined);
});

test('replaceRangeAsTick returns contract-shaped tick and receipt data', async () => {
  const { contractApp, adapter, hash } = await loadModules();
  const runtime = adapter.createInMemoryHotTextRuntime();
  const created = contractApp.createBufferWorldline(runtime, {
    bufferKey: 'notes/today.md',
    initialText: 'hello world',
    projectionPath: '/tmp/notes/today.md',
    createInitialCheckpoint: false,
  }, hash);

  const edited = contractApp.replaceRangeAsTick(runtime, created.nextSession, {
    worldlineId: created.result.worldline.worldlineId,
    baseHeadId: created.result.head.headId,
    startByte: 5,
    endByte: 5,
    insertText: ' brave new',
    author: 'tester',
  }, hash);

  assert.ok(edited.result);
  assert.equal(contractApp.materializeWorldline(runtime, edited.nextSession), 'hello brave new world');
  assert.equal(edited.result.worldline.canonicalHeadId, edited.result.nextHead.headId);
  assert.equal(edited.result.ropeRewrite.worldlineId, edited.result.worldline.worldlineId);
  assert.equal(edited.result.ropeRewrite.kind, 'REPLACE_RANGE_AS_TICK');
  assert.equal(edited.result.ropeRewrite.author, 'tester');
  assert.equal(edited.result.ropeDiff.baseHeadId, created.result.head.headId);
  assert.equal(edited.result.ropeDiff.nextHeadId, edited.result.nextHead.headId);
  assert.equal(edited.result.ropeDiff.rewriteKind, 'REPLACE_RANGE_AS_TICK');
  assert.equal(edited.result.ropeDiff.ropeDiffId, 'receipt:1');
  assert.equal(edited.result.ropeDiff.startByte, 5);
  assert.equal(edited.result.ropeDiff.endByte, 5);
  assert.equal(edited.result.ropeDiff.insertedByteLength, 10);
  assert.equal(edited.result.ropeDiff.deletedByteLength, 0);
});

test('runtime id helpers round-trip numeric identifiers symmetrically', async () => {
  const { contractIds } = await loadModules();

  assert.equal(contractIds.parseRootNodeId(contractIds.toRootNodeId(7)), 7);
  assert.equal(contractIds.parseCheckpointId(contractIds.toCheckpointId(8)), 8);
  assert.equal(contractIds.parseTickId(contractIds.toTickId(9)), 9);
  assert.equal(contractIds.parseReceiptId(contractIds.toReceiptId(10)), 10);
  assert.throws(
    () => contractIds.parseTickId('tick:not-a-number'),
    (error) => error?.name === 'JeditRuntimeIdParseError',
  );
});

test('JeditWorldlineSession reports invalid root identifiers with a dedicated error code', async () => {
  const { contractApp } = await loadModules();

  assert.throws(
    () => new contractApp.JeditWorldlineSession({
      worldlineId: 'wl:/repo/notes.md',
      bufferKey: 'notes.md',
      canonicalHeadId: 'head:0',
      projectionPath: '/repo/notes.md',
    }, {
      currentRoot: { id: Number.NaN },
      checkpoints: [],
    }, [], []),
    (error) => error?.name === 'JeditContractRuntimeError' && error.code === 'INVALID_ROOT_ID',
  );
});

test('JeditWorldlineSession rejects malformed head identifiers before root comparison', async () => {
  const { contractApp } = await loadModules();

  assert.throws(
    () => new contractApp.JeditWorldlineSession({
      worldlineId: 'wl:/repo/notes.md',
      bufferKey: 'notes.md',
      canonicalHeadId: 'head:stale',
      projectionPath: '/repo/notes.md',
    }, {
      currentRoot: { id: 0 },
      checkpoints: [],
    }, [], []),
    (error) => error?.name === 'JeditContractRuntimeError' && error.code === 'INVALID_HEAD_ID',
  );
});

test('createCheckpoint keeps checkpoint metadata in the app-owned adapter layer', async () => {
  const { contractApp, adapter, hash } = await loadModules();
  const runtime = adapter.createInMemoryHotTextRuntime();
  const created = contractApp.createBufferWorldline(runtime, {
    bufferKey: 'notes/today.md',
    initialText: 'hello world',
    projectionPath: '/tmp/notes/today.md',
    createInitialCheckpoint: false,
  }, hash);
  const edited = contractApp.replaceRangeAsTick(runtime, created.nextSession, {
    worldlineId: created.result.worldline.worldlineId,
    baseHeadId: created.result.head.headId,
    startByte: 11,
    endByte: 11,
    insertText: '!',
    author: 'tester',
  }, hash);

  const saved = contractApp.createCheckpoint(runtime, edited.nextSession, {
    worldlineId: edited.nextSession.worldline.worldlineId,
    kind: 'MANUAL_SAVE',
    label: 'after greeting',
  }, hash);

  assert.ok(saved.result);
  assert.equal(saved.result.worldline.worldlineId, edited.nextSession.worldline.worldlineId);
  assert.equal(saved.result.head.headId, edited.nextSession.worldline.canonicalHeadId);
  assert.equal(saved.result.checkpoint.kind, 'MANUAL_SAVE');
  assert.equal(saved.result.checkpoint.label, 'after greeting');
});

test('worldlineSnapshot returns canonical worldline, head, checkpoints, and text', async () => {
  const { contractApp, adapter, hash } = await loadModules();
  const runtime = adapter.createInMemoryHotTextRuntime();
  const created = contractApp.createBufferWorldline(runtime, {
    bufferKey: 'notes/today.md',
    initialText: 'hello world',
    projectionPath: '/tmp/notes/today.md',
    createInitialCheckpoint: true,
  }, hash);
  const edited = contractApp.replaceRangeAsTick(runtime, created.nextSession, {
    worldlineId: created.result.worldline.worldlineId,
    baseHeadId: created.result.head.headId,
    startByte: 11,
    endByte: 11,
    insertText: '!',
    author: 'tester',
  }, hash);
  const saved = contractApp.createCheckpoint(runtime, edited.nextSession, {
    worldlineId: edited.nextSession.worldline.worldlineId,
    kind: 'MANUAL_SAVE',
    label: 'after greeting',
  }, hash);

  const snapshot = contractApp.readWorldlineSnapshot(runtime, saved.nextSession, {
    worldlineId: saved.nextSession.worldline.worldlineId,
  }, hash);

  assert.equal(snapshot.worldline.worldlineId, saved.nextSession.worldline.worldlineId);
  assert.equal(snapshot.head.headId, saved.nextSession.worldline.canonicalHeadId);
  assert.equal(snapshot.text, 'hello world!');
  assert.equal(snapshot.checkpoints.length, 2);
  assert.equal(snapshot.checkpoints[0]?.kind, 'INITIAL');
  assert.equal(snapshot.checkpoints[1]?.kind, 'MANUAL_SAVE');
  assert.equal(snapshot.checkpoints[1]?.label, 'after greeting');
});

test('replaceRangeAsTick rejects a stale or foreign basis head at the app-owned contract layer', async () => {
  const { contractApp, adapter, hash } = await loadModules();
  const runtime = adapter.createInMemoryHotTextRuntime();
  const created = contractApp.createBufferWorldline(runtime, {
    bufferKey: 'notes/today.md',
    initialText: 'hello world',
    projectionPath: '/tmp/notes/today.md',
    createInitialCheckpoint: false,
  }, hash);

  assert.throws(
    () => contractApp.replaceRangeAsTick(runtime, created.nextSession, {
      worldlineId: created.result.worldline.worldlineId,
      baseHeadId: 'head:stale',
      startByte: 0,
      endByte: 0,
      insertText: 'x',
    }, hash),
    /base head/i,
  );
});
