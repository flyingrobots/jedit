import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'workspace', 'production-text-session.js');
const BUFFER_ID = 'buffer:1';
const AT_MS = 123;
const VIEWPORT_APERTURE = Object.freeze({
  cursorLine: 4,
  viewportLineCount: 8,
  beforeLines: 2,
  afterLines: 3,
  maxBytes: 512,
});

let modulePromise;

test('production text session opens buffers through TextBufferSessionPort', async () => {
  const module = await loadModule();
  const calls = [];
  const session = fakeTextBufferSession({
    createBuffer(input) {
      calls.push(input);
      return fakeTextBufferOptic();
    },
  });
  const production = module.createProductionTextSession(session);

  const outcome = await production.openBuffer({
    bufferKey: 'notes.md',
    initialText: 'hello',
    projectionPath: 'notes.md',
    atMs: AT_MS,
  });

  assert.equal(outcome.kind, module.ProductionTextSessionOutcomeKinds.Opened);
  assert.deepEqual(calls, [{
    bufferKey: 'notes.md',
    initialText: 'hello',
    projectionPath: 'notes.md',
  }]);
  assert.equal('requestRunUntilIdle' in production, false);
  assert.equal('requestRunUntilIdle' in outcome.optic, false);
});

test('production text session submits insert replace and delete as app intents', async () => {
  const module = await loadModule();
  const intents = [];
  const optic = fakeTextBufferOptic({
    applyIntent(intent) {
      intents.push(intent);
      return appliedResult();
    },
  });
  const production = module.createProductionTextSession(fakeTextBufferSession({ optic }));

  const inserted = await production.insertText({
    bufferId: BUFFER_ID,
    startByte: 0,
    insertText: 'abc',
    atMs: AT_MS,
  });
  const replaced = await production.replaceRange({
    bufferId: BUFFER_ID,
    startByte: 1,
    endByte: 2,
    insertText: 'B',
    atMs: AT_MS,
  });
  const deleted = await production.deleteRange({
    bufferId: BUFFER_ID,
    startByte: 2,
    endByte: 3,
    atMs: AT_MS,
  });

  assert.equal(inserted.kind, module.ProductionTextSessionOutcomeKinds.Applied);
  assert.equal(replaced.kind, module.ProductionTextSessionOutcomeKinds.Applied);
  assert.equal(deleted.kind, module.ProductionTextSessionOutcomeKinds.Applied);
  assert.deepEqual(intents, [
    { kind: 'replaceRange', startByte: 0, endByte: 0, insertText: 'abc' },
    { kind: 'replaceRange', startByte: 1, endByte: 2, insertText: 'B' },
    { kind: 'replaceRange', startByte: 2, endByte: 3, insertText: '' },
  ]);
});

test('production text session reads bounded windows from cursor and viewport aperture', async () => {
  const module = await loadModule();
  const textWindowCalls = [];
  const applyIntentCalls = [];
  const optic = fakeTextBufferOptic({
    applyIntent(intent) {
      applyIntentCalls.push(intent);
      return appliedResult();
    },
    textWindow(readBasis, input) {
      textWindowCalls.push({ readBasis, input });
      return observedReading();
    },
  });
  const production = module.createProductionTextSession(fakeTextBufferSession({ optic }));

  const outcome = await production.observeWindow({
    bufferId: BUFFER_ID,
    aperture: VIEWPORT_APERTURE,
    atMs: AT_MS,
  });

  assert.equal(outcome.kind, module.ProductionTextSessionOutcomeKinds.Observed);
  assert.deepEqual(textWindowCalls, [{
    readBasis: { kind: 'read-basis-handle', id: 'basis:1' },
    input: VIEWPORT_APERTURE,
  }]);
  assert.deepEqual(applyIntentCalls, []);
  assert.equal(outcome.observed.evidence.readingId, 'reading:1');
  assert.equal(outcome.observed.evidence.retainedEvidence?.refs.length, 2);
});

