import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  bytesAsSequence,
  bytesToHex,
  decodeCbor,
  encodeCbor,
  encodeUtf8,
  hexToBytes,
  packEintEnvelope,
  toByteArray,
} from './support/echo-wasm-cbor.mjs';
import {
  createWitnessReport,
  INLINE_PAYLOAD_PREVIEW_BYTE_LIMIT,
  REPLAY_OBSTRUCTION_DURABLE_UNAVAILABLE,
  RETAINED_EVIDENCE_POSTURE_MISSING,
  WITNESS_REPORT_SCHEMA_VERSION,
} from './support/jedit-echo-witness-report.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRANSPORT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'echo-wasm-kernel.js');
const LIFECYCLE_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'echo-runtime-lifecycle.js');
const REAL_ECHO_WASM_MODULE_RAW = process.env.JEDIT_ECHO_WASM_MODULE;
const REAL_ECHO_WASM_MODULE =
  typeof REAL_ECHO_WASM_MODULE_RAW === 'string' && REAL_ECHO_WASM_MODULE_RAW.trim().length > 0
    ? REAL_ECHO_WASM_MODULE_RAW
    : undefined;
const WITNESS_REPORT_PATH_RAW = process.env.JEDIT_ECHO_WITNESS_REPORT;
const WITNESS_REPORT_PATH =
  typeof WITNESS_REPORT_PATH_RAW === 'string' && WITNESS_REPORT_PATH_RAW.trim().length > 0
    ? WITNESS_REPORT_PATH_RAW
    : undefined;

const STACK_WITNESS_OP_IDS = Object.freeze({
  CREATE_BUFFER: 0x5357_0001,
  REPLACE_RANGE: 0x5357_0002,
  TEXT_WINDOW_QUERY: 0x5357_1001,
});
const ECHO_CONTROL_OP_IDS = Object.freeze({
  INTENT_V1: 0xffff_ffff,
});
const STACK_WITNESS_CREATE_BUFFER_VARS =
  'stack-witness-0001/createBuffer;name=demo.txt;artifact=fixture-file-history-v0';
const STACK_WITNESS_REPLACE_RANGE_VARS =
  'stack-witness-0001/replaceRange;bufferId=demo.txt;basis=B0;coord=utf8-bytes;start=0;end=0;text=hello;artifact=fixture-file-history-v0';
const STACK_WITNESS_TEXT_WINDOW_VARS =
  'stack-witness-0001/textWindow;bufferId=demo.txt;basis=B1;coord=utf8-bytes;start=0;length=5;artifact=fixture-file-history-v0';
const STACK_WITNESS_TEXT = 'hello';
const STACK_WITNESS_BUFFER_KEY = 'demo.txt';
const STACK_WITNESS_FRONTIER_REF = 'frontier:stack-witness-0001:B1';
const EINT_ENVELOPE_HEADER_LENGTH = 12;
const FIRST_BYTE_OFFSET = 0;
const FIRST_LINE = 0;
const SINGLE_LINE_WINDOW = 1;
const DEFAULT_RUN_UNTIL_IDLE_CYCLE_LIMIT = 4;
const CUSTOM_RUN_UNTIL_IDLE_CYCLE_LIMIT = 9;
const MINIMUM_RUN_UNTIL_IDLE_CYCLE_LIMIT = 1;
const RUN_UNTIL_IDLE_CYCLE_LIMIT = readRunUntilIdleCycleLimit(
  process.env.JEDIT_ECHO_WITNESS_CYCLE_LIMIT,
);
const STACK_WITNESS_FIXTURE_NAME = 'stack-witness-0001';

// Witnessed temporary Echo fixture assumption:
// Echo `WarpKernel::new` derives `default_worldline` from
// `engine.root_key().warp_id`; the fresh Engine builder seeds that root warp
// with `make_warp_id("root")`, i.e. BLAKE3("warp:" || "root").
// This is witness scaffolding, not an app-facing API requirement. Durable
// production adapter behavior should get basis/worldline resolution from an
// optic or session capability rather than asking Echo for a default worldline.
const ECHO_DERIVED_FIXTURE_DEFAULT_WORLDLINE_ID_HEX =
  '3e888b35fc1d18b5487da6704fa71c3374e95dd52bc83963239b127f9293f228';
