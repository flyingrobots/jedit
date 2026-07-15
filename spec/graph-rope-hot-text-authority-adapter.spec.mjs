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

function assertOk(result) {
  assert.equal(result.ok, true);
  return result.value;
}

async function loadModules() {
  await ensureDistBuilt();
  const [authority, contract, hash, client, transport] = await Promise.all([
    import(pathToFileURL(AUTHORITY_MODULE_PATH).href),
    import(pathToFileURL(CONTRACT_MODULE_PATH).href),
    import(pathToFileURL(HASH_MODULE_PATH).href),
    import(pathToFileURL(CLIENT_MODULE_PATH).href),
    import(pathToFileURL(TRANSPORT_MODULE_PATH).href),
  ]);
  return { authority, contract, hash, client, transport };
}
