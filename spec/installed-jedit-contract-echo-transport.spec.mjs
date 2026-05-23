import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const TRANSPORT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'installed-jedit-contract-echo-transport.js');
const CLIENT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'jedit-echo-optic-client.js');
const POWERED_SESSION_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'echo-powered-text-buffer-optic-session.js');
const CODEC_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'jedit-echo-optic-codec.js');
const RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'in-memory-hot-text-runtime.js');
const WORK_ENVELOPE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ports', 'jedit-runtime-work-envelope.js');
const INVOCATION_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-runtime-handler-invocation.js');
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
  assert.equal('invokeJeditMutationHandler' in session, false);
  assert.equal('requestRunUntilIdle' in session, false);
  assert.equal('tick' in session, false);
  assert.equal('installContractPackage' in optic, false);
  assert.equal('invokeJeditMutationHandler' in optic, false);
  assert.equal('requestRunUntilIdle' in optic, false);
  assert.equal('tick' in optic, false);
});

test('installed transport stages runtime work before mutation handler execution', async () => {
  const modules = await loadModules();
  const events = [];
  const envelopes = [];
  const baseRuntime = modules.runtime.createInMemoryHotTextRuntime();
  const runtime = {
    ...baseRuntime,
    createBuffer(pathValue, textValue) {
      events.push('handler');
      return baseRuntime.createBuffer(pathValue, textValue);
    },
  };
  const transport = modules.transport.createInstalledJeditContractEchoTransport({
    runtime,
    workSink: {
      recordRuntimeWorkEnvelope(envelope) {
        events.push('envelope');
        envelopes.push(envelope);
      },
    },
  });
  const intentBytes = modules.codec.encodeJeditIntentRequest({
    kind: modules.codec.JEDIT_INTENT_REQUEST_KIND,
    operationName: modules.codec.CREATE_BUFFER_WORLDLINE_OPERATION,
    input: {
      bufferKey: BUFFER_KEY,
      initialText: INITIAL_TEXT,
      projectionPath: BUFFER_KEY,
    },
  });

  const response = modules.codec.decodeJeditIntentResponse(transport.submitIntentBytes(intentBytes));

  assert.equal(response.status, modules.codec.JEDIT_TRANSPORT_STATUS_OK);
  assert.deepEqual(events, ['envelope', 'handler']);
  assert.equal(envelopes.length, 1);
  assert.equal(envelopes[0].operationName, modules.codec.CREATE_BUFFER_WORLDLINE_OPERATION);
  assert.equal(envelopes[0].operationKind, modules.workEnvelope.JEDIT_RUNTIME_WORK_OPERATION_KIND_MUTATION);
  assert.equal(envelopes[0].canonicalRequestBytesHex, Buffer.from(intentBytes).toString('hex'));
});

test('installed transport does not stage query observations as mutation work', async () => {
  const modules = await loadModules();
  const envelopes = [];
  const transport = modules.transport.createInstalledJeditContractEchoTransport({
    workSink: {
      recordRuntimeWorkEnvelope(envelope) {
        envelopes.push(envelope);
      },
    },
  });
  const createResponse = modules.codec.decodeJeditIntentResponse(transport.submitIntentBytes(
    modules.codec.encodeJeditIntentRequest({
      kind: modules.codec.JEDIT_INTENT_REQUEST_KIND,
      operationName: modules.codec.CREATE_BUFFER_WORLDLINE_OPERATION,
      input: {
        bufferKey: BUFFER_KEY,
        initialText: INITIAL_TEXT,
        projectionPath: BUFFER_KEY,
      },
    }),
  ));

  assert.equal(createResponse.status, modules.codec.JEDIT_TRANSPORT_STATUS_OK);
  transport.observeBytes(modules.codec.encodeJeditObserveRequest({
    kind: modules.codec.JEDIT_OBSERVE_REQUEST_KIND,
    operationName: modules.codec.TEXT_WINDOW_OPERATION,
    session: createResponse.execution.nextSession,
    frontierRef: createResponse.execution.nextSession.worldline.canonicalHeadId,
    input: {
      worldlineId: createResponse.execution.nextSession.worldline.worldlineId,
      cursorLine: FIRST_LINE,
      viewportLineCount: SINGLE_LINE,
      beforeLines: FIRST_LINE,
      afterLines: FIRST_LINE,
      maxBytes: BYTE_BUDGET,
    },
  }));

  assert.equal(envelopes.length, 1);
});

test('installed transport invokes handlers with scheduler authority only', async () => {
  const modules = await loadModules();
  const authorities = [];
  const transport = modules.transport.createInstalledJeditContractEchoTransport({
    handlerInvocationSink: {
      recordHandlerInvocationAuthority(authority) {
        authorities.push(authority);
      },
    },
  });

  const response = modules.codec.decodeJeditIntentResponse(transport.submitIntentBytes(
    modules.codec.encodeJeditIntentRequest({
      kind: modules.codec.JEDIT_INTENT_REQUEST_KIND,
      operationName: modules.codec.CREATE_BUFFER_WORLDLINE_OPERATION,
      input: {
        bufferKey: BUFFER_KEY,
        initialText: INITIAL_TEXT,
        projectionPath: BUFFER_KEY,
      },
    }),
  ));

  assert.equal(response.status, modules.codec.JEDIT_TRANSPORT_STATUS_OK);
  assert.deepEqual(authorities, [
    modules.invocation.JEDIT_HANDLER_INVOCATION_AUTHORITY_SCHEDULER,
  ]);
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

    const [transport, client, poweredSession, codec, runtime, workEnvelope, invocation] = await Promise.all([
      import(pathToFileURL(TRANSPORT_MODULE_PATH).href),
      import(pathToFileURL(CLIENT_MODULE_PATH).href),
      import(pathToFileURL(POWERED_SESSION_MODULE_PATH).href),
      import(pathToFileURL(CODEC_MODULE_PATH).href),
      import(pathToFileURL(RUNTIME_MODULE_PATH).href),
      import(pathToFileURL(WORK_ENVELOPE_MODULE_PATH).href),
      import(pathToFileURL(INVOCATION_MODULE_PATH).href),
    ]);

    return {
      transport,
      client,
      poweredSession,
      codec,
      runtime,
      workEnvelope,
      invocation,
    };
  })();

  return modulesPromise;
}
