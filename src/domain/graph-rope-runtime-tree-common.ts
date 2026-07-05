import {
  BYTE_OFFSET_COORDINATE_KIND,
  GRAPH_ROPE_SCHEMA_VERSION,
  INLINE_UTF8_BYTES_STORAGE_KIND,
  ROPE_BRANCH_FACT_KIND,
  ROPE_LEAF_FACT_KIND,
  TEXT_BLOB_FACT_KIND,
  makeByteOffset,
  type ByteOffset,
  type RopeLeafFact,
  type TextBlobFact,
  type TextBlobHashPort,
  type TextByteRange,
} from './graph-rope-contract.js';
import {
  CARRIAGE_RETURN_BYTE,
  LEAF_TARGET_BYTE_LENGTH,
  LINE_FEED_BYTE,
  ONE_VALUE,
  RUNTIME_HASH_PREFIX_BRANCH,
  RUNTIME_HASH_PREFIX_DIFF_ID,
  RUNTIME_HASH_PREFIX_LEAF,
  RUNTIME_HASH_PREFIX_NODE,
  RUNTIME_HASH_PREFIX_REWRITE,
  RUNTIME_HASH_PREFIX_REWRITE_ID,
  RUNTIME_HASH_PREFIX_SPAN,
  RUNTIME_HASH_PREFIX_TICK,
  TWO_VALUE,
  UTF8_CONTINUATION_MASK,
  UTF8_CONTINUATION_TAG,
  ZERO_VALUE,
  type GraphRopeRuntimeFactReader,
  type GraphRopeTreeBuild,
  type GraphRopeTreeWindowEvidence,
  type LeafSegment,
  type NodeRef,
  type RopeNodeFact,
} from './graph-rope-runtime-tree-types.js';

const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true });

export function createLeafPieces(blob: TextBlobFact, bytes: Uint8Array, hash: TextBlobHashPort): readonly NodeRef[] {
  if (bytes.length === ZERO_VALUE) {
    return [leafPiece(blob, bytes, ZERO_VALUE, ZERO_VALUE, hash)];
  }
  const leaves: NodeRef[] = [];
  for (let start = ZERO_VALUE; start < bytes.length;) {
    const end = chunkEnd(bytes, start);
    leaves.push(leafPiece(blob, bytes.subarray(start, end), start, end - start, hash));
    start = end;
  }
  return leaves;
}

export function buildTreeFromPieces(pieces: readonly NodeRef[], hash: TextBlobHashPort): GraphRopeTreeBuild {
  if (pieces.length === ONE_VALUE) {
    const piece = firstPiece(pieces);
    return { root: piece, facts: pieceFactList(piece) };
  }
  const split = Math.floor(pieces.length / TWO_VALUE);
  const left = buildTreeFromPieces(pieces.slice(ZERO_VALUE, split), hash);
  const right = buildTreeFromPieces(pieces.slice(split), hash);
  const branch = branchFact(left.root, right.root, hash);
  return { root: branch, facts: [...left.facts, ...right.facts, ...pieceFactList(branch)] };
}

export function leafPiece(
  blob: TextBlobFact,
  bytes: Uint8Array,
  byteStart: number,
  byteLength: number,
  hash: TextBlobHashPort,
): NodeRef {
  return nodeRefFromFact(leafFact(blob, bytes, byteStart, byteLength, hash));
}

export function existingLeafPiece(segment: LeafSegment): NodeRef {
  return nodeRefFromFact(segment.leaf, null);
}

export function sliceLeafPiece(segment: LeafSegment, startByte: number, endByte: number, hash: TextBlobHashPort): NodeRef {
  const localStart = startByte - segment.startByte;
  const bytes = segment.bytes.subarray(localStart, localStart + endByte - startByte);
  return leafPiece(segment.blob, bytes, segment.leaf.byteStart.value + localStart, bytes.length, hash);
}

export function nodeById(reader: GraphRopeRuntimeFactReader, nodeId: string): RopeNodeFact | null {
  const fact = reader.getFact(nodeId);
  if (fact?.kind === ROPE_BRANCH_FACT_KIND || fact?.kind === ROPE_LEAF_FACT_KIND) {
    return fact;
  }
  return null;
}

export function blobById(reader: GraphRopeRuntimeFactReader, blobId: string): TextBlobFact | null {
  const fact = reader.getFact(blobId);
  return fact?.kind === TEXT_BLOB_FACT_KIND ? fact : null;
}

