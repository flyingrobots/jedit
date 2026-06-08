import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './workspace-helpers.mjs';

const BASIS_A = 'a'.repeat(64);
const BASIS_B = 'b'.repeat(64);
const BASIS_C = 'c'.repeat(64);

test('WSC history replay matches semantic identity while ignoring timing and diagnostics', async () => {
  const [replay, ports] = await replayModules();
  const result = replay.proveJeditWscHistoryReplay({
    firstStore: fakeStore([
      envelope(BASIS_A, settlement({
        submittedAtMs: 100,
        diagnosticProse: 'first run only',
      })),
    ]),
    secondStore: fakeStore([
      envelope(BASIS_B, settlement({
        submittedAtMs: 900,
        diagnosticProse: 'second run only',
      })),
    ]),
  });

  assert.equal(result.status, ports.JEDIT_WSC_HISTORY_REPLAY_MATCH);
  assert.equal(result.wallClockCadenceSemantic, false);
  assert.equal(result.diagnosticProseSemantic, false);
  assert.equal(result.first.entries[0].receiptId, 'receipt:stable');
  assert.equal(result.second.entries[0].readingId, 'reading:stable');
});

test('WSC history replay sorts semantic entries independently from retained envelope order', async () => {
  const [replay, ports] = await replayModules();
  const first = fakeStore([
    envelope(BASIS_B, settlement({ filePath: '/repo/b.txt', receiptId: 'receipt:b', readingId: 'reading:b' })),
    envelope(BASIS_A, settlement({ filePath: '/repo/a.txt', receiptId: 'receipt:a', readingId: 'reading:a' })),
  ]);
  const second = fakeStore([
    envelope(BASIS_A, settlement({ filePath: '/repo/a.txt', receiptId: 'receipt:a', readingId: 'reading:a' })),
    envelope(BASIS_B, settlement({ filePath: '/repo/b.txt', receiptId: 'receipt:b', readingId: 'reading:b' })),
  ]);

  const result = replay.proveJeditWscHistoryReplay({ firstStore: first, secondStore: second });

  assert.equal(result.status, ports.JEDIT_WSC_HISTORY_REPLAY_MATCH);
  assert.deepEqual(result.first.entries.map((entry) => entry.filePath), ['/repo/a.txt', '/repo/b.txt']);
});

test('WSC history replay reports typed receipt mismatch', async () => {
  const [replay, ports] = await replayModules();
  const result = replay.proveJeditWscHistoryReplay({
    firstStore: fakeStore([
      envelope(BASIS_A, settlement({ receiptId: 'receipt:first' })),
    ]),
    secondStore: fakeStore([
      envelope(BASIS_B, settlement({ receiptId: 'receipt:second' })),
    ]),
  });

  assert.equal(result.status, ports.JEDIT_WSC_HISTORY_REPLAY_MISMATCH);
  assert.equal(result.mismatch.path, 'entries[0].receiptId');
  assert.equal(result.mismatch.firstValue, 'receipt:first');
  assert.equal(result.mismatch.secondValue, 'receipt:second');
});

test('WSC history replay reports typed reading mismatch', async () => {
  const [replay, ports] = await replayModules();
  const result = replay.proveJeditWscHistoryReplay({
    firstStore: fakeStore([
      envelope(BASIS_A, settlement({ readingId: 'reading:first' })),
    ]),
    secondStore: fakeStore([
      envelope(BASIS_B, settlement({ readingId: 'reading:second' })),
    ]),
  });

  assert.equal(result.status, ports.JEDIT_WSC_HISTORY_REPLAY_MISMATCH);
  assert.equal(result.mismatch.path, 'entries[0].readingId');
});

test('WSC history replay reports entry count mismatch', async () => {
  const [replay, ports] = await replayModules();
  const result = replay.proveJeditWscHistoryReplay({
    firstStore: fakeStore([
      envelope(BASIS_A, settlement({})),
      envelope(BASIS_B, settlement({ filePath: '/repo/second.txt' })),
    ]),
    secondStore: fakeStore([
      envelope(BASIS_A, settlement({})),
    ]),
  });

  assert.equal(result.status, ports.JEDIT_WSC_HISTORY_REPLAY_MISMATCH);
  assert.equal(result.mismatch.path, 'entries.length');
  assert.equal(result.mismatch.firstValue, '2');
  assert.equal(result.mismatch.secondValue, '1');
});

