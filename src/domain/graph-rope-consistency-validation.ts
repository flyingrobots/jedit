import { ropeFactId } from './graph-rope-fact-id.js';
import { ropeDiffContentHash } from './graph-rope-diff-identity.js';
import { validateRopeRewriteDiffSemantics } from './graph-rope-diff-semantics-validation.js';
import {
  CONTENT_ADDRESSED_BLOB_STORE_KIND,
  FACT_VALIDATION_ERROR_HASH_MISMATCH,
  FACT_VALIDATION_ERROR_INVALID_METRIC,
  FACT_VALIDATION_ERROR_INVALID_REFERENCE,
  INLINE_UTF8_BYTES_STORAGE_KIND,
  ROPE_BRANCH_FACT_KIND,
  ROPE_DIFF_FACT_KIND,
  ROPE_DIFF_SPAN_DELETE_KIND,
  ROPE_DIFF_SPAN_EQUAL_KIND,
  ROPE_DIFF_SPAN_INSERT_KIND,
  ROPE_HEAD_FACT_KIND,
  ROPE_LEAF_FACT_KIND,
  ROPE_REWRITE_FACT_KIND,
  TEXT_BLOB_FACT_KIND,
  type FactValidationErrorCode,
  type RopeAdmittedFact,
  type RopeBranchFact,
  type RopeDiffFact,
  type RopeDiffSpan,
  type RopeFactValidationContext,
  type RopeHeadFact,
  type RopeLeafFact,
  type RopeRewriteFact,
  type TextBlobFact,
  type TextBlobHashPort,
} from './graph-rope-types.js';

const ZERO_VALUE = 0;
const ONE_VALUE = 1;
const LINE_FEED_BYTE = 10;
const CARRIAGE_RETURN_BYTE = 13;
const ROPE_NODE_ID_PREFIX = 'rope-node:';
const ROPE_HEAD_ID_PREFIX = 'rope-head:';
const ROPE_REWRITE_ID_PREFIX = 'rope-rewrite:';
const ROPE_DIFF_ID_PREFIX = 'rope-diff:';
const RUNTIME_HASH_PREFIX_BRANCH = 'branch:';
const RUNTIME_HASH_PREFIX_HEAD = 'head:';
const RUNTIME_HASH_PREFIX_LEAF = 'leaf:';
const RUNTIME_HASH_PREFIX_REWRITE = 'rewrite:';
const RUNTIME_HASH_PREFIX_SPAN = 'span:';

export function validateRopeHeadConsistency(
  head: RopeHeadFact,
  context: RopeFactValidationContext,
): FactValidationErrorCode | null {
  const root = resolveNodeFact(context, head.rootNodeId);
  if (root === null) {
    return FACT_VALIDATION_ERROR_INVALID_REFERENCE;
  }
  if (root.byteLength !== head.byteLength || root.lineCount !== head.lineCount) {
    return FACT_VALIDATION_ERROR_INVALID_METRIC;
  }
  const expectedHash = headContentHash(head, root, context.hash);
  return headMatchesHash(head, expectedHash);
}

export function validateRopeBranchConsistency(
  branch: RopeBranchFact,
  context: RopeFactValidationContext,
): FactValidationErrorCode | null {
  const left = resolveNodeFact(context, branch.left);
  const right = resolveNodeFact(context, branch.right);
  if (left === null || right === null) {
    return FACT_VALIDATION_ERROR_INVALID_REFERENCE;
  }
  if (!branchMetricsMatch(branch, left, right)) {
    return FACT_VALIDATION_ERROR_INVALID_METRIC;
  }
  const expectedHash = branchContentHash(left, right, branch, context.hash);
  return nodeMatchesHash(branch, expectedHash);
}

export function validateRopeLeafConsistency(
  leaf: RopeLeafFact,
  context: RopeFactValidationContext,
): FactValidationErrorCode | null {
  const blob = resolveTextBlobFact(context, leaf.blobId);
  const bytes = blob === null ? null : textBlobBytes(blob, context);
  if (blob === null || bytes === null || leaf.byteStart.value + leaf.byteLength > blob.byteLength) {
    return FACT_VALIDATION_ERROR_INVALID_REFERENCE;
  }
  const leafBytes = bytes.subarray(leaf.byteStart.value, leaf.byteStart.value + leaf.byteLength);
  if (leaf.lineCount !== lineCountForBytes(leafBytes)) {
    return FACT_VALIDATION_ERROR_INVALID_METRIC;
  }
  const expectedHash = leafContentHash(leaf, blob, context.hash);
  return nodeMatchesHash(leaf, expectedHash);
}

