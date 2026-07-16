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
