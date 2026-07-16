import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './workspace-helpers.mjs';

test('causal gutter execution readings correlate applied lines with retained tick receipts', async () => {
  const projection = await importDist('app', 'workspace', 'workspace-source-projection.js');
  const model = modelWithAuthority({
    kind: 'opened',
    cache: { projection: { basisHeadId: 'head:next' } },
    durability: {
      causal: {
        kind: 'admitted',
        headId: 'head:next',
        admittedTickId: 'tick:latest',
        receiptId: 'receipt:echo:latest',
      },
      file: { kind: 'saved', basisHeadId: 'head:basis' },
      lineChanges: {
        kind: 'available',
        source: 'causal-observation',
        basisHeadId: 'head:basis',
        nextHeadId: 'head:next',
        insertedLineCount: 0,
        deletedLineCount: 0,
        tickReceiptIds: ['tick:earlier', 'tick:latest'],
        rewriteIds: ['rewrite:earlier', 'rewrite:latest'],
        diffIds: ['diff:earlier', 'diff:latest'],
        markers: [{
          lineNumber: 1,
          kind: 'MODIFIED',
          tickReceiptIds: ['tick:earlier', 'tick:latest'],
          rewriteIds: ['rewrite:earlier', 'rewrite:latest'],
          diffIds: ['diff:earlier', 'diff:latest'],
        }],
        deletions: [],
        observerVersion: 'test-fixture',
      },
    },
  });

  assert.deepEqual(projection.sourceGutterExecutionReadings(model), [{
    lineNumber: 1,
    markerKind: 'modified',
    posture: 'applied',
    basisHeadId: 'head:basis',
    nextHeadId: 'head:next',
    tickReceiptIds: ['tick:earlier', 'tick:latest'],
    rewriteIds: ['rewrite:earlier', 'rewrite:latest'],
    diffIds: ['diff:earlier', 'diff:latest'],
    receiptId: 'receipt:echo:latest',
  }]);
  assert.deepEqual(projection.sourceGutterLineMarkers(model), [{
    lineNumber: 1,
    kind: 'modified',
  }]);
  assert.deepEqual(projection.causalSourceGutterLineMarkers(model), [{
    lineNumber: 1,
    kind: 'modified',
  }]);
});

test('causal gutter execution readings distinguish pending proposals from causal history', async () => {
  const projection = await importDist('app', 'workspace', 'workspace-source-projection.js');
  const target = commandTarget();
  const model = modelWithAuthority({
    kind: 'opened',
    pendingClientSeq: 7,
    pendingIntentStatus: 'submitted',
    pendingCommandEvent: plannedCommandEvent(7, target),
    durability: unavailableDurability(),
  });

  assert.deepEqual(projection.sourceGutterExecutionReadings(model), [{
    lineNumber: 2,
    markerKind: 'pending',
    posture: 'pending',
    clientSeq: 7,
    eventId: 'event:7',
    target,
    tickReceiptIds: [],
    rewriteIds: [],
    diffIds: [],
  }]);
  assert.deepEqual(projection.sourceGutterLineMarkers(model), [{
    lineNumber: 2,
    kind: 'pending',
  }]);
});

test('causal gutter execution readings expose an obstructed proposal without minting Echo identity', async () => {
  const projection = await importDist('app', 'workspace', 'workspace-source-projection.js');
  const target = commandTarget();
  const model = modelWithAuthority({
    kind: 'opened',
    pendingClientSeq: 7,
    pendingIntentStatus: 'obstructed',
    pendingCommandEvent: plannedCommandEvent(7, target),
    blockedByClientSeq: 7,
    lastObstruction: { message: 'basis moved before admission' },
    durability: unavailableDurability(),
  });

  assert.deepEqual(projection.sourceGutterExecutionReadings(model), [{
    lineNumber: 2,
    markerKind: 'obstructed',
    posture: 'obstructed',
    clientSeq: 7,
    blockerClientSeq: 7,
    eventId: 'event:7',
    target,
    obstructionMessage: 'basis moved before admission',
    tickReceiptIds: [],
    rewriteIds: [],
    diffIds: [],
  }]);
  assert.equal('receiptId' in projection.sourceGutterExecutionReadings(model)[0], false);
});

