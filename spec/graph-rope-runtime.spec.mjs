import assert from 'node:assert/strict';
import test from 'node:test';
import {
  UTF8_ENCODER,
  assertOk,
  byteRange,
  createHashPort,
  loadModules,
} from './support/graph-rope-runtime-test-kit.mjs';

const WINDOW_CACHE_STATUS_UNCACHED = 'uncached-materialization';
const ROPE_LEAF_FACT_KIND = 'jedit.text.RopeLeaf';
const OBSTRUCTION_MISSING_HEAD = 'missing-head';
const OBSTRUCTION_INVALID_BYTE_RANGE = 'invalid-byte-range';
const OBSTRUCTION_INVALID_UTF8_BOUNDARY = 'invalid-utf8-boundary';
const OBSTRUCTION_INVALID_FACT = 'invalid-fact';

test('graph runtime creates a worldline from UTF-8 bytes and reads a named head window', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const initialText = 'alpha\nbeta';
  const byteLength = UTF8_ENCODER.encode(initialText).length;

  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:alpha',
    initialText,
  }));
  const reading = assertOk(graph.textWindow({
    basisHeadId: created.head.headId,
    byteRange: byteRange(contract, 0, byteLength),
  }));

  assert.equal(created.worldline.initialHeadId, created.head.headId);
  assert.equal(created.head.byteLength, byteLength);
  assert.equal(created.head.lineCount, 2);
  assert.equal(created.rootNodeId, created.head.rootNodeId);
  assert.equal(created.nodes.length, 1);
  assert.equal(reading.basisHeadId, created.head.headId);
  assert.equal(reading.text, initialText);
  assert.equal(reading.cacheStatus, WINDOW_CACHE_STATUS_UNCACHED);
  assert.deepEqual(reading.byteRange, byteRange(contract, 0, byteLength));
  assert.equal(reading.validationEvidence.length, 1);
  assert.equal(reading.validationEvidence[0].blobId, created.blob.blobId);
  assert.equal(reading.validationEvidence[0].contentHash, created.blob.contentHash);
});

test('graph runtime rejects duplicate worldline creation', async () => {
  const { runtime } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });

  assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:duplicate',
    initialText: 'first',
  }));

  assert.deepEqual(graph.createBufferWorldline({
    worldlineId: 'worldline:duplicate',
    initialText: 'second',
  }), {
    ok: false,
    code: OBSTRUCTION_INVALID_FACT,
  });
});

test('graph runtime keeps CRLF pairs in the same leaf line metric', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const initialText = `${'a'.repeat(1023)}\r\nb`;
  const byteLength = UTF8_ENCODER.encode(initialText).length;

  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:crlf-boundary',
    initialText,
  }));
  const reading = assertOk(graph.textWindow({
    basisHeadId: created.head.headId,
    byteRange: byteRange(contract, 0, byteLength),
  }));

  assert.equal(created.head.lineCount, 2);
  assert.equal(reading.text, initialText);
});

test('graph runtime debug shape reports retained blob bytes without materialized snapshot roots', async () => {
  const { runtime } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const byteLength = UTF8_ENCODER.encode('shape').length;
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:shape',
    initialText: 'shape',
  }));

  const shape = assertOk(graph.debugRopeShape(created.head.headId));

  assert.equal(shape.headId, created.head.headId);
  assert.equal(shape.rootNodeId, created.rootNodeId);
  assert.equal(shape.nodeCount, 1);
  assert.equal(shape.leafCount, 1);
  assert.equal(shape.retainedBlobBytes, byteLength);
  assert.equal(shape.materializedProjectionBytes, 0);
});