export function pieceFactList(piece: NodeRef): readonly RopeNodeFact[] {
  return piece.fact === null ? [] : [piece.fact];
}

export function leafBytes(leaf: RopeLeafFact, blob: TextBlobFact): Uint8Array {
  return blob.storage.kind === INLINE_UTF8_BYTES_STORAGE_KIND
    ? blob.storage.bytes.subarray(leaf.byteStart.value, leaf.byteStart.value + leaf.byteLength)
    : new Uint8Array();
}

export function overlapRange(leaf: LeafSegment, range: TextByteRange): TextByteRange | null {
  const startByte = Math.max(leaf.startByte, range.startByte.value);
  const endByte = Math.min(leaf.endByte, range.endByte.value);
  return startByte < endByte ? textByteRange(startByte, endByte) : null;
}

export function evidenceForLeaf(leaf: LeafSegment, byteRange: TextByteRange): GraphRopeTreeWindowEvidence {
  return { leafId: leaf.leaf.nodeId, blobId: leaf.blob.blobId, contentHash: leaf.blob.contentHash, byteRange };
}

export function concatBytes(chunks: readonly Uint8Array[], totalLength: number): Uint8Array {
  const output = new Uint8Array(totalLength);
  let offset = ZERO_VALUE;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

export function byteRangeFits(byteRange: TextByteRange, byteLength: number): boolean {
  return ZERO_VALUE <= byteRange.startByte.value
    && byteRange.startByte.value <= byteRange.endByte.value
    && byteRange.endByte.value <= byteLength;
}

export function rangeHasUtf8Boundaries(leaves: readonly LeafSegment[], range: TextByteRange, byteLength: number): boolean {
  return isUtf8BoundaryAt(leaves, range.startByte.value, byteLength) && isUtf8BoundaryAt(leaves, range.endByte.value, byteLength);
}

export function retainedBlobBytes(leaves: readonly LeafSegment[]): number {
  const seen = new Set<string>();
  return leaves.reduce((total, leaf) => addBlobBytes(total, leaf, seen), ZERO_VALUE);
}

export function maxNodeDepth(nodes: readonly { readonly kind: string }[]): number {
  const branchCount = nodes.filter((node) => node.kind === ROPE_BRANCH_FACT_KIND).length;
  return branchCount === ZERO_VALUE ? ZERO_VALUE : Math.ceil(Math.log2(nodes.length));
}

export function diffIdForRewrite(rewriteId: string): string {
  return rewriteId.replace(RUNTIME_HASH_PREFIX_REWRITE_ID, RUNTIME_HASH_PREFIX_DIFF_ID);
}

export function rewriteContentHash(
  basisHeadId: string,
  nextHeadId: string,
  range: TextByteRange,
  hash: TextBlobHashPort,
): string {
  return hash.sha256Hex(`${RUNTIME_HASH_PREFIX_REWRITE}${basisHeadId}:${nextHeadId}:${range.startByte.value}:${range.endByte.value}`);
}

export function rewriteIdFromHash(contentHash: string): string {
  return `${RUNTIME_HASH_PREFIX_REWRITE_ID}${contentHash}`;
}

export function diffIdFromHash(contentHash: string): string {
  return `${RUNTIME_HASH_PREFIX_DIFF_ID}${contentHash}`;
}

export function tickIdFor(worldlineId: string, contentHash: string, hash: TextBlobHashPort): string {
  return `${RUNTIME_HASH_PREFIX_TICK}${hash.sha256Hex(`${worldlineId}:${contentHash}`)}`;
}

export function spanHash(kind: string, startByte: number, endByte: number, hash: TextBlobHashPort): string {
  return hash.sha256Hex(`${RUNTIME_HASH_PREFIX_SPAN}${kind}:${startByte}:${endByte}`);
}

export function textByteRange(startByte: number, endByte: number): TextByteRange {
  return { startByte: trustedByteOffset(startByte), endByte: trustedByteOffset(endByte) };
}

export function decodeText(bytes: Uint8Array): string | null {
  try {
    return TEXT_DECODER.decode(bytes);
  } catch {
    return null;
  }
}

function leafFact(blob: TextBlobFact, bytes: Uint8Array, byteStart: number, byteLength: number, hash: TextBlobHashPort): RopeLeafFact {
  const contentHash = hash.sha256Hex(`${RUNTIME_HASH_PREFIX_LEAF}${blob.contentHash}:${byteStart}:${byteLength}`);
  return {
    kind: ROPE_LEAF_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    nodeId: `${RUNTIME_HASH_PREFIX_NODE}${contentHash}`,
    blobId: blob.blobId,
    byteStart: trustedByteOffset(byteStart),
    byteLength,
    lineCount: lineCountForBytes(bytes),
    contentHash,
  };
}

function branchFact(left: NodeRef, right: NodeRef, hash: TextBlobHashPort): NodeRef {
  const height = Math.max(left.height, right.height) + ONE_VALUE;
  const byteLength = left.byteLength + right.byteLength;
  const lineCount = left.lineCount + right.lineCount - ONE_VALUE;
  const contentHash = hash.sha256Hex(`${RUNTIME_HASH_PREFIX_BRANCH}${left.nodeId}:${right.nodeId}:${byteLength}:${lineCount}:${height}`);
  return nodeRefFromFact({
    kind: ROPE_BRANCH_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    nodeId: `${RUNTIME_HASH_PREFIX_NODE}${contentHash}`,
    left: left.nodeId,
    right: right.nodeId,
    byteLength,
    lineCount,
    height,
    contentHash,
  });
}

function nodeRefFromFact(fact: RopeNodeFact, storedFact: RopeNodeFact | null = fact): NodeRef {
  return { nodeId: fact.nodeId, byteLength: fact.byteLength, lineCount: fact.lineCount, height: nodeHeight(fact), fact: storedFact };
}

function nodeHeight(fact: RopeNodeFact): number {
  return fact.kind === ROPE_BRANCH_FACT_KIND ? fact.height : ZERO_VALUE;
}

function firstPiece(pieces: readonly NodeRef[]): NodeRef {
  return pieces[ZERO_VALUE] ?? { nodeId: '', byteLength: ZERO_VALUE, lineCount: ONE_VALUE, height: ZERO_VALUE, fact: null };
}

function isUtf8BoundaryAt(leaves: readonly LeafSegment[], byteOffset: number, byteLength: number): boolean {
  if (byteOffset === ZERO_VALUE || byteOffset === byteLength) {
    return true;
  }
  const byte = byteAt(leaves, byteOffset);
  return byte !== null && (byte & UTF8_CONTINUATION_MASK) !== UTF8_CONTINUATION_TAG;
}

function byteAt(leaves: readonly LeafSegment[], byteOffset: number): number | null {
  for (const leaf of leaves) {
    if (leaf.startByte <= byteOffset && byteOffset < leaf.endByte) {
      return leaf.bytes[byteOffset - leaf.startByte] ?? null;
    }
  }
  return null;
}

function chunkEnd(bytes: Uint8Array, start: number): number {
  const target = Math.min(start + LEAF_TARGET_BYTE_LENGTH, bytes.length);
  return validBoundaryAtOrBefore(bytes, start, target);
}

function validBoundaryAtOrBefore(bytes: Uint8Array, start: number, target: number): number {
  let end = target;
  while (start < end && isContinuationByte(bytes[end] ?? ZERO_VALUE)) {
    end -= ONE_VALUE;
  }
  return start === end ? nextBoundaryAfter(bytes, target) : end;
}

function nextBoundaryAfter(bytes: Uint8Array, target: number): number {
  let end = target + ONE_VALUE;
  while (end < bytes.length && isContinuationByte(bytes[end] ?? ZERO_VALUE)) {
    end += ONE_VALUE;
  }
  return end;
}

function isContinuationByte(byte: number): boolean {
  return (byte & UTF8_CONTINUATION_MASK) === UTF8_CONTINUATION_TAG;
}

function lineCountForBytes(bytes: Uint8Array): number {
  let count = ONE_VALUE;
  for (let index = 0; index < bytes.length; index += ONE_VALUE) {
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

function addBlobBytes(total: number, leaf: LeafSegment, seen: Set<string>): number {
  if (seen.has(leaf.blob.blobId)) {
    return total;
  }
  seen.add(leaf.blob.blobId);
  return total + leaf.blob.byteLength;
}

function trustedByteOffset(value: number): ByteOffset {
  const result = makeByteOffset(value);
  return result.ok ? result.value : { kind: BYTE_OFFSET_COORDINATE_KIND, value };
}
