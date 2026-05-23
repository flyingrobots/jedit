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

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRANSPORT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'echo-wasm-kernel.js');
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
const FIRST_BYTE_OFFSET = 0;
const FIRST_LINE = 0;
const SINGLE_LINE_WINDOW = 1;
const RUN_UNTIL_IDLE_CYCLE_LIMIT = 4;

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

test('real Echo WASM Stack Witness 0001 transport emits ReadingEnvelope + QueryBytes', {
  skip: REAL_ECHO_WASM_MODULE === undefined
    ? 'set JEDIT_ECHO_WASM_MODULE to an Echo warp-wasm JS module to run this opt-in witness'
    : false,
}, async () => {
  assert.equal(typeof REAL_ECHO_WASM_MODULE, 'string');

  const jeditGeneratedContract = await loadGeneratedContractMetadata();
  const transportModule = await loadTransportModule();
  const hostTransport = await transportModule.createEchoWasmKernelHostTransport({
    moduleSpecifier: toModuleSpecifier(REAL_ECHO_WASM_MODULE),
  });
  const transport = hostTransport.app;

  dispatchFixtureIntent(
    transport,
    STACK_WITNESS_OP_IDS.CREATE_BUFFER,
    STACK_WITNESS_CREATE_BUFFER_VARS,
  );
  runEchoSchedulerUntilIdle(hostTransport.trustedHost);
  dispatchFixtureIntent(
    transport,
    STACK_WITNESS_OP_IDS.REPLACE_RANGE,
    STACK_WITNESS_REPLACE_RANGE_VARS,
  );
  runEchoSchedulerUntilIdle(hostTransport.trustedHost);

  const opticSessionBasis = createWitnessOnlyEchoFixtureBasisResolver();
  const textWindowBasis = opticSessionBasis.resolveTextWindowBasis();
  const artifact = decodeOkEnvelope(transport.observeBytes(
    encodeStackWitnessTextWindowRequest(textWindowBasis),
  ));

  assertReadingEnvelopePresent(artifact);
  assertStackWitnessArtifactIdentity(artifact, textWindowBasis);

  const queryBytes = extractQueryBytes(artifact);
  const appReading = toWitnessOnlyTextWindowReading(artifact, queryBytes);

  assert.equal(UTF8_DECODER.decode(queryBytes), STACK_WITNESS_TEXT);
  assert.equal(appReading.operationName, 'textWindow');
  assert.equal(appReading.frontierRef, STACK_WITNESS_FRONTIER_REF);
  assert.equal(appReading.reading.startLine, FIRST_LINE);
  assert.equal(appReading.reading.lineCount, SINGLE_LINE_WINDOW);
  assert.equal(appReading.reading.totalLineCount, SINGLE_LINE_WINDOW);
  assert.equal(appReading.reading.hasMoreBefore, false);
  assert.equal(appReading.reading.hasMoreAfter, false);
  assert.deepEqual(
    appReading.reading.lines.map((line) => line.text),
    [STACK_WITNESS_TEXT],
  );
  assert.equal(jeditGeneratedContract.queries.textWindow.fieldName, 'textWindow');
  writeWitnessReport({ artifact, appReading, jeditGeneratedContract, textWindowBasis });
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

async function loadGeneratedContractMetadata() {
  const generatedModulePath = path.join(
    REPO_ROOT,
    'dist',
    'generated',
    'jedit',
    'hot-text-runtime.wesley.generated.js',
  );
  const generated = await import(pathToFileURL(generatedModulePath).href);
  return {
    source: 'contracts/jedit/hot-text-runtime.graphql',
    mutations: {
      createBufferWorldline: generated.mutationCreateBufferWorldlineOperation,
      replaceRangeAsTick: generated.mutationReplaceRangeAsTickOperation,
    },
    queries: {
      textWindow: generated.queryTextWindowOperation,
    },
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

function runEchoSchedulerUntilIdle(trustedHostTransport) {
  const response = decodeOkEnvelope(
    trustedHostTransport.dispatchControlIntentBytes(packControlStartIntent()),
  );
  assert.equal(response.accepted, true);
  assert.equal(response.scheduler_status.last_run_completion, 'quiesced');
}

function packControlStartIntent() {
  return packEintEnvelope(ECHO_CONTROL_OP_IDS.INTENT_V1, encodeCbor({
    kind: 'start',
    mode: {
      kind: 'until_idle',
      cycle_limit: RUN_UNTIL_IDLE_CYCLE_LIMIT,
    },
  }));
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

function assertReadingEnvelopePresent(artifact) {
  assert.equal(typeof artifact.reading, 'object');
  assert.notEqual(artifact.reading, null);
  assert.equal(artifact.reading.observer_basis, 'query_view');
  assert.equal(artifact.reading.budget_posture, 'unbounded_one_shot');
  assert.equal(artifact.reading.rights_posture, 'kernel_public');
  assert.equal(artifact.reading.residual_posture, 'complete');
}

function assertStackWitnessArtifactIdentity(artifact, basis) {
  assert.equal(bytesToHex(artifact.resolved.worldline_id), basis.worldlineIdHex);
  assert.equal(artifact.frame, 'query_view');
  assert.equal(artifact.projection.kind, 'query');
  assert.equal(artifact.projection.query_id, STACK_WITNESS_OP_IDS.TEXT_WINDOW_QUERY);
  assert.deepEqual(
    toByteArray(artifact.projection.vars_bytes),
    bytesAsSequence(encodeUtf8(STACK_WITNESS_TEXT_WINDOW_VARS)),
  );
  assert.equal(artifact.payload.kind, 'query_bytes');
}

function extractQueryBytes(artifact) {
  return Uint8Array.from(toByteArray(artifact.payload.data));
}

// Witness-only adapter: Echo's fixture returns QueryBytes("hello"), not durable
// TextWindowReading metadata. The synthetic fields below are local test
// scaffolding and must not become production adapter semantics.
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

function writeWitnessReport({ artifact, appReading, jeditGeneratedContract, textWindowBasis }) {
  if (WITNESS_REPORT_PATH === undefined) {
    return;
  }

  mkdirSync(path.dirname(WITNESS_REPORT_PATH), { recursive: true });
  writeFileSync(WITNESS_REPORT_PATH, `${JSON.stringify({
    schemaVersion: 1,
    authority: {
      applicationDispatch: 'submitIntentBytes',
      trustedHostControl: 'dispatchControlIntentBytes',
    },
    fixture: 'stack-witness-0001',
    operations: {
      createBuffer: STACK_WITNESS_OP_IDS.CREATE_BUFFER,
      replaceRange: STACK_WITNESS_OP_IDS.REPLACE_RANGE,
      textWindowQuery: STACK_WITNESS_OP_IDS.TEXT_WINDOW_QUERY,
    },
    jeditGeneratedContract,
    reading: {
      operationName: appReading.operationName,
      frontierRef: appReading.frontierRef,
      text: appReading.reading.lines.map((line) => line.text).join('\n'),
      readingId: appReading.reading.readingId,
      artifactHash: bytesToHex(artifact.artifact_hash),
      residualPosture: artifact.reading.residual_posture,
      observerBasis: artifact.reading.observer_basis,
      frame: artifact.frame,
      queryId: artifact.projection.query_id,
      basisWorldlineId: textWindowBasis.worldlineIdHex,
    },
  }, null, 2)}\n`);
}

function decodeOkEnvelope(bytes) {
  const decoded = decodeCbor(bytes);
  assert.equal(decoded.ok, true, decoded.message ?? 'Echo WASM returned an error envelope');
  return decoded;
}
