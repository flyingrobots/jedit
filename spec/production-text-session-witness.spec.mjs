import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const WITNESS_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'workspace', 'production-text-session-witness.js');
const SESSION_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'workspace', 'production-text-session.js');
const PROFILE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'text-runtime-profile.js');
const ADAPTER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'text-runtime-profile-session.js');
const TRANSPORT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'installed-jedit-contract-echo-transport.js');
const CLIENT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'jedit-echo-optic-client.js');
const SESSION_ADAPTER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'echo-backed-text-buffer-session.js');
const RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'full-snapshot-hot-text-runtime-fixture.js');
const INSERT_TEXT = 'hello production';

let modulesPromise;

test('production text session witness reports app-safe edit reading checkpoint and export evidence', async () => {
  const modules = await loadModules();
  const report = await modules.witness.runProductionTextSessionWitness({
    session: createProductionSession(modules),
    insertText: INSERT_TEXT,
  });

  assert.equal(report.status, 'applied');
  assert.equal(report.authority.appFacingSessionPort, 'TextBufferSessionPort');
  assert.equal(report.authority.appFacingBufferCapability, 'TextBufferOptic');
  assert.equal(report.authority.exposesTrustedLifecycle, false);
  assert.equal(report.authority.exposesTickAuthority, false);
  assert.match(report.receiptId, /^receipt:/);
  assert.match(report.checkpointId, /^checkpoint:/);
  assert.match(report.readingId, /^text-window:/);
  assert.equal(report.exportedText, INSERT_TEXT);
  assert.equal(report.durableRetentionClaim, false);
  assert.deepEqual(report.retentionRefs.map((ref) => ref.role), [
    'receipt',
    'checkpoint',
    'reading',
    'export',
  ]);
});

test('production text session witness local replay compares stable semantic identity', async () => {
  const modules = await loadModules();
  const replay = await modules.witness.compareProductionTextSessionReplay({
    createSession() {
      return createProductionSession(modules);
    },
  }, {
    insertText: INSERT_TEXT,
  });

  assert.equal(replay.first.status, 'applied');
  assert.equal(replay.second.status, 'applied');
  assert.equal(replay.sameSemanticIdentity, true);
  assert.equal(replay.durableReplayClaim, false);
});

test('production text session witness reports obstruction stage without lifecycle authority', async () => {
  const modules = await loadModules();
  const report = await modules.witness.runProductionTextSessionWitness({
    session: obstructedProductionSession(),
    insertText: INSERT_TEXT,
  });

  assert.equal(report.status, 'obstructed');
  assert.equal(report.stage, 'edit');
  assert.equal(report.authority.exposesTrustedLifecycle, false);
  assert.equal(report.issue.message, 'blocked edit');
});

function createProductionSession(modules) {
  const binding = modules.adapter.createTextRuntimeProfileSession({
    profile: modules.profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
    echoHostedSessionFactory: createFixtureBackedEchoHostedSessionFactory(modules),
  });
  return modules.session.createProductionTextSession(binding.session);
}

function createFixtureBackedEchoHostedSessionFactory(modules) {
  return {
    create() {
      const transport = modules.transport.createInstalledJeditContractEchoTransport({
        allowFullSnapshotTextAuthority: true,
        runtime: modules.runtime.createFullSnapshotHotTextRuntimeFixture(),
      });
      return modules.sessionAdapter.createEchoBackedTextBufferSession({
        client: modules.client.createEchoTransportJeditOpticClient(transport),
      });
    },
  };
}

function obstructedProductionSession() {
  return {
    async openBuffer() {
      return {
        kind: 'opened',
        optic: {
          buffer: { bufferId: 'buffer:1' },
        },
      };
    },
    async insertText() {
      return {
        kind: 'obstructed',
        obstruction: {
          issue: {
            level: 'error',
            source: 'command',
            message: 'blocked edit',
            atMs: 0,
          },
        },
      };
    },
  };
}

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }
  modulesPromise = (async () => {
    const [
      witness,
      session,
      profile,
      adapter,
      transport,
      client,
      sessionAdapter,
      runtime,
    ] = await Promise.all([
      import(pathToFileURL(WITNESS_MODULE_PATH).href),
      import(pathToFileURL(SESSION_MODULE_PATH).href),
      import(pathToFileURL(PROFILE_MODULE_PATH).href),
      import(pathToFileURL(ADAPTER_MODULE_PATH).href),
      import(pathToFileURL(TRANSPORT_MODULE_PATH).href),
      import(pathToFileURL(CLIENT_MODULE_PATH).href),
      import(pathToFileURL(SESSION_ADAPTER_MODULE_PATH).href),
      import(pathToFileURL(RUNTIME_MODULE_PATH).href),
    ]);
    return {
      witness,
      session,
      profile,
      adapter,
      transport,
      client,
      sessionAdapter,
      runtime,
    };
  })();
  return modulesPromise;
}