test('production text session creates manual checkpoint evidence through app capability', async () => {
  const module = await loadModule();
  const checkpoints = [];
  const optic = fakeTextBufferOptic({
    createCheckpoint(request) {
      checkpoints.push(request);
      return checkpointResult();
    },
  });
  const production = module.createProductionTextSession(fakeTextBufferSession({ optic }));

  const outcome = await production.checkpointBuffer({
    bufferId: BUFFER_ID,
    label: 'manual save',
    atMs: AT_MS,
  });

  assert.equal(outcome.kind, module.ProductionTextSessionOutcomeKinds.Checkpointed);
  assert.equal(outcome.result.checkpointId, 'checkpoint:1');
  assert.equal(outcome.result.checkpointKind, 'MANUAL_SAVE');
  assert.deepEqual(checkpoints, [{
    kind: 'MANUAL_SAVE',
    label: 'manual save',
  }]);
});

test('production text session exports materialized text from bounded readings without edit intent', async () => {
  const module = await loadModule();
  const applyIntentCalls = [];
  const optic = fakeTextBufferOptic({
    applyIntent(intent) {
      applyIntentCalls.push(intent);
      return appliedResult();
    },
    textWindow() {
      return observedReading();
    },
  });
  const production = module.createProductionTextSession(fakeTextBufferSession({ optic }));

  const outcome = await production.exportWindow({
    bufferId: BUFFER_ID,
    aperture: VIEWPORT_APERTURE,
    atMs: AT_MS,
  });

  assert.equal(outcome.kind, module.ProductionTextSessionOutcomeKinds.Exported);
  assert.equal(outcome.text, 'text');
  assert.equal(outcome.readingId, 'reading:1');
  assert.deepEqual(applyIntentCalls, []);
});

test('production text session maps obstructed edits to typed runtime issue posture without retry', async () => {
  const module = await loadModule();
  let applyCalls = 0;
  const optic = fakeTextBufferOptic({
    applyIntent() {
      applyCalls += 1;
      throw new Error('unsupported operation');
    },
  });
  const production = module.createProductionTextSession(fakeTextBufferSession({ optic }));

  const outcome = await production.replaceRange({
    bufferId: BUFFER_ID,
    startByte: 0,
    endByte: 1,
    insertText: 'x',
    atMs: AT_MS,
  });

  assert.equal(outcome.kind, module.ProductionTextSessionOutcomeKinds.Obstructed);
  assert.equal(outcome.obstruction.code, module.ProductionTextObstructionCodes.Edit);
  assert.equal(outcome.obstruction.issue.level, 'error');
  assert.equal(outcome.obstruction.issue.source, 'command');
  assert.equal(outcome.obstruction.issue.message, 'unsupported operation');
  assert.equal(outcome.obstruction.issue.atMs, AT_MS);
  assert.equal(applyCalls, 1);
});

test('production text session maps missing buffers to obstruction without mutation', async () => {
  const module = await loadModule();
  const production = module.createProductionTextSession(fakeTextBufferSession({ optic: null }));

  const outcome = await production.deleteRange({
    bufferId: BUFFER_ID,
    startByte: 0,
    endByte: 1,
    atMs: AT_MS,
  });

  assert.equal(outcome.kind, module.ProductionTextSessionOutcomeKinds.Obstructed);
  assert.equal(outcome.obstruction.code, module.ProductionTextObstructionCodes.MissingBuffer);
});

test('production text session obstructs grouped edits instead of mutating locally', async () => {
  const module = await loadModule();
  const intents = [];
  const optic = fakeTextBufferOptic({
    applyIntent(intent) {
      intents.push(intent);
      return appliedResult();
    },
  });
  const production = module.createProductionTextSession(fakeTextBufferSession({ optic }));

  const outcome = await production.multiRangeEdit({
    bufferId: BUFFER_ID,
    ranges: [{ startByte: 0, endByte: 1, insertText: 'x' }],
    atMs: AT_MS,
  });

  assert.equal(outcome.kind, module.ProductionTextSessionOutcomeKinds.Obstructed);
  assert.equal(outcome.obstruction.code, module.ProductionTextObstructionCodes.Edit);
  assert.deepEqual(intents, []);
});

