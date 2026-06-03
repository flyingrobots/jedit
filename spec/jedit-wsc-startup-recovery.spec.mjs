import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist, mockRuntime } from './workspace-helpers.mjs';

const ENVELOPE_ID = 'c'.repeat(64);

test('WSC startup recovery keeps no-history startup as explicit host import', async () => {
  const [recovery, ports, storePorts] = await startupModules();
  const result = recovery.recoverJeditWorkspaceFromWsc(fakeStore([], storePorts));

  assert.equal(result.status, ports.JEDIT_WSC_STARTUP_RECOVERY_NO_HISTORY);
  assert.equal(result.hostImportMode, ports.JEDIT_WSC_STARTUP_HOST_IMPORT_EXPLICIT);
});

test('WSC startup recovery records recovered Echo history without materializing host bytes', async () => {
  const [recovery, ports, storePorts] = await startupModules();
  const result = recovery.recoverJeditWorkspaceFromWsc(fakeStore([ENVELOPE_ID], storePorts));

  assert.equal(result.status, ports.JEDIT_WSC_STARTUP_RECOVERY_RECOVERED);
  assert.equal(result.authorityPosture, ports.JEDIT_WSC_STARTUP_AUTHORITY_ECHO_HISTORY);
  assert.equal(result.readingCachePosture, ports.JEDIT_WSC_STARTUP_PENDING_MATERIALIZATION);
  assert.equal(result.outcomePosture, ports.JEDIT_WSC_STARTUP_PENDING_MATERIALIZATION);
  assert.deepEqual(result.envelopeIds, [ENVELOPE_ID]);
});

test('WSC startup recovery surfaces workspace store obstructions', async () => {
  const [recovery, ports, storePorts] = await startupModules();
  const obstruction = {
    code: storePorts.JEDIT_WSC_WORKSPACE_STORE_HOST_PATH_ERROR,
    message: 'blocked',
  };
  const result = recovery.recoverJeditWorkspaceFromWsc({
    writeEnvelope: () => ({ status: storePorts.JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED, obstruction }),
    readEnvelope: () => ({ status: storePorts.JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED, obstruction }),
    listEnvelopes: () => ({ status: storePorts.JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED, obstruction }),
  });

  assert.equal(result.status, ports.JEDIT_WSC_STARTUP_RECOVERY_OBSTRUCTED);
  assert.equal(result.obstruction, obstruction);
});

test('workspace runtime init stores injected WSC startup recovery result', async () => {
  const [runtime, ports] = await Promise.all([
    importDist('app', 'workspace', 'runtime.js'),
    importDist('ports', 'jedit-wsc-startup-recovery.js'),
  ]);
  const storePorts = await importDist('ports', 'jedit-wsc-workspace-store.js');

  const appRuntime = runtime.createWorkspaceRuntime(mockRuntime({
    wscWorkspaceStore: fakeStore([ENVELOPE_ID], storePorts),
  }));
  const [model] = appRuntime.init();

  assert.equal(model.wscStartupRecovery.status, ports.JEDIT_WSC_STARTUP_RECOVERY_RECOVERED);
  assert.deepEqual(model.wscStartupRecovery.envelopeIds, [ENVELOPE_ID]);
});

async function startupModules() {
  return Promise.all([
    importDist('app', 'jedit-wsc-startup-recovery.js'),
    importDist('ports', 'jedit-wsc-startup-recovery.js'),
    importDist('ports', 'jedit-wsc-workspace-store.js'),
  ]);
}

function fakeStore(envelopeIds, storePorts) {
  return {
    writeEnvelope: () => ({ status: storePorts.JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED }),
    readEnvelope: () => ({ status: storePorts.JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED }),
    listEnvelopes: () => ({
      status: storePorts.JEDIT_WSC_WORKSPACE_STORE_LISTED,
      envelopeIds,
      workspacePath: '/repo/.jedit/echo-wsc/envelopes',
    }),
  };
}
