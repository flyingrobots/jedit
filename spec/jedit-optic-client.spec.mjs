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
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');
const CODEC_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'jedit-echo-optic-codec.js');
const LEGACY_EAGER_LOAD_CAP_BYTES = 24 * 1024;
const UTF8_ENCODER = new TextEncoder();

async function loadModules() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  const [opticClientModule, adapter, transportClientModule, fakeTransportModule, hashModule, codecModule] = await Promise.all([
    import(pathToFileURL(OPTIC_CLIENT_MODULE_PATH).href),
    import(pathToFileURL(ADAPTER_MODULE_PATH).href),
    import(pathToFileURL(TRANSPORT_CLIENT_MODULE_PATH).href),
    import(pathToFileURL(FAKE_TRANSPORT_MODULE_PATH).href),
    import(pathToFileURL(HASH_MODULE_PATH).href),
    import(pathToFileURL(CODEC_MODULE_PATH).href),
  ]);

  return { opticClientModule, adapter, transportClientModule, fakeTransportModule, hashModule, codecModule };
}

test('in-memory optic client exposes GraphQL-shaped mutation and observer operations', async () => {
  const { opticClientModule, adapter, hashModule } = await loadModules();
  const runtime = adapter.createInMemoryHotTextRuntime();
  const client = opticClientModule.createInMemoryJeditOpticClient(runtime, hashModule.createHashPort());

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

test('transport-backed textWindow returns a bounded large-file reading', async () => {
  const { transportClientModule, fakeTransportModule, codecModule } = await loadModules();
  const fakeTransport = fakeTransportModule.createFakeEchoJeditOpticTransport();
  const observedRequests = [];
  const transport = {
    kernelInfo() {
      return fakeTransport.kernelInfo();
    },
    submitIntentBytes(bytes) {
      return fakeTransport.submitIntentBytes(bytes);
    },
    observeBytes(bytes) {
      observedRequests.push(codecModule.decodeJeditObserveRequest(bytes));
      return fakeTransport.observeBytes(bytes);
    },
    schedulerStatusBytes() {
      return fakeTransport.schedulerStatusBytes();
    },
  };
  const client = transportClientModule.createEchoTransportJeditOpticClient(transport);
  const largeLines = Array.from(
    { length: 1200 },
    (_, index) => `line-${String(index).padStart(4, '0')} ${'x'.repeat(40)}`,
  );
  const largeText = largeLines.join('\n');

  assert.ok(byteLength(largeText) > LEGACY_EAGER_LOAD_CAP_BYTES);

  const created = client.createBufferWorldline({
    bufferKey: 'src/large-main.ts',
    initialText: largeText,
    projectionPath: '/tmp/src/large-main.ts',
    createInitialCheckpoint: false,
  });

  const envelope = client.textWindow(
    created.nextSession,
    'frontier:text-window:1',
    {
      worldlineId: created.nextSession.worldline.worldlineId,
      cursorLine: 500,
      viewportLineCount: 4,
      beforeLines: 1,
      afterLines: 2,
      maxBytes: 4096,
    },
  );

  assert.equal(observedRequests.length, 1);
  assert.equal(observedRequests[0].operationName, codecModule.TEXT_WINDOW_OPERATION);
  assert.equal(envelope.operationName, codecModule.TEXT_WINDOW_OPERATION);
  assert.equal(envelope.frontierRef, 'frontier:text-window:1');
  assert.equal(envelope.reading.text, undefined);
  assert.equal(envelope.reading.startLine, 499);
  assert.equal(envelope.reading.lineCount, 7);
  assert.equal(envelope.reading.totalLineCount, largeLines.length);
  assert.equal(envelope.reading.hasMoreBefore, true);
  assert.equal(envelope.reading.hasMoreAfter, true);
  assert.deepEqual(
    envelope.reading.lines.map((line) => line.lineNumber),
    [499, 500, 501, 502, 503, 504, 505],
  );
  assert.equal(envelope.reading.lines[0].text, largeLines[499]);
  assert.equal(envelope.reading.lines[0].startByte, lineStartByte(largeLines, 499));
  assert.equal(envelope.reading.lines[0].endByte, lineStartByte(largeLines, 500) - 1);
  assert.ok(JSON.stringify(envelope.reading).length < byteLength(largeText));
});

function byteLength(text) {
  return UTF8_ENCODER.encode(text).length;
}

function lineStartByte(lines, lineNumber) {
  if (lineNumber === 0) {
    return 0;
  }
  return byteLength(lines.slice(0, lineNumber).join('\n')) + 1;
}