const STACK_WITNESS_ALTERNATE_WORLDLINE_ID_HEX =
  '0000000000000000000000000000000000000000000000000000000000000001';
const PAYLOAD_PREVIEW_TEST_CHARACTER = 'x';

const UTF8_DECODER = new TextDecoder();

test('real Echo WASM witness request construction gets basis through an optic session resolver', () => {
  const opticSessionBasis = createWitnessOnlyEchoFixtureBasisResolver();
  const textWindowBasis = opticSessionBasis.resolveTextWindowBasis();
  const request = decodeCbor(encodeStackWitnessTextWindowRequest(textWindowBasis));
  assertCoordinateUsesTextWindowBasis(request, textWindowBasis);

  const alternateBasis = createWitnessOnlyTextWindowBasis(
    STACK_WITNESS_ALTERNATE_WORLDLINE_ID_HEX,
  );
  const alternateRequest = decodeCbor(encodeStackWitnessTextWindowRequest(alternateBasis));
  assertCoordinateUsesTextWindowBasis(alternateRequest, alternateBasis);
  assert.notDeepEqual(
    toByteArray(alternateRequest.coordinate.worldline_id),
    toByteArray(textWindowBasis.worldlineIdBytes),
  );
});

test('real Echo WASM witness control intent honors configured cycle limit', () => {
  const controlIntent = unpackControlIntentVars(
    packControlStartIntent(CUSTOM_RUN_UNTIL_IDLE_CYCLE_LIMIT),
  );

  assert.equal(controlIntent.kind, 'start');
  assert.equal(controlIntent.mode.kind, 'until_idle');
  assert.equal(controlIntent.mode.cycle_limit, CUSTOM_RUN_UNTIL_IDLE_CYCLE_LIMIT);
});

test('real Echo WASM witness stop control stays on trusted lifecycle vocabulary', () => {
  const controlIntent = unpackControlIntentVars(packControlStopIntent());

  assert.equal(controlIntent.kind, 'stop');
});

test('real Echo WASM witness report names retained-evidence and replay posture', () => {
  const queryBytes = encodeUtf8(STACK_WITNESS_TEXT);
  const artifact = createWitnessReportFixtureArtifact(queryBytes);
  const textWindowBasis = createWitnessOnlyEchoFixtureBasisResolver().resolveTextWindowBasis();
  const appReading = toWitnessOnlyTextWindowReading(artifact, queryBytes);
  const report = createWitnessReport(createWitnessReportArgs({
    artifact,
    appReading,
    jeditGeneratedContract: createGeneratedContractMetadataFixture(),
    queryBytes,
    textWindowBasis,
  }));

  assert.equal(report.schemaVersion, WITNESS_REPORT_SCHEMA_VERSION);
  assert.equal(report.retainedEvidence.posture, RETAINED_EVIDENCE_POSTURE_MISSING);
  assert.deepEqual(
    report.retainedEvidence.availableInline.map((entry) => entry.role),
    ['reading_payload', 'reading_envelope'],
  );
  assert.equal(report.retainedEvidence.availableInline[0].contentPreviewUtf8, STACK_WITNESS_TEXT);
  assert.equal(report.retainedEvidence.availableInline[0].contentPreviewTruncated, false);
  assert.deepEqual(
    report.retainedEvidence.missing.map((entry) => entry.role),
    ['contract_receipt', 'reading_payload_ref', 'reading_envelope_ref'],
  );
  assert.equal(report.retainedEvidence.semanticCoordinates.readingId, appReading.reading.readingId);
  assert.equal(report.retainedEvidence.semanticCoordinates.artifactHash, report.reading.artifactHash);
  assert.equal(report.replay.status, 'obstructed');
  assert.equal(report.replay.obstruction, REPLAY_OBSTRUCTION_DURABLE_UNAVAILABLE);
  assert.equal(report.replay.readingIdentity.readingId, appReading.reading.readingId);
});

