import {
  GRAPH_ROPE_SCHEMA_VERSION,
  ROPE_DIFF_FACT_KIND,
  ROPE_DIFF_SPAN_DELETE_KIND,
  ROPE_DIFF_SPAN_EQUAL_KIND,
  ROPE_DIFF_SPAN_INSERT_KIND,
  ROPE_HEAD_FACT_KIND,
  ROPE_REWRITE_FACT_KIND,
  TICK_RECEIPT_FACT_KIND,
  makeTextBlobFact,
  type RopeDiffFact,
  type RopeDiffSpan,
  type RopeHeadFact,
  type RopeRewriteFact,
  type TextBlobFact,
  type TextBlobHashPort,
  type TextByteRange,
  type TickReceiptFact,
} from './graph-rope-contract.js';
import {
  buildTreeFromPieces,
  byteRangeFits,
  bytesEqual,
  diffIdForRewrite,
  diffIdFromHash,
  existingLeafPiece,
  leafPiece,
  rangeHasUtf8Boundaries,
  rewriteContentHash,
  rewriteIdFromHash,
  sliceLeafPiece,
  spanHash,
  textByteRange,
  tickIdFor,
} from './graph-rope-runtime-tree-common.js';
import { orderedLeafSegments, windowBytesFromLeaves } from './graph-rope-runtime-tree-read.js';
import { ropeDiffContentHash } from './graph-rope-diff-identity.js';
import {
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_BYTE_RANGE,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_UTF8_BOUNDARY,
} from './graph-rope-runtime-issues.js';
import {
  RUNTIME_HASH_PREFIX_ADMISSION_ID,
  RUNTIME_HASH_PREFIX_HEAD,
  RUNTIME_HASH_PREFIX_HEAD_ID,
  RUNTIME_HASH_PREFIX_RECEIPT,
  ZERO_VALUE,
  type GraphRopeReplaceInput,
  type GraphRopeReplacePlan,
  type LeafSegment,
  type NodeRef,
  type RopeNodeFact,
  type TreeResult,
} from './graph-rope-runtime-tree-types.js';

const TEXT_ENCODER = new TextEncoder();

interface ReplacementContext {
  readonly range: TextByteRange;
  readonly replacementBlob: TextBlobFact;
  readonly replacementBytes: Uint8Array;
  readonly hash: TextBlobHashPort;
}

interface ReplacementAccumulator {
  readonly output: NodeRef[];
  inserted: boolean;
}

interface ChangedPlanParts {
  readonly basisHead: RopeHeadFact;
  readonly nextHead: RopeHeadFact;
  readonly replacementBlob: TextBlobFact;
  readonly rewrite: RopeRewriteFact;
  readonly diff: RopeDiffFact;
  readonly receipt: TickReceiptFact;
  readonly treeFacts: readonly RopeNodeFact[];
}

interface RewriteFactInput {
  readonly basisHead: RopeHeadFact;
  readonly nextHead: RopeHeadFact;
  readonly range: TextByteRange;
  readonly replacementBlob: TextBlobFact;
  readonly tickId: string;
  readonly contentHash: string;
}

interface DiffFactInput {
  readonly basisHead: RopeHeadFact;
  readonly nextHead: RopeHeadFact;
  readonly range: TextByteRange;
  readonly replacementBlob: TextBlobFact;
  readonly replacementBytes: Uint8Array;
  readonly rewriteId: string;
  readonly hash: TextBlobHashPort;
}

export function replaceRangeInTree(input: GraphRopeReplaceInput): TreeResult<GraphRopeReplacePlan> {
  const leaves = orderedLeafSegments(input.reader, input.basisHead);
  if (!leaves.ok) {
    return leaves;
  }
  if (!replaceRangeIsValid(leaves.value, input.range, input.basisHead.byteLength)) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_BYTE_RANGE };
  }
  if (!rangeHasUtf8Boundaries(leaves.value, input.range, input.basisHead.byteLength)) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_UTF8_BOUNDARY };
  }
  return replacementPlanFromLeaves(input, leaves.value);
}

function replacementPlanFromLeaves(input: GraphRopeReplaceInput, leaves: readonly LeafSegment[]): TreeResult<GraphRopeReplacePlan> {
  const replacementBytes = TEXT_ENCODER.encode(input.replacementText);
  if (bytesEqual(windowBytesFromLeaves(leaves, input.range).bytes, replacementBytes)) {
    return { ok: true, value: { changed: false, basisHead: input.basisHead, nextHead: input.basisHead } };
  }
  const blobResult = makeTextBlobFact({ bytes: replacementBytes, hash: input.hash });
  if (!blobResult.ok) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT };
  }
  return changedReplacementPlan(input, leaves, replacementBytes, blobResult.fact);
}

