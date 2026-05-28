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
const READ_BASIS_HANDLE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'read-basis-handle-registry.js');
const TEXT_BUFFER_SESSION_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'text-buffer-session.js');
const ECHO_BACKED_TEXT_BUFFER_SESSION_MODULE_PATH = path.join(
  REPO_ROOT,
  'dist',
  'adapters',
  'echo-backed-text-buffer-session.js',
);
const LEGACY_EAGER_LOAD_CAP_BYTES = 24 * 1024;
const STACK_WITNESS_AUTHOR = 'stack-witness-0001';
const STACK_WITNESS_BUFFER_KEY = 'demo.txt';
const STACK_WITNESS_FRONTIER_REF = 'frontier:stack-witness-0001:B1';
const STACK_WITNESS_TEXT = 'hello';
const EMPTY_TEXT = '';
const FIRST_BYTE_OFFSET = 0;
const FIRST_LINE = 0;
const SINGLE_LINE_WINDOW = 1;
const SEMANTIC_READ_BASIS_HANDLE_PREFIX = 'text-buffer:';
const RAW_BASIS_FIELD_NAMES = Object.freeze([
  'worldlineId',
  'basisRef',
  'headId',
  'tick',
  'root',
  'strand',
]);
const UTF8_ENCODER = new TextEncoder();

async function loadModules() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  const [
    opticClientModule,
    adapter,
    transportClientModule,
    fakeTransportModule,
    hashModule,
    codecModule,
    readBasisHandleModule,
    textBufferSessionModule,
    echoBackedTextBufferSessionModule,
  ] = await Promise.all([
    import(pathToFileURL(OPTIC_CLIENT_MODULE_PATH).href),
    import(pathToFileURL(ADAPTER_MODULE_PATH).href),
    import(pathToFileURL(TRANSPORT_CLIENT_MODULE_PATH).href),
    import(pathToFileURL(FAKE_TRANSPORT_MODULE_PATH).href),
    import(pathToFileURL(HASH_MODULE_PATH).href),
    import(pathToFileURL(CODEC_MODULE_PATH).href),
    import(pathToFileURL(READ_BASIS_HANDLE_MODULE_PATH).href),
      import(pathToFileURL(TEXT_BUFFER_SESSION_MODULE_PATH).href),
      import(pathToFileURL(ECHO_BACKED_TEXT_BUFFER_SESSION_MODULE_PATH).href),
  ]);

  return {
    opticClientModule,
    adapter,
    transportClientModule,
    fakeTransportModule,
    hashModule,
    codecModule,
    readBasisHandleModule,
    textBufferSessionModule,
    echoBackedTextBufferSessionModule,
  };
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
  assert.equal(edited.result.ropeDiff.rewriteKind, 'REPLACE_RANGE_AS_TICK');

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
  const {
    transportClientModule,
    fakeTransportModule,
    codecModule,
  } = await loadModules();
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

test('codec exposes a typed invalid JSON payload error', async () => {
  const { codecModule } = await loadModules();

  assert.equal(typeof codecModule.InvalidJsonPayloadError, 'function');
  assert.throws(
    () => {
      throw new codecModule.InvalidJsonPayloadError();
    },
    (error) => error?.name === 'InvalidJsonPayloadError',
  );
});

