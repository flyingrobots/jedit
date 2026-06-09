import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './workspace-helpers.mjs';

const BASIS_A = 'a'.repeat(64);
const BASIS_B = 'b'.repeat(64);
const BASIS_OLD_LEX_HIGH = 'f'.repeat(64);
const BASIS_CURRENT_LEX_LOW = '0'.repeat(64);
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
          bytes: settlementBytes(basisId === BASIS_B ? 20 : 10),
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

test('current WSC history export uses retained causal time instead of lexicographic envelope id', async () => {
  const [currentExport, ports] = await exportModules();
  const saved = [];
  const result = currentExport.exportCurrentJeditWscHistory({
    store: fakeStore({
      envelopeIds: [BASIS_CURRENT_LEX_LOW, BASIS_OLD_LEX_HIGH],
      readEnvelope: (basisId) => ({
        status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
        envelope: {
          envelopeId: basisId,
          bytes: settlementBytes(basisId === BASIS_CURRENT_LEX_LOW ? 20 : 10),
        },
        workspacePath: '/repo/.jedit/echo-wsc/envelopes',
      }),
    }),
    editorFile: fakeEditorFile(saved),
    materializer: envelopeMaterializer(),
  });

  assert.equal(result.status, ports.JEDIT_WSC_CURRENT_HISTORY_EXPORTED);
  assert.equal(result.basisId, BASIS_CURRENT_LEX_LOW);
  assert.deepEqual(saved, [{ filePath: '/repo/notes.txt', lines: ['t=20'] }]);
});

test('current WSC history export tie-breaks same-time envelopes by bytewise id order', async () => {
  const [currentExport, ports] = await exportModules();
  const saved = [];
  const originalLocaleCompare = String.prototype.localeCompare;
  try {
    String.prototype.localeCompare = function reverseLocaleCompare(other) {
      return originalLocaleCompare.call(String(other), String(this));
    };
    const result = currentExport.exportCurrentJeditWscHistory({
      store: fakeStore({
        envelopeIds: [BASIS_A, BASIS_B],
        readEnvelope: (basisId) => ({
          status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
          envelope: {
            envelopeId: basisId,
            bytes: settlementBytes(20),
          },
          workspacePath: '/repo/.jedit/echo-wsc/envelopes',
        }),
      }),
      editorFile: fakeEditorFile(saved),
      materializer: envelopeMaterializer(),
    });

    assert.equal(result.status, ports.JEDIT_WSC_CURRENT_HISTORY_EXPORTED);
    assert.equal(result.basisId, BASIS_B);
  } finally {
    String.prototype.localeCompare = originalLocaleCompare;
  }
});

test('current WSC history export ignores retained rejection envelopes for applied text export', async () => {
  const [currentExport, ports] = await exportModules();
  const saved = [];
  const result = currentExport.exportCurrentJeditWscHistory({
    store: fakeStore({
      envelopeIds: [BASIS_A, BASIS_B],
      readEnvelope: (basisId) => ({
        status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
        envelope: {
          envelopeId: basisId,
          bytes: basisId === BASIS_A ? settlementBytes(10) : rejectionBytes(20),
        },
        workspacePath: '/repo/.jedit/echo-wsc/envelopes',
      }),
    }),
    editorFile: fakeEditorFile(saved),
    materializer: envelopeMaterializer(),
  });

  assert.equal(result.status, ports.JEDIT_WSC_CURRENT_HISTORY_EXPORTED);
  assert.equal(result.basisId, BASIS_A);
  assert.deepEqual(saved, [{ filePath: '/repo/notes.txt', lines: ['t=10'] }]);
});

test('current WSC history export obstructs malformed retained evidence instead of exporting stale text', async () => {
  const [currentExport, ports] = await exportModules();
  const saved = [];
  const result = currentExport.exportCurrentJeditWscHistory({
    store: fakeStore({
      envelopeIds: [BASIS_A, BASIS_B],
      readEnvelope: (basisId) => ({
        status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
        envelope: {
          envelopeId: basisId,
          bytes: basisId === BASIS_A ? settlementBytes(10) : malformedBytes(),
        },
        workspacePath: '/repo/.jedit/echo-wsc/envelopes',
      }),
    }),
    editorFile: fakeEditorFile(saved),
    materializer: envelopeMaterializer(),
  });

  assert.equal(result.status, ports.JEDIT_WSC_CURRENT_HISTORY_EXPORT_OBSTRUCTED);
  assert.equal(result.obstruction.code, ports.JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_FAILED);
  assert.equal(result.obstruction.basisId, BASIS_B);
  assert.deepEqual(saved, []);
});

