import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  importDist,
  mockI18n,
  mockJeditTheme,
  mockRuntime,
} from './workspace-helpers.mjs';

const ENVELOPE_ID = 'e'.repeat(64);
const RECEIPT_ID = 'receipt:123';
const READING_ID = 'reading:123';
const CHECKPOINT_ID = 'checkpoint:123';
const MATERIALIZED_TEXT = 'hello from WSC restart';

test('WSC edit evidence survives stop and restart without stale workspace memory', async (t) => {
  const modules = await workspaceModules();
  const workspaceRoot = createTempDir(t);
  const store = modules.adapter.createNodeJeditWscWorkspaceStore(workspaceRoot);
  const runtime = modules.runtime.createWorkspaceRuntime(mockRuntime({
    initialWorkingDirectory: workspaceRoot,
    wscWorkspaceStore: store,
  }));
  const [settled] = runtime.update(appliedEditMessage(modules, workspaceRoot), openedTextModel(modules, workspaceRoot));
  const restartedStore = modules.adapter.createNodeJeditWscWorkspaceStore(workspaceRoot);
  const restartedRuntime = modules.runtime.createWorkspaceRuntime(mockRuntime({
    initialWorkingDirectory: workspaceRoot,
    wscWorkspaceStore: restartedStore,
  }));
  const [restarted] = restartedRuntime.init();
  const recovered = restartedStore.readEnvelope(ENVELOPE_ID);

  assert.equal(settled.textAuthority.lastReceiptId, RECEIPT_ID);
  assert.equal(restarted.editor, undefined);
  assert.equal(restarted.wscStartupRecovery.status, modules.startupPorts.JEDIT_WSC_STARTUP_RECOVERY_RECOVERED);
  assert.deepEqual(restarted.wscStartupRecovery.envelopeIds, [ENVELOPE_ID]);
  assert.equal(recovered.status, modules.storePorts.JEDIT_WSC_WORKSPACE_STORE_READ);
  assert.deepEqual(decodeSettlement(recovered.envelope.bytes), settlementEvidence());
});

async function workspaceModules() {
  const [adapter, runtime, init, authority, profile, results, msg, storePorts, startupPorts] = await Promise.all([
    importDist('adapters', 'jedit-wsc-workspace-store.js'),
    importDist('app', 'workspace', 'runtime.js'),
    importDist('app', 'workspace', 'init.js'),
    importDist('app', 'workspace', 'workspace-text-authority.js'),
    importDist('app', 'text-runtime-profile.js'),
    importDist('app', 'workspace', 'workspace-text-results.js'),
    importDist('app', 'workspace', 'msg.js'),
    importDist('ports', 'jedit-wsc-workspace-store.js'),
    importDist('ports', 'jedit-wsc-startup-recovery.js'),
  ]);
  return { adapter, runtime, init, authority, profile, results, msg, storePorts, startupPorts };
}

function openedTextModel(modules, workspaceRoot) {
  return {
    ...initialModel(modules, workspaceRoot),
    editor: editorModel(workspaceRoot, ['before']),
    textRequestId: 1,
    textAuthority: modules.authority.openedWorkspaceTextAuthority({
      profile: modules.profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: notesPath(workspaceRoot),
      bufferId: 'buffer:notes',
      readOnly: false,
      dirty: false,
      cache: readingCache('reading:before', ['before']),
    }),
  };
}

function initialModel(modules, workspaceRoot) {
  return modules.init.createInitialModel(workspaceRoot, 80, 24, {
    titleSceneSeed: 0.5,
    jeditTheme: mockJeditTheme(),
    i18n: mockI18n(),
    entries: [],
    nowMs: 123,
  });
}

function appliedEditMessage(modules, workspaceRoot) {
  return {
    type: modules.msg.WorkspaceMessageTypes.TextEditResult,
    requestId: 1,
    result: {
      kind: modules.results.WorkspaceTextResultKinds.Applied,
      filePath: notesPath(workspaceRoot),
      bufferId: 'buffer:notes',
      receiptId: RECEIPT_ID,
      cache: readingCache(READING_ID, [MATERIALIZED_TEXT]),
      wscSettlementEnvelope: {
        envelopeId: ENVELOPE_ID,
        bytes: encodeSettlement(settlementEvidence()),
      },
    },
  };
}

function editorModel(workspaceRoot, lines) {
  return {
    path: notesPath(workspaceRoot),
    lines,
    cursorRow: 0,
    cursorCol: 0,
    scrollRow: 0,
    scrollCol: 0,
    dirty: false,
    readOnly: false,
    mode: 'insert',
    undoStack: [],
    redoStack: [],
  };
}

function readingCache(readingId, lines) {
  return {
    bufferId: 'buffer:notes',
    readingId,
    lines,
    lineCount: lines.length,
    cursorLine: 0,
    viewportLineCount: 24,
    truncated: false,
  };
}

function settlementEvidence() {
  return {
    receiptId: RECEIPT_ID,
    readingId: READING_ID,
    checkpointId: CHECKPOINT_ID,
    materializedText: MATERIALIZED_TEXT,
  };
}

function encodeSettlement(evidence) {
  return new TextEncoder().encode(JSON.stringify(evidence));
}

function decodeSettlement(bytes) {
  return JSON.parse(new TextDecoder().decode(bytes));
}

function notesPath(workspaceRoot) {
  return path.join(workspaceRoot, 'notes.txt');
}

function createTempDir(t) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jedit-wsc-restart-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  return tempDir;
}