export function validateRopeRewriteConsistency(
  rewrite: RopeRewriteFact,
  context: RopeFactValidationContext,
): FactValidationErrorCode | null {
  const refs = rewriteReferences(context, rewrite);
  if (refs === null) {
    return FACT_VALIDATION_ERROR_INVALID_REFERENCE;
  }
  const linkIssue = validateRewriteLinks(rewrite, refs);
  if (linkIssue !== null) {
    return linkIssue;
  }
  const semanticIssue = validateRopeRewriteDiffSemantics({ rewrite, hash: context.hash, ...refs });
  if (semanticIssue !== null) {
    return semanticIssue;
  }
  const expectedHash = rewriteContentHash(rewrite.basisHeadId, rewrite.nextHeadId, rewrite.range, context.hash);
  return rewriteMatchesHash(rewrite, expectedHash);
}

export function validateRopeDiffConsistency(
  diff: RopeDiffFact,
  context: RopeFactValidationContext,
): FactValidationErrorCode | null {
  const rewrite = resolveRopeRewriteFact(context, diff.rewriteId);
  if (rewrite === null) {
    return FACT_VALIDATION_ERROR_INVALID_REFERENCE;
  }
  return validateResolvedRopeDiff(diff, rewrite, context);
}

function validateResolvedRopeDiff(
  diff: RopeDiffFact,
  rewrite: RopeRewriteFact,
  context: RopeFactValidationContext,
): FactValidationErrorCode | null {
  const linkIssue = diffRewriteLinkIssue(diff, rewrite);
  if (linkIssue !== null) {
    return linkIssue;
  }
  const semanticIssue = diffSemanticIssue(diff, rewrite, context);
  if (semanticIssue !== null) {
    return semanticIssue;
  }
  return diffMatchesHash(diff, context);
}

function diffRewriteLinkIssue(diff: RopeDiffFact, rewrite: RopeRewriteFact): FactValidationErrorCode | null {
  return rewrite.diffId === diff.diffId
    && rewrite.basisHeadId === diff.basisHeadId
    && rewrite.nextHeadId === diff.nextHeadId
    ? null
    : FACT_VALIDATION_ERROR_INVALID_REFERENCE;
}

function diffSemanticIssue(
  diff: RopeDiffFact,
  rewrite: RopeRewriteFact,
  context: RopeFactValidationContext,
): FactValidationErrorCode | null {
  const refs = rewriteReferences(context, rewrite);
  return refs === null
    ? FACT_VALIDATION_ERROR_INVALID_REFERENCE
    : validateRopeRewriteDiffSemantics({ rewrite, hash: context.hash, ...refs, diff });
}

function diffMatchesHash(diff: RopeDiffFact, context: RopeFactValidationContext): FactValidationErrorCode | null {
  const expectedHash = ropeDiffContentHash({
    rewriteId: diff.rewriteId,
    basisHeadId: diff.basisHeadId,
    nextHeadId: diff.nextHeadId,
    spans: diff.spans,
  }, context.hash);
  return diff.contentHash === expectedHash && diff.diffId === diffIdForRewrite(diff.rewriteId)
    ? null
    : FACT_VALIDATION_ERROR_HASH_MISMATCH;
}

export function validateDiffSpanHash(
  span: RopeDiffSpan,
  context: RopeFactValidationContext,
): FactValidationErrorCode | null {
  if (span.kind === ROPE_DIFF_SPAN_EQUAL_KIND) {
    return spanHashIssue(span.contentHash, 'equal', span.basisRange.startByte.value, span.basisRange.endByte.value, context.hash);
  }
  if (span.kind === ROPE_DIFF_SPAN_DELETE_KIND) {
    return spanHashIssue(span.contentHash, 'delete', span.basisRange.startByte.value, span.basisRange.endByte.value, context.hash);
  }
  if (span.kind === ROPE_DIFF_SPAN_INSERT_KIND) {
    return spanHashIssue(span.contentHash, 'insert', span.nextRange.startByte.value, span.nextRange.endByte.value, context.hash);
  }
  return FACT_VALIDATION_ERROR_INVALID_REFERENCE;
}

interface RewriteReferences {
  readonly basisHead: RopeHeadFact;
  readonly nextHead: RopeHeadFact;
  readonly diff: RopeDiffFact;
  readonly replacementBlob: TextBlobFact;
}

