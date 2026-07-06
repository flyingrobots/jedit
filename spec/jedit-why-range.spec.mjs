import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const WHY_RANGE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-why-range.js');
const CONTRACT_APP_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-runtime.js');
const ADAPTER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'full-snapshot-hot-text-runtime-fixture.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');

async function loadModules() {
  await ensureDistBuilt();

  const [whyRange, contractApp, adapter, hashAdapter] = await Promise.all([
    import(pathToFileURL(WHY_RANGE_MODULE_PATH).href),
    import(pathToFileURL(CONTRACT_APP_MODULE_PATH).href),
    import(pathToFileURL(ADAPTER_MODULE_PATH).href),
    import(pathToFileURL(HASH_MODULE_PATH).href),
  ]);

  return { whyRange, contractApp, adapter, hash: hashAdapter.createHashPort() };
}

test('range why identifies the retained rope diff that produced a selected span', async () => {
  const { whyRange, contractApp, adapter, hash } = await loadModules();
  const runtime = adapter.createFullSnapshotHotTextRuntimeFixture();
  const created = createBuffer(contractApp, runtime, hash, 'alpha beta');
  const edited = contractApp.replaceRangeAsTick(runtime, created.nextSession, {
    worldlineId: created.result.worldline.worldlineId,
    baseHeadId: created.result.head.headId,
    startByte: 6,
    endByte: 10,
    insertText: 'Jim',
    author: 'tester',
  }, hash);

  const report = whyRange.explainJeditWhyRange(edited.nextSession, {
    startByte: 6,
    endByte: 9,
  });

  assert.equal(report.witness.currentHeadId, edited.nextSession.worldline.canonicalHeadId);
  assert.equal(report.witness.queriedRange.startByte, 6);
  assert.equal(report.witness.queriedRange.endByte, 9);
  assert.equal(report.witness.result.kind, 'produced');
  assert.equal(report.witness.result.ropeDiffId, edited.result.ropeDiff.ropeDiffId);
  assert.equal(report.witness.result.ropeRewriteId, edited.result.ropeRewrite.ropeRewriteId);
  assert.equal(report.witness.result.tickId, edited.result.ropeRewrite.ropeRewriteId);
  assert.equal(report.witness.result.receiptId, edited.result.ropeDiff.ropeDiffId);
  assert.equal(report.witness.evidencePosture.causalHistory, 'available');
  assert.equal(report.witness.evidencePosture.btr, 'missing');
  assert.match(report.message, /ropeDiff receipt:1/);
});

test('range why walks past later edits instead of depending on local command memory', async () => {
  const { whyRange, contractApp, adapter, hash } = await loadModules();
  const runtime = adapter.createFullSnapshotHotTextRuntimeFixture();
  const created = createBuffer(contractApp, runtime, hash, '');
  const inserted = contractApp.replaceRangeAsTick(runtime, created.nextSession, {
    worldlineId: created.result.worldline.worldlineId,
    baseHeadId: created.result.head.headId,
    startByte: 0,
    endByte: 0,
    insertText: 'foo',
    author: 'tester',
  }, hash);
  const appended = contractApp.replaceRangeAsTick(runtime, inserted.nextSession, {
    worldlineId: inserted.result.worldline.worldlineId,
    baseHeadId: inserted.result.nextHead.headId,
    startByte: 3,
    endByte: 3,
    insertText: '\nbar',
    author: 'tester',
  }, hash);

  const report = whyRange.explainJeditWhyRange(appended.nextSession, {
    startByte: 0,
    endByte: 3,
  });

  assert.equal(report.witness.result.kind, 'produced');
  assert.equal(report.witness.result.ropeDiffId, inserted.result.ropeDiff.ropeDiffId);
  assert.deepEqual(report.witness.reverseWalk.inspectedDiffIds, ['receipt:2', 'receipt:1']);
});

test('range why resolves duplicate text by current coordinate, not string content', async () => {
  const { whyRange, contractApp, adapter, hash } = await loadModules();
  const runtime = adapter.createFullSnapshotHotTextRuntimeFixture();
  const created = createBuffer(contractApp, runtime, hash, 'foo\nbar\n');
  const edited = contractApp.replaceRangeAsTick(runtime, created.nextSession, {
    worldlineId: created.result.worldline.worldlineId,
    baseHeadId: created.result.head.headId,
    startByte: 8,
    endByte: 8,
    insertText: 'foo',
    author: 'tester',
  }, hash);

  const report = whyRange.explainJeditWhyRange(edited.nextSession, {
    startByte: 8,
    endByte: 11,
  });

  assert.equal(report.witness.result.kind, 'produced');
  assert.equal(report.witness.result.startByte, 8);
  assert.notEqual(report.witness.result.startByte, 0);
  assert.equal(report.witness.result.ropeDiffId, edited.result.ropeDiff.ropeDiffId);
});

test('range why does not mark mixed old and inserted bytes as wholly produced', async () => {
  const { whyRange, contractApp, adapter, hash } = await loadModules();
  const runtime = adapter.createFullSnapshotHotTextRuntimeFixture();
  const created = createBuffer(contractApp, runtime, hash, 'foo');
  const edited = contractApp.replaceRangeAsTick(runtime, created.nextSession, {
    worldlineId: created.result.worldline.worldlineId,
    baseHeadId: created.result.head.headId,
    startByte: 1,
    endByte: 1,
    insertText: 'X',
    author: 'tester',
  }, hash);

  const report = whyRange.explainJeditWhyRange(edited.nextSession, {
    startByte: 0,
    endByte: 4,
  });

  assert.equal(report.witness.result.kind, 'unavailable');
  assert.equal(report.witness.result.code, 'jedit_why_range_partial_overlap_unavailable');
  assert.match(report.message, /No retained rope diff proves range 0\.\.4/);
});

function createBuffer(contractApp, runtime, hash, initialText) {
  return contractApp.createBufferWorldline(runtime, {
    bufferKey: 'notes/today.md',
    initialText,
    projectionPath: '/tmp/notes/today.md',
    createInitialCheckpoint: false,
  }, hash);
}
