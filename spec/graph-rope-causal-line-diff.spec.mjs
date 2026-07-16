import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertOk,
  byteRange,
  createHashPort,
  loadModules,
} from './support/graph-rope-runtime-test-kit.mjs';

const OBSERVER_VERSION = 'jedit-causal-line-diff-v1';
const OBSTRUCTION_BASIS_NOT_ANCESTOR = 'basis-not-ancestor';
const OBSTRUCTION_LINE_DIFF_LIMIT_EXCEEDED = 'line-diff-limit-exceeded';

test('causal line diff reports zero changes for the same named head', async () => {
  const { runtime } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:same-head',
    initialText: 'alpha\nbeta\n',
  }));

  const reading = assertOk(graph.causalLineDiff({
    worldlineId: created.worldline.worldlineId,
    basisHeadId: created.head.headId,
    nextHeadId: created.head.headId,
    maxByteCount: 10_000,
    maxLineCount: 100,
    maxRewriteCount: 100,
  }));

  assert.deepEqual(reading, {
    worldlineId: created.worldline.worldlineId,
    basisHeadId: created.head.headId,
    nextHeadId: created.head.headId,
    insertedLineCount: 0,
    deletedLineCount: 0,
    rewriteIds: [],
    diffIds: [],
    observerVersion: OBSERVER_VERSION,
  });
});

test('causal line diff computes net changes and cites every supporting rewrite', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:repeated-line',
    initialText: 'alpha\nbeta\ngamma\n',
  }));
  const first = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 6, 10),
    replacementText: 'BETA',
  }));
  const second = assertOk(graph.replaceRangeAsTick({
    basisHeadId: first.nextHead.headId,
    range: byteRange(contract, 6, 10),
    replacementText: 'BETA!',
  }));

  const reading = assertOk(graph.causalLineDiff({
    worldlineId: created.worldline.worldlineId,
    basisHeadId: created.head.headId,
    nextHeadId: second.nextHead.headId,
    maxByteCount: 10_000,
    maxLineCount: 100,
    maxRewriteCount: 100,
  }));

  assert.equal(reading.insertedLineCount, 1);
  assert.equal(reading.deletedLineCount, 1);
  assert.deepEqual(reading.rewriteIds, [first.rewrite.rewriteId, second.rewrite.rewriteId]);
  assert.deepEqual(reading.diffIds, [first.diff.diffId, second.diff.diffId]);
});

test('causal line diff reports inserted and deleted lines without consulting Git', async () => {
  const { runtime, contract } = await loadModules();
  const insertionGraph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const insertionBasis = assertOk(insertionGraph.createBufferWorldline({
    worldlineId: 'worldline:insert-line',
    initialText: 'alpha\ngamma\n',
  }));
  const insertion = assertOk(insertionGraph.replaceRangeAsTick({
    basisHeadId: insertionBasis.head.headId,
    range: byteRange(contract, 6, 6),
    replacementText: 'beta\n',
  }));

  const insertionReading = assertOk(insertionGraph.causalLineDiff({
    worldlineId: insertionBasis.worldline.worldlineId,
    basisHeadId: insertionBasis.head.headId,
    nextHeadId: insertion.nextHead.headId,
    maxByteCount: 10_000,
    maxLineCount: 100,
    maxRewriteCount: 100,
  }));

  assert.equal(insertionReading.insertedLineCount, 1);
  assert.equal(insertionReading.deletedLineCount, 0);

  const deletionGraph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const deletionBasis = assertOk(deletionGraph.createBufferWorldline({
    worldlineId: 'worldline:delete-line',
    initialText: 'alpha\nbeta\ngamma\n',
  }));
  const deletion = assertOk(deletionGraph.replaceRangeAsTick({
    basisHeadId: deletionBasis.head.headId,
    range: byteRange(contract, 6, 11),
    replacementText: '',
  }));

  const deletionReading = assertOk(deletionGraph.causalLineDiff({
    worldlineId: deletionBasis.worldline.worldlineId,
    basisHeadId: deletionBasis.head.headId,
    nextHeadId: deletion.nextHead.headId,
    maxByteCount: 10_000,
    maxLineCount: 100,
    maxRewriteCount: 100,
  }));

  assert.equal(deletionReading.insertedLineCount, 0);
  assert.equal(deletionReading.deletedLineCount, 1);
});

test('causal line diff refuses a basis outside the current head ancestry', async () => {
  const { runtime } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const first = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:first',
    initialText: 'first\n',
  }));
  const second = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:second',
    initialText: 'second\n',
  }));

  assert.deepEqual(graph.causalLineDiff({
    worldlineId: first.worldline.worldlineId,
    basisHeadId: second.head.headId,
    nextHeadId: first.head.headId,
    maxByteCount: 10_000,
    maxLineCount: 100,
    maxRewriteCount: 100,
  }), {
    ok: false,
    code: OBSTRUCTION_BASIS_NOT_ANCESTOR,
  });
});

test('causal line diff refuses materialization beyond its deterministic line bound', async () => {
  const { runtime } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:bounded',
    initialText: 'alpha\nbeta\n',
  }));

  assert.deepEqual(graph.causalLineDiff({
    worldlineId: created.worldline.worldlineId,
    basisHeadId: created.head.headId,
    nextHeadId: created.head.headId,
    maxByteCount: 10_000,
    maxLineCount: 1,
    maxRewriteCount: 100,
  }), {
    ok: false,
    code: OBSTRUCTION_LINE_DIFF_LIMIT_EXCEEDED,
  });
});

test('causal line diff refuses materialization beyond its deterministic byte bound', async () => {
  const { runtime } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:byte-bounded',
    initialText: 'alpha\n',
  }));

  assert.deepEqual(graph.causalLineDiff({
    worldlineId: created.worldline.worldlineId,
    basisHeadId: created.head.headId,
    nextHeadId: created.head.headId,
    maxByteCount: 1,
    maxLineCount: 100,
    maxRewriteCount: 100,
  }), {
    ok: false,
    code: OBSTRUCTION_LINE_DIFF_LIMIT_EXCEEDED,
  });
});

test('causal line diff refuses support traversal beyond its deterministic rewrite bound', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:rewrite-bounded',
    initialText: 'alpha\n',
  }));
  const replaced = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 0, 5),
    replacementText: 'ALPHA',
  }));

  assert.deepEqual(graph.causalLineDiff({
    worldlineId: created.worldline.worldlineId,
    basisHeadId: created.head.headId,
    nextHeadId: replaced.nextHead.headId,
    maxByteCount: 10_000,
    maxLineCount: 100,
    maxRewriteCount: 0,
  }), {
    ok: false,
    code: OBSTRUCTION_LINE_DIFF_LIMIT_EXCEEDED,
  });
});
