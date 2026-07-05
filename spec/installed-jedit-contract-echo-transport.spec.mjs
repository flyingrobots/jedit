import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const TRANSPORT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'installed-jedit-contract-echo-transport.js');
const CLIENT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'jedit-echo-optic-client.js');
const SESSION_ADAPTER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'echo-backed-text-buffer-session.js');
const CODEC_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'jedit-echo-optic-codec.js');
const RUNTIME_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'full-snapshot-hot-text-runtime-fixture.js');
const WORK_ENVELOPE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ports', 'jedit-runtime-work-envelope.js');
const INVOCATION_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-runtime-handler-invocation.js');
const STATE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-state-port.js');
const LEDGER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-submission-ledger.js');
const TICKETED_WORK_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-ticketed-work-boundary.js');
const HOST_PORT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ports', 'echo-contract-package-host.js');
const BUFFER_KEY = 'notes/installed-contract.md';
const INITIAL_TEXT = 'hello';
const INSERT_TEXT = ' Echo';
const FIRST_BYTE = 0;
const INSERT_BYTE = 5;
const FIRST_LINE = 0;
const SINGLE_LINE = 1;
const BYTE_BUDGET = 80;
const PACKAGE_INSTALL_BLOCKED_MESSAGE = 'blocked in test host';
const PACKAGE_NOT_INSTALLED_CODE = 'JEDIT_PACKAGE_NOT_INSTALLED';
const FULL_SNAPSHOT_AUTHORITY_ENV = 'JEDIT_ALLOW_FULL_SNAPSHOT_TEXT_AUTHORITY';
const FULL_SNAPSHOT_GUARD_MESSAGE = /FullSnapshotHotTextRuntimeFixture cannot be used as production text authority/;

let modulesPromise;

test('installed transport rejects implicit full-snapshot fixture authority by default', async () => {
  const modules = await loadModules();

  withFullSnapshotAuthorityEnv(undefined, () => {
    assert.throws(
      () => modules.transport.createInstalledJeditContractEchoTransport(),
      FULL_SNAPSHOT_GUARD_MESSAGE,
    );
  });
});

test('installed transport rejects explicit full-snapshot fixture authority without opt-in', async () => {
  const modules = await loadModules();
  const runtime = modules.runtime.createFullSnapshotHotTextRuntimeFixture();

  withFullSnapshotAuthorityEnv(undefined, () => {
    assert.throws(
      () => modules.transport.createInstalledJeditContractEchoTransport({ runtime }),
      FULL_SNAPSHOT_GUARD_MESSAGE,
    );
  });
});

test('installed transport accepts full-snapshot fixture authority with explicit opt-in', async () => {
  const modules = await loadModules();
  const runtime = modules.runtime.createFullSnapshotHotTextRuntimeFixture();

  const transport = withFullSnapshotAuthorityEnv(undefined, () => (
    modules.transport.createInstalledJeditContractEchoTransport({
      allowFullSnapshotTextAuthority: true,
      runtime,
    })
  ));

  assert.equal(typeof transport.submitIntentBytes, 'function');
});

test('installed transport accepts full-snapshot fixture authority with environment escape hatch', async () => {
  const modules = await loadModules();

  const transport = withFullSnapshotAuthorityEnv('1', () => (
    modules.transport.createInstalledJeditContractEchoTransport()
  ));

  assert.equal(typeof transport.submitIntentBytes, 'function');
});

