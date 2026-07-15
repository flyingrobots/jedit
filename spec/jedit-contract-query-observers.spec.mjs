import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const OBSERVERS_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-query-observers.js');
const MUTATION_HANDLERS_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-mutation-handlers.js');
const PACKAGE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-package.js');
const RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'full-snapshot-hot-text-runtime-fixture.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');
const BUFFER_KEY = 'notes/observer.md';
const INITIAL_TEXT = 'hello observers';
const LATER_TEXT = '!';
const FRONTIER_REF = 'frontier:observer-test';
const FIRST_LINE = 0;
const SINGLE_LINE = 1;
const BYTE_BUDGET = 80;

let modulesPromise;

test('jedit query observer registry exposes generated query operation names', async () => {
  const modules = await loadModules();
  const context = createContext(modules);
  const descriptor = modules.packageModule.jeditHotTextContractPackage();

  assert.deepEqual(context.observers.queryOperationNames, descriptor.queryOperationNames);
});

test('jedit query observers read worldline snapshots and text windows', async () => {
  const modules = await loadModules();
  const context = createContext(modules);
  const session = createSession(modules, context.mutations);
  const descriptor = modules.packageModule.jeditHotTextContractPackage();
  const [snapshotOperation, textWindowOperation] = descriptor.queryOperationNames;

  const snapshot = context.observers.observeQuery({
    operationName: snapshotOperation,
    session,
    frontierRef: FRONTIER_REF,
    input: {
      worldlineId: session.worldline.worldlineId,
    },
  });
  const textWindow = context.observers.observeQuery({
    operationName: textWindowOperation,
    session,
    frontierRef: FRONTIER_REF,
    input: {
      ...textWindowInput(session),
    },
  });

  assert.equal(snapshot.reading.text, INITIAL_TEXT);
  assert.equal(textWindow.reading.lines[0].text, INITIAL_TEXT);
  assert.equal(textWindow.projection.basisHeadId, session.worldline.canonicalHeadId);
  assert.deepEqual(textWindow.projection.byteRange, { startByte: 0, endByte: INITIAL_TEXT.length });
  assert.match(textWindow.planId, /^observer-plan:textWindow:/);
  assert.equal(textWindow.planId.includes('fake'), false);
});

test('text window observers reuse disposable CRLF and Unicode line indexes', async () => {
  const modules = await loadModules();
  const fixture = modules.runtime.createFullSnapshotHotTextRuntimeFixture();
  const requests = [];
  const context = createContext(modules, {
    ...fixture,
    textWindow(state, request) {
      requests.push(request);
      return fixture.textWindow(state, request);
    },
  });
  const text = 'zero\r\none🙂\r\ntwo';
  const session = createSession(modules, context.mutations, text);
  const operationName = modules.packageModule.jeditHotTextContractPackage().queryOperationNames[1];

  const first = context.observers.observeTextWindow({
    operationName,
    session,
    frontierRef: FRONTIER_REF,
    input: {
      ...textWindowInput(session, text),
      cursorLine: 1,
    },
  });
  const second = context.observers.observeTextWindow({
    operationName,
    session,
    frontierRef: FRONTIER_REF,
    input: {
      ...textWindowInput(session, text),
      cursorLine: 2,
    },
  });
  const repeated = context.observers.observeTextWindow({
    operationName,
    session,
    frontierRef: FRONTIER_REF,
    input: {
      ...textWindowInput(session, text),
      cursorLine: 2,
    },
  });

  assert.deepEqual(first.reading.lines[0], {
    lineNumber: 1,
    text: 'one🙂',
    startByte: 6,
    endByte: 13,
  });
  assert.deepEqual(second.reading.lines[0], {
    lineNumber: 2,
    text: 'two',
    startByte: 15,
    endByte: 18,
  });
  assert.deepEqual(requests.map((request) => request.byteRange), [
    { startByte: 0, endByte: 18 },
    { startByte: 6, endByte: 13 },
    { startByte: 15, endByte: 18 },
  ]);
  assert.deepEqual(repeated.projection, second.projection);
  assert.equal(repeated.materialization.key.basis.headId, session.worldline.canonicalHeadId);
  assert.equal(repeated.materialization.key.basis.requestFrontierRef, FRONTIER_REF);
  assert.equal(repeated.materialization.key.observerPlanId, repeated.planId);
  assert.deepEqual(repeated.materialization.key.coverage, {
    startByte: { kind: 'utf8-byte-offset', value: 15 },
    endByte: { kind: 'utf8-byte-offset', value: 18 },
  });
  assert.equal(repeated.materialization.completeness, 'complete');
  assert.equal(repeated.materialization.materializedProjectionBytes, 3);
});

test('text window observers reject projections from the wrong causal basis', async () => {
  const modules = await loadModules();
  const fixture = modules.runtime.createFullSnapshotHotTextRuntimeFixture();
  const context = createContext(modules, {
    ...fixture,
    textWindow(state, request) {
      return { ...fixture.textWindow(state, request), basisHeadId: 'head:wrong-basis' };
    },
  });
  const session = createSession(modules, context.mutations);

  assert.throws(() => context.observers.observeQuery({
    operationName: modules.packageModule.jeditHotTextContractPackage().queryOperationNames[1],
    session,
    frontierRef: FRONTIER_REF,
    input: textWindowInput(session),
  }), /does not match its requested causal basis/);
});

