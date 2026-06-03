import assert from 'node:assert/strict';
import test from 'node:test';
import {
  importDist,
  mockI18n,
  mockJeditTheme,
} from './workspace-helpers.mjs';

const BASIS_A = 'a'.repeat(64);
const BASIS_B = 'b'.repeat(64);

test('WSC history basis list exposes deterministic app-safe basis ids', async () => {
  const [historyBasis, ports] = await basisModules();
  const result = historyBasis.listJeditWscHistoricalBases([BASIS_B, BASIS_A]);

  assert.equal(result.status, ports.JEDIT_WSC_HISTORY_BASIS_LISTED);
  assert.deepEqual(result.bases, [{
    basisId: BASIS_B,
    envelopeId: BASIS_B,
    sequence: 1,
    evidencePosture: ports.JEDIT_WSC_HISTORY_BASIS_RETAINED_ENVELOPE,
  }, {
    basisId: BASIS_A,
    envelopeId: BASIS_A,
    sequence: 2,
    evidencePosture: ports.JEDIT_WSC_HISTORY_BASIS_RETAINED_ENVELOPE,
  }]);
});

test('WSC history basis selection reads retained envelope without mutating workspace state', async () => {
  const [historyBasis, ports, init] = await basisModules();
  const listed = historyBasis.listJeditWscHistoricalBases([BASIS_A, BASIS_B]);
  const model = init.createInitialModel('/repo', 80, 24, {
    titleSceneSeed: 0.5,
    jeditTheme: mockJeditTheme(),
    i18n: mockI18n(),
    entries: [],
    nowMs: 124,
  });
  const selected = historyBasis.selectJeditWscHistoricalBasis(fakeStore({
    status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
    envelope: {
      envelopeId: BASIS_B,
      bytes: Uint8Array.from([1, 2, 4]),
    },
    workspacePath: '/repo/.jedit/echo-wsc/envelopes',
  }), listed.bases[1]);

  assert.equal(selected.status, ports.JEDIT_WSC_HISTORY_BASIS_SELECTED);
  assert.equal(selected.basis.basisId, BASIS_B);
  assert.equal(selected.basis.sequence, 2);
  assert.deepEqual(Array.from(selected.envelope.bytes), [1, 2, 4]);
  assert.equal(model.editor, undefined);
  assert.equal(model.echoHistory.length, 0);
});

test('WSC history basis selection maps missing retained material to typed obstruction', async () => {
  const [historyBasis, ports] = await basisModules();
  const result = historyBasis.selectJeditWscHistoricalBasis(fakeStore({
    status: 'JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED',
    obstruction: {
      code: 'missing_envelope',
      message: 'missing WSC envelope',
      envelopeId: BASIS_B,
    },
  }), {
    basisId: BASIS_B,
    envelopeId: BASIS_B,
    sequence: 2,
    evidencePosture: ports.JEDIT_WSC_HISTORY_BASIS_RETAINED_ENVELOPE,
  });

  assert.equal(result.status, ports.JEDIT_WSC_HISTORY_BASIS_OBSTRUCTED);
  assert.equal(result.obstruction.code, ports.JEDIT_WSC_HISTORY_BASIS_MISSING_BASIS);
  assert.equal(result.obstruction.basisId, BASIS_B);
});

async function basisModules() {
  return Promise.all([
    importDist('app', 'jedit-wsc-history-basis.js'),
    importDist('ports', 'jedit-wsc-history-basis.js'),
    importDist('app', 'workspace', 'init.js'),
  ]);
}

function fakeStore(readResult) {
  return {
    writeEnvelope: () => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED',
      obstruction: {
        code: 'host_path_error',
        message: 'read-only test store',
      },
    }),
    readEnvelope: () => readResult,
    listEnvelopes: () => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_LISTED',
      envelopeIds: [BASIS_A, BASIS_B],
      workspacePath: '/repo/.jedit/echo-wsc/envelopes',
    }),
  };
}