function fakeTextBufferSession(options) {
  return {
    sessionId: 'session:1',
    async createBuffer(input) {
      return options.createBuffer == null ? fakeTextBufferOptic() : options.createBuffer(input);
    },
    async getBufferOptic() {
      return options.optic === undefined ? fakeTextBufferOptic() : options.optic;
    },
    async listBuffers() {
      return [];
    },
  };
}

function fakeTextBufferOptic(overrides = {}) {
  return {
    buffer: {
      bufferId: BUFFER_ID,
      bufferKey: 'notes.md',
      projectionPath: 'notes.md',
      createdAt: '1970-01-01T00:00:00.000Z',
    },
    currentReadBasis() {
      return { kind: 'read-basis-handle', id: 'basis:1' };
    },
    async applyIntent(intent) {
      return overrides.applyIntent == null ? appliedResult() : overrides.applyIntent(intent);
    },
    async createCheckpoint(request) {
      return overrides.createCheckpoint == null ? checkpointResult() : overrides.createCheckpoint(request);
    },
    async textWindow(readBasis, input) {
      return overrides.textWindow == null ? observedReading() : overrides.textWindow(readBasis, input);
    },
  };
}

function appliedResult() {
  return {
    buffer: {
      bufferId: BUFFER_ID,
      bufferKey: 'notes.md',
      projectionPath: 'notes.md',
      createdAt: '1970-01-01T00:00:00.000Z',
    },
    readBasis: { kind: 'read-basis-handle', id: 'basis:1' },
    bufferVersion: 1,
    receiptId: 'receipt:1',
  };
}

function checkpointResult() {
  return {
    buffer: {
      bufferId: BUFFER_ID,
      bufferKey: 'notes.md',
      projectionPath: 'notes.md',
      createdAt: '1970-01-01T00:00:00.000Z',
    },
    readBasis: { kind: 'read-basis-handle', id: 'basis:1' },
    bufferVersion: 1,
    checkpointId: 'checkpoint:1',
    checkpointKind: 'MANUAL_SAVE',
  };
}

function observedReading() {
  return {
    value: {
      readingId: 'reading:1',
      lines: [{ lineNumber: 0, startByte: 0, endByte: 4, text: 'text' }],
      byteLength: 4,
      lineCount: 1,
      cursorLine: VIEWPORT_APERTURE.cursorLine,
      viewportLineCount: VIEWPORT_APERTURE.viewportLineCount,
      truncated: false,
    },
    evidence: {
      readingId: 'reading:1',
      retainedEvidence: {
        refs: [
          {
            kind: 'jedit-retained-evidence-ref',
            role: 'READING_ENVELOPE',
            semanticCoordinate: {
              kind: 'semantic-coordinate',
              packageId: 'jedit.hot-text-runtime',
              operationName: 'textWindow',
              coordinate: 'envelope:reading:1',
            },
            posture: 'MISSING',
          },
          {
            kind: 'jedit-retained-evidence-ref',
            role: 'READING_PAYLOAD',
            semanticCoordinate: {
              kind: 'semantic-coordinate',
              packageId: 'jedit.hot-text-runtime',
              operationName: 'textWindow',
              coordinate: 'payload:reading:1',
            },
            posture: 'MISSING',
          },
        ],
      },
    },
  };
}

async function loadModule() {
  if (modulePromise) {
    return modulePromise;
  }
  modulePromise = (async () => {    return import(pathToFileURL(MODULE_PATH).href);
  })();
  return modulePromise;
}
