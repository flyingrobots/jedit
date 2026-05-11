import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
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

const REPO_ROOT = process.cwd();
const TRANSPORT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'echo-wasm-kernel.js');
const REAL_ECHO_WASM_MODULE = process.env.JEDIT_ECHO_WASM_MODULE;

const STACK_WITNESS_CREATE_BUFFER_OP_ID = 0x5357_0001;
const STACK_WITNESS_REPLACE_RANGE_OP_ID = 0x5357_0002;
const STACK_WITNESS_TEXT_WINDOW_QUERY_ID = 0x5357_1001;
const ECHO_CONTROL_INTENT_V1_OP_ID = 0xffff_ffff;
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
// This must become an Echo-exported value before this graduates from fixture
// witness to production adapter behavior.
const ECHO_DERIVED_FIXTURE_DEFAULT_WORLDLINE_ID_HEX =
  '3e888b35fc1d18b5487da6704fa71c3374e95dd52bc83963239b127f9293f228';

const UTF8_DECODER = new TextDecoder();

test('real Echo WASM Stack Witness 0001 transport emits ReadingEnvelope + QueryBytes', {
  skip: REAL_ECHO_WASM_MODULE == null
    ? 'set JEDIT_ECHO_WASM_MODULE to an Echo warp-wasm JS module to run this opt-in witness'
    : false,
}, async () => {
  assert.equal(typeof REAL_ECHO_WASM_MODULE, 'string');

  const transportModule = await loadTransportModule();
  const transport = await transportModule.createEchoWasmKernelTransport({
    moduleSpecifier: toModuleSpecifier(REAL_ECHO_WASM_MODULE),
  });

  dispatchFixtureIntent(
    transport,
    STACK_WITNESS_CREATE_BUFFER_OP_ID,
    STACK_WITNESS_CREATE_BUFFER_VARS,
  );
  runEchoSchedulerUntilIdle(transport);
  dispatchFixtureIntent(
    transport,
    STACK_WITNESS_REPLACE_RANGE_OP_ID,
    STACK_WITNESS_REPLACE_RANGE_VARS,
  );
  runEchoSchedulerUntilIdle(transport);

  const artifact = decodeOkEnvelope(transport.observeBytes(encodeStackWitnessTextWindowRequest()));

  assertReadingEnvelopePresent(artifact);
  assertStackWitnessArtifactIdentity(artifact);

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
});

async function loadTransportModule() {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);
  return import(pathToFileURL(TRANSPORT_MODULE_PATH).href);
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

function runEchoSchedulerUntilIdle(transport) {
  const response = decodeOkEnvelope(transport.submitIntentBytes(packControlStartIntent()));
  assert.equal(response.accepted, true);
  assert.equal(response.scheduler_status.last_run_completion, 'quiesced');
}

function packControlStartIntent() {
  return packEintEnvelope(ECHO_CONTROL_INTENT_V1_OP_ID, encodeCbor({
    kind: 'start',
    mode: {
      kind: 'until_idle',
      cycle_limit: RUN_UNTIL_IDLE_CYCLE_LIMIT,
    },
  }));
}

function encodeStackWitnessTextWindowRequest() {
  return encodeCbor({
    coordinate: {
      worldline_id: hexToBytes(ECHO_DERIVED_FIXTURE_DEFAULT_WORLDLINE_ID_HEX),
      at: {
        kind: 'frontier',
      },
    },
    frame: 'query_view',
    projection: {
      kind: 'query',
      query_id: STACK_WITNESS_TEXT_WINDOW_QUERY_ID,
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

function assertReadingEnvelopePresent(artifact) {
  assert.equal(typeof artifact.reading, 'object');
  assert.notEqual(artifact.reading, null);
  assert.equal(artifact.reading.observer_basis, 'query_view');
  assert.equal(artifact.reading.budget_posture, 'unbounded_one_shot');
  assert.equal(artifact.reading.rights_posture, 'kernel_public');
  assert.equal(artifact.reading.residual_posture, 'complete');
}

function assertStackWitnessArtifactIdentity(artifact) {
  assert.equal(bytesToHex(artifact.resolved.worldline_id), ECHO_DERIVED_FIXTURE_DEFAULT_WORLDLINE_ID_HEX);
  assert.equal(artifact.frame, 'query_view');
  assert.equal(artifact.projection.kind, 'query');
  assert.equal(artifact.projection.query_id, STACK_WITNESS_TEXT_WINDOW_QUERY_ID);
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

function decodeOkEnvelope(bytes) {
  const decoded = decodeCbor(bytes);
  assert.equal(decoded.ok, true, decoded.message ?? "Echo WASM returned an error envelope");
  return decoded;
}