test('text window observers reject input from another worldline', async () => {
  const modules = await loadModules();
  const context = createContext(modules);
  const session = createSession(modules, context.mutations);

  assert.throws(() => context.observers.observeQuery({
    operationName: modules.packageModule.jeditHotTextContractPackage().queryOperationNames[1],
    session,
    frontierRef: FRONTIER_REF,
    input: {
      ...textWindowInput(session),
      worldlineId: 'wl:other-buffer',
    },
  }), /worldline does not match its session basis/);
});

test('text window observers reject projection metadata from another worldline', async () => {
  const modules = await loadModules();
  const fixture = modules.runtime.createFullSnapshotHotTextRuntimeFixture();
  const context = createContext(modules, {
    ...fixture,
    textWindow(state, request) {
      const projection = fixture.textWindow(state, request);
      return {
        ...projection,
        basis: { ...projection.basis, worldlineId: 'wl:other-buffer' },
      };
    },
  });
  const session = createSession(modules, context.mutations);

  assert.throws(() => context.observers.observeQuery({
    operationName: modules.packageModule.jeditHotTextContractPackage().queryOperationNames[1],
    session,
    frontierRef: FRONTIER_REF,
    input: textWindowInput(session),
  }), /does not match its requested causal basis/);
});

test('text window observers label historical materializations with their requested head', async () => {
  const modules = await loadModules();
  const context = createContext(modules);
  const descriptor = modules.packageModule.jeditHotTextContractPackage();
  const [createOperation, replaceOperation] = descriptor.mutationOperationNames;
  const textWindowOperation = descriptor.queryOperationNames[1];
  const created = context.mutations.executeMutation({
    operationName: createOperation,
    input: {
      bufferKey: BUFFER_KEY,
      initialText: INITIAL_TEXT,
      projectionPath: BUFFER_KEY,
    },
  });
  const replaced = context.mutations.executeMutation({
    operationName: replaceOperation,
    session: created.nextSession,
    input: {
      worldlineId: created.nextSession.worldline.worldlineId,
      baseHeadId: created.nextSession.worldline.canonicalHeadId,
      startByte: Buffer.byteLength(INITIAL_TEXT, 'utf8'),
      endByte: Buffer.byteLength(INITIAL_TEXT, 'utf8'),
      insertText: LATER_TEXT,
    },
  });

  const historical = context.observers.observeQuery({
    operationName: textWindowOperation,
    session: replaced.nextSession,
    frontierRef: FRONTIER_REF,
    input: {
      ...textWindowInput(created.nextSession),
      worldlineId: replaced.nextSession.worldline.worldlineId,
    },
  });

  assert.equal(historical.reading.head.headId, created.nextSession.worldline.canonicalHeadId);
  assert.equal(historical.projection.basis.headId, created.nextSession.worldline.canonicalHeadId);
  assert.equal(historical.reading.lines[0].text, INITIAL_TEXT);
});

test('jedit query observer registry has no lifecycle or mutation authority', async () => {
  const modules = await loadModules();
  const context = createContext(modules);

  assert.equal(context.observers.supportsQueryObserver('unsupportedQuery'), false);
  assert.deepEqual(absentAuthorityMethods(context.observers), []);
});

function absentAuthorityMethods(observerRegistry) {
  return [
    'requestStart',
    'requestRunUntilIdle',
    'requestStop',
    'tick',
    'submitIntentBytes',
    'executeMutation',
    'createBuffer',
    'replaceRange',
    'writeFactSet',
    'writeState',
  ].filter((methodName) => methodName in observerRegistry);
}

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
    const [observers, mutations, packageModule, runtime, hash] = await Promise.all([
      import(pathToFileURL(OBSERVERS_MODULE_PATH).href),
      import(pathToFileURL(MUTATION_HANDLERS_MODULE_PATH).href),
      import(pathToFileURL(PACKAGE_MODULE_PATH).href),
      import(pathToFileURL(RUNTIME_MODULE_PATH).href),
      import(pathToFileURL(HASH_MODULE_PATH).href),
    ]);

    return {
      observers,
      mutations,
      packageModule,
      runtime,
      hash,
    };
  })();

  return modulesPromise;
}

function createContext(modules, runtime = modules.runtime.createFullSnapshotHotTextRuntimeFixture()) {
  const hash = modules.hash.createHashPort();
  return {
    mutations: modules.mutations.createJeditContractMutationHandlerRegistry({
      runtime,
      hash,
    }),
    observers: modules.observers.createJeditContractQueryObserverRegistry({
      runtime,
      hash,
    }),
  };
}

function textWindowInput(session, text = INITIAL_TEXT) {
  return {
    worldlineId: session.worldline.worldlineId,
    basisHeadId: session.worldline.canonicalHeadId,
    startByte: 0,
    endByte: Buffer.byteLength(text, 'utf8'),
    cursorLine: FIRST_LINE,
    viewportLineCount: SINGLE_LINE,
    beforeLines: FIRST_LINE,
    afterLines: FIRST_LINE,
    maxBytes: BYTE_BUDGET,
  };
}

function createSession(modules, mutations, initialText = INITIAL_TEXT) {
  const descriptor = modules.packageModule.jeditHotTextContractPackage();
  const [createOperation] = descriptor.mutationOperationNames;
  const created = mutations.executeMutation({
    operationName: createOperation,
    input: {
      bufferKey: BUFFER_KEY,
      initialText,
      projectionPath: BUFFER_KEY,
    },
  });
  return created.nextSession;
}
