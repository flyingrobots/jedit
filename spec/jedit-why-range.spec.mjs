import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const CLIENT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'jedit-echo-optic-client.js');
const TRANSPORT_MODULE_PATH = path.join(
  REPO_ROOT,
  'dist',
  'adapters',
  'installed-jedit-contract-echo-transport.js',
);
const SESSION_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'text-buffer-session.js');
const OBSERVER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-why-range-observer.js');
const OBSERVED_WORLDLINE_ID = 'worldline:observer-range';
const OBSERVED_HEAD_ID = 'head:observer-range';
const OBSERVED_RANGE_START_BYTE = 2;
const OBSERVED_RANGE_END_BYTE = 5;
const MISMATCHED_RANGE_START_BYTE = 1;
const MISMATCHED_RANGE_END_BYTE = 6;
const OBSERVER_MAX_FACTS = 16;
const OBSERVER_MAX_DEPTH = 8;
const OBSERVER_MAX_HISTORICAL_TEXT_BYTES = 0;

async function createOptic(initialText) {
  await ensureDistBuilt();
  const [clientModule, transportModule, sessionModule] = await Promise.all([
    import(pathToFileURL(CLIENT_MODULE_PATH).href),
    import(pathToFileURL(TRANSPORT_MODULE_PATH).href),
    import(pathToFileURL(SESSION_MODULE_PATH).href),
  ]);
  const client = clientModule.createEchoTransportJeditOpticClient(
    transportModule.createInstalledJeditContractEchoTransport(),
  );
  return sessionModule.createTextBufferSession(client).createBuffer({
    bufferKey: 'notes/today.md',
    initialText,
    projectionPath: '/tmp/notes/today.md',
  });
}

test('installed Echo why-range returns retained rewrite, diff, and tick receipt identities', async () => {
  const optic = await createOptic('alpha beta');
  await optic.applyIntent({
    kind: 'replaceRange',
    startByte: 6,
    endByte: 10,
    insertText: 'Jim',
  });

  const report = await optic.explainRange({ startByte: 6, endByte: 9 });
  const fragment = report.witness.result.fragments[0];

  assert.equal(report.witness.result.kind, 'produced');
  assert.equal(report.witness.result.coverage.kind, 'COMPLETE');
  assert.equal(fragment.origin.kind, 'REWRITE');
  assert.notEqual(fragment.origin.rewriteId, fragment.origin.diffId);
  assert.notEqual(fragment.origin.rewriteId, fragment.origin.textTickReceiptId);
  assert.notEqual(fragment.origin.diffId, fragment.origin.textTickReceiptId);
  assert.equal(report.witness.basisHeadId, fragment.headId);
  assert.match(report.message, new RegExp(fragment.origin.rewriteId));
  assert.match(report.message, new RegExp(fragment.origin.textTickReceiptId));
});

test('installed Echo why-range preserves mixed imported and rewritten fragments', async () => {
  const optic = await createOptic('foo');
  await optic.applyIntent({
    kind: 'replaceRange',
    startByte: 1,
    endByte: 1,
    insertText: 'X',
  });

  const report = await optic.explainRange({ startByte: 0, endByte: 4 });

  assert.deepEqual(
    report.witness.result.fragments.map(fragment => fragment.origin.kind),
    ['IMPORTED', 'REWRITE', 'IMPORTED'],
  );
  assert.deepEqual(
    report.witness.result.fragments.map(fragment => fragment.coveredRange),
    [
      { startByte: 0, endByte: 1 },
      { startByte: 1, endByte: 2 },
      { startByte: 2, endByte: 4 },
    ],
  );
});

test('installed Echo why-range explains untouched imported text without inventing rewrite evidence', async () => {
  const optic = await createOptic('untouched');

  const report = await optic.explainRange({ startByte: 0, endByte: 9 });
  const fragment = report.witness.result.fragments[0];

  assert.equal(fragment.origin.kind, 'IMPORTED');
  assert.equal('rewriteId' in fragment.origin, false);
  assert.equal('diffId' in fragment.origin, false);
  assert.equal('textTickReceiptId' in fragment.origin, false);
  assert.equal(report.witness.basisHeadId, fragment.headId);
});

