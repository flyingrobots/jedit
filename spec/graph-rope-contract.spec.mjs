import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './dist-helpers.mjs';

const UTF8_ENCODER = new TextEncoder();
const FACT_VALIDATION_ERROR_HASH_MISMATCH = 'hash-mismatch';
const FACT_VALIDATION_ERROR_INVALID_KIND = 'invalid-kind';
const FACT_VALIDATION_ERROR_INVALID_REFERENCE = 'invalid-reference';

async function loadContract() {
  return importDist('domain', 'graph-rope-contract.js');
}

async function loadModules() {
  const [contract, runtime, anchorDigest] = await Promise.all([
    importDist('domain', 'graph-rope-contract.js'),
    importDist('domain', 'graph-rope-runtime.js'),
    importDist('domain', 'graph-rope-causal-anchor-digest.js'),
  ]);
  return { anchorDigest, contract, runtime };
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

test('text blob validation rejects malformed stored blob variants', async () => {
  const contract = await loadContract();
  const stored = assertOk(contract.makeStoredTextBlobFact({
    bytes: UTF8_ENCODER.encode('alpha'),
    contentRef: 'blob/alpha',
    hash: createHashPort(),
  }));
  const malformed = {
    ...stored,
    storage: { kind: 'bogus', contentRef: 'blob/alpha' },
  };

  const validation = contract.validateRopeFact(
    malformed,
    createValidationContext(contract, [malformed], new Map([['blob/alpha', UTF8_ENCODER.encode('alpha')]])),
  );

  assert.deepEqual(validation, {
    ok: false,
    code: FACT_VALIDATION_ERROR_INVALID_REFERENCE,
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

test('buffer worldline validation requires its initial head to belong to the worldline', async () => {
  const facts = await graphCreateFixture('worldline:initial-head', 'initial');
  const { contract } = facts;
  const forged = {
    ...facts.worldline,
    worldlineId: 'worldline:forged',
  };

  assert.deepEqual(contract.validateRopeFact(
    forged,
    createValidationContext(contract, [...facts.writeSet, forged]),
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

test('rope checkpoint validation recomputes checkpoint identity and anchor frontier', async () => {
  const facts = await checkpointFixture('worldline:checkpoint-identity');
  const { anchorDigest, contract } = facts;
  const forgedCheckpoint = {
    ...facts.checkpoint,
    checkpointId: 'rope-checkpoint:forged',
  };
  const frontierForgedAnchor = rekeyAnchor({
    ...facts.anchor,
    basisFrontierDigest: 'frontier:forged',
  }, anchorDigest, createHashPort());
  const frontierForgedCheckpoint = {
    ...facts.checkpoint,
    causalAnchorId: frontierForgedAnchor.anchorId,
  };

  assert.deepEqual(contract.validateRopeFact(
    forgedCheckpoint,
    createValidationContext(contract, [...facts.baseFacts, facts.anchor, forgedCheckpoint]),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_HASH_MISMATCH,
  });
  assert.deepEqual(contract.validateRopeFact(
    frontierForgedCheckpoint,
    createValidationContext(contract, [...facts.baseFacts, frontierForgedAnchor, frontierForgedCheckpoint]),
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

test('graph rope validation rejects forged diff span and rewrite evidence', async () => {
  const facts = await graphEditFixture();
  const { contract, replaced } = facts;
  const insertSpan = replaced.diff.spans.find((span) => span.kind === contract.ROPE_DIFF_SPAN_INSERT_KIND);
  const emptyDiff = {
    ...replaced.diff,
    spans: [],
  };
  const unknownSpanDiff = {
    ...replaced.diff,
    spans: replaced.diff.spans.map((span) => span === insertSpan ? { ...span, kind: 'move' } : span),
  };
  const wrongBlobRewrite = {
    ...replaced.rewrite,
    replacementBlobId: facts.blob.blobId,
  };

  assert.notEqual(insertSpan, undefined);
  assert.deepEqual(contract.validateRopeFact(
    emptyDiff,
    createValidationContext(contract, [...facts.writeSet, emptyDiff]),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  });
  assert.deepEqual(contract.validateRopeFact(
    unknownSpanDiff,
    createValidationContext(contract, [...facts.writeSet, unknownSpanDiff]),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_INVALID_KIND,
  });
  assert.deepEqual(contract.validateRopeFact(
    wrongBlobRewrite,
    createValidationContext(contract, [...facts.writeSet, wrongBlobRewrite]),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  });
});

test('graph rope validation rejects rewrites outside their basis head', async () => {
  const facts = await graphEditFixture();
  const { contract, replaced } = facts;
  const forged = rekeyRewriteChain({
    basisHead: replaced.basisHead,
    diff: replaced.diff,
    receipt: replaced.receipt,
    rewrite: replaced.rewrite,
    range: textByteRange(contract, 99, 100),
    hash: createHashPort(),
  });

  assert.deepEqual(contract.validateRopeFact(
    forged.rewrite,
    createValidationContext(contract, [
      ...facts.writeSet,
      replaced.replacementBlob,
      replaced.nextHead,
      forged.diff,
      forged.rewrite,
      forged.receipt,
    ]),
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
  const { anchorDigest, contract, runtime } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({ hash: createHashPort() });
  const created = assertOk(graph.createBufferWorldline({ worldlineId, initialText }));
  const leaf = created.nodes.find((node) => node.kind === contract.ROPE_LEAF_FACT_KIND);

  assert.notEqual(leaf, undefined);
  return {
    anchorDigest,
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

function rekeyAnchor(anchor, anchorDigest, hash) {
  const anchorDigestValue = anchorDigest.causalAnchorDigestFor(anchor, hash);
  return {
    ...anchor,
    anchorDigest: anchorDigestValue,
    anchorId: anchorDigest.causalAnchorIdForDigest(anchorDigestValue, hash),
  };
}

function rekeyRewriteChain(input) {
  const contentHash = input.hash.sha256Hex([
    'rewrite',
    input.rewrite.basisHeadId,
    input.rewrite.nextHeadId,
    input.range.startByte.value,
    input.range.endByte.value,
  ].join(':'));
  const rewriteId = `rope-rewrite:${contentHash}`;
  const diffId = `rope-diff:${contentHash}`;
  const sequence = input.receipt.admittedAtSequence + 100;
  const receiptHash = input.hash.sha256Hex(`${'receipt'}:${input.receipt.basisHeadId}:${input.receipt.nextHeadId}:${sequence}`);
  const tickId = `tick:${input.hash.sha256Hex(`${input.receipt.worldlineId}:${receiptHash}`)}`;
  return {
    rewrite: {
      ...input.rewrite,
      rewriteId,
      diffId,
      range: input.range,
      admittedByTickId: tickId,
      contentHash,
    },
    diff: {
      ...input.diff,
      diffId,
      rewriteId,
      contentHash: input.hash.sha256Hex(`${'diff'}:${rewriteId}:${input.diff.basisHeadId}:${input.diff.nextHeadId}`),
    },
    receipt: {
      ...input.receipt,
      tickId,
      admissionId: `rope-admission:${receiptHash}`,
      rewriteId,
      admittedAtSequence: sequence,
      contentHash: receiptHash,
    },
  };
}

function textByteRange(contract, start, end) {
  return assertOk(contract.makeTextByteRange(
    assertOk(contract.makeByteOffset(start)),
    assertOk(contract.makeByteOffset(end)),
  ));
}
