import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './workspace-helpers.mjs';

const BASIS_OLD = '1'.repeat(64);
const BASIS_REJECTED = '2'.repeat(64);
const BASIS_NEW = '3'.repeat(64);
const BASIS_MISSING = '4'.repeat(64);

test('WSC history listing exposes deterministic app-safe evidence records', async () => {
  const [history, ports] = await historyModules();
  const result = history.listJeditWscHistory(fakeStore({
    ids: [BASIS_NEW, BASIS_REJECTED, BASIS_OLD],
    envelopes: {
      [BASIS_OLD]: settlementPayload({ filePath: '/repo/a.txt', submittedAtMs: 10, receiptId: 'receipt:old' }),
      [BASIS_REJECTED]: rejectionPayload({ filePath: '/repo/a.txt', submittedAtMs: 20 }),
      [BASIS_NEW]: settlementPayload({ filePath: '/repo/a.txt', submittedAtMs: 30, receiptId: 'receipt:new' }),
    },
  }));

  assert.equal(result.status, ports.JEDIT_WSC_HISTORY_LISTED);
  assert.deepEqual(result.records.map((record) => record.basisId), [
    BASIS_OLD,
    BASIS_REJECTED,
    BASIS_NEW,
  ]);
  assert.deepEqual(result.records.map((record) => record.sequence), [1, 2, 3]);
  assert.equal(result.records[0].outcomeStatus, ports.JEDIT_WSC_HISTORY_APPLIED);
  assert.equal(result.records[0].evidencePosture, ports.JEDIT_WSC_HISTORY_SETTLEMENT_EVIDENCE);
  assert.equal(result.records[0].readingId, 'reading:/repo/a.txt:10');
  assert.equal(result.records[0].readingCoverage, 'full');
  assert.equal(result.records[0].readingReturnedLineCount, 1);
  assert.equal(result.records[0].readingTotalLineCount, 1);
  assert.equal(result.records[0].readingTruncated, false);
  assert.equal(result.records[0].exportEvidenceId, `wsc-current-export:${BASIS_OLD}:reading:/repo/a.txt:10`);
  assert.equal(result.records[1].outcomeStatus, ports.JEDIT_WSC_HISTORY_REJECTED);
  assert.equal(result.records[1].rejectionReason, 'stale causal basis');
  assert.equal(Object.hasOwn(result.records[0], 'workspacePath'), false);
  assert.deepEqual(result.files, [{
    filePath: '/repo/a.txt',
    recordCount: 3,
    appliedCount: 2,
    rejectedCount: 1,
    missingEvidenceCount: 0,
    latestBasisId: BASIS_NEW,
  }]);
});

test('WSC history listing keeps missing evidence explicit without trusted internals', async () => {
  const [history, ports] = await historyModules();
  const result = history.listJeditWscHistory(fakeStore({
    ids: [BASIS_OLD, BASIS_MISSING],
    envelopes: {
      [BASIS_OLD]: settlementPayload({ filePath: '/repo/a.txt', submittedAtMs: 10 }),
    },
    missingIds: new Set([BASIS_MISSING]),
  }));

  assert.equal(result.status, ports.JEDIT_WSC_HISTORY_LISTED);
  const missing = result.records[1];
  assert.equal(missing.basisId, BASIS_MISSING);
  assert.equal(missing.outcomeStatus, ports.JEDIT_WSC_HISTORY_MISSING_EVIDENCE);
  assert.equal(missing.evidencePosture, ports.JEDIT_WSC_HISTORY_READ_OBSTRUCTED_EVIDENCE);
  assert.equal(missing.obstructionCode, 'missing_envelope');
  assert.equal(Object.hasOwn(missing, 'workspacePath'), false);
});

test('WSC history listing can isolate one file from retained multi-file history', async () => {
  const [history, ports] = await historyModules();
  const store = fakeStore({
    ids: [BASIS_OLD, BASIS_NEW],
    envelopes: {
      [BASIS_OLD]: settlementPayload({ filePath: '/repo/a.txt', submittedAtMs: 10 }),
      [BASIS_NEW]: settlementPayload({ filePath: '/repo/b.txt', submittedAtMs: 20 }),
    },
  });

  const all = history.listJeditWscHistory(store);
  const fileA = history.listJeditWscHistoryForFile(store, '/repo/a.txt');

  assert.equal(all.status, ports.JEDIT_WSC_HISTORY_LISTED);
  assert.equal(all.files.length, 2);
  assert.equal(fileA.status, ports.JEDIT_WSC_HISTORY_LISTED);
  assert.deepEqual(fileA.records.map((record) => record.filePath), ['/repo/a.txt']);
  assert.deepEqual(fileA.files.map((summary) => summary.filePath), ['/repo/a.txt']);
});

