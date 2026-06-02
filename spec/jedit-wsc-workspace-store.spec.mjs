import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const ADAPTER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'jedit-wsc-workspace-store.js');
const PORT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ports', 'jedit-wsc-workspace-store.js');
const ENVELOPE_ID_A = 'a'.repeat(64);
const ENVELOPE_ID_B = 'b'.repeat(64);

let modulesPromise;

test('workspace WSC store writes reads and lists generic envelopes under jedit path policy', async (t) => {
  const modules = await loadModules();
  const workspaceRoot = createTempDir(t);
  const store = modules.adapter.createNodeJeditWscWorkspaceStore(workspaceRoot);
  const firstBytes = Uint8Array.from([1, 2, 3]);
  const secondBytes = Uint8Array.from([4, 5]);

  const firstWrite = store.writeEnvelope({
    envelopeId: ENVELOPE_ID_B,
    bytes: secondBytes,
  });
  const secondWrite = store.writeEnvelope({
    envelopeId: ENVELOPE_ID_A,
    bytes: firstBytes,
  });
  const list = store.listEnvelopes();
  const read = store.readEnvelope(ENVELOPE_ID_A);

  assert.equal(firstWrite.status, modules.ports.JEDIT_WSC_WORKSPACE_STORE_WRITTEN);
  assert.equal(secondWrite.workspacePath, expectedEnvelopePath(workspaceRoot, ENVELOPE_ID_A));
  assert.equal(list.status, modules.ports.JEDIT_WSC_WORKSPACE_STORE_LISTED);
  assert.deepEqual(list.envelopeIds, [ENVELOPE_ID_A, ENVELOPE_ID_B]);
  assert.equal(read.status, modules.ports.JEDIT_WSC_WORKSPACE_STORE_READ);
  assert.deepEqual(Array.from(read.envelope.bytes), Array.from(firstBytes));
});

test('workspace WSC store rejects non-digest envelope ids before touching host paths', async (t) => {
  const modules = await loadModules();
  const workspaceRoot = createTempDir(t);
  const store = modules.adapter.createNodeJeditWscWorkspaceStore(workspaceRoot);

  const result = store.writeEnvelope({
    envelopeId: '../escape',
    bytes: Uint8Array.from([1]),
  });

  assert.equal(result.status, modules.ports.JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED);
  assert.equal(result.obstruction.code, modules.ports.JEDIT_WSC_WORKSPACE_STORE_INVALID_ENVELOPE_ID);
  assert.equal(fs.existsSync(path.join(workspaceRoot, 'escape')), false);
});

test('workspace WSC store reports missing envelopes as typed obstruction', async (t) => {
  const modules = await loadModules();
  const workspaceRoot = createTempDir(t);
  const store = modules.adapter.createNodeJeditWscWorkspaceStore(workspaceRoot);

  const result = store.readEnvelope(ENVELOPE_ID_A);

  assert.equal(result.status, modules.ports.JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED);
  assert.equal(result.obstruction.code, modules.ports.JEDIT_WSC_WORKSPACE_STORE_MISSING_ENVELOPE);
});

test('workspace WSC store reports host path failures as typed obstruction', async (t) => {
  const modules = await loadModules();
  const workspaceRoot = createTempDir(t);
  fs.writeFileSync(path.join(workspaceRoot, '.jedit'), 'not a directory', 'utf8');
  const store = modules.adapter.createNodeJeditWscWorkspaceStore(workspaceRoot);

  const result = store.writeEnvelope({
    envelopeId: ENVELOPE_ID_A,
    bytes: Uint8Array.from([9]),
  });

  assert.equal(result.status, modules.ports.JEDIT_WSC_WORKSPACE_STORE_OBSTRUCTED);
  assert.equal(result.obstruction.code, modules.ports.JEDIT_WSC_WORKSPACE_STORE_HOST_PATH_ERROR);
});

async function loadModules() {
  if (modulesPromise == null) {
    modulesPromise = buildAndImportModules();
  }
  return modulesPromise;
}

async function buildAndImportModules() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(build.status, 0, build.stderr || build.stdout);
  const [adapter, ports] = await Promise.all([
    import(pathToFileURL(ADAPTER_MODULE_PATH).href),
    import(pathToFileURL(PORT_MODULE_PATH).href),
  ]);
  return {
    adapter,
    ports,
  };
}

function createTempDir(t) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jedit-wsc-store-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  return tempDir;
}

function expectedEnvelopePath(workspaceRoot, envelopeId) {
  return path.join(workspaceRoot, '.jedit', 'echo-wsc', 'envelopes', `${envelopeId}.wsc-envelope`);
}