test('transient posture withholds stale causal coordinates while optimistic text is visible', async () => {
  const projection = await importDist('app', 'workspace', 'workspace-source-projection.js');
  const target = commandTarget();
  const model = modelWithAuthority({
    kind: 'opened',
    cache: { projection: { basisHeadId: 'head:next' } },
    pendingClientSeq: 7,
    pendingIntentStatus: 'submitted',
    pendingCommandEvent: plannedCommandEvent(7, target),
    durability: availableDurability({
      lineNumber: 2,
      kind: 'MODIFIED',
      tickReceiptIds: ['tick:applied'],
      rewriteIds: ['rewrite:applied'],
      diffIds: ['diff:applied'],
    }),
  });

  assert.deepEqual(
    projection.sourceGutterExecutionReadings(model).map(reading => reading.posture),
    ['pending'],
  );
  assert.deepEqual(projection.sourceGutterLineMarkers(model), [{ lineNumber: 2, kind: 'pending' }]);
});

test('causal gutter refuses applied markers without retained tick receipt support', async () => {
  const projection = await importDist('app', 'workspace', 'workspace-source-projection.js');
  const model = modelWithAuthority({
    kind: 'opened',
    cache: { projection: { basisHeadId: 'head:next' } },
    durability: availableDurability({
      lineNumber: 1,
      kind: 'MODIFIED',
      tickReceiptIds: [],
      rewriteIds: ['rewrite:unsupported'],
      diffIds: ['diff:unsupported'],
    }, [{
      boundaryLineNumber: 1,
      deletedLineCount: 1,
      tickReceiptIds: [],
      rewriteIds: ['rewrite:unsupported'],
      diffIds: ['diff:unsupported'],
    }]),
  });

  assert.deepEqual(projection.sourceGutterExecutionReadings(model), []);
  assert.deepEqual(projection.sourceGutterLineMarkers(model), []);
  assert.deepEqual(projection.causalSourceGutterLineMarkers(model), []);
  assert.deepEqual(projection.causalSourceGutterDeletionMarkers(model), []);
});

test('causal gutter refuses marker receipt IDs outside the bounded reading support', async () => {
  const projection = await importDist('app', 'workspace', 'workspace-source-projection.js');
  const model = modelWithAuthority({
    kind: 'opened',
    cache: { projection: { basisHeadId: 'head:next' } },
    durability: availableDurability({
      lineNumber: 1,
      kind: 'MODIFIED',
      tickReceiptIds: ['tick:forged'],
      rewriteIds: ['rewrite:unsupported'],
      diffIds: ['diff:unsupported'],
    }, [], ['tick:retained']),
  });

  assert.deepEqual(projection.sourceGutterExecutionReadings(model), []);
  assert.deepEqual(projection.causalSourceGutterLineMarkers(model), []);
});

test('transient gutter posture refuses to guess a line without planned command evidence', async () => {
  const projection = await importDist('app', 'workspace', 'workspace-source-projection.js');
  const model = modelWithAuthority({
    kind: 'opened',
    pendingClientSeq: 7,
    pendingIntentStatus: 'submitted',
    durability: unavailableDurability(),
  });

  assert.deepEqual(projection.sourceGutterExecutionReadings(model), []);
  assert.deepEqual(projection.sourceGutterLineMarkers(model), []);
});

function modelWithAuthority(textAuthority) {
  return {
    editor: { cursorRow: 4 },
    causalGutterBasis: { kind: 'last-save' },
    textAuthority,
  };
}

function unavailableDurability() {
  return {
    causal: { kind: 'unavailable' },
    file: { kind: 'unknown' },
    lineChanges: { kind: 'unavailable', reason: 'observation-pending' },
  };
}

function availableDurability(marker, deletions = [], tickReceiptIds = marker.tickReceiptIds) {
  return {
    causal: { kind: 'admitted', headId: 'head:next' },
    file: { kind: 'saved', basisHeadId: 'head:basis' },
    lineChanges: {
      kind: 'available',
      source: 'causal-observation',
      basisHeadId: 'head:basis',
      nextHeadId: 'head:next',
      insertedLineCount: 0,
      deletedLineCount: deletions.reduce((count, deletion) => count + deletion.deletedLineCount, 0),
      tickReceiptIds,
      rewriteIds: [...marker.rewriteIds],
      diffIds: [...marker.diffIds],
      markers: [marker],
      deletions,
      observerVersion: 'test-fixture',
    },
  };
}

function plannedCommandEvent(requestId, target) {
  return {
    requestId,
    event: {
      eventId: `event:${requestId}`,
      result: { cursorRow: 2 },
      target,
    },
  };
}

function commandTarget() {
  return {
    basisDigest: 'basis:command',
    kind: 'motion',
    rangeStart: 6,
    rangeEnd: 10,
    shape: 'characterwise',
  };
}