test('real Echo WASM witness report bounds inline reading payload preview', () => {
  const text = PAYLOAD_PREVIEW_TEST_CHARACTER.repeat(INLINE_PAYLOAD_PREVIEW_BYTE_LIMIT + 1);
  const queryBytes = encodeUtf8(text);
  const artifact = createWitnessReportFixtureArtifact(queryBytes);
  const textWindowBasis = createWitnessOnlyEchoFixtureBasisResolver().resolveTextWindowBasis();
  const appReading = toWitnessOnlyTextWindowReading(artifact, queryBytes);
  const report = createWitnessReport(createWitnessReportArgs({
    artifact,
    appReading,
    jeditGeneratedContract: createGeneratedContractMetadataFixture(),
    queryBytes,
    textWindowBasis,
  }));
  const payloadEntry = report.retainedEvidence.availableInline[0];

  assert.equal(payloadEntry.byteLength, queryBytes.length);
  assert.equal(payloadEntry.contentPreviewUtf8.length, INLINE_PAYLOAD_PREVIEW_BYTE_LIMIT);
  assert.equal(payloadEntry.contentPreviewTruncated, true);
});

test('real Echo WASM requires an installed observer before jedit textWindow can materialize', {
  skip: REAL_ECHO_WASM_MODULE === undefined
    ? 'set JEDIT_ECHO_WASM_MODULE to an Echo warp-wasm JS module to run this opt-in boundary witness'
    : false,
}, async () => {
  assert.equal(typeof REAL_ECHO_WASM_MODULE, 'string');

  const echoModules = await loadEchoModules();
  const hostTransport = await echoModules.transport.createEchoWasmKernelHostTransport({
    moduleSpecifier: toModuleSpecifier(REAL_ECHO_WASM_MODULE),
  });
  const transport = hostTransport.app;
  const lifecycle = echoModules.lifecycle.createTrustedEchoRuntimeLifecyclePort({
    trustedHost: hostTransport.trustedHost,
    codec: createWitnessLifecycleCodec(),
  });

  dispatchFixtureIntent(
    transport,
    STACK_WITNESS_OP_IDS.CREATE_BUFFER,
    STACK_WITNESS_CREATE_BUFFER_VARS,
  );
  requestEchoRunUntilIdle(lifecycle);
  dispatchFixtureIntent(
    transport,
    STACK_WITNESS_OP_IDS.REPLACE_RANGE,
    STACK_WITNESS_REPLACE_RANGE_VARS,
  );
  requestEchoRunUntilIdle(lifecycle);

  const opticSessionBasis = createWitnessOnlyEchoFixtureBasisResolver();
  const textWindowBasis = opticSessionBasis.resolveTextWindowBasis();
  const error = decodeErrEnvelope(transport.observeBytes(
    encodeStackWitnessTextWindowRequest(textWindowBasis),
  ));

  assert.equal(error.code, 11);
  assert.match(error.message, /query observation is not installed/);
  writeBoundaryWitnessReport(error);
});

async function loadTransportModule() {
  try {
    return await import(pathToFileURL(TRANSPORT_MODULE_PATH).href);
  } catch (cause) {
    throw new Error(
      `${TRANSPORT_MODULE_PATH} not found; run scripts/run-real-echo-wasm-stack-witness.sh `
        + 'or npm run build before invoking this witness.',
      { cause },
    );
  }
}

async function loadEchoModules() {
  return {
    transport: await loadTransportModule(),
    lifecycle: await import(pathToFileURL(LIFECYCLE_MODULE_PATH).href),
  };
}

function toModuleSpecifier(modulePath) {
  if (modulePath.startsWith('file:')) {
    return modulePath;
  }
  if (path.isAbsolute(modulePath)) {
    return pathToFileURL(modulePath).href;
  }
  return modulePath;
}

function dispatchFixtureIntent(transport, opId, varsText) {
  const response = decodeOkEnvelope(
    transport.submitIntentBytes(packEintEnvelope(opId, encodeUtf8(varsText))),
  );
  assert.equal(response.accepted, true);
}

