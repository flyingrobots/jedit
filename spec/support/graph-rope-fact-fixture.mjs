import { importDist } from '../dist-helpers.mjs';

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();
const LEAF_TARGET_BYTES = 2_048;

export async function createGraphRopeFactFixture(worldlineId, text, hash) {
  const contract = await importDist('domain', 'graph-rope-contract.js');
  const tree = createTreeFixture(contract, text, hash);
  const contentHash = hash.sha256Hex(
    `head:${worldlineId}:${tree.root.nodeId}:${tree.root.byteLength}`,
  );
  const headId = `rope-head:${contentHash}`;
  const createdByEchoReceiptId = `test-only-echo-receipt:import:${worldlineId}`;
  const head = {
    kind: contract.ROPE_HEAD_FACT_KIND,
    schemaVersion: contract.GRAPH_ROPE_SCHEMA_VERSION,
    headId,
    worldlineId,
    rootNodeId: tree.root.nodeId,
    createdByEchoReceiptId,
    byteLength: tree.root.byteLength,
    lineCount: tree.root.lineCount,
    contentHash,
  };
  const worldline = {
    kind: contract.BUFFER_WORLDLINE_FACT_KIND,
    schemaVersion: contract.GRAPH_ROPE_SCHEMA_VERSION,
    worldlineId,
    createdByEchoReceiptId,
    initialHeadId: headId,
  };
  return {
    contract,
    blob: tree.blob,
    nodes: tree.nodes,
    leaf: tree.leaves[0],
    head,
    worldline,
    writeSet: [tree.blob, ...tree.nodes, head, worldline],
  };
}

export async function createGraphEditFactFixture(worldlineId, text, range, replacementText, hash) {
  const basis = await createGraphRopeFactFixture(worldlineId, text, hash);
  const startByte = range.startByte.value;
  const endByte = range.endByte.value;
  const basisBytes = UTF8_ENCODER.encode(text);
  const replacementBytes = UTF8_ENCODER.encode(replacementText);
  const nextBytes = concatBytes(
    basisBytes.subarray(0, startByte),
    replacementBytes,
    basisBytes.subarray(endByte),
  );
  const nextTree = createTreeFixture(basis.contract, UTF8_DECODER.decode(nextBytes), hash);
  const replacementBlob = assertFact(basis.contract.makeTextBlobFact({
    bytes: replacementBytes,
    hash,
  }));
  const nextHeadContentHash = hash.sha256Hex(
    `head:${basis.head.headId}:${nextTree.root.nodeId}:${nextTree.root.byteLength}`,
  );
  const nextHeadId = `rope-head:${nextHeadContentHash}`;
  const rewriteContentHash = hash.sha256Hex(
    `rewrite:${basis.head.headId}:${nextHeadId}:${startByte}:${endByte}`,
  );
  const rewriteId = `rope-rewrite:${rewriteContentHash}`;
  const diffId = `rope-diff:${rewriteContentHash}`;
  const echoReceiptId = `test-only-echo-receipt:replace:${worldlineId}:1`;
  const nextHead = {
    kind: basis.contract.ROPE_HEAD_FACT_KIND,
    schemaVersion: basis.contract.GRAPH_ROPE_SCHEMA_VERSION,
    headId: nextHeadId,
    worldlineId,
    rootNodeId: nextTree.root.nodeId,
    basisHeadId: basis.head.headId,
    createdByEchoReceiptId: echoReceiptId,
    byteLength: nextTree.root.byteLength,
    lineCount: nextTree.root.lineCount,
    contentHash: nextHeadContentHash,
  };
  const spans = createDiffSpans(
    basis.contract,
    basis.head.byteLength,
    range,
    replacementBlob,
    hash,
  );
  const diffIdentity = await importDist('domain', 'graph-rope-diff-identity.js');
  const diff = {
    kind: basis.contract.ROPE_DIFF_FACT_KIND,
    schemaVersion: basis.contract.GRAPH_ROPE_SCHEMA_VERSION,
    diffId,
    rewriteId,
    basisHeadId: basis.head.headId,
    nextHeadId,
    spans,
    contentHash: diffIdentity.ropeDiffContentHash({
      rewriteId,
      basisHeadId: basis.head.headId,
      nextHeadId,
      spans,
    }, hash),
  };
  const rewrite = {
    kind: basis.contract.ROPE_REWRITE_FACT_KIND,
    schemaVersion: basis.contract.GRAPH_ROPE_SCHEMA_VERSION,
    rewriteId,
    worldlineId,
    basisHeadId: basis.head.headId,
    nextHeadId,
    admittedByEchoReceiptId: echoReceiptId,
    range,
    replacementBlobId: replacementBlob.blobId,
    diffId,
    contentHash: rewriteContentHash,
  };
  const replaced = {
    basisHead: basis.head,
    nextHead,
    replacementBlob,
    rewrite,
    diff,
    echoReceiptId,
  };
  return {
    ...basis,
    replaced,
    writeSet: [
      ...basis.writeSet,
      replacementBlob,
      nextTree.blob,
      ...nextTree.nodes,
      nextHead,
      diff,
      rewrite,
    ],
  };
}

