import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './workspace-helpers.mjs';

const BASIS_A = 'a'.repeat(64);
const BASIS_B = 'b'.repeat(64);
const BASIS_C = 'c'.repeat(64);
const BASIS_D = 'd'.repeat(64);

test('WSC history listing includes app-safe evidence refs in stable causal order', async () => {
  const [listing, ports] = await listingModules();
  const result = listing.listJeditWscHistoryEvidence(fakeStore({
    envelopeIds: [BASIS_B, BASIS_A],
    readEnvelope: (basisId) => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
      envelope: {
        envelopeId: basisId,
        bytes: settlementBytes({
          filePath: `/repo/${basisId === BASIS_A ? 'a' : 'b'}.txt`,
          commandKind: 'replace_range',
          submittedAtMs: basisId === BASIS_A ? 10 : 20,
          receiptId: `receipt:${basisId}`,
          reading: {
            readingId: `reading:${basisId}`,
            lineCount: basisId === BASIS_A ? 1 : 2,
          },
        }),
      },
      workspacePath: '/repo/.jedit/echo-wsc/envelopes',
    }),
  }));

  assert.equal(result.status, ports.JEDIT_WSC_HISTORY_LISTED);
  assert.deepEqual(result.entries.map((entry) => [
    entry.sequence,
    entry.basisId,
    entry.submittedAtMs,
    entry.filePath,
    entry.lineCount,
  ]), [
    [1, BASIS_A, 10, '/repo/a.txt', 1],
    [2, BASIS_B, 20, '/repo/b.txt', 2],
  ]);
  assert.equal(result.entries[0].refs.submission.status, ports.JEDIT_WSC_HISTORY_EVIDENCE_DERIVED);
  assert.equal(result.entries[0].refs.submission.id, `wsc-submission:${BASIS_A}`);
  assert.equal(result.entries[0].refs.outcome.id, `wsc-outcome:applied:receipt:${BASIS_A}`);
  assert.equal(result.entries[0].refs.receipt.id, `receipt:${BASIS_A}`);
  assert.equal(result.entries[0].refs.reading.id, `reading:${BASIS_A}`);
  assert.equal(result.entries[0].refs.checkpoint.status, ports.JEDIT_WSC_HISTORY_EVIDENCE_MISSING);
  assert.equal(result.entries[0].refs.export.status, ports.JEDIT_WSC_HISTORY_EVIDENCE_MISSING);
});

test('WSC history listing tie-breaks same-time entries by bytewise basis id', async () => {
  const [listing, ports] = await listingModules();
  const originalLocaleCompare = String.prototype.localeCompare;
  try {
    String.prototype.localeCompare = function reverseLocaleCompare(other) {
      return originalLocaleCompare.call(String(other), String(this));
    };
    const result = listing.listJeditWscHistoryEvidence(fakeStore({
      envelopeIds: [BASIS_B, BASIS_A],
      readEnvelope: (basisId) => ({
        status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
        envelope: {
          envelopeId: basisId,
          bytes: settlementBytes({
            submittedAtMs: 10,
            receiptId: `receipt:${basisId}`,
            reading: { readingId: `reading:${basisId}` },
          }),
        },
        workspacePath: '/repo/.jedit/echo-wsc/envelopes',
      }),
    }));

    assert.equal(result.status, ports.JEDIT_WSC_HISTORY_LISTED);
    assert.deepEqual(result.entries.map((entry) => entry.basisId), [BASIS_A, BASIS_B]);
  } finally {
    String.prototype.localeCompare = originalLocaleCompare;
  }
});

test('WSC history listing makes missing evidence explicit', async () => {
  const [listing, ports] = await listingModules();
  const result = listing.listJeditWscHistoryEvidence(fakeStore({
    envelopeIds: [BASIS_A],
    readEnvelope: () => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
      envelope: {
        envelopeId: BASIS_A,
        bytes: settlementBytes({
          filePath: '/repo/missing.txt',
          commandKind: 'replace_range',
          submittedAtMs: 30,
        }),
      },
      workspacePath: '/repo/.jedit/echo-wsc/envelopes',
    }),
  }));

  assert.equal(result.status, ports.JEDIT_WSC_HISTORY_LISTED);
  const [entry] = result.entries;
  assert.equal(entry.refs.receipt.status, ports.JEDIT_WSC_HISTORY_EVIDENCE_MISSING);
  assert.equal(entry.refs.receipt.reason, ports.JEDIT_WSC_HISTORY_MISSING_RECEIPT);
  assert.equal(entry.refs.reading.reason, ports.JEDIT_WSC_HISTORY_MISSING_READING);
  assert.equal(entry.refs.checkpoint.reason, ports.JEDIT_WSC_HISTORY_MISSING_CHECKPOINT);
  assert.equal(entry.refs.export.reason, ports.JEDIT_WSC_HISTORY_MISSING_EXPORT);
});