test('transport-backed textWindow uses an opaque read basis handle', async () => {
  const {
    transportClientModule,
    fakeTransportModule,
    codecModule,
    readBasisHandleModule,
  } = await loadModules();
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

  const opened = client.openTextBuffer({
    bufferKey: 'src/large-main.ts',
    initialText: largeText,
    projectionPath: '/tmp/src/large-main.ts',
    createInitialCheckpoint: false,
  });

  assert.equal(opened.readBasisHandle.kind, 'read-basis-handle');
  assert.equal(typeof opened.readBasisHandle.id, 'string');
  assert.equal(opened.readBasisHandle.id.includes(opened.nextSession.worldline.worldlineId), false);
  assert.equal(opened.readBasisHandle.id.includes(opened.nextSession.worldline.canonicalHeadId), false);
  assert.equal(opened.readBasisHandle.id.includes(opened.nextSession.worldline.bufferKey), false);
  assert.deepEqual(Object.keys(opened.readBasisHandle).sort(), ['id', 'kind']);
  for (const rawFieldName of RAW_BASIS_FIELD_NAMES) {
    assert.equal(
      Object.hasOwn(opened.readBasisHandle, rawFieldName),
      false,
      `ReadBasisHandle must not expose ${rawFieldName}`,
    );
  }
  const semanticReadBasisHandle = Object.freeze({
    kind: opened.readBasisHandle.kind,
    id: `${SEMANTIC_READ_BASIS_HANDLE_PREFIX}${opened.nextSession.worldline.bufferKey}`,
  });
  assert.throws(
    () => client.textWindow(
      opened.nextSession,
      'frontier:text-window:semantic-forgery',
      semanticReadBasisHandle,
      {
        cursorLine: 0,
        viewportLineCount: 1,
        beforeLines: 0,
        afterLines: 0,
        maxBytes: 128,
      },
    ),
    readBasisHandleModule.ReadBasisHandleResolutionError,
  );
  const clonedReadBasisHandle = Object.freeze({
    kind: opened.readBasisHandle.kind,
    id: opened.readBasisHandle.id,
  });
  assert.throws(
    () => client.textWindow(
      opened.nextSession,
      'frontier:text-window:cloned-handle',
      clonedReadBasisHandle,
      {
        cursorLine: 0,
        viewportLineCount: 1,
        beforeLines: 0,
        afterLines: 0,
        maxBytes: 128,
      },
    ),
    readBasisHandleModule.ReadBasisHandleResolutionError,
  );

  const envelope = client.textWindow(
    opened.nextSession,
    'frontier:text-window:1',
    opened.readBasisHandle,
    {
      cursorLine: 500,
      viewportLineCount: 4,
      beforeLines: 1,
      afterLines: 2,
      maxBytes: 4096,
    },
  );

  assert.equal(observedRequests.length, 1);
  assert.equal(observedRequests[0].operationName, codecModule.TEXT_WINDOW_OPERATION);
  assert.equal(observedRequests[0].input.worldlineId, opened.nextSession.worldline.worldlineId);
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

  const otherOpened = client.openTextBuffer({
    bufferKey: 'src/other-main.ts',
    initialText: 'other',
    projectionPath: '/tmp/src/other-main.ts',
    createInitialCheckpoint: false,
  });
  assert.throws(
    () => client.textWindow(
      otherOpened.nextSession,
      'frontier:text-window:cross-session',
      opened.readBasisHandle,
      {
        cursorLine: FIRST_LINE,
        viewportLineCount: SINGLE_LINE_WINDOW,
        beforeLines: FIRST_LINE,
        afterLines: FIRST_LINE,
        maxBytes: 128,
      },
    ),
    readBasisHandleModule.ReadBasisHandleResolutionError,
  );
  const otherEnvelope = client.textWindow(
    otherOpened.nextSession,
    'frontier:text-window:other',
    otherOpened.readBasisHandle,
    {
      cursorLine: FIRST_LINE,
      viewportLineCount: SINGLE_LINE_WINDOW,
      beforeLines: FIRST_LINE,
      afterLines: FIRST_LINE,
      maxBytes: 128,
    },
  );
  assert.deepEqual(
    otherEnvelope.reading.lines.map((line) => line.text),
    ['other'],
  );
});