export async function createCheckpointFactFixture(worldlineId, hash) {
  const facts = await createGraphRopeFactFixture(worldlineId, 'checkpoint text', hash);
  const identity = await importDist('domain', 'graph-rope-checkpoint-identity.js');
  const reason = facts.contract.ROPE_CHECKPOINT_REASON_MANUAL_SAVE;
  const checkpoint = {
    kind: facts.contract.ROPE_CHECKPOINT_FACT_KIND,
    schemaVersion: facts.contract.GRAPH_ROPE_SCHEMA_VERSION,
    checkpointId: identity.ropeCheckpointIdFor({
      worldlineId,
      headId: facts.head.headId,
      reason,
      hash,
    }),
    worldlineId,
    headId: facts.head.headId,
    reason,
  };
  return {
    ...facts,
    checkpoint,
    baseFacts: facts.writeSet,
    writeSet: [...facts.writeSet, checkpoint],
  };
}

export async function createCheckpointAnchorFactFixture(worldlineId, hash) {
  const facts = await createCheckpointFactFixture(worldlineId, hash);
  const identity = await importDist('domain', 'graph-rope-checkpoint-identity.js');
  const causalAnchorId = 'test-only-anchor:1';
  const causalAnchorFactId = 'test-only-anchor-fact:1';
  const causalAnchorReceiptId = 'test-only-anchor-receipt:1';
  const association = {
    kind: facts.contract.ROPE_CHECKPOINT_ANCHORED_FACT_KIND,
    schemaVersion: facts.contract.GRAPH_ROPE_SCHEMA_VERSION,
    associationId: identity.ropeCheckpointAnchorAssociationIdFor({
      checkpointId: facts.checkpoint.checkpointId,
      causalAnchorId,
      causalAnchorFactId,
      causalAnchorReceiptId,
      hash,
    }),
    checkpointId: facts.checkpoint.checkpointId,
    causalAnchorId,
    causalAnchorFactId,
    causalAnchorReceiptId,
  };
  return {
    ...facts,
    association,
    writeSet: [...facts.writeSet, association],
  };
}