test('installed Echo why-range preserves typed runtime limit obstructions', async () => {
  await ensureDistBuilt();
  const [clientModule, transportModule] = await Promise.all([
    import(pathToFileURL(CLIENT_MODULE_PATH).href),
    import(pathToFileURL(TRANSPORT_MODULE_PATH).href),
  ]);
  const client = clientModule.createEchoTransportJeditOpticClient(
    transportModule.createInstalledJeditContractEchoTransport(),
  );
  const opened = await client.openTextBuffer({
    bufferKey: 'bounded.txt',
    initialText: 'bounded',
    projectionPath: '/tmp/bounded.txt',
    createInitialCheckpoint: false,
  });

  await assert.rejects(
    client.whyRange(opened.nextSession, 'frontier:bounded', {
      worldlineId: opened.nextSession.worldline.worldlineId,
      basisHeadId: opened.nextSession.worldline.canonicalHeadId,
      startByte: 0,
      endByte: 7,
      maxFacts: 1,
      maxDepth: 8,
      maxHistoricalTextBytes: 1,
    }),
    error => error.name === 'JeditOpticTransportObstructionError'
      && error.obstruction.code === 'range-why-limit-exceeded',
  );
});

for (const scenario of [
  {
    name: 'query coordinates',
    reading: whyRangeReading({ startByte: MISMATCHED_RANGE_START_BYTE }),
  },
  {
    name: 'complete coverage coordinates',
    reading: whyRangeReading({
      coverage: {
        ...whyRangeReading().coverage,
        coveredEndByte: MISMATCHED_RANGE_END_BYTE,
      },
    }),
  },
]) {
  test(`why-range observer rejects mismatched ${scenario.name}`, async () => {
    await ensureDistBuilt();
    const observer = await import(pathToFileURL(OBSERVER_MODULE_PATH).href);

    assert.throws(
      () => observer.readWhyRangeWithObserverPlan(
        whyRangeRuntime(scenario.reading),
        whyRangeSession(),
        'frontier:observer-range',
        whyRangeInput(),
      ),
      error => error.name === 'WhyRangeRuntimeError'
        && /byte range/.test(error.message),
    );
  });
}

test('why-range observer accepts partial coverage contained within the requested range', async () => {
  await ensureDistBuilt();
  const observer = await import(pathToFileURL(OBSERVER_MODULE_PATH).href);
  const partialReading = whyRangeReading({
    coverage: {
      kind: 'PARTIAL',
      coveredStartByte: OBSERVED_RANGE_START_BYTE + 1,
      coveredEndByte: OBSERVED_RANGE_END_BYTE,
      continuation: 'continuation:observer-range',
      reason: 'bounded',
    },
  });

  const envelope = observer.readWhyRangeWithObserverPlan(
    whyRangeRuntime(partialReading),
    whyRangeSession(),
    'frontier:observer-range',
    whyRangeInput(),
  );

  assert.deepEqual(envelope.reading.coverage, partialReading.coverage);
});

function whyRangeRuntime(reading) {
  return {
    whyRange() {
      return reading;
    },
  };
}

function whyRangeSession() {
  return {
    worldline: { worldlineId: OBSERVED_WORLDLINE_ID },
    state: {},
  };
}

function whyRangeInput() {
  return {
    worldlineId: OBSERVED_WORLDLINE_ID,
    basisHeadId: OBSERVED_HEAD_ID,
    startByte: OBSERVED_RANGE_START_BYTE,
    endByte: OBSERVED_RANGE_END_BYTE,
    maxFacts: OBSERVER_MAX_FACTS,
    maxDepth: OBSERVER_MAX_DEPTH,
    maxHistoricalTextBytes: OBSERVER_MAX_HISTORICAL_TEXT_BYTES,
  };
}

function whyRangeReading(overrides = {}) {
  return {
    worldlineId: OBSERVED_WORLDLINE_ID,
    basisHeadId: OBSERVED_HEAD_ID,
    startByte: OBSERVED_RANGE_START_BYTE,
    endByte: OBSERVED_RANGE_END_BYTE,
    coverage: {
      kind: 'COMPLETE',
      coveredStartByte: OBSERVED_RANGE_START_BYTE,
      coveredEndByte: OBSERVED_RANGE_END_BYTE,
      continuation: null,
      reason: null,
    },
    fragments: [],
    relatedCheckpoints: [],
    inspectedFactCount: 0,
    observerVersion: 'test-observer-range',
    ...overrides,
  };
}
