import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './workspace-helpers.mjs';

const BASIS_A = 'a'.repeat(64);
const BASIS_B = 'b'.repeat(64);
const READING_ID = 'reading:125';

test('current WSC history export materializes latest basis before writing host artifact', async () => {
  const [currentExport, ports] = await exportModules();
  const saved = [];
  let writeCount = 0;
  const result = currentExport.exportCurrentJeditWscHistory({
    store: fakeStore({
      readEnvelope: (basisId) => ({
        status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
        envelope: {
          envelopeId: basisId,
          bytes: Uint8Array.from([1, 2, 5]),
        },
        workspacePath: '/repo/.jedit/echo-wsc/envelopes',
      }),
      writeEnvelope: () => {
        writeCount += 1;
        return obstructedStoreWrite();
      },
    }),
    editorFile: fakeEditorFile(saved),
    materializer: materializer({
      filePath: '/repo/notes.txt',
      lines: ['current', 'history'],
      readingId: READING_ID,
    }),
  });

  assert.equal(result.status, ports.JEDIT_WSC_CURRENT_HISTORY_EXPORTED);
  assert.equal(result.basisId, BASIS_B);
  assert.equal(result.readingId, READING_ID);
  assert.equal(result.exportEvidenceId, `${ports.JEDIT_WSC_CURRENT_HISTORY_EXPORT_EVIDENCE_PREFIX}${BASIS_B}:${READING_ID}`);
  assert.deepEqual(saved, [{ filePath: '/repo/notes.txt', lines: ['current', 'history'] }]);
  assert.equal(writeCount, 0);
});

test('current WSC history export does not write host artifact when materialization fails', async () => {
  const [currentExport, ports] = await exportModules();
  const saved = [];
  const result = currentExport.exportCurrentJeditWscHistory({
    store: fakeStore({
      readEnvelope: (basisId) => ({
        status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
        envelope: {
          envelopeId: basisId,
          bytes: Uint8Array.from([9]),
        },
        workspacePath: '/repo/.jedit/echo-wsc/envelopes',
      }),
    }),
    editorFile: fakeEditorFile(saved),
    materializer: {
      materialize: () => ({
        status: ports.JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_OBSTRUCTED,
        obstruction: {
          code: ports.JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_FAILED,
          message: 'cannot decode retained WSC envelope',
        },
      }),
    },
  });

  assert.equal(result.status, ports.JEDIT_WSC_CURRENT_HISTORY_EXPORT_OBSTRUCTED);
  assert.equal(result.obstruction.code, ports.JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_FAILED);
  assert.deepEqual(saved, []);
});

test('current WSC history export returns typed obstruction when no basis is retained', async () => {
  const [currentExport, ports] = await exportModules();
  const result = currentExport.exportCurrentJeditWscHistory({
    store: fakeStore({
      envelopeIds: [],
      readEnvelope: () => ({
        status: 'JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED',
        obstruction: {
          code: 'missing_envelope',
          message: 'missing envelope',
        },
      }),
    }),
    editorFile: fakeEditorFile([]),
    materializer: materializer({
      filePath: '/repo/notes.txt',
      lines: ['unused'],
      readingId: READING_ID,
    }),
  });

  assert.equal(result.status, ports.JEDIT_WSC_CURRENT_HISTORY_EXPORT_OBSTRUCTED);
  assert.equal(result.obstruction.code, ports.JEDIT_WSC_CURRENT_HISTORY_MISSING_CURRENT_BASIS);
});

async function exportModules() {
  return Promise.all([
    importDist('app', 'jedit-wsc-current-history-export.js'),
    importDist('ports', 'jedit-wsc-current-history-export.js'),
  ]);
}

function fakeStore(overrides) {
  return {
    writeEnvelope: overrides.writeEnvelope ?? (() => obstructedStoreWrite()),
    readEnvelope: overrides.readEnvelope,
    listEnvelopes: () => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_LISTED',
      envelopeIds: overrides.envelopeIds ?? [BASIS_A, BASIS_B],
      workspacePath: '/repo/.jedit/echo-wsc/envelopes',
    }),
  };
}

function obstructedStoreWrite() {
  return {
    status: 'JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED',
    obstruction: {
      code: 'host_path_error',
      message: 'current export must not write WSC',
    },
  };
}

function fakeEditorFile(saved) {
  return {
    loadEditorFile: () => ({
      lines: [],
      readOnly: false,
    }),
    saveEditorFile: (filePath, lines) => {
      saved.push({ filePath, lines });
    },
  };
}

function materializer(artifact) {
  return {
    materialize: () => ({
      status: 'JEDIT_WSC_CURRENT_HISTORY_MATERIALIZED',
      artifact,
    }),
  };
}
