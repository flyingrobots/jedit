import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const AUTHORITY_MODULE_PATH = path.join(
  REPO_ROOT,
  'dist',
  'adapters',
  'graph-rope-hot-text-authority-adapter.js',
);
const CONTRACT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-runtime.js');
const TEXT_BUFFER_SESSION_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'text-buffer-session.js');
const HASH_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'hash.js');
const CLIENT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'jedit-echo-optic-client.js');
const TRANSPORT_MODULE_PATH = path.join(
  REPO_ROOT,
  'dist',
  'adapters',
  'installed-jedit-contract-echo-transport.js',
);
const ROPE_BRANCH_FACT_KIND = 'jedit.text.RopeBranch';
const ROPE_LEAF_FACT_KIND = 'jedit.text.RopeLeaf';
const IMPORT_TEXT = `${'a'.repeat(1400)}\n${'b'.repeat(1400)}`;

test('imports initial bytes into graph rope authority and exposes its named basis', async () => {
  const modules = await loadModules();
  const authority = modules.authority.createGraphRopeHotTextAuthority({
    hash: modules.hash.createHashPort(),
  });
  const created = modules.contract.createBufferWorldline(authority, {
    bufferKey: 'large.txt',
    initialText: IMPORT_TEXT,
    projectionPath: '/tmp/large.txt',
    createInitialCheckpoint: false,
  }, modules.hash.createHashPort());
  const basis = created.nextSession.state.authorityBasis;

  assert.ok(basis);
  assert.equal(created.result.worldline.worldlineId, basis.worldlineId);
  assert.equal(created.result.worldline.canonicalHeadId, basis.headId);
  assert.equal(created.result.head.headId, basis.headId);
  assert.equal(created.result.head.rootNodeId, basis.rootNodeId);
  assert.equal(created.nextSession.state.roots.length, 1);

  const shape = assertOk(authority.debugRopeShape(basis.headId));
  assert.equal(shape.retainedBlobBytes, Buffer.byteLength(IMPORT_TEXT, 'utf8'));
  assert.ok(shape.leafCount > 1);
  assert.ok(shape.nodes.some((node) => node.kind === ROPE_LEAF_FACT_KIND));
  assert.ok(shape.nodes.some((node) => node.kind === ROPE_BRANCH_FACT_KIND));
});

test('installed transport preserves the opaque import basis through its response codec', async () => {
  const modules = await loadModules();
  const client = modules.client.createEchoTransportJeditOpticClient(
    modules.transport.createInstalledJeditContractEchoTransport(),
  );
  const opened = await client.openTextBuffer({
    bufferKey: 'codec.txt',
    initialText: 'codec basis',
    projectionPath: '/tmp/codec.txt',
    createInitialCheckpoint: false,
  });
  const basis = opened.nextSession.state.authorityBasis;

  assert.ok(basis);
  assert.equal(opened.result.worldline.worldlineId, basis.worldlineId);
  assert.equal(opened.result.worldline.canonicalHeadId, basis.headId);
  assert.equal(opened.result.head.rootNodeId, basis.rootNodeId);
});

test('installed text optic exposes opaque graph tick and next-head identities', async () => {
  const modules = await loadModules();
  const client = modules.client.createEchoTransportJeditOpticClient(
    modules.transport.createInstalledJeditContractEchoTransport(),
  );
  const textSession = modules.textSession.createTextBufferSession(client);
  const optic = await textSession.createBuffer({
    bufferKey: 'optic-edit.txt',
    initialText: 'zero\none\ntwo',
    projectionPath: '/tmp/optic-edit.txt',
  });
  const applied = await optic.applyIntent({
    kind: 'replaceRange', startByte: 5, endByte: 8, insertText: 'causal',
  });
  const observed = await optic.textWindow(optic.currentReadBasis(), {
    cursorLine: 1, viewportLineCount: 1, beforeLines: 0, afterLines: 0, maxBytes: 80,
  });

  assert.ok(applied.causalTransition);
  assert.notEqual(applied.causalTransition.admittedTickId, applied.receiptId);
  assert.ok(applied.causalTransition.nextHeadId.length > 0);
  assert.equal(observed.value.projection.basisHeadId, applied.causalTransition.nextHeadId);
  assert.deepEqual(observed.value.projection.byteRange, { startByte: 5, endByte: 11 });
  assert.ok(observed.value.projection.support.length > 0);
  assert.deepEqual(observed.value.lines.map((line) => line.text), ['causal']);
});

