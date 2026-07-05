import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './dist-helpers.mjs';

const UTF8_ENCODER = new TextEncoder();
const FACT_VALIDATION_ERROR_HASH_MISMATCH = 'hash-mismatch';
const FACT_VALIDATION_ERROR_INVALID_REFERENCE = 'invalid-reference';

async function loadContract() {
  return importDist('domain', 'graph-rope-contract.js');
}

function createHashPort() {
  return {
    sha256Hex(value) {
      return `hash(${value})`;
    },
  };
}

function createBlobStore(entries = new Map()) {
  return {
    readBlobBytes(storage) {
      return entries.get(storage.contentRef) ?? null;
    },
  };
}

function createValidationContext(contract, writeSet = [], entries = new Map()) {
  return {
    writeSet,
    admittedBasis: {
      getFact(id) {
        return writeSet.find((fact) => contract.ropeFactId(fact) === id) ?? null;
      },
    },
    blobStore: createBlobStore(entries),
    hash: createHashPort(),
  };
}

function assertOk(result) {
  assert.equal(result.ok, true);
  return result.value ?? result.fact;
}

test('graph rope coordinates keep UTF-8 storage offsets separate from UI projections', async () => {
  const contract = await loadContract();

  const start = assertOk(contract.makeByteOffset(1));
  const end = assertOk(contract.makeByteOffset(4));
  const range = assertOk(contract.makeTextByteRange(start, end));
  const line = assertOk(contract.makeZeroBasedLineIndex(2));
  const column = assertOk(contract.makeUtf16Offset(3));
  const lineColumn = contract.makeLineColumn(line, column);

  assert.deepEqual(range, { startByte: start, endByte: end });
  assert.deepEqual(lineColumn, { line, columnUtf16: column });
  assert.equal(contract.makeByteOffset(-1).ok, false);
  assert.equal(contract.makeTextByteRange(end, start).ok, false);
});

test('text blob facts derive identity, length, storage, and hash from UTF-8 bytes', async () => {
  const contract = await loadContract();
  const bytes = UTF8_ENCODER.encode('a\n');

  const result = contract.makeTextBlobFact({ bytes, hash: createHashPort() });
  const fact = assertOk(result);

  assert.equal(fact.kind, contract.TEXT_BLOB_FACT_KIND);
  assert.equal(fact.schemaVersion, contract.GRAPH_ROPE_SCHEMA_VERSION);
  assert.equal(fact.blobId, 'text-blob:hash(utf8:610a)');
  assert.equal(fact.encoding, contract.TEXT_BLOB_ENCODING_UTF8);
  assert.equal(fact.byteLength, bytes.length);
  assert.equal(fact.contentHash, 'hash(utf8:610a)');
  assert.equal(fact.storage.kind, contract.INLINE_UTF8_BYTES_STORAGE_KIND);
  assert.deepEqual([...fact.storage.bytes], [...bytes]);
});

test('text blob validation rejects caller-forged content hashes', async () => {
  const contract = await loadContract();
  const result = contract.makeTextBlobFact({
    bytes: UTF8_ENCODER.encode('authoritative'),
    hash: createHashPort(),
  });
  const fact = assertOk(result);
  const forged = { ...fact, contentHash: 'hash(forged)' };

  const validation = contract.validateRopeFact(
    forged,
    createValidationContext(contract, [forged]),
  );

  assert.deepEqual(validation, {
    ok: false,
    code: FACT_VALIDATION_ERROR_HASH_MISMATCH,
  });
});

test('stored text blob validation fetches bytes from the declared blob store', async () => {
  const contract = await loadContract();
  const stored = assertOk(contract.makeStoredTextBlobFact({
    bytes: UTF8_ENCODER.encode('alpha'),
    contentRef: 'blob/alpha',
    hash: createHashPort(),
  }));
  const wrongStore = new Map([['blob/alpha', UTF8_ENCODER.encode('bravo')]]);

  const validation = contract.validateRopeFact(
    stored,
    createValidationContext(contract, [stored], wrongStore),
  );

  assert.deepEqual(validation, {
    ok: false,
    code: FACT_VALIDATION_ERROR_HASH_MISMATCH,
  });
});

test('rope leaf validation requires a typed text blob reference in the admission scope', async () => {
  const contract = await loadContract();
  const blob = assertOk(contract.makeTextBlobFact({
    bytes: UTF8_ENCODER.encode('leaf text'),
    hash: createHashPort(),
  }));
  const leaf = {
    kind: contract.ROPE_LEAF_FACT_KIND,
    schemaVersion: contract.GRAPH_ROPE_SCHEMA_VERSION,
    nodeId: 'rope-node:leaf-1',
    blobId: blob.blobId,
    byteStart: assertOk(contract.makeByteOffset(0)),
    byteLength: blob.byteLength,
    lineCount: 1,
    contentHash: 'leaf-hash',
  };

  assert.equal(contract.validateRopeFact(
    leaf,
    createValidationContext(contract, [blob, leaf]),
  ).ok, true);

  assert.deepEqual(contract.validateRopeFact(
    { ...leaf, blobId: 'text-blob:missing' },
    createValidationContext(contract, [leaf]),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  });
});

