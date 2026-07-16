import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertOk,
  byteRange,
  createHashPort,
  loadModules,
} from './support/graph-rope-runtime-test-kit.mjs';

const MAX_FACTS = 64;
const MAX_DEPTH = 16;
const MAX_HISTORICAL_TEXT_BYTES = 8_192;

test('range why cites distinct retained graph facts for edited bytes', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:range-why-edit',
    initialText: 'alpha beta',
  }));
  const edited = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 6, 10),
    replacementText: 'Jim',
  }));

  const reading = assertOk(graph.whyRange(whyRequest(
    edited.nextHead.worldlineId,
    edited.nextHead.headId,
    byteRange(contract, 6, 9),
  )));

  assert.equal(reading.coverage.kind, 'complete');
  assert.equal(reading.fragments.length, 1);
  const fragment = reading.fragments[0];
  assert.equal(fragment.headId, edited.nextHead.headId);
  assert.equal(fragment.coveredRange.startByte.value, 6);
  assert.equal(fragment.coveredRange.endByte.value, 9);
  assert.notEqual(fragment.leafId, fragment.blobId);
  assert.deepEqual(fragment.origin, {
    kind: 'rewrite',
    rewriteId: edited.rewrite.rewriteId,
    diffId: edited.diff.diffId,
    textTickReceiptId: edited.receipt.tickId,
    basisHeadId: edited.basisHead.headId,
    nextHeadId: edited.nextHead.headId,
  });
  assert.notEqual(fragment.origin.rewriteId, fragment.origin.diffId);
  assert.notEqual(fragment.origin.diffId, fragment.origin.textTickReceiptId);
});

test('range why fragments mixed imported and rewritten bytes', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:range-why-fragments',
    initialText: 'ab',
  }));
  const edited = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 1, 1),
    replacementText: 'X',
  }));

  const reading = assertOk(graph.whyRange(whyRequest(
    edited.nextHead.worldlineId,
    edited.nextHead.headId,
    byteRange(contract, 0, 3),
  )));

  assert.equal(reading.coverage.kind, 'complete');
  assert.deepEqual(
    reading.fragments.map(fragment => fragment.origin.kind),
    ['imported', 'rewrite', 'imported'],
  );
  assert.deepEqual(
    reading.fragments.map(fragment => [
      fragment.coveredRange.startByte.value,
      fragment.coveredRange.endByte.value,
    ]),
    [[0, 1], [1, 2], [2, 3]],
  );
});

test('range why returns ordered complete coverage across retained rope leaves', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:range-why-leaves',
    initialText: 'a'.repeat(2_048),
  }));

  const reading = assertOk(graph.whyRange(whyRequest(
    created.worldline.worldlineId,
    created.head.headId,
    byteRange(contract, 1_000, 1_050),
  )));

  assert.equal(reading.coverage.kind, 'complete');
  assert.deepEqual(
    reading.fragments.map(fragment => [
      fragment.coveredRange.startByte.value,
      fragment.coveredRange.endByte.value,
    ]),
    [[1_000, 1_024], [1_024, 1_050]],
  );
  assert.notEqual(reading.fragments[0].leafId, reading.fragments[1].leafId);
});

test('range why reports a checkpoint without inventing an Echo anchor', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:range-why-checkpoint',
    initialText: 'checkpointed',
  }));
  const checkpointed = assertOk(graph.createCheckpoint({
    worldlineId: created.worldline.worldlineId,
    headId: created.head.headId,
    reason: contract.ROPE_CHECKPOINT_REASON_MANUAL_SAVE,
  }));

  const reading = assertOk(graph.whyRange(whyRequest(
    created.worldline.worldlineId,
    created.head.headId,
    byteRange(contract, 0, 12),
  )));

  assert.deepEqual(reading.relatedCheckpoints, [{
    checkpointId: checkpointed.checkpoint.checkpointId,
    headId: created.head.headId,
    reason: contract.ROPE_CHECKPOINT_REASON_MANUAL_SAVE,
  }]);
});

test('range why fails closed when provenance depth exceeds the request bound', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:range-why-depth',
    initialText: 'base',
  }));
  const edited = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 4, 4),
    replacementText: ' tail',
  }));

  const result = graph.whyRange({
    ...whyRequest(
      edited.nextHead.worldlineId,
      edited.nextHead.headId,
      byteRange(contract, 0, 4),
    ),
    maxDepth: 1,
  });

  assert.deepEqual(result, { ok: false, code: 'range-why-limit-exceeded' });
});

test('range why accepts a zero historical-text budget when no historical text is materialized', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:range-why-zero-history-bytes',
    initialText: 'base',
  }));

  const reading = assertOk(graph.whyRange({
    ...whyRequest(
      created.worldline.worldlineId,
      created.head.headId,
      byteRange(contract, 0, 4),
    ),
    maxHistoricalTextBytes: 0,
  }));

  assert.equal(reading.coverage.kind, 'complete');
  assert.equal(reading.fragments[0].origin.kind, 'imported');
});

function whyRequest(worldlineId, basisHeadId, queriedRange) {
  return {
    worldlineId,
    basisHeadId,
    queriedRange,
    maxFacts: MAX_FACTS,
    maxDepth: MAX_DEPTH,
    maxHistoricalTextBytes: MAX_HISTORICAL_TEXT_BYTES,
  };
}