test('routes insert delete and replace through graph authority without minting no-op evidence', async () => {
  const modules = await loadModules();
  const hash = modules.hash.createHashPort();
  const authority = modules.authority.createGraphRopeHotTextAuthority({ hash });
  const created = modules.contract.createBufferWorldline(authority, {
    bufferKey: 'edits.txt',
    initialText: 'alpha',
    projectionPath: '/tmp/edits.txt',
    createInitialCheckpoint: false,
  }, hash);

  const inserted = replace(modules, authority, hash, created.nextSession, 5, 5, ' beta');
  assert.equal(authority.materialize(inserted.nextSession.state), 'alpha beta');
  assertGraphEditEvidence(inserted);

  const deleted = replace(modules, authority, hash, inserted.nextSession, 0, 6, '');
  assert.equal(authority.materialize(deleted.nextSession.state), 'beta');
  assertGraphEditEvidence(deleted);

  const replaced = replace(modules, authority, hash, deleted.nextSession, 0, 4, 'gamma');
  assert.equal(authority.materialize(replaced.nextSession.state), 'gamma');
  assertGraphEditEvidence(replaced);
  assert.equal(replaced.nextSession.state.roots.length, 1);

  const noOp = replace(modules, authority, hash, replaced.nextSession, 0, 5, 'gamma');
  assert.equal(noOp.result, undefined);
  assert.equal(
    noOp.nextSession.worldline.canonicalHeadId,
    replaced.nextSession.worldline.canonicalHeadId,
  );
  assert.equal(noOp.nextSession.tickMetadata.length, replaced.nextSession.tickMetadata.length);
});

function replace(modules, authority, hash, session, startByte, endByte, insertText) {
  return modules.contract.replaceRangeAsTick(authority, session, {
    worldlineId: session.worldline.worldlineId,
    baseHeadId: session.worldline.canonicalHeadId,
    startByte,
    endByte,
    insertText,
    author: 'graph-rope-test',
  }, hash);
}

function assertGraphEditEvidence(execution) {
  assert.ok(execution.result);
  const metadata = execution.nextSession.tickMetadata.at(-1);
  assert.equal(execution.result.nextHead.headId, execution.nextSession.state.authorityBasis?.headId);
  assert.equal(execution.result.ropeRewrite.ropeRewriteId, metadata?.authorityRewriteId);
  assert.equal(execution.result.ropeDiff.ropeDiffId, metadata?.authorityDiffId);
  assert.equal(execution.nextSession.state.authorityBasis?.createdByTickId, metadata?.authorityTickId);
}

function assertOk(result) {
  assert.equal(result.ok, true);
  return result.value;
}

async function loadModules() {
  await ensureDistBuilt();
  const [authority, contract, hash, client, transport, textSession] = await Promise.all([
    import(pathToFileURL(AUTHORITY_MODULE_PATH).href),
    import(pathToFileURL(CONTRACT_MODULE_PATH).href),
    import(pathToFileURL(HASH_MODULE_PATH).href),
    import(pathToFileURL(CLIENT_MODULE_PATH).href),
    import(pathToFileURL(TRANSPORT_MODULE_PATH).href),
    import(pathToFileURL(TEXT_BUFFER_SESSION_MODULE_PATH).href),
  ]);
  return { authority, contract, hash, client, transport, textSession };
}