function changedReplacementPlan(
  input: GraphRopeReplaceInput,
  leaves: readonly LeafSegment[],
  replacementBytes: Uint8Array,
  replacementBlob: TextBlobFact,
): TreeResult<GraphRopeReplacePlan> {
  const tree = buildTreeFromPieces(replacementPieces(leaves, input.range, replacementBlob, replacementBytes, input.hash), input.hash);
  const nextHead = createReplacementHead(input.basisHead, tree.root, input.hash);
  const rewriteHash = rewriteContentHash(input.basisHead.headId, nextHead.headId, input.range, input.hash);
  const receipt = createReceipt(input.basisHead, nextHead, rewriteIdFromHash(rewriteHash), input.sequence, input.hash);
  const rewrite = createRewrite({
    basisHead: input.basisHead,
    nextHead,
    range: input.range,
    replacementBlob,
    tickId: receipt.tickId,
    contentHash: rewriteHash,
  });
  const diff = createDiff({
    basisHead: input.basisHead,
    nextHead,
    range: input.range,
    replacementBlob,
    replacementBytes,
    rewriteId: rewrite.rewriteId,
    hash: input.hash,
  });
  return { ok: true, value: changedPlan({ basisHead: input.basisHead, nextHead, replacementBlob, rewrite, diff, receipt, treeFacts: tree.facts }) };
}

function changedPlan(parts: ChangedPlanParts): GraphRopeReplacePlan {
  return {
    changed: true,
    basisHead: parts.basisHead,
    nextHead: parts.nextHead,
    replacementBlob: parts.replacementBlob,
    rewrite: parts.rewrite,
    diff: parts.diff,
    receipt: parts.receipt,
    facts: [parts.replacementBlob, ...parts.treeFacts, parts.nextHead, parts.diff, parts.rewrite, parts.receipt],
  };
}

function replacementPieces(
  leaves: readonly LeafSegment[],
  range: TextByteRange,
  replacementBlob: TextBlobFact,
  replacementBytes: Uint8Array,
  hash: TextBlobHashPort,
): readonly NodeRef[] {
  const accumulator = replacementAccumulator();
  const context = { range, replacementBlob, replacementBytes, hash };
  for (const leaf of leaves) {
    appendReplacementPieces(accumulator, leaf, context);
  }
  appendReplacementAtEnd(accumulator, context);
  return accumulator.output;
}

function appendReplacementPieces(
  accumulator: ReplacementAccumulator,
  leaf: LeafSegment,
  context: ReplacementContext,
): void {
  if (leaf.endByte <= context.range.startByte.value) {
    accumulator.output.push(existingLeafPiece(leaf));
    return;
  }
  if (leaf.startByte >= context.range.endByte.value) {
    appendReplacementAtEnd(accumulator, context);
    accumulator.output.push(existingLeafPiece(leaf));
    return;
  }
  appendOverlappedLeaf(accumulator, leaf, context);
}

function appendOverlappedLeaf(
  accumulator: ReplacementAccumulator,
  leaf: LeafSegment,
  context: ReplacementContext,
): void {
  appendLeafPrefix(accumulator.output, leaf, context.range.startByte.value, context.hash);
  appendReplacementAtEnd(accumulator, context);
  appendLeafSuffix(accumulator.output, leaf, context.range.endByte.value, context.hash);
}

function appendLeafPrefix(output: NodeRef[], leaf: LeafSegment, cutByte: number, hash: TextBlobHashPort): void {
  if (leaf.startByte < cutByte) {
    output.push(sliceLeafPiece(leaf, leaf.startByte, cutByte, hash));
  }
}

function appendLeafSuffix(output: NodeRef[], leaf: LeafSegment, cutByte: number, hash: TextBlobHashPort): void {
  if (cutByte < leaf.endByte) {
    output.push(sliceLeafPiece(leaf, cutByte, leaf.endByte, hash));
  }
}

function appendReplacementAtEnd(
  accumulator: ReplacementAccumulator,
  context: ReplacementContext,
): void {
  if (!accumulator.inserted && (context.replacementBlob.byteLength > ZERO_VALUE || accumulator.output.length === ZERO_VALUE)) {
    accumulator.output.push(leafPiece(context.replacementBlob, context.replacementBytes, ZERO_VALUE, context.replacementBlob.byteLength, context.hash));
  }
  accumulator.inserted = true;
}

function replacementAccumulator(): ReplacementAccumulator {
  return { output: [], inserted: false };
}

function createReplacementHead(basisHead: RopeHeadFact, root: NodeRef, hash: TextBlobHashPort): RopeHeadFact {
  const contentHash = hash.sha256Hex(`${RUNTIME_HASH_PREFIX_HEAD}${basisHead.headId}:${root.nodeId}:${root.byteLength}`);
  return {
    kind: ROPE_HEAD_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    headId: `${RUNTIME_HASH_PREFIX_HEAD_ID}${contentHash}`,
    worldlineId: basisHead.worldlineId,
    rootNodeId: root.nodeId,
    basisHeadId: basisHead.headId,
    createdByTickId: tickIdFor(basisHead.worldlineId, contentHash, hash),
    byteLength: root.byteLength,
    lineCount: root.lineCount,
    contentHash,
  };
}