test('WSC history listing supports checkpoint and export refs when retained', async () => {
  const [listing, ports] = await listingModules();
  const result = listing.listJeditWscHistoryEvidence(fakeStore({
    envelopeIds: [BASIS_A],
    readEnvelope: () => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
      envelope: {
        envelopeId: BASIS_A,
        bytes: settlementBytes({
          submittedAtMs: 40,
          receiptId: 'receipt:40',
          reading: { readingId: 'reading:40' },
          checkpoint: { checkpointId: 'checkpoint:40' },
          export: { exportEvidenceId: 'wsc-current-export:40' },
        }),
      },
      workspacePath: '/repo/.jedit/echo-wsc/envelopes',
    }),
  }));

  assert.equal(result.status, ports.JEDIT_WSC_HISTORY_LISTED);
  const [entry] = result.entries;
  assert.equal(entry.refs.checkpoint.status, ports.JEDIT_WSC_HISTORY_EVIDENCE_AVAILABLE);
  assert.equal(entry.refs.checkpoint.id, 'checkpoint:40');
  assert.equal(entry.refs.export.id, 'wsc-current-export:40');
});

test('WSC history listing records unsupported and malformed envelopes without raw bytes', async () => {
  const [listing, ports] = await listingModules();
  const result = listing.listJeditWscHistoryEvidence(fakeStore({
    envelopeIds: [BASIS_C, BASIS_D],
    readEnvelope: (basisId) => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
      envelope: {
        envelopeId: basisId,
        bytes: basisId === BASIS_C
          ? new TextEncoder().encode('{')
          : new TextEncoder().encode(JSON.stringify({ schemaVersion: 'other.v1' })),
      },
      workspacePath: '/repo/.jedit/echo-wsc/envelopes',
    }),
  }));

  assert.equal(result.status, ports.JEDIT_WSC_HISTORY_LISTED);
  assert.deepEqual(result.entries.map((entry) => [entry.basisId, entry.eventKind]), [
    [BASIS_C, ports.JEDIT_WSC_HISTORY_EVENT_UNSUPPORTED_ENVELOPE],
    [BASIS_D, ports.JEDIT_WSC_HISTORY_EVENT_UNSUPPORTED_ENVELOPE],
  ]);
  assert.equal(result.entries[0].refs.receipt.status, ports.JEDIT_WSC_HISTORY_EVIDENCE_UNSUPPORTED);
  assert.equal(result.entries[0].refs.receipt.reason, ports.JEDIT_WSC_HISTORY_MALFORMED_ENVELOPE);
  assert.equal(result.entries[1].refs.receipt.reason, ports.JEDIT_WSC_HISTORY_UNSUPPORTED_SCHEMA);
});

test('WSC history listing renders deterministic app-safe text output', async () => {
  const [listing] = await listingModules();
  const result = listing.listJeditWscHistoryEvidence(fakeStore({
    envelopeIds: [BASIS_A],
    readEnvelope: () => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
      envelope: {
        envelopeId: BASIS_A,
        bytes: settlementBytes({
          filePath: '/repo/render.txt',
          commandKind: 'replace_range',
          submittedAtMs: 50,
          receiptId: 'receipt:50',
          reading: { readingId: 'reading:50' },
        }),
      },
      workspacePath: '/repo/.jedit/echo-wsc/envelopes',
    }),
  }));
  const lines = listing.renderJeditWscHistoryListingLines(result);

  assert.match(lines[0], /^seq  submittedAt  event/);
  assert.match(lines[1], /1  50  edit_settlement  replace_range  \/repo\/render\.txt/);
  assert.match(lines[1], /derived:wsc-submission:/);
  assert.match(lines[1], /available:receipt:50/);
  assert.match(lines[1], /missing:missing_checkpoint_ref/);
});

test('WSC history listing maps missing retained material to typed obstruction', async () => {
  const [listing, ports] = await listingModules();
  const result = listing.listJeditWscHistoryEvidence(fakeStore({
    envelopeIds: [BASIS_A],
    readEnvelope: () => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED',
      obstruction: {
        code: 'missing_envelope',
        message: 'missing WSC envelope',
        envelopeId: BASIS_A,
      },
    }),
  }));

  assert.equal(result.status, ports.JEDIT_WSC_HISTORY_LIST_OBSTRUCTED);
  assert.equal(result.obstruction.code, ports.JEDIT_WSC_HISTORY_WSC_STORE_OBSTRUCTED);
  assert.equal(result.obstruction.envelopeId, BASIS_A);
  assert.deepEqual(
    listing.renderJeditWscHistoryListingLines(result),
    [
      'status  code  envelope  message',
      `obstructed  wsc_store_obstructed  ${BASIS_A}  missing WSC envelope`,
    ],
  );
});

async function listingModules() {
  return Promise.all([
    importDist('app', 'jedit-wsc-history-listing.js'),
    importDist('ports', 'jedit-wsc-history-listing.js'),
  ]);
}

function fakeStore(overrides) {
  return {
    writeEnvelope: () => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED',
      obstruction: {
        code: 'host_path_error',
        message: 'read-only test store',
      },
    }),
    readEnvelope: overrides.readEnvelope,
    listEnvelopes: () => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_LISTED',
      envelopeIds: overrides.envelopeIds,
      workspacePath: '/repo/.jedit/echo-wsc/envelopes',
    }),
  };
}

function settlementBytes(payload) {
  return new TextEncoder().encode(JSON.stringify({
    schemaVersion: 'jedit.workspace_text_edit_settlement.v1',
    ...payload,
  }));
}