function rewriteReferences(
  context: RopeFactValidationContext,
  rewrite: RopeRewriteFact,
): RewriteReferences | null {
  const basisHead = resolveRopeHeadFact(context, rewrite.basisHeadId);
  const nextHead = resolveRopeHeadFact(context, rewrite.nextHeadId);
  const diff = resolveRopeDiffFact(context, rewrite.diffId);
  const replacementBlob = resolveTextBlobFact(context, rewrite.replacementBlobId);
  if (basisHead === null || nextHead === null || diff === null || replacementBlob === null) {
    return null;
  }
  return { basisHead, nextHead, diff, replacementBlob };
}

function validateRewriteLinks(
  rewrite: RopeRewriteFact,
  refs: RewriteReferences,
): FactValidationErrorCode | null {
  if (!rewriteWorldlineMatches(rewrite, refs)) {
    return FACT_VALIDATION_ERROR_INVALID_REFERENCE;
  }
  if (refs.nextHead.basisHeadId !== refs.basisHead.headId) {
    return FACT_VALIDATION_ERROR_INVALID_REFERENCE;
  }
  if (!rewriteDiffMatches(rewrite, refs.diff)) {
    return FACT_VALIDATION_ERROR_INVALID_REFERENCE;
  }
  return refs.nextHead.createdByEchoReceiptId === rewrite.admittedByEchoReceiptId
    ? null
    : FACT_VALIDATION_ERROR_INVALID_REFERENCE;
}

function rewriteWorldlineMatches(rewrite: RopeRewriteFact, refs: RewriteReferences): boolean {
  return rewrite.worldlineId === refs.basisHead.worldlineId
    && refs.nextHead.worldlineId === refs.basisHead.worldlineId;
}

function rewriteDiffMatches(rewrite: RopeRewriteFact, diff: RopeDiffFact): boolean {
  return diff.rewriteId === rewrite.rewriteId
    && diff.basisHeadId === rewrite.basisHeadId
    && diff.nextHeadId === rewrite.nextHeadId;
}

function branchMetricsMatch(
  branch: RopeBranchFact,
  left: RopeBranchFact | RopeLeafFact,
  right: RopeBranchFact | RopeLeafFact,
): boolean {
  return branch.byteLength === left.byteLength + right.byteLength
    && branch.lineCount === left.lineCount + right.lineCount - ONE_VALUE
    && branch.height === Math.max(nodeHeight(left), nodeHeight(right)) + ONE_VALUE;
}

function headMatchesHash(
  head: RopeHeadFact,
  expectedHash: string,
): FactValidationErrorCode | null {
  if (head.contentHash !== expectedHash || head.headId !== `${ROPE_HEAD_ID_PREFIX}${expectedHash}`) {
    return FACT_VALIDATION_ERROR_HASH_MISMATCH;
  }
  return null;
}

function nodeMatchesHash(
  node: RopeBranchFact | RopeLeafFact,
  expectedHash: string,
): FactValidationErrorCode | null {
  return node.contentHash === expectedHash && node.nodeId === `${ROPE_NODE_ID_PREFIX}${expectedHash}`
    ? null
    : FACT_VALIDATION_ERROR_HASH_MISMATCH;
}

function rewriteMatchesHash(
  rewrite: RopeRewriteFact,
  expectedHash: string,
): FactValidationErrorCode | null {
  return rewrite.contentHash === expectedHash
    && rewrite.rewriteId === `${ROPE_REWRITE_ID_PREFIX}${expectedHash}`
    && rewrite.diffId === `${ROPE_DIFF_ID_PREFIX}${expectedHash}`
    ? null
    : FACT_VALIDATION_ERROR_HASH_MISMATCH;
}

function resolveNodeFact(
  context: RopeFactValidationContext,
  id: string,
): RopeBranchFact | RopeLeafFact | null {
  const fact = resolveFactById(context, id);
  return fact?.kind === ROPE_BRANCH_FACT_KIND || fact?.kind === ROPE_LEAF_FACT_KIND ? fact : null;
}

function resolveRopeHeadFact(context: RopeFactValidationContext, id: string): RopeHeadFact | null {
  const fact = resolveFactById(context, id);
  return fact?.kind === ROPE_HEAD_FACT_KIND ? fact : null;
}

