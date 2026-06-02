import assert from 'node:assert/strict';
import test from 'node:test';
import {
  importDist,
  mockI18n,
  mockJeditTheme,
  mockRuntime,
} from './workspace-helpers.mjs';

const ENVELOPE_ID = 'd'.repeat(64);

test('applied text edit persists WSC settlement evidence before accepting receipt', async () => {
  const modules = await workspaceModules();
  const written = [];
  const store = fakeStore({
    writeEnvelope: (envelope) => {
      written.push(envelope);
      return {
        status: modules.storePorts.JEDIT_WSC_WORKSPACE_STORE_WRITTEN,
        envelopeId: envelope.envelopeId,
        byteLength: envelope.bytes.byteLength,
        workspacePath: '/repo/.jedit/echo-wsc/envelopes',
      };
    },
  });
  const runtime = modules.runtime.createWorkspaceRuntime(mockRuntime({ wscWorkspaceStore: store }));
  const model = openedTextModel(modules);
  const [next] = runtime.update(appliedEditMessage(modules), model);

  assert.deepEqual(written, [settlementEnvelope()]);
  assert.equal(next.textAuthority.lastReceiptId, 'receipt:122');
  assert.deepEqual(next.editor.lines, ['after']);
  assert.equal(next.echoHistory.at(-1).status, modules.history.EchoHistoryEntryStatuses.Applied);
});

test('obstructed WSC settlement keeps applied edit from becoming durable UI state', async () => {
  const modules = await workspaceModules();
  const obstruction = {
    code: modules.storePorts.JEDIT_WSC_WORKSPACE_STORE_HOST_PATH_ERROR,
    message: 'workspace path blocked',
  };
  const store = fakeStore({
    writeEnvelope: () => ({
      status: modules.storePorts.JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED,
      obstruction,
    }),
  });
  const runtime = modules.runtime.createWorkspaceRuntime(mockRuntime({ wscWorkspaceStore: store }));
  const model = openedTextModel(modules);
  const [next] = runtime.update(appliedEditMessage(modules), model);

  assert.equal(next.textAuthority.lastReceiptId, undefined);
  assert.deepEqual(next.editor.lines, ['before']);
  assert.equal(next.echoHistory.at(-1).status, modules.history.EchoHistoryEntryStatuses.Obstructed);
  assert.match(next.echoHistory.at(-1).summary, /workspace path blocked/);
});

test('obstructed edit result records honest outcome without WSC persistence', async () => {
  const modules = await workspaceModules();
  let writeCount = 0;
  const runtime = modules.runtime.createWorkspaceRuntime(mockRuntime({
    wscWorkspaceStore: fakeStore({
      writeEnvelope: () => {
        writeCount += 1;
        return {
          status: modules.storePorts.JEDIT_WSC_WORKSPACE_STORE_WRITTEN,
          envelopeId: ENVELOPE_ID,
          byteLength: 0,
          workspacePath: '/repo/.jedit/echo-wsc/envelopes',
        };
      },
    }),
  }));
  const model = openedTextModel(modules);
  const [next] = runtime.update({
    type: modules.msg.WorkspaceMessageTypes.TextEditResult,
    requestId: 1,
    result: {
      kind: modules.results.WorkspaceTextResultKinds.Obstructed,
      filePath: '/repo/notes.txt',
      issue: {
        level: 'error',
        source: 'command',
        message: 'edit rejected',
        atMs: 122,
      },
    },
  }, model);

  assert.equal(writeCount, 0);
  assert.equal(next.textAuthority.lastReceiptId, undefined);
  assert.equal(next.echoHistory.at(-1).status, modules.history.EchoHistoryEntryStatuses.Obstructed);
  assert.match(next.echoHistory.at(-1).summary, /edit rejected/);
});

async function workspaceModules() {
  const [init, runtime, authority, profile, results, msg, history, storePorts] = await Promise.all([
    importDist('app', 'workspace', 'init.js'),
    importDist('app', 'workspace', 'runtime.js'),
    importDist('app', 'workspace', 'workspace-text-authority.js'),
    importDist('app', 'text-runtime-profile.js'),
    importDist('app', 'workspace', 'workspace-text-results.js'),
    importDist('app', 'workspace', 'msg.js'),
    importDist('app', 'workspace', 'echo-history.js'),
    importDist('ports', 'jedit-wsc-workspace-store.js'),
  ]);
  return { init, runtime, authority, profile, results, msg, history, storePorts };
}

function openedTextModel(modules) {
  const base = modules.init.createInitialModel('/repo', 80, 24, {
    titleSceneSeed: 0.5,
    jeditTheme: mockJeditTheme(),
    i18n: mockI18n(),
    entries: [],
    nowMs: 122,
  });
  return {
    ...base,
    editor: {
      path: '/repo/notes.txt',
      lines: ['before'],
      cursorRow: 0,
      cursorCol: 0,
      scrollRow: 0,
      scrollCol: 0,
      dirty: false,
      readOnly: false,
      mode: 'insert',
      undoStack: [],
      redoStack: [],
    },
    textRequestId: 1,
    textAuthority: modules.authority.openedWorkspaceTextAuthority({
      profile: modules.profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: '/repo/notes.txt',
      bufferId: 'buffer:notes',
      readOnly: false,
      dirty: false,
      cache: {
        bufferId: 'buffer:notes',
        readingId: 'reading:before',
        lines: ['before'],
        lineCount: 1,
        cursorLine: 0,
        viewportLineCount: 24,
        truncated: false,
      },
    }),
  };
}

function appliedEditMessage(modules) {
  return {
    type: modules.msg.WorkspaceMessageTypes.TextEditResult,
    requestId: 1,
    result: {
      kind: modules.results.WorkspaceTextResultKinds.Applied,
      filePath: '/repo/notes.txt',
      bufferId: 'buffer:notes',
      receiptId: 'receipt:122',
      cache: {
        bufferId: 'buffer:notes',
        readingId: 'reading:after',
        lines: ['after'],
        lineCount: 1,
        cursorLine: 0,
        viewportLineCount: 24,
        truncated: false,
      },
      wscSettlementEnvelope: settlementEnvelope(),
    },
  };
}

function settlementEnvelope() {
  return {
    envelopeId: ENVELOPE_ID,
    bytes: new Uint8Array([1, 2, 2]),
  };
}

function fakeStore(overrides) {
  return {
    writeEnvelope: overrides.writeEnvelope,
    readEnvelope: () => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED',
      obstruction: {
        code: 'missing_envelope',
        message: 'missing envelope',
      },
    }),
    listEnvelopes: () => ({
      status: 'JEDIT_WSC_WORKSPACE_STORE_LISTED',
      envelopeIds: [],
      workspacePath: '/repo/.jedit/echo-wsc/envelopes',
    }),
  };
}
