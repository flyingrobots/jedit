import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const LOOP_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'trusted-echo-runtime-loop.js');
const TRANSPORT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'installed-jedit-contract-echo-transport.js');
const CLIENT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'jedit-echo-optic-client.js');
const SESSION_ADAPTER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'echo-backed-text-buffer-session.js');
const TICK_FREQUENCY_HZ = 60;
const TICK_INTERVAL_SECONDS = 1 / 60;
const CYCLE_LIMIT = 7;
const BUFFER_KEY = 'notes/runtime-loop.md';
const INITIAL_TEXT = 'loop';
const INVALID_TICK_FREQUENCY_HZ = 0;
const INVALID_CYCLE_LIMIT = 0;

let modulesPromise;

test('trusted Echo runtime loop records host cadence and drains through lifecycle port', async () => {
  const modules = await loadModules();
  const lifecycle = recordingLifecycle();
  const loop = modules.loop.createTrustedEchoRuntimeLoop({ lifecycle });

  assert.equal(loop.status().state, modules.loop.TRUSTED_ECHO_RUNTIME_LOOP_STOPPED);
  assert.deepEqual(loop.drain(), {
    accepted: false,
    lastRunCompletion: modules.loop.TRUSTED_ECHO_RUNTIME_LOOP_NOT_RUNNING,
  });
  assert.deepEqual(loop.start({
    tickFrequencyHz: TICK_FREQUENCY_HZ,
    cycleLimit: CYCLE_LIMIT,
  }), {
    state: modules.loop.TRUSTED_ECHO_RUNTIME_LOOP_RUNNING,
    tickFrequencyHz: TICK_FREQUENCY_HZ,
    cycleLimit: CYCLE_LIMIT,
    lastRunCompletion: 'started',
  });
  assert.deepEqual(loop.drain(), {
    accepted: true,
    lastRunCompletion: 'quiesced',
  });

  assert.deepEqual(lifecycle.startRequests, [TICK_INTERVAL_SECONDS]);
  assert.deepEqual(lifecycle.runRequests, [CYCLE_LIMIT]);
  assert.equal('tick' in loop, false);
  assert.equal('requestRunUntilIdle' in loop, false);
});

test('trusted Echo runtime loop keeps rejected start from enabling drain', async () => {
  const modules = await loadModules();
  const lifecycle = recordingLifecycle();
  lifecycle.rejectStart = true;
  const loop = modules.loop.createTrustedEchoRuntimeLoop({ lifecycle });

  assert.deepEqual(loop.start({
    tickFrequencyHz: TICK_FREQUENCY_HZ,
    cycleLimit: CYCLE_LIMIT,
  }), {
    state: modules.loop.TRUSTED_ECHO_RUNTIME_LOOP_STOPPED,
    lastRunCompletion: 'start-rejected',
  });
  assert.deepEqual(loop.drain(), {
    accepted: false,
    lastRunCompletion: modules.loop.TRUSTED_ECHO_RUNTIME_LOOP_NOT_RUNNING,
  });
  assert.deepEqual(lifecycle.runRequests, []);
});

test('trusted Echo runtime loop rejects invalid start requests before lifecycle control', async () => {
  const modules = await loadModules();
  const lifecycle = recordingLifecycle();
  const loop = modules.loop.createTrustedEchoRuntimeLoop({ lifecycle });

  assert.deepEqual(loop.start({
    tickFrequencyHz: INVALID_TICK_FREQUENCY_HZ,
    cycleLimit: CYCLE_LIMIT,
  }), {
    state: modules.loop.TRUSTED_ECHO_RUNTIME_LOOP_STOPPED,
    lastRunCompletion: 'invalid-start-request',
  });
  assert.deepEqual(loop.start({
    tickFrequencyHz: TICK_FREQUENCY_HZ,
    cycleLimit: INVALID_CYCLE_LIMIT,
  }), {
    state: modules.loop.TRUSTED_ECHO_RUNTIME_LOOP_STOPPED,
    lastRunCompletion: 'invalid-start-request',
  });
  assert.deepEqual(lifecycle.startRequests, []);
  assert.deepEqual(lifecycle.runRequests, []);
});