test('point-in-time WSC history export materializes the requested historical basis', async () => {
  const [currentExport, ports] = await exportModules();
  const saved = [];
  let writeCount = 0;
  const store = fakeStore({
    envelopeIds: [BASIS_A, BASIS_B],
    readEnvelope: (basisId) => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
      envelope: {
        envelopeId: basisId,
        bytes: settlementBytes(basisId === BASIS_A ? 10 : 20),
      },
      workspacePath: '/repo/.jedit/echo-wsc/envelopes',
    }),
    writeEnvelope: () => {
      writeCount += 1;
      return obstructedStoreWrite();
    },
  });

  const oldResult = currentExport.exportJeditWscHistoryAtBasis({
    store,
    basisId: BASIS_A,
    editorFile: fakeEditorFile(saved),
    materializer: envelopeMaterializer(),
  });
  const newResult = currentExport.exportJeditWscHistoryAtBasis({
    store,
    basisId: BASIS_B,
    editorFile: fakeEditorFile(saved),
    materializer: envelopeMaterializer(),
  });

  assert.equal(oldResult.status, ports.JEDIT_WSC_CURRENT_HISTORY_EXPORTED);
  assert.equal(oldResult.basisId, BASIS_A);
  assert.equal(newResult.status, ports.JEDIT_WSC_CURRENT_HISTORY_EXPORTED);
  assert.equal(newResult.basisId, BASIS_B);
  assert.deepEqual(saved, [
    { filePath: '/repo/notes.txt', lines: ['t=10'] },
    { filePath: '/repo/notes.txt', lines: ['t=20'] },
  ]);
  assert.equal(writeCount, 0);
});

test('point-in-time WSC history export does not change the active editor state', async () => {
  const [currentExport, ports] = await exportModules();
  const activeEditorLines = ['current', 'workspace', 'state'];
  const saved = [];
  const result = currentExport.exportJeditWscHistoryAtBasis({
    store: fakeStore({
      envelopeIds: [BASIS_A, BASIS_B],
      readEnvelope: (basisId) => ({
        status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
        envelope: {
          envelopeId: basisId,
          bytes: settlementBytes(basisId === BASIS_A ? 10 : 20),
        },
        workspacePath: '/repo/.jedit/echo-wsc/envelopes',
      }),
    }),
    basisId: BASIS_A,
    editorFile: fakeEditorFile(saved, activeEditorLines),
    materializer: envelopeMaterializer(),
  });

  assert.equal(result.status, ports.JEDIT_WSC_CURRENT_HISTORY_EXPORTED);
  assert.deepEqual(activeEditorLines, ['current', 'workspace', 'state']);
  assert.deepEqual(saved, [{ filePath: '/repo/notes.txt', lines: ['t=10'] }]);
});