test('Stack Witness 0001 walks createBuffer -> replaceRange -> textWindow through Echo transport', async () => {
  const { transportClientModule, fakeTransportModule, codecModule } = await loadModules();
  const fakeTransport = fakeTransportModule.createFakeEchoJeditOpticTransport();
  const intentRequests = [];
  const observeRequests = [];
  const transport = {
    kernelInfo() {
      return fakeTransport.kernelInfo();
    },
    submitIntentBytes(bytes) {
      intentRequests.push(codecModule.decodeJeditIntentRequest(bytes));
      return fakeTransport.submitIntentBytes(bytes);
    },
    observeBytes(bytes) {
      observeRequests.push(codecModule.decodeJeditObserveRequest(bytes));
      return fakeTransport.observeBytes(bytes);
    },
    schedulerStatusBytes() {
      return fakeTransport.schedulerStatusBytes();
    },
  };
  const client = transportClientModule.createEchoTransportJeditOpticClient(transport);

  const opened = client.openTextBuffer({
    bufferKey: STACK_WITNESS_BUFFER_KEY,
    initialText: EMPTY_TEXT,
    projectionPath: STACK_WITNESS_BUFFER_KEY,
    createInitialCheckpoint: false,
  });

  const edited = client.replaceRangeAsTick(opened.nextSession, {
    worldlineId: opened.nextSession.worldline.worldlineId,
    baseHeadId: opened.nextSession.worldline.canonicalHeadId,
    startByte: FIRST_BYTE_OFFSET,
    endByte: FIRST_BYTE_OFFSET,
    insertText: STACK_WITNESS_TEXT,
    author: STACK_WITNESS_AUTHOR,
  });
  assert.notEqual(
    edited.nextSession.worldline.canonicalHeadId,
    opened.nextSession.worldline.canonicalHeadId,
  );

  const envelope = client.textWindow(
    edited.nextSession,
    STACK_WITNESS_FRONTIER_REF,
    opened.readBasisHandle,
    {
      cursorLine: FIRST_LINE,
      viewportLineCount: SINGLE_LINE_WINDOW,
      beforeLines: FIRST_LINE,
      afterLines: FIRST_LINE,
      maxBytes: byteLength(STACK_WITNESS_TEXT),
    },
  );

  assert.deepEqual(
    intentRequests.map((request) => request.operationName),
    [
      codecModule.CREATE_BUFFER_WORLDLINE_OPERATION,
      codecModule.REPLACE_RANGE_AS_TICK_OPERATION,
    ],
  );
  assert.equal(observeRequests.length, 1);
  assert.equal(observeRequests[0].operationName, codecModule.TEXT_WINDOW_OPERATION);
  assert.equal(envelope.operationName, codecModule.TEXT_WINDOW_OPERATION);
  assert.equal(envelope.frontierRef, STACK_WITNESS_FRONTIER_REF);
  assert.equal(envelope.reading.worldline.worldlineId, edited.nextSession.worldline.worldlineId);
  assert.equal(envelope.reading.head.headId, edited.nextSession.worldline.canonicalHeadId);
  assert.equal(envelope.reading.startLine, FIRST_LINE);
  assert.equal(envelope.reading.lineCount, SINGLE_LINE_WINDOW);
  assert.equal(envelope.reading.totalLineCount, SINGLE_LINE_WINDOW);
  assert.equal(envelope.reading.hasMoreBefore, false);
  assert.equal(envelope.reading.hasMoreAfter, false);
  assert.deepEqual(
    envelope.reading.lines.map((line) => line.text),
    [STACK_WITNESS_TEXT],
  );
  assert.equal(envelope.reading.lines[0].startByte, FIRST_BYTE_OFFSET);
  assert.equal(envelope.reading.lines[0].endByte, byteLength(STACK_WITNESS_TEXT));
});

test('TextBufferOptic creates, edits, and reads without exposing runtime coordinates', async () => {
  const {
    transportClientModule,
    fakeTransportModule,
    textBufferSessionModule,
  } = await loadModules();
  const client = transportClientModule.createEchoTransportJeditOpticClient(
    fakeTransportModule.createFakeEchoJeditOpticTransport(),
  );
  const session = textBufferSessionModule.createTextBufferSession(client);

  const optic = await session.createBuffer({
    bufferKey: STACK_WITNESS_BUFFER_KEY,
    initialText: EMPTY_TEXT,
    projectionPath: STACK_WITNESS_BUFFER_KEY,
  });
  const readBasis = optic.currentReadBasis();

  assert.deepEqual(Object.keys(optic.buffer).sort(), [
    'bufferId',
    'bufferKey',
    'createdAt',
    'projectionPath',
  ]);
  assert.equal(optic.buffer.bufferKey, STACK_WITNESS_BUFFER_KEY);
  for (const rawFieldName of RAW_BASIS_FIELD_NAMES) {
    assert.equal(Object.hasOwn(optic, rawFieldName), false);
    assert.equal(Object.hasOwn(optic.buffer, rawFieldName), false);
    assert.equal(Object.hasOwn(readBasis, rawFieldName), false);
  }

  const applied = await optic.applyIntent({
    kind: 'replaceRange',
    startByte: FIRST_BYTE_OFFSET,
    endByte: FIRST_BYTE_OFFSET,
    insertText: STACK_WITNESS_TEXT,
  });

  assert.equal(applied.buffer.bufferId, optic.buffer.bufferId);
  assert.equal(applied.readBasis, optic.currentReadBasis());
  assert.equal(applied.bufferVersion, 1);
  assert.equal(typeof applied.receiptId, 'string');

  const observed = await optic.textWindow(optic.currentReadBasis(), {
    cursorLine: FIRST_LINE,
    viewportLineCount: SINGLE_LINE_WINDOW,
    beforeLines: FIRST_LINE,
    afterLines: FIRST_LINE,
    maxBytes: byteLength(STACK_WITNESS_TEXT),
  });

  assert.equal(observed.value.cursorLine, FIRST_LINE);
  assert.equal(observed.value.viewportLineCount, SINGLE_LINE_WINDOW);
  assert.equal(observed.value.lineCount, SINGLE_LINE_WINDOW);
  assert.equal(observed.value.byteLength, byteLength(STACK_WITNESS_TEXT));
  assert.equal(observed.value.truncated, false);
  assert.deepEqual(
    observed.value.lines.map((line) => line.text),
    [STACK_WITNESS_TEXT],
  );
  assert.equal(observed.evidence.readingId, observed.value.readingId);
});