test('graph runtime replaces a UTF-8 range by admitting rewrite diff and receipt facts', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const initialText = 'alpha beta gamma';
  const replacementText = 'BETA';
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:replace',
    initialText,
  }));

  const replaced = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 6, 10),
    replacementText,
  }));
  const reading = assertOk(graph.textWindow({
    basisHeadId: replaced.nextHead.headId,
    byteRange: byteRange(contract, 0, UTF8_ENCODER.encode('alpha BETA gamma').length),
  }));
  const shape = assertOk(graph.debugRopeShape(replaced.nextHead.headId));

  assert.equal(replaced.changed, true);
  assert.equal(replaced.basisHead.headId, created.head.headId);
  assert.equal(replaced.rewrite.basisHeadId, created.head.headId);
  assert.equal(replaced.diff.rewriteId, replaced.rewrite.rewriteId);
  assert.equal(replaced.receipt.rewriteId, replaced.rewrite.rewriteId);
  assert.equal(reading.text, 'alpha BETA gamma');
  assert.equal(shape.retainedBlobBytes, UTF8_ENCODER.encode(initialText).length + UTF8_ENCODER.encode(replacementText).length);
  assert.equal(shape.materializedProjectionBytes, 0);
});

test('graph runtime no-op replacement does not mint text authority facts', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:noop',
    initialText: 'alpha beta',
  }));

  const replaced = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 0, 5),
    replacementText: 'alpha',
  }));

  assert.equal(replaced.changed, false);
  assert.equal(replaced.nextHead.headId, created.head.headId);
  assert.equal(replaced.rewrite, null);
  assert.equal(replaced.diff, null);
  assert.equal(replaced.receipt, null);
});

test('graph runtime preserves untouched leaf identity across narrow replacements', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const initialText = 'a'.repeat(3000);
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:identity',
    initialText,
  }));
  const before = assertOk(graph.debugRopeShape(created.head.headId));
  const beforeLeafIds = before.nodes.filter((node) => node.kind === ROPE_LEAF_FACT_KIND).map((node) => node.nodeId);

  const replaced = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 1500, 1501),
    replacementText: 'b',
  }));
  const after = assertOk(graph.debugRopeShape(replaced.nextHead.headId));
  const afterLeafIds = after.nodes.filter((node) => node.kind === ROPE_LEAF_FACT_KIND).map((node) => node.nodeId);

  assert.ok(afterLeafIds.includes(beforeLeafIds[0]));
  assert.ok(afterLeafIds.includes(beforeLeafIds[beforeLeafIds.length - 1]));
  assert.equal(after.retainedBlobBytes, UTF8_ENCODER.encode(initialText).length + UTF8_ENCODER.encode('b').length);
});

test('graph runtime keeps admitted facts isolated from returned mutable objects', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const initialText = 'sealed';
  const byteLength = UTF8_ENCODER.encode(initialText).length;
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:sealed',
    initialText,
  }));
  const basisHeadId = created.head.headId;

  created.head.rootNodeId = 'rope-node:corrupt';
  created.blob.storage.bytes[0] = UTF8_ENCODER.encode('x')[0];

  const reading = assertOk(graph.textWindow({
    basisHeadId,
    byteRange: byteRange(contract, 0, byteLength),
  }));

  assert.equal(reading.text, initialText);
});

test('graph runtime textWindow obstructs missing heads and invalid UTF-8 byte boundaries', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:emoji',
    initialText: 'a🙂z',
  }));

  assert.deepEqual(graph.textWindow({
    basisHeadId: 'rope-head:missing',
    byteRange: byteRange(contract, 0, 1),
  }), {
    ok: false,
    code: OBSTRUCTION_MISSING_HEAD,
  });

  assert.deepEqual(graph.textWindow({
    basisHeadId: created.head.headId,
    byteRange: byteRange(contract, 2, 3),
  }), {
    ok: false,
    code: OBSTRUCTION_INVALID_UTF8_BOUNDARY,
  });

  assert.deepEqual(graph.textWindow({
    basisHeadId: created.head.headId,
    byteRange: byteRange(contract, 0, 999),
  }), {
    ok: false,
    code: OBSTRUCTION_INVALID_BYTE_RANGE,
  });
});
