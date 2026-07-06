import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './dist-helpers.mjs';

const UTF8_ENCODER = new TextEncoder();
const FACT_VALIDATION_ERROR_HASH_MISMATCH = 'hash-mismatch';
const FACT_VALIDATION_ERROR_INVALID_REFERENCE = 'invalid-reference';

async function loadContract() {
  return importDist('domain', 'graph-rope-contract.js');
}

async function loadModules() {
  const [contract, runtime] = await Promise.all([
    importDist('domain', 'graph-rope-contract.js'),
    importDist('domain', 'graph-rope-runtime.js'),
  ]);
  return { contract, runtime };
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
  const facts = await graphCreateFixture('worldline:leaf-validation', 'leaf text');
  const { contract, blob, leaf } = facts;

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
  const facts = await checkpointFixture('worldline:checkpoint');
  const { contract } = facts;

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
  const facts = await checkpointFixture('worldline:checkpoint');
  const otherFacts = await checkpointFixture('worldline:other-checkpoint');
  const { contract } = facts;
  const weakCheckpoint = {
    ...facts.checkpoint,
    checkpointId: 'rope-checkpoint:weak',
    causalAnchorId: otherFacts.anchor.anchorId,
  };

  assert.equal(contract.validateRopeFact(
    otherFacts.anchor,
    createValidationContext(contract, otherFacts.writeSet),
  ).ok, true);
  assert.deepEqual(contract.validateRopeFact(
    weakCheckpoint,
    createValidationContext(contract, [...facts.baseFacts, otherFacts.anchor, weakCheckpoint]),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  });
});

test('causal anchor validation rejects authority roots as materializations', async () => {
  const facts = await checkpointFixture('worldline:projection-anchor');
  const { contract } = facts;
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

test('causal anchor validation rejects forged digests ids and purposes', async () => {
  const facts = await checkpointFixture('worldline:forged-anchor');
  const { contract } = facts;

  assert.deepEqual(contract.validateRopeFact(
    { ...facts.anchor, anchorDigest: 'anchor-digest:forged' },
    createValidationContext(contract, facts.writeSet),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_HASH_MISMATCH,
  });
  assert.deepEqual(contract.validateRopeFact(
    { ...facts.anchor, anchorId: 'causal-anchor:forged' },
    createValidationContext(contract, facts.writeSet),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_HASH_MISMATCH,
  });
  assert.deepEqual(contract.validateRopeFact(
    { ...facts.anchor, purpose: 'pretend-save' },
    createValidationContext(contract, facts.writeSet),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  });
});

test('graph rope validation rejects forged branch and leaf metrics', async () => {
  const facts = await graphCreateFixture('worldline:metrics', 'a'.repeat(3000));
  const { contract } = facts;
  const branch = facts.nodes.find((node) => node.kind === contract.ROPE_BRANCH_FACT_KIND);

  assert.notEqual(branch, undefined);
  assert.deepEqual(contract.validateRopeFact(
    { ...branch, byteLength: branch.byteLength + 1 },
    createValidationContext(contract, facts.writeSet),
  ), {
    ok: false,
    code: 'invalid-metric',
  });
  assert.deepEqual(contract.validateRopeFact(
    { ...facts.leaf, contentHash: 'leaf-hash:forged' },
    createValidationContext(contract, facts.writeSet),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_HASH_MISMATCH,
  });
});

test('graph rope validation rejects inconsistent rewrite diff and receipt links', async () => {
  const facts = await graphEditFixture();
  const { contract, replaced } = facts;

  assert.deepEqual(contract.validateRopeFact(
    { ...replaced.rewrite, nextHeadId: replaced.basisHead.headId },
    createValidationContext(contract, facts.writeSet),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  });
  assert.deepEqual(contract.validateRopeFact(
    { ...replaced.diff, nextHeadId: replaced.basisHead.headId },
    createValidationContext(contract, facts.writeSet),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  });
  assert.deepEqual(contract.validateRopeFact(
    { ...replaced.receipt, nextHeadId: replaced.basisHead.headId },
    createValidationContext(contract, facts.writeSet),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  });
  assert.deepEqual(contract.validateRopeFact(
    { ...replaced.diff, contentHash: 'diff-hash:forged' },
    createValidationContext(contract, facts.writeSet),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_HASH_MISMATCH,
  });
});

async function graphCreateFixture(worldlineId, initialText) {
  const { contract, runtime } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({ worldlineId, initialText }));
  const leaf = created.nodes.find((node) => node.kind === contract.ROPE_LEAF_FACT_KIND);

  assert.notEqual(leaf, undefined);
  return {
    contract,
    runtime,
    graph,
    ...created,
    leaf,
    writeSet: [created.blob, ...created.nodes, created.head, created.worldline],
  };
}

async function graphEditFixture() {
  const facts = await graphCreateFixture('worldline:edit-consistency', 'alpha beta gamma');
  const range = assertOk(facts.contract.makeTextByteRange(
    assertOk(facts.contract.makeByteOffset(6)),
    assertOk(facts.contract.makeByteOffset(10)),
  ));
  const replaced = assertOk(facts.graph.replaceRangeAsTick({
    basisHeadId: facts.head.headId,
    range,
    replacementText: 'BETA',
  }));
  return {
    ...facts,
    replaced,
    writeSet: [
      ...facts.writeSet,
      replaced.replacementBlob,
      replaced.nextHead,
      replaced.diff,
      replaced.rewrite,
      replaced.receipt,
    ],
  };
}

async function checkpointFixture(worldlineId) {
  const facts = await graphCreateFixture(worldlineId, 'checkpoint text');
  const checkpointed = assertOk(facts.graph.createCheckpoint({
    worldlineId,
    headId: facts.head.headId,
    reason: 'manual-save',
  }));
  const baseFacts = facts.writeSet;
  return {
    ...facts,
    anchor: checkpointed.causalAnchor,
    checkpoint: checkpointed.checkpoint,
    baseFacts,
    writeSet: [...baseFacts, checkpointed.causalAnchor, checkpointed.checkpoint],
  };
}
