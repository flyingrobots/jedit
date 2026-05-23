import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const TRANSPORT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'installed-jedit-contract-echo-transport.js');
const CLIENT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'jedit-echo-optic-client.js');
const POWERED_SESSION_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'echo-powered-text-buffer-optic-session.js');
const BUFFER_KEY = 'notes/installed-contract.md';
const INITIAL_TEXT = 'hello';
const INSERT_TEXT = ' Echo';
const FIRST_BYTE = 0;
const INSERT_BYTE = 5;
const FIRST_LINE = 0;
const SINGLE_LINE = 1;
const CYCLE_LIMIT = 5;
const BYTE_BUDGET = 80;

let modulesPromise;

test('TextBufferOptic headless flow uses installed jedit contract transport', async () => {
  const modules = await loadModules();
  const lifecycleRequests = [];
  const transport = modules.transport.createInstalledJeditContractEchoTransport();
  const client = modules.client.createEchoTransportJeditOpticClient(transport);
  const session = modules.poweredSession.createEchoPoweredTextBufferOpticSession({
    client,
    lifecycle: {
      requestRunUntilIdle(request) {
        lifecycleRequests.push(request.cycleLimit);
        return {
          accepted: true,
          lastRunCompletion: 'quiesced',
        };
      },
    },
    cycleLimit: CYCLE_LIMIT,
  });

  const optic = await session.createBuffer({
    bufferKey: BUFFER_KEY,
    initialText: INITIAL_TEXT,
    projectionPath: BUFFER_KEY,
  });
  await optic.applyIntent({
    kind: 'replaceRange',
    startByte: INSERT_BYTE,
    endByte: INSERT_BYTE,
    insertText: INSERT_TEXT,
  });
  const observed = await optic.textWindow(optic.currentReadBasis(), {
    cursorLine: FIRST_LINE,
    viewportLineCount: SINGLE_LINE,
    beforeLines: FIRST_LINE,
    afterLines: FIRST_LINE,
    maxBytes: BYTE_BUDGET,
  });

  assert.equal(observed.value.lines[0].text, `${INITIAL_TEXT}${INSERT_TEXT}`);
  assert.deepEqual(lifecycleRequests, [CYCLE_LIMIT, CYCLE_LIMIT]);
  assert.equal('installContractPackage' in session, false);
  assert.equal('requestRunUntilIdle' in session, false);
  assert.equal('tick' in session, false);
  assert.equal('installContractPackage' in optic, false);
  assert.equal('requestRunUntilIdle' in optic, false);
  assert.equal('tick' in optic, false);
});

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
    const build = spawnSync('npm', ['run', '--silent', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.equal(build.status, 0, build.stderr || build.stdout);

    const [transport, client, poweredSession] = await Promise.all([
      import(pathToFileURL(TRANSPORT_MODULE_PATH).href),
      import(pathToFileURL(CLIENT_MODULE_PATH).href),
      import(pathToFileURL(POWERED_SESSION_MODULE_PATH).href),
    ]);

    return {
      transport,
      client,
      poweredSession,
    };
  })();

  return modulesPromise;
}