function createRewrite(input: RewriteFactInput): RopeRewriteFact {
  return {
    kind: ROPE_REWRITE_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    rewriteId: rewriteIdFromHash(input.contentHash),
    worldlineId: input.basisHead.worldlineId,
    basisHeadId: input.basisHead.headId,
    nextHeadId: input.nextHead.headId,
    admittedByTickId: input.tickId,
    range: input.range,
    replacementBlobId: input.replacementBlob.blobId,
    diffId: diffIdFromHash(input.contentHash),
    contentHash: input.contentHash,
  };
}

function createDiff(input: DiffFactInput): RopeDiffFact {
  const spans = diffSpans(input.basisHead, input.range, input.replacementBlob, input.replacementBytes, input.hash);
  const contentHash = ropeDiffContentHash({
    rewriteId: input.rewriteId,
    basisHeadId: input.basisHead.headId,
    nextHeadId: input.nextHead.headId,
    spans,
  }, input.hash);
  return {
    kind: ROPE_DIFF_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    diffId: diffIdForRewrite(input.rewriteId),
    rewriteId: input.rewriteId,
    basisHeadId: input.basisHead.headId,
    nextHeadId: input.nextHead.headId,
    spans,
    contentHash,
  };
}

function createReceipt(basisHead: RopeHeadFact, nextHead: RopeHeadFact, rewriteId: string, sequence: number, hash: TextBlobHashPort): TickReceiptFact {
  const contentHash = hash.sha256Hex(`${RUNTIME_HASH_PREFIX_RECEIPT}${basisHead.headId}:${nextHead.headId}:${sequence}`);
  return {
    kind: TICK_RECEIPT_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    tickId: tickIdFor(basisHead.worldlineId, contentHash, hash),
    admissionId: `${RUNTIME_HASH_PREFIX_ADMISSION_ID}${contentHash}`,
    worldlineId: basisHead.worldlineId,
    basisHeadId: basisHead.headId,
    nextHeadId: nextHead.headId,
    rewriteId,
    admittedAtSequence: sequence,
    contentHash,
  };
}

function diffSpans(
  basisHead: RopeHeadFact,
  range: TextByteRange,
  replacementBlob: TextBlobFact,
  replacementBytes: Uint8Array,
  hash: TextBlobHashPort,
): readonly RopeDiffSpan[] {
  return [
    ...equalSpan(ZERO_VALUE, range.startByte.value, ZERO_VALUE, range.startByte.value, hash),
    ...deleteSpan(range, hash),
    ...insertSpan(range.startByte.value, replacementBlob, replacementBytes, hash),
    ...equalSpan(
      range.endByte.value,
      basisHead.byteLength,
      range.startByte.value + replacementBytes.length,
      basisHead.byteLength - (range.endByte.value - range.startByte.value) + replacementBytes.length,
      hash,
    ),
  ];
}

function equalSpan(basisStart: number, basisEnd: number, nextStart: number, nextEnd: number, hash: TextBlobHashPort): readonly RopeDiffSpan[] {
  if (basisStart === basisEnd) {
    return [];
  }
  return [{
    kind: ROPE_DIFF_SPAN_EQUAL_KIND,
    basisRange: textByteRange(basisStart, basisEnd),
    nextRange: textByteRange(nextStart, nextEnd),
    contentHash: spanHash('equal', basisStart, basisEnd, hash),
  }];
}

function deleteSpan(range: TextByteRange, hash: TextBlobHashPort): readonly RopeDiffSpan[] {
  if (range.startByte.value === range.endByte.value) {
    return [];
  }
  return [{ kind: ROPE_DIFF_SPAN_DELETE_KIND, basisRange: range, contentHash: spanHash('delete', range.startByte.value, range.endByte.value, hash) }];
}

function insertSpan(startByte: number, replacementBlob: TextBlobFact, replacementBytes: Uint8Array, hash: TextBlobHashPort): readonly RopeDiffSpan[] {
  if (replacementBytes.length === ZERO_VALUE) {
    return [];
  }
  return [{
    kind: ROPE_DIFF_SPAN_INSERT_KIND,
    nextRange: textByteRange(startByte, startByte + replacementBytes.length),
    blobId: replacementBlob.blobId,
    contentHash: spanHash('insert', startByte, startByte + replacementBytes.length, hash),
  }];
}

function replaceRangeIsValid(leaves: readonly LeafSegment[], range: TextByteRange, byteLength: number): boolean {
  return leaves.length > ZERO_VALUE && byteRangeFits(range, byteLength);
}