function createTreeFixture(contract, text, hash) {
  const bytes = UTF8_ENCODER.encode(text);
  const blob = assertFact(contract.makeTextBlobFact({ bytes, hash }));
  const leaves = [];
  for (let start = 0; start < Math.max(bytes.length, 1); start += LEAF_TARGET_BYTES) {
    const byteLength = Math.min(LEAF_TARGET_BYTES, bytes.length - start);
    const contentHash = hash.sha256Hex(`leaf:${blob.contentHash}:${start}:${byteLength}`);
    leaves.push({
      kind: contract.ROPE_LEAF_FACT_KIND,
      schemaVersion: contract.GRAPH_ROPE_SCHEMA_VERSION,
      nodeId: `rope-node:${contentHash}`,
      blobId: blob.blobId,
      byteStart: { kind: contract.BYTE_OFFSET_COORDINATE_KIND, value: start },
      byteLength,
      lineCount: lineCount(bytes.subarray(start, start + byteLength)),
      contentHash,
    });
  }
  const nodes = [...leaves];
  let level = leaves;
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1];
      if (right === undefined) {
        next.push(left);
        continue;
      }
      const branch = createBranchFixture(contract, left, right, hash);
      nodes.push(branch);
      next.push(branch);
    }
    level = next;
  }
  return { blob, leaves, nodes, root: level[0] };
}

function createBranchFixture(contract, left, right, hash) {
  const byteLength = left.byteLength + right.byteLength;
  const lineCountValue = left.lineCount + right.lineCount - 1;
  const height = Math.max(nodeHeight(left), nodeHeight(right)) + 1;
  const contentHash = hash.sha256Hex(
    `branch:${left.nodeId}:${right.nodeId}:${byteLength}:${lineCountValue}:${height}`,
  );
  return {
    kind: contract.ROPE_BRANCH_FACT_KIND,
    schemaVersion: contract.GRAPH_ROPE_SCHEMA_VERSION,
    nodeId: `rope-node:${contentHash}`,
    left: left.nodeId,
    right: right.nodeId,
    byteLength,
    lineCount: lineCountValue,
    height,
    contentHash,
  };
}

function createDiffSpans(contract, basisLength, range, replacementBlob, hash) {
  const start = range.startByte.value;
  const end = range.endByte.value;
  const replacementLength = replacementBlob.byteLength;
  return [
    ...equalSpan(contract, 0, start, 0, start, hash),
    ...deleteSpan(contract, start, end, hash),
    ...insertSpan(contract, start, replacementBlob, hash),
    ...equalSpan(
      contract,
      end,
      basisLength,
      start + replacementLength,
      basisLength - (end - start) + replacementLength,
      hash,
    ),
  ];
}

function equalSpan(contract, basisStart, basisEnd, nextStart, nextEnd, hash) {
  return basisStart === basisEnd ? [] : [{
    kind: contract.ROPE_DIFF_SPAN_EQUAL_KIND,
    basisRange: byteRange(contract, basisStart, basisEnd),
    nextRange: byteRange(contract, nextStart, nextEnd),
    contentHash: hash.sha256Hex(`span:equal:${basisStart}:${basisEnd}`),
  }];
}

function deleteSpan(contract, start, end, hash) {
  return start === end ? [] : [{
    kind: contract.ROPE_DIFF_SPAN_DELETE_KIND,
    basisRange: byteRange(contract, start, end),
    contentHash: hash.sha256Hex(`span:delete:${start}:${end}`),
  }];
}

function insertSpan(contract, start, blob, hash) {
  return blob.byteLength === 0 ? [] : [{
    kind: contract.ROPE_DIFF_SPAN_INSERT_KIND,
    nextRange: byteRange(contract, start, start + blob.byteLength),
    blobId: blob.blobId,
    contentHash: hash.sha256Hex(`span:insert:${start}:${start + blob.byteLength}`),
  }];
}

function byteRange(contract, start, end) {
  return {
    startByte: { kind: contract.BYTE_OFFSET_COORDINATE_KIND, value: start },
    endByte: { kind: contract.BYTE_OFFSET_COORDINATE_KIND, value: end },
  };
}

function concatBytes(...chunks) {
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function lineCount(bytes) {
  let count = 1;
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 13 || (bytes[index] === 10 && bytes[index - 1] !== 13)) {
      count += 1;
    }
  }
  return count;
}

function nodeHeight(node) {
  return node.height ?? 0;
}

function assertFact(result) {
  if (!result.ok) {
    throw new Error(`test fixture fact creation failed: ${result.code}`);
  }
  return result.fact;
}
