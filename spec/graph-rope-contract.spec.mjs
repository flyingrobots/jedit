import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist } from './dist-helpers.mjs';
import { createTestEchoCausalAnchorAdmissionPort } from './support/test-echo-causal-anchor-admission.mjs';

const UTF8_ENCODER = new TextEncoder();
const FACT_VALIDATION_ERROR_HASH_MISMATCH = 'hash-mismatch';
const FACT_VALIDATION_ERROR_INVALID_ID = 'invalid-id';
const FACT_VALIDATION_ERROR_INVALID_KIND = 'invalid-kind';
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

test('graph rope coordinate adapters preserve Unicode boundaries and end of buffer', async () => {
  const contract = await loadContract();
  const text = 'A😀é';
  const afterEmojiUtf16 = assertOk(contract.makeUtf16Offset(3));
  const afterEmojiByte = assertOk(contract.makeByteOffset(5));
  const endUtf16 = assertOk(contract.makeUtf16Offset(4));
  const endByte = assertOk(contract.makeByteOffset(7));

  assert.deepEqual(
    assertOk(contract.byteOffsetFromUtf16Offset(text, afterEmojiUtf16)),
    afterEmojiByte,
  );
  assert.deepEqual(
    assertOk(contract.utf16OffsetFromByteOffset(text, afterEmojiByte)),
    afterEmojiUtf16,
  );
  assert.deepEqual(assertOk(contract.byteOffsetFromUtf16Offset(text, endUtf16)), endByte);
  assert.deepEqual(assertOk(contract.utf16OffsetFromByteOffset(text, endByte)), endUtf16);

  const splitSurrogate = assertOk(contract.makeUtf16Offset(2));
  const splitUtf8Sequence = assertOk(contract.makeByteOffset(2));
  assert.equal(contract.byteOffsetFromUtf16Offset(text, splitSurrogate).ok, false);
  assert.equal(contract.utf16OffsetFromByteOffset(text, splitUtf8Sequence).ok, false);

  const bomText = '\uFEFFx';
  assert.deepEqual(
    assertOk(contract.utf16OffsetFromByteOffset(
      bomText,
      assertOk(contract.makeByteOffset(3)),
    )),
    assertOk(contract.makeUtf16Offset(1)),
  );
});

