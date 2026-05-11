import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

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

const UTF8_ENCODER = new TextEncoder();
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
  const queryBytes = extractQueryBytes(artifact);
  const appReading = toAppFacingTextWindowReading(artifact, queryBytes);

  assertReadingEnvelopePresent(artifact);
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

function extractQueryBytes(artifact) {
  assert.equal(artifact.payload.kind, 'query_bytes');
  if (artifact.payload.data instanceof Uint8Array) {
    return artifact.payload.data;
  }
  assert.ok(Array.isArray(artifact.payload.data));
  return Uint8Array.from(artifact.payload.data);
}

function toAppFacingTextWindowReading(artifact, queryBytes) {
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

function packEintEnvelope(opId, varsBytes) {
  const envelope = new Uint8Array(12 + varsBytes.length);
  envelope.set(encodeUtf8('EINT'), 0);
  writeU32Le(envelope, 4, opId);
  writeU32Le(envelope, 8, varsBytes.length);
  envelope.set(varsBytes, 12);
  return envelope;
}

function writeU32Le(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function decodeOkEnvelope(bytes) {
  const decoded = decodeCbor(bytes);
  assert.equal(decoded.ok, true, decoded.message ?? 'Echo WASM returned an error envelope');
  return decoded;
}

function encodeUtf8(text) {
  return UTF8_ENCODER.encode(text);
}

function bytesAsSequence(bytes) {
  return Array.from(bytes);
}

function encodeCbor(value) {
  const chunks = [];
  appendCbor(value, chunks);
  return concatBytes(chunks);
}

function appendCbor(value, chunks) {
  if (value === null) {
    chunks.push(new Uint8Array([0xf6]));
    return;
  }
  if (typeof value === 'boolean') {
    chunks.push(new Uint8Array([value ? 0xf5 : 0xf4]));
    return;
  }
  if (typeof value === 'number') {
    assert.equal(Number.isSafeInteger(value), true);
    appendCborInteger(value, chunks);
    return;
  }
  if (typeof value === 'string') {
    appendCborText(value, chunks);
    return;
  }
  if (value instanceof Uint8Array) {
    appendCborBytes(value, chunks);
    return;
  }
  if (Array.isArray(value)) {
    appendMajorLength(4, value.length, chunks);
    for (const item of value) {
      appendCbor(item, chunks);
    }
    return;
  }
  appendCborObject(value, chunks);
}

function appendCborObject(value, chunks) {
  const entries = Object.entries(value).map(([key, entryValue]) => {
    const encodedKey = encodeCbor(key);
    const encodedValue = encodeCbor(entryValue);
    return { encodedKey, encodedValue };
  });
  entries.sort((left, right) => compareBytes(left.encodedKey, right.encodedKey));
  appendMajorLength(5, entries.length, chunks);
  for (const entry of entries) {
    chunks.push(entry.encodedKey);
    chunks.push(entry.encodedValue);
  }
}

function appendCborInteger(value, chunks) {
  if (value >= 0) {
    appendMajorLength(0, value, chunks);
    return;
  }
  appendMajorLength(1, -1 - value, chunks);
}

function appendCborText(value, chunks) {
  const bytes = encodeUtf8(value);
  appendMajorLength(3, bytes.length, chunks);
  chunks.push(bytes);
}

function appendCborBytes(value, chunks) {
  appendMajorLength(2, value.length, chunks);
  chunks.push(value);
}

function appendMajorLength(major, length, chunks) {
  if (length <= 23) {
    chunks.push(new Uint8Array([(major << 5) | length]));
  } else if (length <= 0xff) {
    chunks.push(new Uint8Array([(major << 5) | 24, length]));
  } else if (length <= 0xffff) {
    chunks.push(new Uint8Array([(major << 5) | 25, length >> 8, length & 0xff]));
  } else if (length <= 0xffff_ffff) {
    chunks.push(new Uint8Array([
      (major << 5) | 26,
      (length >>> 24) & 0xff,
      (length >>> 16) & 0xff,
      (length >>> 8) & 0xff,
      length & 0xff,
    ]));
  } else {
    throw new Error('CBOR witness encoder does not support lengths above u32::MAX');
  }
}

function decodeCbor(bytes) {
  const cursor = { offset: 0 };
  const value = readCbor(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), cursor);
  assert.equal(cursor.offset, bytes.length);
  return value;
}

function readCbor(bytes, cursor) {
  const initial = readByte(bytes, cursor);
  const major = initial >> 5;
  const additional = initial & 0x1f;
  switch (major) {
    case 0:
      return readLength(bytes, cursor, additional);
    case 1:
      return -1 - readLength(bytes, cursor, additional);
    case 2:
      return readByteString(bytes, cursor, additional);
    case 3:
      return UTF8_DECODER.decode(readByteString(bytes, cursor, additional));
    case 4:
      return readArray(bytes, cursor, additional);
    case 5:
      return readMap(bytes, cursor, additional);
    case 7:
      return readSimple(additional);
    default:
      throw new Error(`unsupported CBOR major type ${major}`);
  }
}

function readArray(bytes, cursor, additional) {
  const length = readLength(bytes, cursor, additional);
  const values = [];
  for (let index = 0; index < length; index += 1) {
    values.push(readCbor(bytes, cursor));
  }
  return values;
}

function readMap(bytes, cursor, additional) {
  const length = readLength(bytes, cursor, additional);
  const value = {};
  for (let index = 0; index < length; index += 1) {
    const key = readCbor(bytes, cursor);
    assert.equal(typeof key, 'string');
    value[key] = readCbor(bytes, cursor);
  }
  return value;
}

function readByteString(bytes, cursor, additional) {
  const length = readLength(bytes, cursor, additional);
  const start = cursor.offset;
  const end = start + length;
  assert.ok(end <= bytes.length);
  cursor.offset = end;
  return bytes.slice(start, end);
}

function readSimple(additional) {
  switch (additional) {
    case 20:
      return false;
    case 21:
      return true;
    case 22:
      return null;
    default:
      throw new Error(`unsupported CBOR simple value ${additional}`);
  }
}

function readLength(bytes, cursor, additional) {
  if (additional <= 23) {
    return additional;
  }
  if (additional === 24) {
    return readByte(bytes, cursor);
  }
  if (additional === 25) {
    return (readByte(bytes, cursor) << 8) | readByte(bytes, cursor);
  }
  if (additional === 26) {
    return (
      (readByte(bytes, cursor) * 0x1_000000)
      + (readByte(bytes, cursor) << 16)
      + (readByte(bytes, cursor) << 8)
      + readByte(bytes, cursor)
    );
  }
  throw new Error(`unsupported CBOR additional length ${additional}`);
}

function readByte(bytes, cursor) {
  assert.ok(cursor.offset < bytes.length);
  const value = bytes[cursor.offset];
  cursor.offset += 1;
  return value;
}

function concatBytes(chunks) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function compareBytes(left, right) {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const delta = left[index] - right[index];
    if (delta !== 0) {
      return delta;
    }
  }
  return left.length - right.length;
}

function hexToBytes(hex) {
  assert.equal(hex.length % 2, 0);
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
