import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const HANDLERS_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-mutation-handlers.js');
const PACKAGE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-package.js');
const RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'full-snapshot-hot-text-runtime-fixture.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');
const SESSION_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'text-buffer-session.js');
const TRANSPORT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'fake-echo-jedit-optic-transport.js');
const CLIENT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'jedit-echo-optic-client.js');
const BUFFER_KEY = 'notes/handler.md';
const INITIAL_TEXT = 'hello';
const INSERT_TEXT = ' world';
const FIRST_BYTE = 0;
const INSERT_BYTE = 5;
const CHECKPOINT_KIND = 'MANUAL_SAVE';

let modulesPromise;

test('jedit mutation handler registry exposes generated mutation operation names', async () => {
  const modules = await loadModules();
  const registry = createRegistry(modules);
  const descriptor = modules.packageModule.jeditHotTextContractPackage();

  assert.deepEqual(registry.mutationOperationNames, descriptor.mutationOperationNames);
});

test('jedit mutation handlers execute create replace and checkpoint behind registry boundary', async () => {
  const modules = await loadModules();
  const registry = createRegistry(modules);
  const descriptor = modules.packageModule.jeditHotTextContractPackage();
  const [createOperation, replaceOperation, checkpointOperation] = descriptor.mutationOperationNames;

  const created = registry.executeMutation({
    operationName: createOperation,
    input: {
      bufferKey: BUFFER_KEY,
      initialText: INITIAL_TEXT,
      projectionPath: BUFFER_KEY,
    },
  });
  const replaced = registry.executeMutation({
    operationName: replaceOperation,
    session: created.nextSession,
    input: {
      worldlineId: created.nextSession.worldline.worldlineId,
      baseHeadId: created.nextSession.worldline.canonicalHeadId,
      startByte: INSERT_BYTE,
      endByte: INSERT_BYTE,
      insertText: INSERT_TEXT,
    },
  });
  const checkpoint = registry.executeMutation({
    operationName: checkpointOperation,
    session: replaced.nextSession,
    input: {
      worldlineId: replaced.nextSession.worldline.worldlineId,
      kind: CHECKPOINT_KIND,
    },
  });

  assert.equal(created.result.worldline.bufferKey, BUFFER_KEY);
  assert.equal(replaced.result.ropeDiff.insertedByteLength, INSERT_TEXT.length);
  assert.equal(checkpoint.result.checkpoint.kind, CHECKPOINT_KIND);
});

test('app-facing TextBufferSession port does not expose mutation handlers', async () => {
  const modules = await loadModules();
  const client = modules.client.createEchoTransportJeditOpticClient(
    modules.transport.createFakeEchoJeditOpticTransport(),
  );
  const session = modules.session.createTextBufferSession(client);
  const optic = await session.createBuffer({
    bufferKey: BUFFER_KEY,
    initialText: INITIAL_TEXT,
    projectionPath: BUFFER_KEY,
  });

  assert.equal('executeMutation' in session, false);
  assert.equal('mutationOperationNames' in session, false);
  assert.equal('executeMutation' in optic, false);
  assert.equal('mutationOperationNames' in optic, false);
});

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
    const [handlers, packageModule, runtime, hash, session, transport, client] = await Promise.all([
      import(pathToFileURL(HANDLERS_MODULE_PATH).href),
      import(pathToFileURL(PACKAGE_MODULE_PATH).href),
      import(pathToFileURL(RUNTIME_MODULE_PATH).href),
      import(pathToFileURL(HASH_MODULE_PATH).href),
      import(pathToFileURL(SESSION_MODULE_PATH).href),
      import(pathToFileURL(TRANSPORT_MODULE_PATH).href),
      import(pathToFileURL(CLIENT_MODULE_PATH).href),
    ]);

    return {
      handlers,
      packageModule,
      runtime,
      hash,
      session,
      transport,
      client,
    };
  })();

  return modulesPromise;
}

function createRegistry(modules) {
  return modules.handlers.createJeditContractMutationHandlerRegistry({
    runtime: modules.runtime.createFullSnapshotHotTextRuntimeFixture(),
    hash: modules.hash.createHashPort(),
  });
}
