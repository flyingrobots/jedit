import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const OBSERVERS_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-query-observers.js');
const MUTATION_HANDLERS_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-mutation-handlers.js');
const PACKAGE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-package.js');
const RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'in-memory-hot-text-runtime.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');
const BUFFER_KEY = 'notes/observer.md';
const INITIAL_TEXT = 'hello observers';
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
      worldlineId: session.worldline.worldlineId,
      cursorLine: FIRST_LINE,
      viewportLineCount: SINGLE_LINE,
      beforeLines: FIRST_LINE,
      afterLines: FIRST_LINE,
      maxBytes: BYTE_BUDGET,
    },
  });

  assert.equal(snapshot.reading.text, INITIAL_TEXT);
  assert.equal(textWindow.reading.lines[0].text, INITIAL_TEXT);
  assert.match(textWindow.planId, /^observer-plan:textWindow:/);
  assert.equal(textWindow.planId.includes('fake'), false);
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

function createContext(modules) {
  const runtime = modules.runtime.createInMemoryHotTextRuntime();
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

function createSession(modules, mutations) {
  const descriptor = modules.packageModule.jeditHotTextContractPackage();
  const [createOperation] = descriptor.mutationOperationNames;
  const created = mutations.executeMutation({
    operationName: createOperation,
    input: {
      bufferKey: BUFFER_KEY,
      initialText: INITIAL_TEXT,
      projectionPath: BUFFER_KEY,
    },
  });
  return created.nextSession;
}
