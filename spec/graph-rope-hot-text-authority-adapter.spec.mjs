import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';
import { createTestEchoCausalAnchorAdmissionPort } from './support/test-echo-causal-anchor-admission.mjs';

const AUTHORITY_MODULE_PATH = path.join(
  REPO_ROOT,
  'dist',
  'adapters',
  'graph-rope-hot-text-authority-adapter.js',
);
const CONTRACT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'jedit-contract-runtime.js');
const GRAPH_ROPE_CONTRACT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'domain', 'graph-rope-contract.js');
const TEXT_BUFFER_SESSION_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'app', 'text-buffer-session.js');
const TEXT_BUFFER_SESSION_PORT_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ports', 'text-buffer-session.js');
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
  assert.equal(created.nextSession.state.roots, undefined);

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
  const observed = await optic.textWindow({
    ...applied.textBasis,
    aperture: {
      cursorLine: 1, viewportLineCount: 1, beforeLines: 0, afterLines: 0, maxBytes: 80,
    },
  });

  assert.ok(applied.causalTransition);
  assert.notEqual(applied.causalTransition.admittedTickId, applied.receiptId);
  assert.ok(applied.causalTransition.nextHeadId.length > 0);
  assert.equal(observed.value.projection.basisHeadId, applied.causalTransition.nextHeadId);
  assert.deepEqual(observed.value.projection.byteRange, { startByte: 5, endByte: 11 });
  assert.ok(observed.value.projection.support.length > 0);
  assert.deepEqual(observed.value.lines.map((line) => line.text), ['causal']);
});

test('installed Echo transport reports net causal line changes with retained support', async () => {
  const modules = await loadModules();
  const client = modules.client.createEchoTransportJeditOpticClient(
    modules.transport.createInstalledJeditContractEchoTransport(),
  );
  const textSession = modules.textSession.createTextBufferSession(client);
  const optic = await textSession.createBuffer({
    bufferKey: 'causal-lines.txt',
    initialText: 'a\nb\nc',
    projectionPath: '/tmp/causal-lines.txt',
  });
  const basisHeadId = optic.openedTextBasis.basisHeadId;
  await optic.applyIntent({
    kind: 'replaceRange', startByte: 2, endByte: 3, insertText: 'middle',
  });
  const finalEdit = await optic.applyIntent({
    kind: 'replaceRange', startByte: 2, endByte: 8, insertText: 'final',
  });

  const reading = await optic.causalLineDiff({
    basisHeadId,
    nextHeadId: finalEdit.textBasis.basisHeadId,
    maxByteCount: 1024,
    maxLineCount: 32,
    maxRewriteCount: 32,
    maxMarkerCount: 32,
  });

  assert.equal(reading.basisHeadId, basisHeadId);
  assert.equal(reading.nextHeadId, finalEdit.textBasis.basisHeadId);
  assert.equal(reading.insertedLineCount, 1);
  assert.equal(reading.deletedLineCount, 1);
  assert.equal(reading.tickReceiptIds.length, 2);
  assert.equal(reading.rewriteIds.length, 2);
  assert.equal(reading.diffIds.length, 2);
  assert.equal(new Set(reading.tickReceiptIds).size, 2);
  assert.equal(new Set(reading.rewriteIds).size, 2);
  assert.equal(new Set(reading.diffIds).size, 2);
  assert.deepEqual(reading.markers, [{
    lineNumber: 1,
    kind: 'MODIFIED',
    tickReceiptIds: reading.tickReceiptIds,
    rewriteIds: reading.rewriteIds,
    diffIds: reading.diffIds,
  }]);
  assert.match(reading.observerVersion, /^jedit-causal-line-diff-/);
});

test('text optic isolates causal receipt arrays returned by its client', async () => {
  const modules = await loadModules();
  const backingClient = modules.client.createEchoTransportJeditOpticClient(
    modules.transport.createInstalledJeditContractEchoTransport(),
  );
  let retainedEnvelope;
  const client = {
    ...backingClient,
    async causalLineDiff(...args) {
      retainedEnvelope ??= await backingClient.causalLineDiff(...args);
      return retainedEnvelope;
    },
  };
  const textSession = modules.textSession.createTextBufferSession(client);
  const optic = await textSession.createBuffer({
    bufferKey: 'isolated-causal-lines.txt',
    initialText: 'a\nb\nc',
    projectionPath: '/tmp/isolated-causal-lines.txt',
  });
  const basisHeadId = optic.openedTextBasis.basisHeadId;
  await optic.applyIntent({ kind: 'replaceRange', startByte: 0, endByte: 1, insertText: 'x' });
  const deleted = await optic.applyIntent({ kind: 'replaceRange', startByte: 2, endByte: 4, insertText: '' });
  const request = {
    basisHeadId,
    nextHeadId: deleted.textBasis.basisHeadId,
    maxByteCount: 1024,
    maxLineCount: 32,
    maxRewriteCount: 32,
    maxMarkerCount: 32,
  };

  const first = await optic.causalLineDiff(request);
  const expectedRoot = [...first.tickReceiptIds];
  const expectedMarker = [...first.markers[0].tickReceiptIds];
  const expectedDeletion = [...first.deletions[0].tickReceiptIds];
  first.tickReceiptIds.push('tick:forged');
  first.markers[0].tickReceiptIds.push('tick:marker:forged');
  first.deletions[0].tickReceiptIds.push('tick:deletion:forged');

  const second = await optic.causalLineDiff(request);
  assert.deepEqual(second.tickReceiptIds, expectedRoot);
  assert.deepEqual(second.markers[0].tickReceiptIds, expectedMarker);
  assert.deepEqual(second.deletions[0].tickReceiptIds, expectedDeletion);
});