test('TextBufferOptic rejects cloned read basis handles', async () => {
  const {
    transportClientModule,
    fakeTransportModule,
    readBasisHandleModule,
    textBufferSessionModule,
  } = await loadModules();
  const client = transportClientModule.createEchoTransportJeditOpticClient(
    fakeTransportModule.createFakeEchoJeditOpticTransport(),
  );
  const session = textBufferSessionModule.createTextBufferSession(client);
  const optic = await session.createBuffer({
    bufferKey: STACK_WITNESS_BUFFER_KEY,
    initialText: STACK_WITNESS_TEXT,
    projectionPath: STACK_WITNESS_BUFFER_KEY,
  });
  const clonedReadBasis = Object.freeze({
    kind: optic.currentReadBasis().kind,
    id: optic.currentReadBasis().id,
  });

  await assert.rejects(
    () => optic.textWindow(clonedReadBasis, {
      cursorLine: FIRST_LINE,
      viewportLineCount: SINGLE_LINE_WINDOW,
      beforeLines: FIRST_LINE,
      afterLines: FIRST_LINE,
      maxBytes: byteLength(STACK_WITNESS_TEXT),
    }),
    readBasisHandleModule.ReadBasisHandleResolutionError,
  );
});

test('TextBufferOptic does not mark a satisfied bounded aperture as truncated', async () => {
  const {
    transportClientModule,
    fakeTransportModule,
    textBufferSessionModule,
  } = await loadModules();
  const client = transportClientModule.createEchoTransportJeditOpticClient(
    fakeTransportModule.createFakeEchoJeditOpticTransport(),
  );
  const session = textBufferSessionModule.createTextBufferSession(client);
  const lines = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];
  const optic = await session.createBuffer({
    bufferKey: 'demo-multiline.txt',
    initialText: lines.join('\n'),
    projectionPath: 'demo-multiline.txt',
  });

  const observed = await optic.textWindow(optic.currentReadBasis(), {
    cursorLine: 2,
    viewportLineCount: 1,
    beforeLines: 1,
    afterLines: 1,
    maxBytes: 1024,
  });

  assert.deepEqual(
    observed.value.lines.map((line) => line.text),
    ['bravo', 'charlie', 'delta'],
  );
  assert.equal(observed.value.truncated, false);

  const byteBounded = await optic.textWindow(optic.currentReadBasis(), {
    cursorLine: 2,
    viewportLineCount: 1,
    beforeLines: 1,
    afterLines: 1,
    maxBytes: 6,
  });

  assert.deepEqual(
    byteBounded.value.lines.map((line) => line.text),
    ['bravo'],
  );
  assert.equal(byteBounded.value.truncated, true);
});

test('Echo-backed TextBufferSession port does not request lifecycle during app-facing dispatch', async () => {
  const {
    transportClientModule,
    fakeTransportModule,
    echoBackedTextBufferSessionModule,
  } = await loadModules();
  const client = transportClientModule.createEchoTransportJeditOpticClient(
    fakeTransportModule.createFakeEchoJeditOpticTransport(),
  );
  const session = echoBackedTextBufferSessionModule.createEchoBackedTextBufferSession({
    client,
  });

  const optic = await session.createBuffer({
    bufferKey: STACK_WITNESS_BUFFER_KEY,
    initialText: EMPTY_TEXT,
    projectionPath: STACK_WITNESS_BUFFER_KEY,
  });
  await optic.applyIntent({
    kind: 'replaceRange',
    startByte: FIRST_BYTE_OFFSET,
    endByte: FIRST_BYTE_OFFSET,
    insertText: STACK_WITNESS_TEXT,
  });
  const observed = await optic.textWindow(optic.currentReadBasis(), {
    cursorLine: FIRST_LINE,
    viewportLineCount: SINGLE_LINE_WINDOW,
    beforeLines: FIRST_LINE,
    afterLines: FIRST_LINE,
    maxBytes: byteLength(STACK_WITNESS_TEXT),
  });

  assert.equal(observed.value.lines[0].text, STACK_WITNESS_TEXT);
  assert.equal('requestRunUntilIdle' in session, false);
  assert.equal('tick' in session, false);
  assert.equal('requestRunUntilIdle' in optic, false);
  assert.equal('tick' in optic, false);
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
