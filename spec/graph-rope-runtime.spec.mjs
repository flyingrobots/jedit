import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './dist-helpers.mjs';

const UTF8_ENCODER = new TextEncoder();
const WINDOW_CACHE_STATUS_UNCACHED = 'uncached-materialization';
const OBSTRUCTION_MISSING_HEAD = 'missing-head';
const OBSTRUCTION_INVALID_BYTE_RANGE = 'invalid-byte-range';
const OBSTRUCTION_INVALID_UTF8_BOUNDARY = 'invalid-utf8-boundary';

async function loadModules() {
  const [runtime, contract] = await Promise.all([
    importDist('domain', 'graph-rope-runtime.js'),
    importDist('domain', 'graph-rope-contract.js'),
  ]);
  return { runtime, contract };
}

function createHashPort() {
  return {
    sha256Hex(value) {
      return `hash(${value})`;
    },
  };
}

function assertOk(result) {
  assert.equal(result.ok, true);
  return result.value ?? result.fact ?? result;
}

function byteRange(contract, start, end) {
  return assertOk(contract.makeTextByteRange(
    assertOk(contract.makeByteOffset(start)),
    assertOk(contract.makeByteOffset(end)),
  ));
}

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
  assert.equal(reading.basisHeadId, created.head.headId);
  assert.equal(reading.text, initialText);
  assert.equal(reading.cacheStatus, WINDOW_CACHE_STATUS_UNCACHED);
  assert.deepEqual(reading.byteRange, byteRange(contract, 0, byteLength));
  assert.equal(reading.validationEvidence.length, 1);
  assert.equal(reading.validationEvidence[0].blobId, created.blob.blobId);
  assert.equal(reading.validationEvidence[0].contentHash, created.blob.contentHash);
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
  assert.equal(shape.rootNodeId, created.leaf.nodeId);
  assert.equal(shape.nodeCount, 1);
  assert.equal(shape.leafCount, 1);
  assert.equal(shape.retainedBlobBytes, byteLength);
  assert.equal(shape.materializedProjectionBytes, 0);
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
