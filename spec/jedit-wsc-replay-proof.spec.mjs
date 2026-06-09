import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './workspace-helpers.mjs';

const BASIS_A = 'a'.repeat(64);
const BASIS_B = 'b'.repeat(64);
const BASIS_C = 'c'.repeat(64);
const BASIS_D = 'd'.repeat(64);

test('WSC replay proof matches same semantic edits across host timing permutations', async () => {
  const [history, replay, ports] = await replayModules();
  const first = history.listJeditWscHistory(fakeStore({
    [BASIS_A]: settlementPayload({ submittedAtMs: 10 }),
    [BASIS_B]: rejectionPayload({ submittedAtMs: 20 }),
  }));
  const second = history.listJeditWscHistory(fakeStore({
    [BASIS_C]: settlementPayload({ submittedAtMs: 110 }),
    [BASIS_D]: rejectionPayload({ submittedAtMs: 120 }),
  }));

  const proof = replay.proveJeditWscReplay(first, second);

  assert.equal(proof.status, ports.JEDIT_WSC_REPLAY_MATCH);
  assert.equal(proof.wallClockCadenceSemantic, false);
  assert.notEqual(first.records[0].basisId, second.records[0].basisId);
  assert.equal(proof.first[0].readingTextDigest, proof.second[0].readingTextDigest);
});

test('WSC replay proof reports the divergent semantic evidence coordinate', async () => {
  const [history, replay, ports] = await replayModules();
  const first = history.listJeditWscHistory(fakeStore({
    [BASIS_A]: settlementPayload({ lines: ['same'] }),
  }));
  const second = history.listJeditWscHistory(fakeStore({
    [BASIS_B]: settlementPayload({ lines: ['changed'] }),
  }));

  const proof = replay.proveJeditWscReplay(first, second);

  assert.equal(proof.status, ports.JEDIT_WSC_REPLAY_MISMATCH);
  assert.equal(proof.mismatchCoordinate, 'history[0].readingTextDigest');
});

test('WSC replay closeout covers retained DIND coordinates and non-applied outcomes', async () => {
  const [history, replay, ports] = await replayModules();
  const listed = history.listJeditWscHistory(fakeStore({
    [BASIS_A]: settlementPayload({ submittedAtMs: 10 }),
    [BASIS_B]: rejectionPayload({ submittedAtMs: 20 }),
  }));

  const closeout = replay.jeditWscReplayCloseout(listed);

  assert.equal(closeout.status, ports.JEDIT_WSC_REPLAY_CLOSEOUT_READY);
  assert.deepEqual(closeout.coveredStages, [
    'submission',
    'admission',
    'ticket',
    'execution',
    'receipt',
    'reading',
    'retention',
    'export',
  ]);
  assert.equal(closeout.nonAppliedOutcomeCount, 1);
  assert.equal(closeout.evidenceCoordinates[0].exportEvidenceId, `wsc-current-export:${BASIS_A}:reading:semantic`);
  assert.equal(closeout.deterministicOnCleanCheckout, true);
});

async function replayModules() {
  return Promise.all([
    importDist('app', 'jedit-wsc-history-listing.js'),
    importDist('app', 'jedit-wsc-replay-proof.js'),
    importDist('ports', 'jedit-wsc-replay-proof.js'),
  ]);
}

function fakeStore(payloadsByEnvelopeId) {
  const ids = Object.keys(payloadsByEnvelopeId);
  return {
    writeEnvelope: () => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED',
      obstruction: { code: 'read_only_test_store', message: 'replay proof is read-only' },
    }),
    readEnvelope: (envelopeId) => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
      envelope: {
        envelopeId,
        bytes: new TextEncoder().encode(JSON.stringify(payloadsByEnvelopeId[envelopeId])),
      },
      workspacePath: '/repo/.jedit/echo-wsc/envelopes',
    }),
    listEnvelopes: () => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_LISTED',
      envelopeIds: ids,
    }),
  };
}

function settlementPayload(overrides = {}) {
  return {
    schemaVersion: 'jedit.workspace_text_edit_settlement.v1',
    filePath: '/repo/a.txt',
    bufferId: 'buffer:a',
    commandKind: 'replaceTextRange',
    submittedAtMs: overrides.submittedAtMs ?? 10,
    receiptId: 'receipt:semantic',
    checkpointId: 'checkpoint:semantic',
    submissionId: 'submission:semantic',
    admissionId: 'admission:semantic',
    ticketId: 'ticket:semantic',
    executionId: 'execution:semantic',
    reading: {
      readingId: 'reading:semantic',
      lines: overrides.lines ?? ['same semantic text'],
      lineCount: 1,
      cursorLine: 0,
      viewportLineCount: 1,
      truncated: false,
    },
  };
}

function rejectionPayload(overrides = {}) {
  return {
    schemaVersion: 'jedit.workspace_text_edit_rejection.v1',
    filePath: '/repo/a.txt',
    bufferId: 'buffer:a',
    commandKind: 'replaceTextRange',
    submittedAtMs: overrides.submittedAtMs ?? 20,
    receiptId: 'receipt:rejected',
    rejectionReason: 'stale causal basis',
  };
}