function resolveRopeRewriteFact(context: RopeFactValidationContext, id: string): RopeRewriteFact | null {
  const fact = resolveFactById(context, id);
  return fact?.kind === ROPE_REWRITE_FACT_KIND ? fact : null;
}

function resolveRopeDiffFact(context: RopeFactValidationContext, id: string): RopeDiffFact | null {
  const fact = resolveFactById(context, id);
  return fact?.kind === ROPE_DIFF_FACT_KIND ? fact : null;
}

function resolveTextBlobFact(context: RopeFactValidationContext, id: string): TextBlobFact | null {
  const fact = resolveFactById(context, id);
  return fact?.kind === TEXT_BLOB_FACT_KIND ? fact : null;
}

function resolveFactById(context: RopeFactValidationContext, id: string): RopeAdmittedFact | null {
  for (const fact of context.writeSet) {
    if (ropeFactId(fact) === id) {
      return fact;
    }
  }
  return context.admittedBasis.getFact(id);
}

function textBlobBytes(fact: TextBlobFact, context: RopeFactValidationContext): Uint8Array | null {
  if (fact.storage.kind === INLINE_UTF8_BYTES_STORAGE_KIND) {
    return fact.storage.bytes;
  }
  if (fact.storage.kind === CONTENT_ADDRESSED_BLOB_STORE_KIND) {
    return context.blobStore.readBlobBytes(fact.storage);
  }
  return null;
}

function branchContentHash(
  left: RopeBranchFact | RopeLeafFact,
  right: RopeBranchFact | RopeLeafFact,
  branch: RopeBranchFact,
  hash: TextBlobHashPort,
): string {
  return hash.sha256Hex(`${RUNTIME_HASH_PREFIX_BRANCH}${left.nodeId}:${right.nodeId}:${branch.byteLength}:${branch.lineCount}:${branch.height}`);
}

function leafContentHash(leaf: RopeLeafFact, blob: TextBlobFact, hash: TextBlobHashPort): string {
  return hash.sha256Hex(`${RUNTIME_HASH_PREFIX_LEAF}${blob.contentHash}:${String(leaf.byteStart.value)}:${String(leaf.byteLength)}`);
}

function headContentHash(
  head: RopeHeadFact,
  root: RopeBranchFact | RopeLeafFact,
  hash: TextBlobHashPort,
): string {
  const basis = head.basisHeadId ?? head.worldlineId;
  return hash.sha256Hex(`${RUNTIME_HASH_PREFIX_HEAD}${basis}:${root.nodeId}:${root.byteLength}`);
}

function rewriteContentHash(
  basisHeadId: string,
  nextHeadId: string,
  range: RopeRewriteFact['range'],
  hash: TextBlobHashPort,
): string {
  return hash.sha256Hex(`${RUNTIME_HASH_PREFIX_REWRITE}${basisHeadId}:${nextHeadId}:${String(range.startByte.value)}:${String(range.endByte.value)}`);
}

function spanHashIssue(
  contentHash: string,
  kind: string,
  startByte: number,
  endByte: number,
  hash: TextBlobHashPort,
): FactValidationErrorCode | null {
  return contentHash === spanHash(kind, startByte, endByte, hash)
    ? null
    : FACT_VALIDATION_ERROR_HASH_MISMATCH;
}

function spanHash(kind: string, startByte: number, endByte: number, hash: TextBlobHashPort): string {
  return hash.sha256Hex(`${RUNTIME_HASH_PREFIX_SPAN}${kind}:${String(startByte)}:${String(endByte)}`);
}

function diffIdForRewrite(rewriteId: string): string {
  return rewriteId.replace(ROPE_REWRITE_ID_PREFIX, ROPE_DIFF_ID_PREFIX);
}

function nodeHeight(node: RopeBranchFact | RopeLeafFact): number {
  return node.kind === ROPE_BRANCH_FACT_KIND ? node.height : ZERO_VALUE;
}

function lineCountForBytes(bytes: Uint8Array): number {
  let count = ONE_VALUE;
  for (let index = ZERO_VALUE; index < bytes.length; index += ONE_VALUE) {
    if (isLogicalLineBreak(bytes, index)) {
      count += ONE_VALUE;
    }
  }
  return count;
}

function isLogicalLineBreak(bytes: Uint8Array, index: number): boolean {
  if (bytes[index] === LINE_FEED_BYTE) {
    return bytes[index - ONE_VALUE] !== CARRIAGE_RETURN_BYTE;
  }
  return bytes[index] === CARRIAGE_RETURN_BYTE;
}
