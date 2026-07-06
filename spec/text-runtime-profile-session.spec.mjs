import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const SESSION_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'text-runtime-profile-session.js');
const PROFILE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'text-runtime-profile.js');
const FULL_SNAPSHOT_AUTHORITY_ENV = 'JEDIT_ALLOW_FULL_SNAPSHOT_TEXT_AUTHORITY';
const FULL_SNAPSHOT_GUARD_MESSAGE = /FullSnapshotHotTextRuntimeFixture cannot be used as production text authority/;

let modulesPromise;

test('Echo-hosted text runtime profile rejects implicit full-snapshot authority by default', async () => {
  const modules = await loadModules();

  withFullSnapshotAuthorityEnv(undefined, () => {
    assert.throws(
      () => modules.session.createTextRuntimeProfileSession({
        profile: modules.profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      }),
      FULL_SNAPSHOT_GUARD_MESSAGE,
    );
  });
});

test('Echo-hosted text runtime profile drives a narrow edit/read path through Echo-backed session', async () => {
  const modules = await loadModules();
  const binding = withFullSnapshotAuthorityEnv('1', () => (
    modules.session.createTextRuntimeProfileSession({
      profile: modules.profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
    })
  ));

  const text = await runNarrowEditRead(binding.session, 'echoHosted');

  assert.equal(binding.profile, modules.profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED);
  assert.equal(text, 'echoHosted');
  assert.equal('requestRunUntilIdle' in binding.session, false);
});

test('text runtime profile session accepts injected Echo-hosted session factories', async () => {
  const modules = await loadModules();
  const calls = [];
  const echoHostedSession = fakeTextBufferSession('echo-hosted-injected');

  const echoHosted = modules.session.createTextRuntimeProfileSession({
    profile: modules.profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
    echoHostedSessionFactory: {
      create() {
        calls.push('echoHosted');
        return echoHostedSession;
      },
    },
  });

  assert.equal(echoHosted.session, echoHostedSession);
  assert.deepEqual(calls, ['echoHosted']);
});

test('text runtime profile session rejects unknown profiles', async () => {
  const modules = await loadModules();

  assert.throws(
    () => modules.session.createTextRuntimeProfileSession({ profile: 'bad-profile' }),
    modules.session.TextRuntimeProfileSessionError,
  );
});

test('text runtime profile parser defaults to Echo-hosted and obstructs non-Echo profiles', async () => {
  const modules = await loadModules();

  assert.deepEqual(modules.profile.parseTextRuntimeProfile(undefined), {
    kind: modules.profile.TEXT_RUNTIME_PROFILE_PARSE_OK,
    profile: modules.profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
  });
  assert.deepEqual(modules.profile.parseTextRuntimeProfile('testLocal'), {
    kind: modules.profile.TEXT_RUNTIME_PROFILE_PARSE_OBSTRUCTED,
    code: modules.profile.TEXT_RUNTIME_PROFILE_UNSUPPORTED_CODE,
    suppliedValue: 'testLocal',
    requiredProfile: modules.profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
  });
  assert.deepEqual(modules.profile.parseTextRuntimeProfile('legacy'), {
    kind: modules.profile.TEXT_RUNTIME_PROFILE_PARSE_OBSTRUCTED,
    code: modules.profile.TEXT_RUNTIME_PROFILE_UNSUPPORTED_CODE,
    suppliedValue: 'legacy',
    requiredProfile: modules.profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
  });
  assert.equal(
    modules.profile.requireTextRuntimeProfile(modules.profile.parseTextRuntimeProfile('echoHosted')),
    modules.profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
  );
  assert.throws(
    () => modules.profile.requireTextRuntimeProfile(modules.profile.parseTextRuntimeProfile('testLocal')),
    modules.profile.TextRuntimeProfileError,
  );
});

test('workspace initial model pins the Echo-hosted text runtime profile', async () => {
  const modules = await loadModules();
  const workspace = await import(pathToFileURL(path.join(
    REPO_ROOT,
    'dist',
    'app',
    'workspace',
    'init.js',
  )).href);
  const model = workspace.createInitialModel('/tmp/jedit', 80, 24, {
    entries: [],
    titleSceneSeed: 0.5,
    jeditTheme: {
      name: 'test',
      mode: 'dark',
      colors: {},
    },
    i18n: {},
    nowMs: 0,
  });

  assert.equal(model.textRuntimeProfile, modules.profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED);
});

async function runNarrowEditRead(session, text) {
  const optic = await session.createBuffer({
    bufferKey: `${text}.md`,
    initialText: '',
    projectionPath: `${text}.md`,
  });
  await optic.applyIntent({
    kind: 'replaceRange',
    startByte: 0,
    endByte: 0,
    insertText: text,
  });
  const observed = await optic.textWindow(optic.currentReadBasis(), {
    cursorLine: 0,
    beforeLines: 0,
    viewportLineCount: 1,
    afterLines: 0,
    maxBytes: 80,
  });
  return observed.value.lines.map((line) => line.text).join('\n');
}

function fakeTextBufferSession(sessionId) {
  return {
    sessionId,
    async createBuffer() {
      return {};
    },
    async getBufferOptic() {
      return null;
    },
    async listBuffers() {
      return [];
    },
  };
}

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
    const [session, profile] = await Promise.all([
      import(pathToFileURL(SESSION_MODULE_PATH).href),
      import(pathToFileURL(PROFILE_MODULE_PATH).href),
    ]);
    return { session, profile };
  })();

  return modulesPromise;
}

function withFullSnapshotAuthorityEnv(value, callback) {
  const previous = process.env[FULL_SNAPSHOT_AUTHORITY_ENV];
  if (value === undefined) {
    delete process.env[FULL_SNAPSHOT_AUTHORITY_ENV];
  } else {
    process.env[FULL_SNAPSHOT_AUTHORITY_ENV] = value;
  }

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