test('graph rope line-column adapters treat CRLF as one break and preserve EOF', async () => {
  const contract = await loadContract();
  const text = 'ab\r\n😀\r\n';
  const lineOne = assertOk(contract.makeZeroBasedLineIndex(1));
  const lineTwo = assertOk(contract.makeZeroBasedLineIndex(2));
  const columnZero = assertOk(contract.makeUtf16Offset(0));
  const columnTwo = assertOk(contract.makeUtf16Offset(2));
  const afterFirstCrlf = assertOk(contract.makeByteOffset(4));
  const afterEmoji = assertOk(contract.makeByteOffset(8));
  const endByte = assertOk(contract.makeByteOffset(10));
  const emojiEnd = contract.makeLineColumn(lineOne, columnTwo);
  const eof = contract.makeLineColumn(lineTwo, columnZero);

  assert.deepEqual(
    assertOk(contract.byteOffsetFromLineColumn(text, emojiEnd)),
    afterEmoji,
  );
  assert.deepEqual(
    assertOk(contract.lineColumnFromByteOffset(text, afterFirstCrlf)),
    contract.makeLineColumn(lineOne, columnZero),
  );
  assert.deepEqual(assertOk(contract.byteOffsetFromLineColumn(text, eof)), endByte);
  assert.deepEqual(assertOk(contract.lineColumnFromByteOffset(text, endByte)), eof);

  const pastLineEnd = contract.makeLineColumn(
    assertOk(contract.makeZeroBasedLineIndex(0)),
    assertOk(contract.makeUtf16Offset(3)),
  );
  const insideCrlf = assertOk(contract.makeByteOffset(9));
  assert.equal(contract.byteOffsetFromLineColumn(text, pastLineEnd).ok, false);
  assert.equal(contract.lineColumnFromByteOffset(text, insideCrlf).ok, false);
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

test('rope checkpoint validation admits a Jim declaration without Echo evidence', async () => {
  const facts = await checkpointFixture('worldline:checkpoint');
  const { contract } = facts;

  assert.equal(contract.validateRopeFact(
    facts.checkpoint,
    createValidationContext(contract, facts.writeSet),
  ).ok, true);
  assert.equal('createdByTickId' in facts.checkpoint, false);
  assert.equal('causalAnchorId' in facts.checkpoint, false);
});

test('rope checkpoint validation recomputes Jim-owned declaration identity', async () => {
  const facts = await checkpointFixture('worldline:checkpoint-identity');
  const { contract } = facts;
  const forgedCheckpoint = {
    ...facts.checkpoint,
    checkpointId: 'rope-checkpoint:forged',
  };

  assert.deepEqual(contract.validateRopeFact(
    forgedCheckpoint,
    createValidationContext(contract, [...facts.baseFacts, forgedCheckpoint]),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_HASH_MISMATCH,
  });
});

test('checkpoint anchor associations retain opaque Echo identities as Jim facts', async () => {
  const facts = await checkpointAnchorFixture('worldline:checkpoint-anchor');
  const { contract } = facts;

  assert.equal(contract.validateRopeFact(
    facts.association,
    createValidationContext(contract, facts.writeSet),
  ).ok, true);
  assert.equal(facts.association.causalAnchorId, 'test-only-anchor:1');
  assert.equal(facts.association.causalAnchorFactId, 'test-only-anchor-fact:1');
  assert.equal(facts.association.causalAnchorReceiptId, 'test-only-anchor-receipt:1');
  assert.equal('authority' in facts.association, false);

  assert.deepEqual(contract.validateRopeFact(
    { ...facts.association, checkpointId: 'rope-checkpoint:missing' },
    createValidationContext(contract, facts.writeSet),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  });
  assert.deepEqual(contract.validateRopeFact(
    { ...facts.association, associationId: 'rope-checkpoint-anchor:forged' },
    createValidationContext(contract, facts.writeSet),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_HASH_MISMATCH,
  });
  assert.deepEqual(contract.validateRopeFact(
    { ...facts.association, causalAnchorFactId: '' },
    createValidationContext(contract, facts.writeSet),
  ), {
    ok: false,
    code: FACT_VALIDATION_ERROR_INVALID_ID,
  });
});

test('checkpoint identities do not collide when opaque fields contain separators', async () => {
  const identity = await importDist('domain', 'graph-rope-checkpoint-identity.js');
  const hash = createHashPort();

  const firstCheckpointId = identity.ropeCheckpointIdFor({
    worldlineId: 'worldline:a',
    headId: 'b',
    reason: 'manual-save',
    hash,
  });
  const secondCheckpointId = identity.ropeCheckpointIdFor({
    worldlineId: 'worldline',
    headId: 'a:b',
    reason: 'manual-save',
    hash,
  });
  const firstAssociationId = identity.ropeCheckpointAnchorAssociationIdFor({
    checkpointId: 'rope-checkpoint:a',
    causalAnchorId: 'b',
    causalAnchorFactId: 'c',
    causalAnchorReceiptId: 'd',
    hash,
  });
  const secondAssociationId = identity.ropeCheckpointAnchorAssociationIdFor({
    checkpointId: 'rope-checkpoint',
    causalAnchorId: 'a:b',
    causalAnchorFactId: 'c',
    causalAnchorReceiptId: 'd',
    hash,
  });

  assert.notEqual(secondCheckpointId, firstCheckpointId);
  assert.notEqual(secondAssociationId, firstAssociationId);
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
    checkpoint: checkpointed.checkpoint,
    baseFacts,
    writeSet: [...baseFacts, checkpointed.checkpoint],
  };
}

async function checkpointAnchorFixture(worldlineId) {
  const { contract, runtime } = await loadModules();
  const graph = runtime.createGraphRopeRuntime({
    hash: createHashPort(),
    causalAnchorAdmission: createTestEchoCausalAnchorAdmissionPort(),
  });
  const created = assertOk(graph.createBufferWorldline({ worldlineId, initialText: 'checkpoint text' }));
  const checkpointed = assertOk(graph.createCheckpoint({
    worldlineId,
    headId: created.head.headId,
    reason: 'manual-save',
  }));
  const anchored = assertOk(graph.anchorCheckpoint({
    checkpointId: checkpointed.checkpoint.checkpointId,
  }));
  const baseFacts = [created.blob, ...created.nodes, created.head, created.worldline];
  return {
    contract,
    association: anchored.association,
    checkpoint: checkpointed.checkpoint,
    writeSet: [...baseFacts, checkpointed.checkpoint, anchored.association],
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