test('point-in-time WSC history export preserves listed historical basis metadata', async () => {
  const [currentExport, ports] = await exportModules();
  const saved = [];
  const materializedSequences = [];
  const result = currentExport.exportJeditWscHistoryAtBasis({
    store: fakeStore({
      envelopeIds: [BASIS_A, BASIS_B],
      readEnvelope: (basisId) => ({
        status: 'JEDIT_WSC_WORKSPACE_STORE_READ',
        envelope: {
          envelopeId: basisId,
          bytes: settlementBytes(basisId === BASIS_A ? 10 : 20),
        },
        workspacePath: '/repo/.jedit/echo-wsc/envelopes',
      }),
    }),
    basisId: BASIS_B,
    editorFile: fakeEditorFile(saved),
    materializer: {
      materialize: (_envelope, basis) => {
        materializedSequences.push(basis.sequence);
        return {
          status: ports.JEDIT_WSC_CURRENT_HISTORY_MATERIALIZED,
          artifact: {
            filePath: '/repo/notes.txt',
            lines: [`sequence=${String(basis.sequence)}`],
            readingId: READING_ID,
          },
        };
      },
    },
  });

  assert.equal(result.status, ports.JEDIT_WSC_CURRENT_HISTORY_EXPORTED);
  assert.equal(result.basisId, BASIS_B);
  assert.deepEqual(materializedSequences, [2]);
  assert.deepEqual(saved, [{ filePath: '/repo/notes.txt', lines: ['sequence=2'] }]);
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
          bytes: settlementBytes(20),
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

test('point-in-time WSC history export returns typed obstruction for missing retained material', async () => {
  const [currentExport, ports] = await exportModules();
  const saved = [];
  const result = currentExport.exportJeditWscHistoryAtBasis({
    store: fakeStore({
      envelopeIds: [BASIS_B],
      readEnvelope: () => ({
        status: 'JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED',
        obstruction: {
          code: 'missing_envelope',
          message: 'missing requested WSC envelope',
          envelopeId: BASIS_B,
        },
      }),
    }),
    basisId: BASIS_B,
    editorFile: fakeEditorFile(saved),
    materializer: envelopeMaterializer(),
  });

  assert.equal(result.status, ports.JEDIT_WSC_CURRENT_HISTORY_EXPORT_OBSTRUCTED);
  assert.equal(result.obstruction.code, ports.JEDIT_WSC_CURRENT_HISTORY_WSC_STORE_OBSTRUCTED);
  assert.equal(result.obstruction.basisId, BASIS_B);
  assert.deepEqual(saved, []);
});

test('point-in-time WSC history export obstructs unknown historical basis without materializing', async () => {
  const [currentExport, ports] = await exportModules();
  const saved = [];
  let materializeCount = 0;
  const result = currentExport.exportJeditWscHistoryAtBasis({
    store: fakeStore({
      envelopeIds: [BASIS_A],
      readEnvelope: () => ({
        status: 'JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED',
        obstruction: {
          code: 'missing_envelope',
          message: 'must not read an unlisted basis',
          envelopeId: BASIS_B,
        },
      }),
    }),
    basisId: BASIS_B,
    editorFile: fakeEditorFile(saved),
    materializer: {
      materialize: () => {
        materializeCount += 1;
        return {
          status: ports.JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_OBSTRUCTED,
          obstruction: {
            code: ports.JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_FAILED,
            message: 'must not materialize an unlisted basis',
          },
        };
      },
    },
  });

  assert.equal(result.status, ports.JEDIT_WSC_CURRENT_HISTORY_EXPORT_OBSTRUCTED);
  assert.equal(result.obstruction.code, ports.JEDIT_WSC_CURRENT_HISTORY_MISSING_CURRENT_BASIS);
  assert.equal(result.obstruction.basisId, BASIS_B);
  assert.equal(materializeCount, 0);
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

function fakeEditorFile(saved, activeLines = []) {
  return {
    loadEditorFile: () => ({
      lines: activeLines,
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

function envelopeMaterializer() {
  return {
    materialize: (envelope) => {
      const payload = JSON.parse(new TextDecoder().decode(envelope.bytes));
      return {
        status: 'JEDIT_WSC_CURRENT_HISTORY_MATERIALIZED',
        artifact: {
          filePath: '/repo/notes.txt',
          lines: [`t=${payload.submittedAtMs}`],
          readingId: READING_ID,
        },
      };
    },
  };
}

function settlementBytes(submittedAtMs) {
  return new TextEncoder().encode(JSON.stringify({
    schemaVersion: 'jedit.workspace_text_edit_settlement.v1',
    submittedAtMs,
  }));
}

function rejectionBytes(submittedAtMs) {
  return new TextEncoder().encode(JSON.stringify({
    schemaVersion: 'jedit.workspace_text_edit_rejection.v1',
    submittedAtMs,
    rejectionReason: 'stale causal basis',
  }));
}

function malformedBytes() {
  return new TextEncoder().encode('not json');
}
