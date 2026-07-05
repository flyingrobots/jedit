import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const WITNESS_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'workspace', 'production-text-session-witness.js');
const SESSION_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'workspace', 'production-text-session.js');
const PROFILE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'text-runtime-profile.js');
const ADAPTER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'text-runtime-profile-session.js');
const INSERT_TEXT = 'hello production';
const FULL_SNAPSHOT_AUTHORITY_ENV = 'JEDIT_ALLOW_FULL_SNAPSHOT_TEXT_AUTHORITY';

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
  const binding = withFullSnapshotAuthorityEnv('1', () => (
    modules.adapter.createTextRuntimeProfileSession({
      profile: modules.profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
    })
  ));
  return modules.session.createProductionTextSession(binding.session);
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
    const [witness, session, profile, adapter] = await Promise.all([
      import(pathToFileURL(WITNESS_MODULE_PATH).href),
      import(pathToFileURL(SESSION_MODULE_PATH).href),
      import(pathToFileURL(PROFILE_MODULE_PATH).href),
      import(pathToFileURL(ADAPTER_MODULE_PATH).href),
    ]);
    return { witness, session, profile, adapter };
  })();
  return modulesPromise;
}

function withFullSnapshotAuthorityEnv(value, callback) {
  const previous = process.env[FULL_SNAPSHOT_AUTHORITY_ENV];
  process.env[FULL_SNAPSHOT_AUTHORITY_ENV] = value;

  try {
    return callback();
  } finally {
    if (previous === undefined) {
      delete process.env[FULL_SNAPSHOT_AUTHORITY_ENV];
    } else {
      process.env[FULL_SNAPSHOT_AUTHORITY_ENV] = previous;
    }
  }
}
