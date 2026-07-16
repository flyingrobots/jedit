import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertOk,
  byteRange,
  createHashPort,
  loadModules,
} from './support/graph-rope-runtime-test-kit.mjs';

const OBSERVER_VERSION = 'jedit-causal-line-diff-v4';
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
    maxMarkerCount: 100,
  }));

  assert.deepEqual(reading, {
    worldlineId: created.worldline.worldlineId,
    basisHeadId: created.head.headId,
    nextHeadId: created.head.headId,
    insertedLineCount: 0,
    deletedLineCount: 0,
    tickReceiptIds: [],
    rewriteIds: [],
    diffIds: [],
    markers: [],
    deletions: [],
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
    maxMarkerCount: 100,
  }));

  assert.equal(reading.insertedLineCount, 1);
  assert.equal(reading.deletedLineCount, 1);
  assert.deepEqual(reading.rewriteIds, [first.rewrite.rewriteId, second.rewrite.rewriteId]);
  assert.deepEqual(reading.diffIds, [first.diff.diffId, second.diff.diffId]);
  assert.deepEqual(reading.tickReceiptIds, [first.receipt.tickId, second.receipt.tickId]);
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
    maxMarkerCount: 100,
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
    maxMarkerCount: 100,
  }));

  assert.equal(deletionReading.insertedLineCount, 0);
  assert.equal(deletionReading.deletedLineCount, 1);
});

test('causal line diff derives current line markers from retained diff spans', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:gutter-markers',
    initialText: 'alpha\ngamma\n',
  }));
  const inserted = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 6, 6),
    replacementText: 'beta\n',
  }));
  const modified = assertOk(graph.replaceRangeAsTick({
    basisHeadId: inserted.nextHead.headId,
    range: byteRange(contract, 0, 5),
    replacementText: 'ALPHA',
  }));

  const reading = assertOk(graph.causalLineDiff({
    worldlineId: created.worldline.worldlineId,
    basisHeadId: created.head.headId,
    nextHeadId: modified.nextHead.headId,
    maxByteCount: 10_000,
    maxLineCount: 100,
    maxRewriteCount: 100,
    maxMarkerCount: 100,
  }));

  assert.deepEqual(reading.markers, [{
    lineNumber: 0,
    kind: 'MODIFIED',
    tickReceiptIds: [modified.receipt.tickId],
    rewriteIds: [modified.rewrite.rewriteId],
    diffIds: [modified.diff.diffId],
  }, {
    lineNumber: 1,
    kind: 'INSERTED',
    tickReceiptIds: [inserted.receipt.tickId],
    rewriteIds: [inserted.rewrite.rewriteId],
    diffIds: [inserted.diff.diffId],
  }]);
});

test('causal line diff retains pure-deletion support on the surviving modified line', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:pure-deletion-marker',
    initialText: 'alpha\n',
  }));
  const deleted = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 2, 4),
    replacementText: '',
  }));

  const reading = assertOk(graph.causalLineDiff({
    worldlineId: created.worldline.worldlineId,
    basisHeadId: created.head.headId,
    nextHeadId: deleted.nextHead.headId,
    maxByteCount: 10_000,
    maxLineCount: 100,
    maxRewriteCount: 100,
    maxMarkerCount: 100,
  }));

  assert.deepEqual(reading.markers, [{
    lineNumber: 0,
    kind: 'MODIFIED',
    tickReceiptIds: [deleted.receipt.tickId],
    rewriteIds: [deleted.rewrite.rewriteId],
    diffIds: [deleted.diff.diffId],
  }]);
});

test('causal line diff cites both lines produced by splitting a basis line', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:split-line-marker',
    initialText: 'alpha\n',
  }));
  const split = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 2, 2),
    replacementText: '\n',
  }));

  const reading = assertOk(graph.causalLineDiff({
    worldlineId: created.worldline.worldlineId,
    basisHeadId: created.head.headId,
    nextHeadId: split.nextHead.headId,
    maxByteCount: 10_000,
    maxLineCount: 100,
    maxRewriteCount: 100,
    maxMarkerCount: 100,
  }));

  assert.deepEqual(reading.markers, [0, 1].map(lineNumber => ({
    lineNumber,
    kind: 'MODIFIED',
    tickReceiptIds: [split.receipt.tickId],
    rewriteIds: [split.rewrite.rewriteId],
    diffIds: [split.diff.diffId],
  })));
});

test('causal line markers retain touch history when current text equals the basis', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:causal-revert-marker',
    initialText: 'alpha\n',
  }));
  const changed = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 0, 1),
    replacementText: 'A',
  }));
  const reverted = assertOk(graph.replaceRangeAsTick({
    basisHeadId: changed.nextHead.headId,
    range: byteRange(contract, 0, 1),
    replacementText: 'a',
  }));

  const reading = assertOk(graph.causalLineDiff({
    worldlineId: created.worldline.worldlineId,
    basisHeadId: created.head.headId,
    nextHeadId: reverted.nextHead.headId,
    maxByteCount: 10_000,
    maxLineCount: 100,
    maxRewriteCount: 100,
    maxMarkerCount: 100,
  }));

  assert.equal(reading.insertedLineCount, 0);
  assert.equal(reading.deletedLineCount, 0);
  assert.deepEqual(reading.markers, [{
    lineNumber: 0,
    kind: 'MODIFIED',
    tickReceiptIds: [changed.receipt.tickId, reverted.receipt.tickId],
    rewriteIds: [changed.rewrite.rewriteId, reverted.rewrite.rewriteId],
    diffIds: [changed.diff.diffId, reverted.diff.diffId],
  }]);
});