test('text optic keeps an explicitly pinned historical head stable after later edits', async () => {
  const modules = await loadModules();
  const client = modules.client.createEchoTransportJeditOpticClient(
    modules.transport.createInstalledJeditContractEchoTransport(),
  );
  const textSession = modules.textSession.createTextBufferSession(client);
  const optic = await textSession.createBuffer({
    bufferKey: 'historical.txt',
    initialText: 'before',
    projectionPath: '/tmp/historical.txt',
  });
  const historicalBasis = optic.openedTextBasis;
  const aperture = {
    cursorLine: 0, viewportLineCount: 1, beforeLines: 0, afterLines: 0, maxBytes: 80,
  };
  const before = await optic.textWindow({ ...historicalBasis, aperture });
  const applied = await optic.applyIntent({
    kind: 'replaceRange', startByte: 0, endByte: 6, insertText: 'after',
  });
  const current = await optic.textWindow({ ...applied.textBasis, aperture });
  const historical = await optic.textWindow({ ...historicalBasis, aperture });

  assert.deepEqual(before.value.lines.map((line) => line.text), ['before']);
  assert.deepEqual(current.value.lines.map((line) => line.text), ['after']);
  assert.deepEqual(historical.value.lines.map((line) => line.text), ['before']);
  assert.equal(historical.value.textBasis.basisHeadId, historicalBasis.basisHeadId);
  assert.equal(historical.value.projection.basis.headId, historicalBasis.basisHeadId);
  assert.equal(current.value.projection.basis.headId, applied.textBasis.basisHeadId);
  assert.deepEqual(historical.value.textBasis.byteRange, historicalBasis.byteRange);
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
  assert.equal(replaced.nextSession.state.roots, undefined);

  const noOp = replace(modules, authority, hash, replaced.nextSession, 0, 5, 'gamma');
  assert.equal(noOp.result, undefined);
  assert.equal(
    noOp.nextSession.worldline.canonicalHeadId,
    replaced.nextSession.worldline.canonicalHeadId,
  );
  assert.equal(noOp.nextSession.tickMetadata.length, replaced.nextSession.tickMetadata.length);
});

test('materialization ignores a forged compatibility projection and reads the graph head', async () => {
  const modules = await loadModules();
  const authority = modules.authority.createGraphRopeHotTextAuthority({
    hash: modules.hash.createHashPort(),
  });
  const state = authority.createBuffer('/tmp/materialize-authority.txt', 'graph authority');
  const forgedProjection = {
    ...state,
    currentRoot: { ...state.currentRoot, text: 'forged projection' },
  };

  assert.equal(authority.materialize(forgedProjection), 'graph authority');
});

test('worldline snapshot head metadata is derived from graph materialization', async () => {
  const modules = await loadModules();
  const hash = modules.hash.createHashPort();
  const authority = modules.authority.createGraphRopeHotTextAuthority({ hash });
  const created = modules.contract.createBufferWorldline(authority, {
    bufferKey: 'snapshot-authority.txt',
    initialText: 'graph snapshot',
    projectionPath: '/tmp/snapshot-authority.txt',
    createInitialCheckpoint: false,
  }, hash);
  const session = new modules.contract.JeditWorldlineSession(
    created.nextSession.worldline,
    {
      ...created.nextSession.state,
      currentRoot: { ...created.nextSession.state.currentRoot, text: 'forged projection' },
    },
    created.nextSession.tickMetadata,
    created.nextSession.checkpointMetadata,
  );

  const snapshot = modules.contract.readWorldlineSnapshot(authority, session, {
    worldlineId: session.worldline.worldlineId,
  }, hash);

  assert.equal(snapshot.text, 'graph snapshot');
  assert.equal(snapshot.head.utf16Length, snapshot.text.length);
  assert.equal(snapshot.head.equivalenceDigest, hash.sha256Hex(snapshot.text));
});