function requestEchoRunUntilIdle(lifecycle) {
  const result = lifecycle.requestRunUntilIdle({
    cycleLimit: RUN_UNTIL_IDLE_CYCLE_LIMIT,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.lastRunCompletion, 'quiesced');
}

function packControlStartIntent(cycleLimit = RUN_UNTIL_IDLE_CYCLE_LIMIT) {
  return packEintEnvelope(ECHO_CONTROL_OP_IDS.INTENT_V1, encodeCbor({
    kind: 'start',
    mode: {
      kind: 'until_idle',
      cycle_limit: cycleLimit,
    },
  }));
}

function packControlStopIntent() {
  return packEintEnvelope(ECHO_CONTROL_OP_IDS.INTENT_V1, encodeCbor({
    kind: 'stop',
  }));
}

function createWitnessLifecycleCodec() {
  return {
    encodeRunUntilIdleRequest(request) {
      return packControlStartIntent(request.cycleLimit);
    },
    decodeRunUntilIdleResponse(responseBytes) {
      const response = decodeOkEnvelope(responseBytes);
      return {
        accepted: response.accepted === true,
        lastRunCompletion: response.scheduler_status.last_run_completion,
      };
    },
    encodeStopRequest() {
      return packControlStopIntent();
    },
    decodeStopResponse(responseBytes) {
      const response = decodeOkEnvelope(responseBytes);
      return {
        accepted: response.accepted === true,
        lastRunCompletion: response.scheduler_status.last_run_completion,
      };
    },
  };
}

function readRunUntilIdleCycleLimit(rawValue) {
  if (rawValue === undefined || rawValue.trim().length === 0) {
    return DEFAULT_RUN_UNTIL_IDLE_CYCLE_LIMIT;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (
    !Number.isSafeInteger(parsed)
      || parsed < MINIMUM_RUN_UNTIL_IDLE_CYCLE_LIMIT
      || parsed.toString() !== rawValue.trim()
  ) {
    throw new Error(`invalid JEDIT_ECHO_WITNESS_CYCLE_LIMIT: ${rawValue}`);
  }
  return parsed;
}

function unpackControlIntentVars(intentBytes) {
  return decodeCbor(intentBytes.slice(EINT_ENVELOPE_HEADER_LENGTH));
}

function createWitnessOnlyEchoFixtureBasisResolver() {
  return Object.freeze({
    resolveTextWindowBasis() {
      return createWitnessOnlyTextWindowBasis(ECHO_DERIVED_FIXTURE_DEFAULT_WORLDLINE_ID_HEX);
    },
  });
}

function createWitnessOnlyTextWindowBasis(worldlineIdHex) {
  return Object.freeze({
    worldlineIdHex,
    worldlineIdBytes: hexToBytes(worldlineIdHex),
    at: Object.freeze({
      kind: 'frontier',
    }),
  });
}

function encodeStackWitnessTextWindowRequest(textWindowBasis) {
  return encodeCbor({
    coordinate: {
      worldline_id: textWindowBasis.worldlineIdBytes,
      at: textWindowBasis.at,
    },
    frame: 'query_view',
    projection: {
      kind: 'query',
      query_id: STACK_WITNESS_OP_IDS.TEXT_WINDOW_QUERY,
      vars_bytes: bytesAsSequence(encodeUtf8(STACK_WITNESS_TEXT_WINDOW_VARS)),
    },
    observer_plan: {
      kind: 'builtin',
      plan: 'query_bytes',
    },
    observer_instance: null,
    budget: {
      kind: 'unbounded_one_shot',
    },
    rights: {
      kind: 'kernel_public',
    },
  });
}

function assertCoordinateUsesTextWindowBasis(request, textWindowBasis) {
  assert.deepEqual(
    toByteArray(request.coordinate.worldline_id),
    toByteArray(textWindowBasis.worldlineIdBytes),
  );
  assert.equal(request.coordinate.at.kind, textWindowBasis.at.kind);
}

// Witness-only adapter: the local report fixture returns QueryBytes("hello"),
// not durable TextWindowReading metadata. The synthetic fields below are local
// test scaffolding and must not become production adapter semantics.
function toWitnessOnlyTextWindowReading(artifact, queryBytes) {
  const text = UTF8_DECODER.decode(queryBytes);
  const worldlineId = bytesToHex(artifact.resolved.worldline_id);
  const headId = `echo-worldline-tick:${artifact.resolved.resolved_worldline_tick}`;
  return {
    operationName: 'textWindow',
    frontierRef: STACK_WITNESS_FRONTIER_REF,
    reading: {
      worldline: {
        worldlineId,
        bufferKey: STACK_WITNESS_BUFFER_KEY,
        canonicalHeadId: headId,
        createdAtTickId: null,
        projectionPath: STACK_WITNESS_BUFFER_KEY,
      },
      head: {
        headId,
        worldlineId,
        rootNodeId: bytesToHex(artifact.resolved.state_root),
        byteLength: queryBytes.length,
        lineCount: SINGLE_LINE_WINDOW,
        utf16Length: text.length,
        equivalenceDigest: bytesToHex(artifact.artifact_hash),
      },
      readingId: bytesToHex(artifact.artifact_hash),
      startLine: FIRST_LINE,
      lineCount: SINGLE_LINE_WINDOW,
      totalLineCount: SINGLE_LINE_WINDOW,
      hasMoreBefore: false,
      hasMoreAfter: false,
      lines: [{
        lineNumber: FIRST_LINE,
        text,
        startByte: FIRST_BYTE_OFFSET,
        endByte: queryBytes.length,
      }],
    },
  };
}

function writeWitnessReport(args) {
  if (WITNESS_REPORT_PATH === undefined) {
    return;
  }

  mkdirSync(path.dirname(WITNESS_REPORT_PATH), { recursive: true });
  writeFileSync(WITNESS_REPORT_PATH, `${JSON.stringify(createWitnessReport(args), null, 2)}\n`);
}

function writeBoundaryWitnessReport(error) {
  if (WITNESS_REPORT_PATH === undefined) {
    return;
  }

  const report = {
    schemaVersion: WITNESS_REPORT_SCHEMA_VERSION,
    boundary: {
      status: 'unsupported_query_without_installed_observer',
      errorCode: error.code,
      message: error.message,
    },
    replay: {
      status: 'obstructed',
      obstruction: REPLAY_OBSTRUCTION_DURABLE_UNAVAILABLE,
      reason: 'the current real Echo WASM witness proves a generic boundary obstruction, not durable replay',
    },
  };
  mkdirSync(path.dirname(WITNESS_REPORT_PATH), { recursive: true });
  writeFileSync(WITNESS_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
}

function createWitnessReportFixtureArtifact(queryBytes) {
  const textWindowBasis = createWitnessOnlyEchoFixtureBasisResolver().resolveTextWindowBasis();
  return {
    resolved: {
      worldline_id: textWindowBasis.worldlineIdBytes,
      resolved_worldline_tick: 1,
      state_root: hexToBytes('11'.repeat(32)),
    },
    reading: {
      observer_basis: 'query_view',
      budget_posture: 'unbounded_one_shot',
      rights_posture: 'kernel_public',
      residual_posture: 'complete',
    },
    frame: 'query_view',
    projection: {
      kind: 'query',
      query_id: STACK_WITNESS_OP_IDS.TEXT_WINDOW_QUERY,
      vars_bytes: bytesAsSequence(encodeUtf8(STACK_WITNESS_TEXT_WINDOW_VARS)),
    },
    artifact_hash: hexToBytes('22'.repeat(32)),
    payload: {
      kind: 'query_bytes',
      data: bytesAsSequence(queryBytes),
    },
  };
}

function createWitnessReportArgs({
  artifact,
  appReading,
  jeditGeneratedContract,
  queryBytes,
  textWindowBasis,
}) {
  return {
    appReading,
    artifact,
    cycleLimit: RUN_UNTIL_IDLE_CYCLE_LIMIT,
    fixtureName: STACK_WITNESS_FIXTURE_NAME,
    jeditGeneratedContract,
    operationIds: {
      createBuffer: STACK_WITNESS_OP_IDS.CREATE_BUFFER,
      replaceRange: STACK_WITNESS_OP_IDS.REPLACE_RANGE,
      textWindowQuery: STACK_WITNESS_OP_IDS.TEXT_WINDOW_QUERY,
    },
    queryBytes,
    textWindowBasis,
  };
}

function createGeneratedContractMetadataFixture() {
  return {
    source: 'contracts/jedit/hot-text-runtime.graphql',
    mutations: {
      createBufferWorldline: {
        fieldName: 'createBufferWorldline',
      },
      replaceRangeAsTick: {
        fieldName: 'replaceRangeAsTick',
      },
    },
    queries: {
      textWindow: {
        fieldName: 'textWindow',
      },
    },
  };
}

function decodeOkEnvelope(bytes) {
  const decoded = decodeCbor(bytes);
  assert.equal(decoded.ok, true, decoded.message ?? 'Echo WASM returned an error envelope');
  return decoded;
}

function decodeErrEnvelope(bytes) {
  const decoded = decodeCbor(bytes);
  assert.equal(decoded.ok, false, 'Echo WASM unexpectedly returned an ok envelope');
  return decoded;
}