test('trusted Echo runtime loop stops through lifecycle port', async () => {
  const modules = await loadModules();
  const lifecycle = recordingLifecycle();
  const loop = modules.loop.createTrustedEchoRuntimeLoop({ lifecycle });

  loop.start({
    tickFrequencyHz: TICK_FREQUENCY_HZ,
    cycleLimit: CYCLE_LIMIT,
  });

  assert.deepEqual(loop.stop(), {
    accepted: true,
    lastRunCompletion: 'stopped',
  });
  assert.equal(loop.status().state, modules.loop.TRUSTED_ECHO_RUNTIME_LOOP_STOPPED);
  assert.equal(lifecycle.stopRequests, 1);
});

test('trusted Echo runtime loop remains running when stop is rejected', async () => {
  const modules = await loadModules();
  const lifecycle = recordingLifecycle();
  lifecycle.rejectStop = true;
  const loop = modules.loop.createTrustedEchoRuntimeLoop({ lifecycle });

  loop.start({
    tickFrequencyHz: TICK_FREQUENCY_HZ,
    cycleLimit: CYCLE_LIMIT,
  });

  assert.deepEqual(loop.stop(), {
    accepted: false,
    lastRunCompletion: 'stop-rejected',
  });
  assert.equal(loop.status().state, modules.loop.TRUSTED_ECHO_RUNTIME_LOOP_RUNNING);
  assert.deepEqual(loop.drain(), {
    accepted: true,
    lastRunCompletion: 'quiesced',
  });
});

test('app-facing Echo-backed TextBufferSession port does not expose trusted host loop control', async () => {
  const modules = await loadModules();
  const transport = modules.transport.createInstalledJeditContractEchoTransport();
  const client = modules.client.createEchoTransportJeditOpticClient(transport);
  const session = modules.sessionAdapter.createEchoBackedTextBufferSession({
    client,
  });
  const optic = await session.createBuffer({
    bufferKey: BUFFER_KEY,
    initialText: INITIAL_TEXT,
    projectionPath: BUFFER_KEY,
  });

  assert.equal('start' in session, false);
  assert.equal('stop' in session, false);
  assert.equal('tick' in session, false);
  assert.equal('start' in optic, false);
  assert.equal('stop' in optic, false);
  assert.equal('tick' in optic, false);

  const lifecycle = recordingLifecycle();
  const beforeReadRequestCount = lifecycleRequestCount(lifecycle);
  await optic.textWindow(optic.currentReadBasis(), {
    cursorLine: 0,
    beforeLines: 0,
    viewportLineCount: 1,
    afterLines: 0,
    maxBytes: 80,
  });

  assert.equal(lifecycleRequestCount(lifecycle), beforeReadRequestCount);
});

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
    const [loop, transport, client, sessionAdapter] = await Promise.all([
      import(pathToFileURL(LOOP_MODULE_PATH).href),
      import(pathToFileURL(TRANSPORT_MODULE_PATH).href),
      import(pathToFileURL(CLIENT_MODULE_PATH).href),
      import(pathToFileURL(SESSION_ADAPTER_MODULE_PATH).href),
    ]);

    return {
      loop,
      transport,
      client,
      sessionAdapter,
    };
  })();

  return modulesPromise;
}

function recordingLifecycle() {
  return {
    rejectStart: false,
    rejectStop: false,
    startRequests: [],
    runRequests: [],
    stopRequests: 0,
    requestStart(request) {
      this.startRequests.push(request.tickIntervalSeconds);
      return {
        accepted: !this.rejectStart,
        lastRunCompletion: this.rejectStart ? 'start-rejected' : 'started',
      };
    },
    requestRunUntilIdle(request) {
      this.runRequests.push(request.cycleLimit);
      return {
        accepted: true,
        lastRunCompletion: 'quiesced',
      };
    },
    requestStop() {
      this.stopRequests += 1;
      return {
        accepted: !this.rejectStop,
        lastRunCompletion: this.rejectStop ? 'stop-rejected' : 'stopped',
      };
    },
  };
}

function lifecycleRequestCount(lifecycle) {
  return lifecycle.startRequests.length
    + lifecycle.runRequests.length
    + lifecycle.stopRequests;
}