test('manual save declares the current head without implicitly requesting an Echo anchor', async () => {
  const modules = await loadModules();
  const requests = [];
  const authority = modules.authority.createGraphRopeHotTextAuthority({
    hash: modules.hash.createHashPort(),
    causalAnchorAdmission: createTestEchoCausalAnchorAdmissionPort({ requests }),
  });
  const state = authority.createBuffer('/tmp/save.txt', 'causal save');
  const basis = state.authorityBasis;
  const before = assertOk(authority.debugRopeShape(basis.headId));

  const saved = authority.saveCheckpoint(state, {
    kind: modules.textBufferPort.TEXT_BUFFER_CHECKPOINT_KIND_MANUAL_SAVE,
  });
  const after = assertOk(authority.debugRopeShape(basis.headId));

  assert.deepEqual(saved.checkpointDeclaration, {
    kind: modules.graphContract.ROPE_CHECKPOINT_FACT_KIND,
    schemaVersion: modules.graphContract.GRAPH_ROPE_SCHEMA_VERSION,
    checkpointId: saved.receipt.authorityCheckpointId,
    worldlineId: basis.worldlineId,
    headId: basis.headId,
    reason: modules.graphContract.ROPE_CHECKPOINT_REASON_MANUAL_SAVE,
  });
  assert.equal(saved.anchorAssociation, undefined);
  assert.deepEqual(requests, []);
  assert.deepEqual(after, before);
  assert.equal(saved.nextState.authorityBasis, state.authorityBasis);
  assert.equal(authority.materialize(saved.nextState), 'causal save');
});

test('manual save declaration does not require Echo causal-anchor admission', async () => {
  const modules = await loadModules();
  const authority = modules.authority.createGraphRopeHotTextAuthority({
    hash: modules.hash.createHashPort(),
  });
  const state = authority.createBuffer('/tmp/save-no-echo.txt', 'causal save');

  const saved = authority.saveCheckpoint(state, {
    kind: modules.textBufferPort.TEXT_BUFFER_CHECKPOINT_KIND_MANUAL_SAVE,
  });

  assert.equal(saved.checkpointDeclaration.reason, modules.graphContract.ROPE_CHECKPOINT_REASON_MANUAL_SAVE);
  assert.equal(saved.anchorAssociation, undefined);
});

test('invalid Jim checkpoint semantics fail before requesting Echo admission', async () => {
  const modules = await loadModules();
  const requests = [];
  const authority = modules.authority.createGraphRopeHotTextAuthority({
    hash: modules.hash.createHashPort(),
    causalAnchorAdmission: createTestEchoCausalAnchorAdmissionPort({ requests }),
  });
  const state = authority.createBuffer('/tmp/invalid-checkpoint.txt', 'invalid');

  assert.throws(
    () => authority.saveCheckpoint(state, { kind: 'UNKNOWN_CHECKPOINT_KIND' }),
    (error) => error.operation === 'saveCheckpoint'
      && error.obstructionCode === 'invalid-fact',
  );
  assert.deepEqual(requests, []);
});

test('initial checkpoint declaration does not require causal-anchor admission', async () => {
  const modules = await loadModules();
  const authority = modules.authority.createGraphRopeHotTextAuthority({
    hash: modules.hash.createHashPort(),
  });
  const state = authority.createBuffer('/tmp/import.txt', 'imported');

  const saved = authority.saveCheckpoint(state, { kind: 'INITIAL' });

  assert.equal(saved.checkpointDeclaration.reason, modules.graphContract.ROPE_CHECKPOINT_REASON_IMPORT);
  assert.equal(saved.anchorAssociation, undefined);
  assert.equal(saved.receipt.authorityCheckpointId, saved.checkpointDeclaration.checkpointId);
});