test('TextBufferOptic headless flow uses installed jedit contract transport', async () => {
  const modules = await loadModules();
  const transport = createFixtureBackedInstalledTransport(modules);
  const client = modules.client.createEchoTransportJeditOpticClient(transport);
  const session = modules.sessionAdapter.createEchoBackedTextBufferSession({
    client,
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
  assert.equal('installContractPackage' in session, false);
  assert.equal('invokeJeditMutationHandler' in session, false);
  assert.equal('writeFactSet' in session, false);
  assert.equal('readFactSet' in session, false);
  assert.equal('requestRunUntilIdle' in session, false);
  assert.equal('tick' in session, false);
  assert.equal('installContractPackage' in optic, false);
  assert.equal('invokeJeditMutationHandler' in optic, false);
  assert.equal('writeFactSet' in optic, false);
  assert.equal('readFactSet' in optic, false);
  assert.equal('requestRunUntilIdle' in optic, false);
  assert.equal('tick' in optic, false);
});

test('installed transport preserves retained diff metadata across intent response codec', async () => {
  const modules = await loadModules();
  const transport = createFixtureBackedInstalledTransport(modules);
  const created = modules.codec.decodeJeditIntentResponse(transport.submitIntentBytes(
    createBufferWorldlineEnvelope(modules),
  ));

  assert.equal(created.status, modules.codec.JEDIT_TRANSPORT_STATUS_OK);
  transport.jeditSessionPort.registerSession(created.execution.nextSession);
  const edited = modules.codec.decodeJeditIntentResponse(transport.submitIntentBytes(
    replaceRangeAsTickEnvelope(modules, created.execution.nextSession),
  ));

  assert.equal(edited.status, modules.codec.JEDIT_TRANSPORT_STATUS_OK);
  assert.equal(edited.execution.nextSession.tickMetadata.length, 1);
  assert.equal(edited.execution.nextSession.tickMetadata[0].baseHeadId, created.execution.nextSession.worldline.canonicalHeadId);
  assert.equal(edited.execution.nextSession.tickMetadata[0].nextHeadId, edited.execution.nextSession.worldline.canonicalHeadId);
  assert.equal(edited.execution.nextSession.tickMetadata[0].startByte, INSERT_BYTE);
  assert.equal(edited.execution.nextSession.tickMetadata[0].endByte, INSERT_BYTE);
  assert.equal(edited.execution.nextSession.tickMetadata[0].insertedByteLength, INSERT_TEXT.length);
  assert.equal(edited.execution.nextSession.tickMetadata[0].deletedByteLength, 0);
});

test('installed transport stages runtime work before mutation handler execution', async () => {
  const modules = await loadModules();
  const events = [];
  const envelopes = [];
  const baseRuntime = modules.runtime.createFullSnapshotHotTextRuntimeFixture();
  const runtime = {
    ...baseRuntime,
    createBuffer(pathValue, textValue) {
      events.push('handler');
      return baseRuntime.createBuffer(pathValue, textValue);
    },
  };
  const transport = createFixtureBackedInstalledTransport(modules, {
    runtime,
    workSink: {
      recordRuntimeWorkEnvelope(envelope) {
        events.push('envelope');
        envelopes.push(envelope);
      },
    },
  });
  const intentBytes = createBufferWorldlineEnvelope(modules);

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
  const transport = createFixtureBackedInstalledTransport(modules, {
    workSink: {
      recordRuntimeWorkEnvelope(envelope) {
        envelopes.push(envelope);
      },
    },
  });
  const createResponse = modules.codec.decodeJeditIntentResponse(transport.submitIntentBytes(
    createBufferWorldlineEnvelope(modules),
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
  const transport = createFixtureBackedInstalledTransport(modules, {
    handlerInvocationSink: {
      recordHandlerInvocationAuthority(authority) {
        authorities.push(authority);
      },
    },
  });

  const response = modules.codec.decodeJeditIntentResponse(transport.submitIntentBytes(
    createBufferWorldlineEnvelope(modules),
  ));

  assert.equal(response.status, modules.codec.JEDIT_TRANSPORT_STATUS_OK);
  assert.deepEqual(authorities, [
    modules.invocation.JEDIT_HANDLER_INVOCATION_SCHEDULER_AUTHORITY,
  ]);
});

test('installed transport publishes handler state through jedit state port', async () => {
  const modules = await loadModules();
  const statePort = modules.state.createInMemoryJeditContractStatePort();
  const transport = createFixtureBackedInstalledTransport(modules, {
    statePort,
  });
  const createResponse = modules.codec.decodeJeditIntentResponse(transport.submitIntentBytes(
    createBufferWorldlineEnvelope(modules),
  ));

  assert.equal(createResponse.status, modules.codec.JEDIT_TRANSPORT_STATUS_OK);
  const read = modules.state.readJeditContractFactSet(
    statePort,
    createResponse.execution.nextSession.worldline.worldlineId,
  );
  assert.equal(read.status, modules.state.JEDIT_CONTRACT_STATE_READ_FOUND);
});

test('installed transport records accepted submissions before handler execution', async () => {
  const modules = await loadModules();
  const events = [];
  const baseLedger = modules.ledger.createInMemoryJeditSubmissionLedgerPort();
  const submissionLedger = {
    recordAcceptedSubmission(record) {
      events.push('submission');
      return baseLedger.recordAcceptedSubmission(record);
    },
    readSubmission(submissionId) {
      return baseLedger.readSubmission(submissionId);
    },
  };
  const baseRuntime = modules.runtime.createFullSnapshotHotTextRuntimeFixture();
  const runtime = {
    ...baseRuntime,
    createBuffer(pathValue, textValue) {
      events.push('handler');
      return baseRuntime.createBuffer(pathValue, textValue);
    },
  };
  const transport = createFixtureBackedInstalledTransport(modules, {
    runtime,
    submissionLedger,
  });

  modules.codec.decodeJeditIntentResponse(transport.submitIntentBytes(
    createBufferWorldlineEnvelope(modules),
  ));

  assert.deepEqual(events, ['submission', 'handler']);
});

test('installed transport blocks unticketed work before handler invocation', async () => {
  const modules = await loadModules();
  const handlerAuthorities = [];
  const envelopes = [];
  const transport = createFixtureBackedInstalledTransport(modules, {
    workSink: {
      recordRuntimeWorkEnvelope(envelope) {
        envelopes.push(envelope);
      },
    },
    ticketedWorkPort: {
      issueTicketedWork(request) {
        return modules.ticketedWork.missingJeditTicketedWork(request.submissionId);
      },
    },
    handlerInvocationSink: {
      recordHandlerInvocationAuthority(authority) {
        handlerAuthorities.push(authority);
      },
    },
  });
  const response = modules.codec.decodeJeditIntentResponse(transport.submitIntentBytes(
    createBufferWorldlineEnvelope(modules),
  ));

  assert.equal(response.status, modules.codec.JEDIT_TRANSPORT_STATUS_OBSTRUCTED);
  assert.equal(response.obstruction.code, modules.ticketedWork.JEDIT_TICKETED_WORK_MISSING_CODE);
  assert.deepEqual(handlerAuthorities, []);
  assert.deepEqual(envelopes, []);
});

test('installed transport accepts package host injection and blocks non-installed packages', async () => {
  const modules = await loadModules();
  const hostRequests = [];
  const handlerAuthorities = [];
  const envelopes = [];
  const transport = createFixtureBackedInstalledTransport(modules, {
    packageHost: {
      installContractPackage(request) {
        hostRequests.push(request);
        return {
          status: modules.hostPort.ECHO_CONTRACT_PACKAGE_INSTALL_BLOCKED,
          packageId: request.packageId,
          message: PACKAGE_INSTALL_BLOCKED_MESSAGE,
        };
      },
    },
    handlerInvocationSink: {
      recordHandlerInvocationAuthority(authority) {
        handlerAuthorities.push(authority);
      },
    },
    workSink: {
      recordRuntimeWorkEnvelope(envelope) {
        envelopes.push(envelope);
      },
    },
  });
  const response = modules.codec.decodeJeditIntentResponse(transport.submitIntentBytes(
    createBufferWorldlineEnvelope(modules),
  ));

  assert.equal(hostRequests.length, 1);
  assert.equal(response.status, modules.codec.JEDIT_TRANSPORT_STATUS_OBSTRUCTED);
  assert.equal(response.obstruction.code, PACKAGE_NOT_INSTALLED_CODE);
  assert.deepEqual(handlerAuthorities, []);
  assert.deepEqual(envelopes, []);
});

test('installed transport keeps submission identity aligned across ledger ticket and work', async () => {
  const modules = await loadModules();
  const ledgerRecords = [];
  const ticketRequests = [];
  const envelopes = [];
  const baseLedger = modules.ledger.createInMemoryJeditSubmissionLedgerPort();
  const transport = createFixtureBackedInstalledTransport(modules, {
    submissionLedger: {
      recordAcceptedSubmission(record) {
        ledgerRecords.push(record);
        return baseLedger.recordAcceptedSubmission(record);
      },
      readSubmission(submissionId) {
        return baseLedger.readSubmission(submissionId);
      },
    },
    ticketedWorkPort: {
      issueTicketedWork(request) {
        ticketRequests.push(request);
        return {
          status: modules.ticketedWork.JEDIT_TICKETED_WORK_AVAILABLE,
          submissionId: request.submissionId,
          ticketId: 'ticket:test',
          packageId: request.packageId,
          operationName: request.operationName,
        };
      },
    },
    workSink: {
      recordRuntimeWorkEnvelope(envelope) {
        envelopes.push(envelope);
      },
    },
  });
  const response = modules.codec.decodeJeditIntentResponse(transport.submitIntentBytes(
    createBufferWorldlineEnvelope(modules),
  ));

  assert.equal(response.status, modules.codec.JEDIT_TRANSPORT_STATUS_OK);
  assert.equal(ledgerRecords.length, 1);
  assert.equal(ticketRequests.length, 1);
  assert.equal(envelopes.length, 1);
  assert.equal(ledgerRecords[0].submissionId, ticketRequests[0].submissionId);
  assert.equal(ledgerRecords[0].submissionId, envelopes[0].submissionId);
});

test('installed query observers require state-port-backed basis', async () => {
  const modules = await loadModules();
  const statePort = createMissingReadStatePort(modules);
  const transport = createFixtureBackedInstalledTransport(modules, {
    statePort,
  });
  const createResponse = modules.codec.decodeJeditIntentResponse(transport.submitIntentBytes(
    createBufferWorldlineEnvelope(modules),
  ));
  const observeResponse = modules.codec.decodeJeditObserveResponse(transport.observeBytes(
    modules.codec.encodeJeditObserveRequest({
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
    }),
  ));

  assert.equal(observeResponse.status, modules.codec.JEDIT_TRANSPORT_STATUS_OBSTRUCTED);
  assert.equal(observeResponse.obstruction.code, modules.state.JEDIT_CONTRACT_STATE_MISSING_CODE);
});

test('installed query observer runtime errors do not masquerade as package install failures', async () => {
  const modules = await loadModules();
  const transport = createFixtureBackedInstalledTransport(modules);
  const createResponse = modules.codec.decodeJeditIntentResponse(transport.submitIntentBytes(
    createBufferWorldlineEnvelope(modules),
  ));
  const observeResponse = modules.codec.decodeJeditObserveResponse(transport.observeBytes(
    modules.codec.encodeJeditObserveRequest({
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
        maxBytes: 0,
      },
    }),
  ));

  assert.equal(observeResponse.status, modules.codec.JEDIT_TRANSPORT_STATUS_OBSTRUCTED);
  assert.equal(observeResponse.obstruction.code, 'JEDIT_QUERY_OBSERVER_RUNTIME_ERROR');
  assert.notEqual(observeResponse.obstruction.code, 'JEDIT_PACKAGE_NOT_INSTALLED');
});

function createBufferWorldlineEnvelope(modules) {
  return modules.codec.encodeJeditMutationIntentEnvelope({
    operationName: modules.codec.CREATE_BUFFER_WORLDLINE_OPERATION,
    vars: {
      input: {
        bufferKey: BUFFER_KEY,
        initialText: INITIAL_TEXT,
        projectionPath: BUFFER_KEY,
        createInitialCheckpoint: null,
      },
    },
  });
}

function replaceRangeAsTickEnvelope(modules, session) {
  return modules.codec.encodeJeditMutationIntentEnvelope({
    operationName: modules.codec.REPLACE_RANGE_AS_TICK_OPERATION,
    vars: {
      input: {
        worldlineId: session.worldline.worldlineId,
        baseHeadId: session.worldline.canonicalHeadId,
        startByte: INSERT_BYTE,
        endByte: INSERT_BYTE,
        insertText: INSERT_TEXT,
        author: 'transport-test',
      },
    },
  });
}

test('installed transport: malformed EINT envelope yields obstructed response with absent operationName', async () => {
  const modules = await loadModules();
  const transport = createFixtureBackedInstalledTransport(modules);
  // Bytes that are NOT a valid EINT envelope. The bridge's decode step must
  // fail before any operationName is known, so the obstructed response
  // omits operationName entirely and the consumer is forced to branch on
  // obstruction.code.
  const garbage = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
  const responseBytes = transport.submitIntentBytes(garbage);
  const response = modules.codec.decodeJeditIntentResponse(responseBytes);

  assert.equal(response.status, modules.codec.JEDIT_TRANSPORT_STATUS_OBSTRUCTED);
  assert.equal(response.operationName, undefined,
    'operationName MUST be absent on envelope-decode-failure obstructions');
  assert.equal(response.obstruction.code, 'JEDIT_MUTATION_ENVELOPE_INVALID');
});

function createMissingReadStatePort(modules) {
  return {
    writeFactSet(factSet) {
      return {
        status: modules.state.JEDIT_CONTRACT_STATE_WRITE_STORED,
        factSet,
      };
    },
    readFactSet(worldlineId) {
      return {
        status: modules.state.JEDIT_CONTRACT_STATE_READ_MISSING,
        worldlineId,
        obstruction: {
          code: modules.state.JEDIT_CONTRACT_STATE_MISSING_CODE,
          reason: 'test missing state',
        },
      };
    },
  };
}

function createFixtureBackedInstalledTransport(modules, options = {}) {
  return modules.transport.createInstalledJeditContractEchoTransport({
    allowFullSnapshotTextAuthority: true,
    ...options,
  });
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

async function loadModules() {
  if (modulesPromise) {
    return modulesPromise;
  }

  modulesPromise = (async () => {
    const [
      transport,
      client,
    sessionAdapter,
      codec,
      runtime,
      workEnvelope,
      invocation,
      state,
      ledger,
      ticketedWork,
      hostPort,
    ] = await Promise.all([
      import(pathToFileURL(TRANSPORT_MODULE_PATH).href),
      import(pathToFileURL(CLIENT_MODULE_PATH).href),
      import(pathToFileURL(SESSION_ADAPTER_MODULE_PATH).href),
      import(pathToFileURL(CODEC_MODULE_PATH).href),
      import(pathToFileURL(RUNTIME_MODULE_PATH).href),
      import(pathToFileURL(WORK_ENVELOPE_MODULE_PATH).href),
      import(pathToFileURL(INVOCATION_MODULE_PATH).href),
      import(pathToFileURL(STATE_MODULE_PATH).href),
      import(pathToFileURL(LEDGER_MODULE_PATH).href),
      import(pathToFileURL(TICKETED_WORK_MODULE_PATH).href),
      import(pathToFileURL(HOST_PORT_MODULE_PATH).href),
    ]);

    return {
      transport,
      client,
      sessionAdapter,
      codec,
      runtime,
      workEnvelope,
      invocation,
      state,
      ledger,
      ticketedWork,
      hostPort,
    };
  })();

  return modulesPromise;
}