test('WSC history listing displays bounded reading evidence without export claim', async () => {
  const [history, ports] = await historyModules();
  const result = history.listJeditWscHistory(fakeStore({
    ids: [BASIS_OLD],
    envelopes: {
      [BASIS_OLD]: settlementPayload({
        filePath: '/repo/a.txt',
        submittedAtMs: 10,
        reading: {
          coverage: 'window',
          returnedLineCount: 1,
          totalLineCount: 2,
          hasMoreAfter: true,
        },
      }),
    },
  }));

  assert.equal(result.status, ports.JEDIT_WSC_HISTORY_LISTED);
  assert.equal(result.records[0].readingCoverage, 'window');
  assert.equal(result.records[0].readingReturnedLineCount, 1);
  assert.equal(result.records[0].readingTotalLineCount, 2);
  assert.equal(result.records[0].readingTruncated, false);
  assert.equal(result.records[0].evidencePosture, ports.JEDIT_WSC_HISTORY_SETTLEMENT_EVIDENCE);
});

async function historyModules() {
  return Promise.all([
    importDist('app', 'jedit-wsc-history-listing.js'),
    importDist('ports', 'jedit-wsc-history-listing.js'),
  ]);
}

function fakeStore(options) {
  return {
    writeEnvelope: () => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED',
      obstruction: { code: 'read_only_test_store', message: 'history listing is read-only' },
    }),
    readEnvelope: (envelopeId) => readEnvelope(options, envelopeId),
    listEnvelopes: () => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_LISTED',
      envelopeIds: options.ids,
    }),
  };
}

function readEnvelope(options, envelopeId) {
  if (options.missingIds?.has(envelopeId)) {
    return {
      status: 'JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED',
      obstruction: { code: 'missing_envelope', message: 'missing WSC envelope', envelopeId },
    };
  }
  return {
    status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
    envelope: { envelopeId, bytes: encodedPayload(options.envelopes[envelopeId]) },
    workspacePath: '/repo/.jedit/echo-wsc/envelopes',
  };
}

function settlementPayload(overrides) {
  const filePath = overrides.filePath;
  const submittedAtMs = overrides.submittedAtMs;
  return {
    schemaVersion: 'jedit.workspace_text_edit_settlement.v1',
    filePath,
    bufferId: `buffer:${filePath}`,
    commandKind: 'replaceTextRange',
    submittedAtMs,
    receiptId: overrides.receiptId ?? `receipt:${filePath}:${String(submittedAtMs)}`,
    checkpointId: `checkpoint:${filePath}:${String(submittedAtMs)}`,
    submissionId: `submission:${filePath}:${String(submittedAtMs)}`,
    admissionId: `admission:${filePath}:${String(submittedAtMs)}`,
    ticketId: `ticket:${filePath}:${String(submittedAtMs)}`,
    executionId: `execution:${filePath}:${String(submittedAtMs)}`,
    reading: {
      readingId: `reading:${filePath}:${String(submittedAtMs)}`,
      lines: [`${filePath} at ${String(submittedAtMs)}`],
      coverage: overrides.reading?.coverage ?? 'full',
      lineCount: 1,
      startLine: 0,
      returnedLineCount: overrides.reading?.returnedLineCount ?? 1,
      totalLineCount: overrides.reading?.totalLineCount ?? 1,
      hasMoreBefore: false,
      hasMoreAfter: overrides.reading?.hasMoreAfter ?? false,
      cursorLine: 0,
      viewportLineCount: 1,
      truncated: false,
    },
  };
}

function rejectionPayload(overrides) {
  return {
    schemaVersion: 'jedit.workspace_text_edit_rejection.v1',
    filePath: overrides.filePath,
    bufferId: `buffer:${overrides.filePath}`,
    commandKind: 'replaceTextRange',
    submittedAtMs: overrides.submittedAtMs,
    receiptId: `receipt:rejected:${overrides.filePath}`,
    rejectionReason: 'stale causal basis',
  };
}

function encodedPayload(payload) {
  return new TextEncoder().encode(JSON.stringify(payload));
}
