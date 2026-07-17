import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './dist-helpers.mjs';
import {
  assertOk,
  byteRange,
  createHashPort,
  loadModules,
} from './support/graph-rope-runtime-test-kit.mjs';
import { createTestEchoCausalAnchorAdmissionPort } from './support/test-echo-causal-anchor-admission.mjs';

const MAX_FACTS = 64;
const MAX_DEPTH = 16;
const MAX_HISTORICAL_TEXT_BYTES = 8_192;
const NARROW_RANGE_END_BYTE = 1;
const NARROW_RANGE_FACT_BUDGET = 8;
const LARGE_ROPE_BYTE_LENGTH = 16_384;
const CHECKPOINT_INDEX_FACT_BUDGET = 5;
const INDEX_OVERFLOW_SENTINEL = 1;

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

test('range why validates a query ending exactly at a retained leaf boundary', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:range-why-leaf-boundary',
    initialText: 'a'.repeat(2_048),
  }));

  const reading = assertOk(graph.whyRange(whyRequest(
    created.worldline.worldlineId,
    created.head.headId,
    byteRange(contract, 1_000, 1_024),
  )));

  assert.deepEqual(reading.fragments.map(fragment => [
    fragment.coveredRange.startByte.value,
    fragment.coveredRange.endByte.value,
  ]), [[1_000, 1_024]]);
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

test('range why cites an explicitly admitted opaque Echo anchor association', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({
    hash: createHashPort(),
    causalAnchorAdmission: createTestEchoCausalAnchorAdmissionPort(),
  });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:range-why-anchor',
    initialText: 'anchored',
  }));
  const checkpointed = assertOk(graph.createCheckpoint({
    worldlineId: created.worldline.worldlineId,
    headId: created.head.headId,
    reason: contract.ROPE_CHECKPOINT_REASON_MANUAL_SAVE,
  }));
  const anchored = assertOk(graph.anchorCheckpoint({
    checkpointId: checkpointed.checkpoint.checkpointId,
  }));

  const reading = assertOk(graph.whyRange(whyRequest(
    created.worldline.worldlineId,
    created.head.headId,
    byteRange(contract, 0, 8),
  )));

  assert.deepEqual(reading.relatedCheckpoints[0].anchorAssociation, {
    associationId: anchored.association.associationId,
    causalAnchorId: anchored.echoEvidence.anchorId,
    causalAnchorFactId: anchored.echoEvidence.anchorFactId,
    causalAnchorReceiptId: anchored.echoEvidence.receiptId,
  });
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

test('range why fact budget bounds every graph fact inspected for a narrow rope window', async () => {
  const [{ runtime, contract }, rangeWhy] = await Promise.all([
    loadModules(),
    importDist('domain', 'graph-rope-range-why.js'),
  ]);
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:range-why-bounded-tree',
    initialText: 'a'.repeat(LARGE_ROPE_BYTE_LENGTH),
  }));
  const observed = instrumentedCatalog(created);

  const reading = assertOk(rangeWhy.readGraphRopeRangeWhy(observed.catalog, {
    ...whyRequest(
      created.worldline.worldlineId,
      created.head.headId,
      byteRange(contract, 0, NARROW_RANGE_END_BYTE),
    ),
    maxFacts: NARROW_RANGE_FACT_BUDGET,
  }));

  assert.equal(observed.inspectedFactIds.size, reading.inspectedFactCount);
  assert.ok(observed.inspectedFactIds.size <= NARROW_RANGE_FACT_BUDGET);
  assert.deepEqual(observed.checkpointIndexLimits, [INDEX_OVERFLOW_SENTINEL]);
});

test('range why checkpoint index reads stop at the remaining fact budget plus one', async () => {
  const [{ runtime, contract }, rangeWhy] = await Promise.all([
    loadModules(),
    importDist('domain', 'graph-rope-range-why.js'),
  ]);
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:range-why-bounded-checkpoints',
    initialText: 'a',
  }));
  const checkpointIds = ['checkpoint:bounded:first', 'checkpoint:bounded:second'];
  const checkpointFacts = checkpointIds.map(checkpointId => ({
    kind: contract.ROPE_CHECKPOINT_FACT_KIND,
    schemaVersion: contract.GRAPH_ROPE_SCHEMA_VERSION,
    checkpointId,
    worldlineId: created.worldline.worldlineId,
    headId: created.head.headId,
    reason: contract.ROPE_CHECKPOINT_REASON_MANUAL_SAVE,
  }));
  const observed = instrumentedCatalog(created, checkpointFacts);

  const result = rangeWhy.readGraphRopeRangeWhy(observed.catalog, {
    ...whyRequest(
      created.worldline.worldlineId,
      created.head.headId,
      byteRange(contract, 0, NARROW_RANGE_END_BYTE),
    ),
    maxFacts: CHECKPOINT_INDEX_FACT_BUDGET,
  });

  assert.deepEqual(result, { ok: false, code: 'range-why-limit-exceeded' });
  assert.deepEqual(observed.checkpointIndexLimits, [INDEX_OVERFLOW_SENTINEL + INDEX_OVERFLOW_SENTINEL]);
  assert.ok(observed.inspectedFactIds.size <= CHECKPOINT_INDEX_FACT_BUDGET);
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

function instrumentedCatalog(created, checkpointFacts = []) {
  const inspectedFactIds = new Set();
  const checkpointIndexLimits = [];
  const factsById = new Map([
    [created.worldline.worldlineId, created.worldline],
    [created.head.headId, created.head],
    [created.blob.blobId, created.blob],
    ...created.nodes.map(node => [node.nodeId, node]),
    ...checkpointFacts.map(checkpoint => [checkpoint.checkpointId, checkpoint]),
  ]);
  const checkpointIds = checkpointFacts.map(checkpoint => checkpoint.checkpointId).sort();
  return {
    inspectedFactIds,
    checkpointIndexLimits,
    catalog: {
      getFact(id) {
        inspectedFactIds.add(id);
        return factsById.get(id) ?? null;
      },
      checkpointIdsForHead(_headId, maxCount) {
        checkpointIndexLimits.push(maxCount);
        return checkpointIds.slice(0, maxCount ?? checkpointIds.length);
      },
      anchorAssociationIdsForCheckpoint() {
        return [];
      },
    },
  };
}