test('causal line diff refuses marker materialization beyond its deterministic bound', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:marker-limit',
    initialText: 'alpha\nbeta\n',
  }));
  const first = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 0, 1),
    replacementText: 'A',
  }));
  const second = assertOk(graph.replaceRangeAsTick({
    basisHeadId: first.nextHead.headId,
    range: byteRange(contract, 6, 7),
    replacementText: 'B',
  }));

  assert.deepEqual(graph.causalLineDiff({
    worldlineId: created.worldline.worldlineId,
    basisHeadId: created.head.headId,
    nextHeadId: second.nextHead.headId,
    maxByteCount: 10_000,
    maxLineCount: 100,
    maxRewriteCount: 100,
    maxMarkerCount: 1,
  }), {
    ok: false,
    code: runtime.GRAPH_ROPE_RUNTIME_OBSTRUCTION_LINE_DIFF_LIMIT_EXCEEDED,
  });
});

test('causal line diff shares its output bound across line and deletion markers', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:combined-marker-limit',
    initialText: 'alpha\nbeta\ngamma\n',
  }));
  const deleted = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 6, 11),
    replacementText: '',
  }));
  const modified = assertOk(graph.replaceRangeAsTick({
    basisHeadId: deleted.nextHead.headId,
    range: byteRange(contract, 6, 7),
    replacementText: 'G',
  }));

  assert.deepEqual(graph.causalLineDiff({
    worldlineId: created.worldline.worldlineId,
    basisHeadId: created.head.headId,
    nextHeadId: modified.nextHead.headId,
    maxByteCount: 10_000,
    maxLineCount: 100,
    maxRewriteCount: 100,
    maxMarkerCount: 1,
  }), {
    ok: false,
    code: runtime.GRAPH_ROPE_RUNTIME_OBSTRUCTION_LINE_DIFF_LIMIT_EXCEEDED,
  });
});

for (const scenario of [{
  name: 'at file start',
  startByte: 0,
  endByte: 11,
  boundaryLineNumber: 0,
}, {
  name: 'between surviving lines',
  startByte: 6,
  endByte: 17,
  boundaryLineNumber: 1,
}, {
  name: 'at file end',
  startByte: 11,
  endByte: 23,
  boundaryLineNumber: 2,
}]) {
  test(`causal line diff projects multi-line deletion ${scenario.name}`, async () => {
    const { runtime, contract } = await loadModules();
    const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
    const created = assertOk(graph.createBufferWorldline({
      worldlineId: `worldline:deletion-${scenario.boundaryLineNumber}`,
      initialText: 'alpha\nbeta\ngamma\ndelta\n',
    }));
    const deleted = assertOk(graph.replaceRangeAsTick({
      basisHeadId: created.head.headId,
      range: byteRange(contract, scenario.startByte, scenario.endByte),
      replacementText: '',
    }));

    const reading = assertOk(graph.causalLineDiff({
      worldlineId: created.worldline.worldlineId,
      basisHeadId: created.head.headId,
      nextHeadId: deleted.nextHead.headId,
      maxByteCount: 10_000,
      maxLineCount: 100,
      maxRewriteCount: 100,
      maxMarkerCount: 100,
    }));

    assert.deepEqual(reading.deletions, [{
      boundaryLineNumber: scenario.boundaryLineNumber,
      deletedLineCount: 2,
      tickReceiptIds: [deleted.receipt.tickId],
      rewriteIds: [deleted.rewrite.rewriteId],
      diffIds: [deleted.diff.diffId],
    }]);
  });
}

test('causal line diff reports deletion of an unterminated final line', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:unterminated-final-line',
    initialText: 'alpha\nomega',
  }));
  const deleted = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 6, 11),
    replacementText: '',
  }));

  const reading = assertOk(graph.causalLineDiff({
    worldlineId: created.worldline.worldlineId,
    basisHeadId: created.head.headId,
    nextHeadId: deleted.nextHead.headId,
    maxByteCount: 10_000,
    maxLineCount: 100,
    maxRewriteCount: 100,
    maxMarkerCount: 100,
  }));

  assert.deepEqual(reading.deletions, [{
    boundaryLineNumber: 1,
    deletedLineCount: 1,
    tickReceiptIds: [deleted.receipt.tickId],
    rewriteIds: [deleted.rewrite.rewriteId],
    diffIds: [deleted.diff.diffId],
  }]);
});