test('installed transport declares saved heads without manufacturing Echo anchors', async () => {
  const modules = await loadModules();
  const requests = [];
  const client = modules.client.createEchoTransportJeditOpticClient(
    modules.transport.createInstalledJeditContractEchoTransport({
      causalAnchorAdmission: createTestEchoCausalAnchorAdmissionPort({ requests }),
    }),
  );
  const opened = await client.openTextBuffer({
    bufferKey: 'installed-save.txt',
    initialText: 'installed causal save',
    projectionPath: '/tmp/installed-save.txt',
    createInitialCheckpoint: false,
  });
  const basis = opened.nextSession.state.authorityBasis;
  assert.ok(basis);

  const saved = await client.createCheckpoint(opened.nextSession, {
    worldlineId: basis.worldlineId,
    kind: modules.textBufferPort.TEXT_BUFFER_CHECKPOINT_KIND_MANUAL_SAVE,
    label: 'installed save',
  });
  const [authorityCheckpoint, ...unexpectedAuthorityCheckpoints] = saved.nextSession.state.checkpoints;
  const [checkpointMetadata, ...unexpectedCheckpointMetadata] = saved.nextSession.checkpointMetadata;

  assert.deepEqual(requests, []);
  assert.ok(authorityCheckpoint);
  assert.deepEqual(unexpectedAuthorityCheckpoints, []);
  assert.equal(saved.result.checkpoint.checkpointId, authorityCheckpoint.authorityCheckpointId);
  assert.equal(saved.result.checkpoint.headId, basis.headId);
  assert.equal(saved.nextSession.state.roots, undefined);
  assert.ok(checkpointMetadata);
  assert.deepEqual(unexpectedCheckpointMetadata, []);
  assert.equal(checkpointMetadata.authorityCheckpointId, saved.result.checkpoint.checkpointId);
  assert.equal(checkpointMetadata.authorityHeadId, basis.headId);

  const repeated = await client.createCheckpoint(saved.nextSession, {
    worldlineId: basis.worldlineId,
    kind: modules.textBufferPort.TEXT_BUFFER_CHECKPOINT_KIND_MANUAL_SAVE,
    label: 'installed save',
  });
  assert.equal(repeated.result, undefined);
  assert.deepEqual(requests, []);
});

test('installed transport checkpoint declarations remain available without Echo admission', async () => {
  const modules = await loadModules();
  const client = modules.client.createEchoTransportJeditOpticClient(
    modules.transport.createInstalledJeditContractEchoTransport(),
  );
  const opened = await client.openTextBuffer({
    bufferKey: 'installed-save-no-echo.txt',
    initialText: 'fail closed',
    projectionPath: '/tmp/installed-save-no-echo.txt',
    createInitialCheckpoint: false,
  });

  const saved = await client.createCheckpoint(opened.nextSession, {
    worldlineId: opened.nextSession.worldline.worldlineId,
    kind: modules.textBufferPort.TEXT_BUFFER_CHECKPOINT_KIND_MANUAL_SAVE,
    label: 'declaration only',
  });
  const [authorityCheckpoint, ...unexpectedAuthorityCheckpoints] = saved.nextSession.state.checkpoints;

  assert.equal(saved.result.checkpoint.kind, modules.textBufferPort.TEXT_BUFFER_CHECKPOINT_KIND_MANUAL_SAVE);
  assert.ok(authorityCheckpoint);
  assert.deepEqual(unexpectedAuthorityCheckpoints, []);
});

test('checkpoint rejects a stale exported head before requesting Echo admission', async () => {
  const modules = await loadModules();
  const requests = [];
  const client = modules.client.createEchoTransportJeditOpticClient(
    modules.transport.createInstalledJeditContractEchoTransport({
      causalAnchorAdmission: createTestEchoCausalAnchorAdmissionPort({ requests }),
    }),
  );
  const textSession = modules.textSession.createTextBufferSession(client);
  const optic = await textSession.createBuffer({
    bufferKey: 'stale-export.txt',
    initialText: 'before',
    projectionPath: '/tmp/stale-export.txt',
  });
  const before = await optic.textWindow({
    ...optic.openedTextBasis,
    aperture: {
      cursorLine: 0, viewportLineCount: 1, beforeLines: 0, afterLines: 0, maxBytes: 80,
    },
  });
  await optic.applyIntent({
    kind: 'replaceRange', startByte: 0, endByte: 6, insertText: 'after',
  });

  await assert.rejects(
    optic.createCheckpoint({
      kind: modules.textBufferPort.TEXT_BUFFER_CHECKPOINT_KIND_MANUAL_SAVE,
      basisHeadId: before.value.projection.basisHeadId,
      label: 'stale export basis',
    }),
    (error) => error.name === 'TextBufferCheckpointBasisError'
      && error.message.includes('basis mismatch'),
  );
  assert.deepEqual(requests, []);
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
  const [authority, contract, graphContract, hash, client, transport, textSession, textBufferPort] = await Promise.all([
    import(pathToFileURL(AUTHORITY_MODULE_PATH).href),
    import(pathToFileURL(CONTRACT_MODULE_PATH).href),
    import(pathToFileURL(GRAPH_ROPE_CONTRACT_MODULE_PATH).href),
    import(pathToFileURL(HASH_MODULE_PATH).href),
    import(pathToFileURL(CLIENT_MODULE_PATH).href),
    import(pathToFileURL(TRANSPORT_MODULE_PATH).href),
    import(pathToFileURL(TEXT_BUFFER_SESSION_MODULE_PATH).href),
    import(pathToFileURL(TEXT_BUFFER_SESSION_PORT_MODULE_PATH).href),
  ]);
  return { authority, contract, graphContract, hash, client, transport, textSession, textBufferPort };
}