test('WSC history replay reports malformed retained history as obstruction', async () => {
  const [replay, ports] = await replayModules();
  const result = replay.proveJeditWscHistoryReplay({
    firstStore: fakeStore([
      {
        envelopeId: BASIS_C,
        bytes: new TextEncoder().encode('{'),
      },
    ]),
    secondStore: fakeStore([
      envelope(BASIS_A, settlement({})),
    ]),
  });

  assert.equal(result.status, ports.JEDIT_WSC_HISTORY_REPLAY_OBSTRUCTED);
  assert.equal(result.obstruction.code, ports.JEDIT_WSC_REPLAY_MALFORMED_ENVELOPE);
  assert.equal(result.obstruction.envelopeId, BASIS_C);
});

test('WSC history replay maps missing retained material to store obstruction', async () => {
  const [replay, ports] = await replayModules();
  const result = replay.proveJeditWscHistoryReplay({
    firstStore: {
      writeEnvelope: () => obstructedWrite(),
      listEnvelopes: () => listed([BASIS_A]),
      readEnvelope: () => ({
        status: 'JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED',
        obstruction: {
          code: 'missing_envelope',
          message: 'missing retained WSC envelope',
          envelopeId: BASIS_A,
        },
      }),
    },
    secondStore: fakeStore([
      envelope(BASIS_A, settlement({})),
    ]),
  });

  assert.equal(result.status, ports.JEDIT_WSC_HISTORY_REPLAY_OBSTRUCTED);
  assert.equal(result.obstruction.code, ports.JEDIT_WSC_REPLAY_WSC_STORE_OBSTRUCTED);
  assert.equal(result.obstruction.envelopeId, BASIS_A);
});

async function replayModules() {
  return Promise.all([
    importDist('app', 'jedit-wsc-history-replay.js'),
    importDist('ports', 'jedit-wsc-history-replay.js'),
  ]);
}

function fakeStore(envelopes) {
  const byId = new Map(envelopes.map((item) => [item.envelopeId, item]));
  return {
    writeEnvelope: () => obstructedWrite(),
    listEnvelopes: () => listed(envelopes.map((item) => item.envelopeId)),
    readEnvelope: (envelopeId) => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
      envelope: byId.get(envelopeId),
      workspacePath: '/repo/.jedit/echo-wsc/envelopes',
    }),
  };
}

function listed(envelopeIds) {
  return {
    status: 'JEDIT_WSC_WORKSPACE_STORE_LISTED',
    envelopeIds,
    workspacePath: '/repo/.jedit/echo-wsc/envelopes',
  };
}

function obstructedWrite() {
  return {
    status: 'JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED',
    obstruction: {
      code: 'host_path_error',
      message: 'read-only replay fixture',
    },
  };
}

function envelope(envelopeId, bytes) {
  return {
    envelopeId,
    bytes,
  };
}

function settlement(overrides) {
  return new TextEncoder().encode(JSON.stringify({
    schemaVersion: 'jedit.workspace_text_edit_settlement.v1',
    filePath: '/repo/notes.txt',
    bufferId: 'buffer:notes',
    commandKind: 'replace',
    range: {
      startByte: 0,
      endByte: 0,
      insertText: 'hello replay',
    },
    submittedAtMs: 100,
    receiptId: 'receipt:stable',
    reading: {
      readingId: 'reading:stable',
      lines: ['hello replay'],
      lineCount: 1,
      cursorLine: 0,
      viewportLineCount: 24,
      truncated: false,
    },
    aperture: {
      cursorLine: 0,
      viewportLineCount: 24,
      beforeLines: 0,
      afterLines: 0,
      maxBytes: 4096,
    },
    ...overrides,
    reading: {
      readingId: overrides.readingId ?? 'reading:stable',
      lines: overrides.lines ?? ['hello replay'],
      lineCount: 1,
      cursorLine: 0,
      viewportLineCount: 24,
      truncated: false,
    },
  }));
}