test('causal line diff does not report a partial unterminated final line as deleted', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:partial-unterminated-final-line',
    initialText: 'alpha\n😀omega',
  }));
  const deleted = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 10, 15),
    replacementText: '',
  }));

  const reading = assertOk(graph.causalLineDiff({
    worldlineId: created.worldline.worldlineId,
    basisHeadId: created.head.headId,
    nextHeadId: deleted.nextHead.headId,
    maxByteCount: 10_000,
    maxLineCount: 100,
    maxRewriteCount: 100,
    maxMarkerCount: 100,
  }));

  assert.deepEqual(reading.deletions, []);
});

for (const scenario of [{ name: 'carriage return', startByte: 5, endByte: 6 }, {
  name: 'line feed',
  startByte: 6,
  endByte: 7,
}]) {
  test(`causal line diff does not report a deleted line for a retained CRLF half: ${scenario.name}`, async () => {
    const { runtime, contract } = await loadModules();
    const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
    const created = assertOk(graph.createBufferWorldline({
      worldlineId: `worldline:split-crlf-${scenario.startByte}`,
      initialText: 'alpha\r\nbeta',
    }));
    const deleted = assertOk(graph.replaceRangeAsTick({
      basisHeadId: created.head.headId,
      range: byteRange(contract, scenario.startByte, scenario.endByte),
      replacementText: '',
    }));

    const reading = assertOk(graph.causalLineDiff({
      worldlineId: created.worldline.worldlineId,
      basisHeadId: created.head.headId,
      nextHeadId: deleted.nextHead.headId,
      maxByteCount: 10_000,
      maxLineCount: 100,
      maxRewriteCount: 100,
      maxMarkerCount: 100,
    }));

    assert.deepEqual(reading.deletions, []);
  });
}

test('causal line diff projects and coalesces deletion boundaries through later rewrites', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:projected-deletions',
    initialText: 'alpha\nbeta\ngamma\ndelta\n',
  }));
  const firstDeletion = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 6, 11),
    replacementText: '',
  }));
  const insertedPrefix = assertOk(graph.replaceRangeAsTick({
    basisHeadId: firstDeletion.nextHead.headId,
    range: byteRange(contract, 0, 0),
    replacementText: 'zero\n',
  }));
  const secondDeletion = assertOk(graph.replaceRangeAsTick({
    basisHeadId: insertedPrefix.nextHead.headId,
    range: byteRange(contract, 11, 17),
    replacementText: '',
  }));

  const reading = assertOk(graph.causalLineDiff({
    worldlineId: created.worldline.worldlineId,
    basisHeadId: created.head.headId,
    nextHeadId: secondDeletion.nextHead.headId,
    maxByteCount: 10_000,
    maxLineCount: 100,
    maxRewriteCount: 100,
    maxMarkerCount: 100,
  }));

  assert.deepEqual(reading.deletions, [{
    boundaryLineNumber: 2,
    deletedLineCount: 2,
    tickReceiptIds: [firstDeletion.receipt.tickId, secondDeletion.receipt.tickId],
    rewriteIds: [firstDeletion.rewrite.rewriteId, secondDeletion.rewrite.rewriteId],
    diffIds: [firstDeletion.diff.diffId, secondDeletion.diff.diffId],
  }]);
});

test('causal line diff bounds historical bytes read for deletion evidence', async () => {
  const { runtime, contract } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({
    worldlineId: 'worldline:deletion-byte-limit',
    initialText: 'a\nb\n',
  }));
  const firstDeletion = assertOk(graph.replaceRangeAsTick({
    basisHeadId: created.head.headId,
    range: byteRange(contract, 0, 2),
    replacementText: '',
  }));
  const firstInsertion = assertOk(graph.replaceRangeAsTick({
    basisHeadId: firstDeletion.nextHead.headId,
    range: byteRange(contract, 0, 0),
    replacementText: 'c\n',
  }));
  const secondDeletion = assertOk(graph.replaceRangeAsTick({
    basisHeadId: firstInsertion.nextHead.headId,
    range: byteRange(contract, 0, 2),
    replacementText: '',
  }));
  const secondInsertion = assertOk(graph.replaceRangeAsTick({
    basisHeadId: secondDeletion.nextHead.headId,
    range: byteRange(contract, 0, 0),
    replacementText: 'd\n',
  }));
  const thirdDeletion = assertOk(graph.replaceRangeAsTick({
    basisHeadId: secondInsertion.nextHead.headId,
    range: byteRange(contract, 0, 2),
    replacementText: '',
  }));

  assert.deepEqual(graph.causalLineDiff({
    worldlineId: created.worldline.worldlineId,
    basisHeadId: created.head.headId,
    nextHeadId: thirdDeletion.nextHead.headId,
    maxByteCount: 4,
    maxLineCount: 100,
    maxRewriteCount: 100,
    maxMarkerCount: 100,
  }), {
    ok: false,
    code: runtime.GRAPH_ROPE_RUNTIME_OBSTRUCTION_LINE_DIFF_LIMIT_EXCEEDED,
  });
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
    maxMarkerCount: 100,
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
    maxMarkerCount: 100,
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
    maxMarkerCount: 100,
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
    maxMarkerCount: 100,
  }), {
    ok: false,
    code: OBSTRUCTION_LINE_DIFF_LIMIT_EXCEEDED,
  });
});
