import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const OPTIC_CLIENT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-optic-client.js');
const ADAPTER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'in-memory-hot-text-runtime.js');
const TRANSPORT_CLIENT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'jedit-echo-optic-client.js');
const FAKE_TRANSPORT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'fake-echo-jedit-optic-transport.js');
const CODEC_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'jedit-echo-optic-codec.js');

async function loadModules() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  const [opticClientModule, adapter, transportClientModule, fakeTransportModule, codecModule] = await Promise.all([
    import(pathToFileURL(OPTIC_CLIENT_MODULE_PATH).href),
    import(pathToFileURL(ADAPTER_MODULE_PATH).href),
    import(pathToFileURL(TRANSPORT_CLIENT_MODULE_PATH).href),
    import(pathToFileURL(FAKE_TRANSPORT_MODULE_PATH).href),
    import(pathToFileURL(CODEC_MODULE_PATH).href),
  ]);

  return { opticClientModule, adapter, transportClientModule, fakeTransportModule, codecModule };
}

test('in-memory optic client exposes GraphQL-shaped mutation and observer operations', async () => {
  const { opticClientModule, adapter } = await loadModules();
  const runtime = adapter.createInMemoryHotTextRuntime();
  const client = opticClientModule.createInMemoryJeditOpticClient(runtime);

  const created = client.createBufferWorldline({
    bufferKey: 'notes/today.md',
    initialText: 'hello world',
    projectionPath: '/tmp/notes/today.md',
    createInitialCheckpoint: true,
  });

  assert.equal(created.result.worldline.bufferKey, 'notes/today.md');
  assert.equal(created.result.checkpoint?.kind, 'INITIAL');

  const edited = client.replaceRangeAsTick(created.nextSession, {
    worldlineId: created.nextSession.worldline.worldlineId,
    baseHeadId: created.nextSession.worldline.canonicalHeadId,
    startByte: 5,
    endByte: 5,
    insertText: ' brave new',
    author: 'tester',
  });

  assert.ok(edited.result);
  assert.equal(edited.result.receipt.rewriteKind, 'REPLACE_RANGE_AS_TICK');

  const saved = client.createCheckpoint(edited.nextSession, {
    worldlineId: edited.nextSession.worldline.worldlineId,
    kind: 'MANUAL_SAVE',
    label: 'after edit',
  });

  assert.ok(saved.result);
  assert.equal(saved.result.checkpoint.kind, 'MANUAL_SAVE');

  const reading = client.worldlineSnapshot(
    saved.nextSession,
    'frontier:wl:notes-today-md:2',
    {
      worldlineId: saved.nextSession.worldline.worldlineId,
    },
  );

  assert.equal(reading.operationName, 'worldlineSnapshot');
  assert.equal(reading.frontierRef, 'frontier:wl:notes-today-md:2');
  assert.equal(reading.reading.text, 'hello brave new world');
  assert.equal(reading.reading.checkpoints.length, 2);
});

test('transport-backed optic client exercises the fake Echo host through encoded bytes', async () => {
  const { transportClientModule, fakeTransportModule, codecModule } = await loadModules();
  const fakeTransport = fakeTransportModule.createFakeEchoJeditOpticTransport();
  const calls = [];
  const transport = {
    kernelInfo() {
      return fakeTransport.kernelInfo();
    },
    submitIntentBytes(bytes) {
      calls.push(['intent', Array.from(bytes)]);
      return fakeTransport.submitIntentBytes(bytes);
    },
    observeBytes(bytes) {
      calls.push(['observe', Array.from(bytes)]);
      return fakeTransport.observeBytes(bytes);
    },
    schedulerStatusBytes() {
      calls.push(['scheduler']);
      return fakeTransport.schedulerStatusBytes();
    },
  };
  const client = transportClientModule.createEchoTransportJeditOpticClient(transport);

  const created = client.createBufferWorldline({
    bufferKey: 'notes/transport.md',
    initialText: 'alpha omega',
    projectionPath: '/tmp/notes/transport.md',
    createInitialCheckpoint: true,
  });

  const edited = client.replaceRangeAsTick(created.nextSession, {
    worldlineId: created.nextSession.worldline.worldlineId,
    baseHeadId: created.nextSession.worldline.canonicalHeadId,
    startByte: 5,
    endByte: 5,
    insertText: ' beta',
    author: 'transport-test',
  });

  const saved = client.createCheckpoint(edited.nextSession, {
    worldlineId: edited.nextSession.worldline.worldlineId,
    kind: 'MANUAL_SAVE',
    label: 'transport checkpoint',
  });

  const reading = client.worldlineSnapshot(
    saved.nextSession,
    'frontier:transport:1',
    {
      worldlineId: saved.nextSession.worldline.worldlineId,
    },
  );

  assert.equal(reading.reading.text, 'alpha beta omega');
  assert.equal(reading.reading.checkpoints.length, 2);
  assert.deepEqual(calls.map((entry) => entry[0]), ['intent', 'intent', 'intent', 'observe']);
  for (const entry of calls) {
    if (entry[0] === 'scheduler') {
      continue;
    }
    assert.ok(entry[1] instanceof Array, 'transport calls should capture byte arrays, not runtime objects');
  }

  const staleBytes = fakeTransport.submitIntentBytes(codecModule.encodeJeditIntentRequest({
    kind: codecModule.JEDIT_INTENT_REQUEST_KIND,
    operationName: codecModule.REPLACE_RANGE_AS_TICK_OPERATION,
    session: created.nextSession,
    input: {
      worldlineId: created.nextSession.worldline.worldlineId,
      baseHeadId: 'head:stale',
      startByte: 0,
      endByte: 0,
      insertText: '!',
      author: 'transport-test',
    },
  }));
  const stale = codecModule.decodeJeditIntentResponse(staleBytes);

  assert.equal(stale.status, codecModule.JEDIT_TRANSPORT_STATUS_OBSTRUCTED);
  assert.equal(stale.operationName, codecModule.REPLACE_RANGE_AS_TICK_OPERATION);
  assert.equal(stale.obstruction.code, 'JEDIT_CONTRACT_RUNTIME_ERROR');
  assert.match(stale.obstruction.message, /Base head mismatch/);
});