test('rope checkpoint validation references a causal anchor instead of a tick receipt', async () => {
  const contract = await loadContract();
  const facts = checkpointFixture(contract);

  assert.equal(contract.validateRopeFact(
    facts.checkpoint,
    createValidationContext(contract, facts.writeSet),
  ).ok, true);
  assert.equal('createdByTickId' in facts.checkpoint, false);

  assert.deepEqual(contract.validateRopeFact(
    { ...facts.checkpoint, causalAnchorId: 'tick:initial' },
    createValidationContext(contract, facts.writeSet),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  });
});

test('rope checkpoints require a matching authority root on their causal anchor', async () => {
  const contract = await loadContract();
  const facts = checkpointFixture(contract);
  const weakAnchor = {
    ...facts.anchor,
    anchorId: 'causal-anchor:weak',
    retainedRoots: [{
      ...facts.anchor.retainedRoots[0],
      id: 'rope-head:other',
    }],
  };
  const weakCheckpoint = {
    ...facts.checkpoint,
    checkpointId: 'rope-checkpoint:weak',
    causalAnchorId: weakAnchor.anchorId,
  };

  assert.equal(contract.validateRopeFact(
    weakAnchor,
    createValidationContext(contract, [...facts.baseFacts, weakAnchor]),
  ).ok, true);
  assert.deepEqual(contract.validateRopeFact(
    weakCheckpoint,
    createValidationContext(contract, [...facts.baseFacts, weakAnchor, weakCheckpoint]),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  });
});

test('causal anchor validation rejects authority roots as materializations', async () => {
  const contract = await loadContract();
  const facts = checkpointFixture(contract);
  const projectionAuthorityAnchor = {
    ...facts.anchor,
    anchorId: 'causal-anchor:projection-authority',
    materializationRoots: [facts.anchor.retainedRoots[0]],
  };

  assert.deepEqual(contract.validateRopeFact(
    projectionAuthorityAnchor,
    createValidationContext(contract, [...facts.baseFacts, projectionAuthorityAnchor]),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  });
});

function checkpointFixture(contract) {
  const blob = assertOk(contract.makeTextBlobFact({
    bytes: UTF8_ENCODER.encode('checkpoint text'),
    hash: createHashPort(),
  }));
  const leaf = {
    kind: contract.ROPE_LEAF_FACT_KIND,
    schemaVersion: contract.GRAPH_ROPE_SCHEMA_VERSION,
    nodeId: 'rope-node:checkpoint-leaf',
    blobId: blob.blobId,
    byteStart: assertOk(contract.makeByteOffset(0)),
    byteLength: blob.byteLength,
    lineCount: 1,
    contentHash: 'leaf-hash',
  };
  const head = {
    kind: contract.ROPE_HEAD_FACT_KIND,
    schemaVersion: contract.GRAPH_ROPE_SCHEMA_VERSION,
    headId: 'rope-head:checkpoint',
    worldlineId: 'worldline:checkpoint',
    rootNodeId: leaf.nodeId,
    createdByTickId: 'tick:initial',
    byteLength: blob.byteLength,
    lineCount: 1,
    contentHash: 'head-hash',
  };
  const worldline = {
    kind: contract.BUFFER_WORLDLINE_FACT_KIND,
    schemaVersion: contract.GRAPH_ROPE_SCHEMA_VERSION,
    worldlineId: head.worldlineId,
    createdAtTick: 'tick:initial',
    initialHeadId: head.headId,
  };
  const anchor = {
    kind: contract.ECHO_CAUSAL_ANCHOR_FACT_KIND,
    schemaVersion: contract.GRAPH_ROPE_SCHEMA_VERSION,
    anchorId: 'causal-anchor:checkpoint',
    subject: {
      appId: contract.JEDIT_CAUSAL_ANCHOR_APP_ID,
      subjectKind: contract.JEDIT_CAUSAL_ANCHOR_SUBJECT_KIND_BUFFER_WORLDLINE,
      subjectId: worldline.worldlineId,
    },
    basisFrontierDigest: 'frontier:checkpoint',
    retainedRoots: [{
      kind: contract.ECHO_CAUSAL_ANCHOR_ROOT_KIND_APP_SUBJECT,
      appId: contract.JEDIT_CAUSAL_ANCHOR_APP_ID,
      subjectKind: contract.JEDIT_CAUSAL_ANCHOR_SUBJECT_KIND_ROPE_HEAD,
      id: head.headId,
      role: contract.ECHO_CAUSAL_ANCHOR_ROOT_ROLE_AUTHORITY,
    }],
    materializationRoots: [],
    purpose: 'user-save',
    admittedByReceiptId: 'receipt:checkpoint-anchor',
    anchorDigest: 'anchor-digest',
  };
  const checkpoint = {
    kind: contract.ROPE_CHECKPOINT_FACT_KIND,
    schemaVersion: contract.GRAPH_ROPE_SCHEMA_VERSION,
    checkpointId: 'rope-checkpoint:checkpoint',
    worldlineId: worldline.worldlineId,
    headId: head.headId,
    causalAnchorId: anchor.anchorId,
    reason: 'manual-save',
  };
  const baseFacts = [blob, leaf, head, worldline];
  return {
    blob,
    leaf,
    head,
    worldline,
    anchor,
    checkpoint,
    baseFacts,
    writeSet: [...baseFacts, anchor, checkpoint],
  };
}
