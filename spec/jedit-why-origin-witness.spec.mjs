import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const CLIENT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'jedit-echo-optic-client.js');
const TRANSPORT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'installed-jedit-contract-echo-transport.js');
const SESSION_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'text-buffer-session.js');
const WHY_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-why-range.js');
const DETAILS_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'workspace', 'workspace-why-range-details.js');
const MAX_FACTS = 64;
const MAX_DEPTH = 16;
const MAX_HISTORICAL_TEXT_BYTES = 8_192;
const MALFORMED_RANGE_START_BYTE = 0;
const MALFORMED_RANGE_END_BYTE = 1;
const UNKNOWN_ORIGIN_KIND = 'FUTURE_ORIGIN';

let modulesPromise;

test('why origin witness identifies untouched imported text', async () => {
  const { optic } = await createOptic('imported');
  const report = await optic.explainRange({ startByte: 0, endByte: 8 });

  assert.equal(report.witness.result.fragments[0].origin.kind, 'IMPORTED');
  assert.equal('rewriteId' in report.witness.result.fragments[0].origin, false);
});

test('why origin witness identifies user-edited text through retained rewrite facts', async () => {
  const { optic } = await createOptic('before');
  await optic.applyIntent({ kind: 'replaceRange', startByte: 0, endByte: 6, insertText: 'after' });
  const report = await optic.explainRange({ startByte: 0, endByte: 5 });
  const origin = report.witness.result.fragments[0].origin;

  assert.equal(origin.kind, 'REWRITE');
  assert.notEqual(origin.rewriteId, origin.diffId);
  assert.notEqual(origin.diffId, origin.textTickReceiptId);
});

test('why origin witness associates saved text with its checkpoint declaration', async () => {
  const { optic } = await createOptic('saved');
  const checkpoint = await optic.createCheckpoint({ kind: 'MANUAL_SAVE', label: 'manual save' });
  const report = await optic.explainRange({ startByte: 0, endByte: 5 });

  assert.deepEqual(report.witness.result.relatedCheckpoints, [{
    checkpointId: checkpoint.checkpointId,
    headId: report.witness.basisHeadId,
    reason: 'manual-save',
    anchorAssociation: null,
  }]);
});

test('why origin witness obstructs generated attribution when producer evidence is absent', async () => {
  const modules = await loadModules();
  const client = installedClient(modules);
  const opened = await client.openTextBuffer({
    bufferKey: 'generated.txt',
    initialText: '',
    projectionPath: '/tmp/generated.txt',
    createInitialCheckpoint: false,
  });
  const edited = await client.replaceRangeAsTick(opened.nextSession, {
    worldlineId: opened.nextSession.worldline.worldlineId,
    baseHeadId: opened.nextSession.worldline.canonicalHeadId,
    startByte: 0,
    endByte: 0,
    insertText: 'generated',
    author: 'graft-generator',
  });
  const reading = await client.whyRange(edited.nextSession, 'frontier:generated', {
    worldlineId: edited.nextSession.worldline.worldlineId,
    basisHeadId: edited.nextSession.worldline.canonicalHeadId,
    startByte: 0,
    endByte: 9,
    maxFacts: MAX_FACTS,
    maxDepth: MAX_DEPTH,
    maxHistoricalTextBytes: MAX_HISTORICAL_TEXT_BYTES,
  });
  const report = modules.why.explainJeditWhyRange(reading.reading);
  const origin = report.witness.result.fragments[0].origin;

  assert.deepEqual(origin.producerEvidence, {
    kind: 'UNAVAILABLE',
    code: 'jedit_why_range_producer_evidence_unavailable',
  });
  assert.ok(modules.details.jeditWhyRangeDetailRows(report).some(row => (
    row.includes('jedit_why_range_producer_evidence_unavailable')
  )));
});

test('why origin witness rejects unknown origin discriminators', async () => {
  const modules = await loadModules();

  assert.throws(
    () => modules.why.explainJeditWhyRange(malformedOriginReading()),
    error => error.name === 'JeditWhyRangeEvidenceError'
      && error.message.includes('unsupported'),
  );
});

async function createOptic(initialText) {
  const modules = await loadModules();
  const client = installedClient(modules);
  const optic = await modules.session.createTextBufferSession(client).createBuffer({
    bufferKey: 'origin.txt',
    initialText,
    projectionPath: '/tmp/origin.txt',
  });
  return { optic };
}

function installedClient(modules) {
  return modules.client.createEchoTransportJeditOpticClient(
    modules.transport.createInstalledJeditContractEchoTransport(),
  );
}

function malformedOriginReading() {
  return {
    worldlineId: 'worldline:malformed-origin',
    basisHeadId: 'head:malformed-origin',
    startByte: MALFORMED_RANGE_START_BYTE,
    endByte: MALFORMED_RANGE_END_BYTE,
    coverage: {
      kind: 'COMPLETE',
      coveredStartByte: MALFORMED_RANGE_START_BYTE,
      coveredEndByte: MALFORMED_RANGE_END_BYTE,
      continuation: null,
      reason: null,
    },
    fragments: [{
      coveredStartByte: MALFORMED_RANGE_START_BYTE,
      coveredEndByte: MALFORMED_RANGE_END_BYTE,
      headId: 'head:malformed-origin',
      leafId: 'leaf:malformed-origin',
      blobId: 'blob:malformed-origin',
      origin: { kind: UNKNOWN_ORIGIN_KIND, unavailableCode: 'false-unavailable' },
    }],
    relatedCheckpoints: [],
    inspectedFactCount: 1,
    observerVersion: 'test-malformed-origin',
  };
}

async function loadModules() {
  await ensureDistBuilt();
  modulesPromise ??= Promise.all([
    import(pathToFileURL(CLIENT_MODULE_PATH).href),
    import(pathToFileURL(TRANSPORT_MODULE_PATH).href),
    import(pathToFileURL(SESSION_MODULE_PATH).href),
    import(pathToFileURL(WHY_MODULE_PATH).href),
    import(pathToFileURL(DETAILS_MODULE_PATH).href),
  ]).then(([client, transport, session, why, details]) => ({
    client,
    transport,
    session,
    why,
    details,
  }));
  return modulesPromise;
}
