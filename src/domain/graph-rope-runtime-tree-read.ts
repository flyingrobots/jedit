import {
  INLINE_UTF8_BYTES_STORAGE_KIND,
  ROPE_BRANCH_FACT_KIND,
  ROPE_LEAF_FACT_KIND,
  type RopeBranchFact,
  type RopeHeadFact,
  type TextByteRange,
} from './graph-rope-contract.js';
import {
  blobById,
  byteRangeFits,
  concatBytes,
  decodeText,
  evidenceForLeaf,
  leafBytes,
  maxNodeDepth,
  nodeById,
  overlapRange,
  rangeHasUtf8Boundaries,
  retainedBlobBytes,
} from './graph-rope-runtime-tree-common.js';
import {
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_BYTE_RANGE,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_UTF8_BOUNDARY,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_BLOB,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_NODE,
  type GraphRopeRuntimeObstructionCode,
} from './graph-rope-runtime-issues.js';
import {
  ZERO_VALUE,
  ONE_VALUE,
  type GraphRopeRuntimeFactReader,
  type GraphRopeTreeDebugNode,
  type GraphRopeTreeDebugShape,
  type GraphRopeTreeWindowEvidence,
  type GraphRopeTreeWindowReading,
  type LeafSegment,
  type RopeNodeFact,
  type TreeResult,
  type WindowBytes,
} from './graph-rope-runtime-tree-types.js';

interface WindowTraversal {
  readonly reader: GraphRopeRuntimeFactReader;
  readonly inspectionStart: number;
  readonly inspectionEnd: number;
  readonly leaves: LeafSegment[];
}

export function readTreeWindow(
  reader: GraphRopeRuntimeFactReader,
  head: RopeHeadFact,
  byteRange: TextByteRange,
): TreeResult<GraphRopeTreeWindowReading> {
  if (!byteRangeFits(byteRange, head.byteLength)) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_BYTE_RANGE };
  }
  const leaves = windowLeafSegments(reader, head, byteRange);
  if (!leaves.ok) {
    return leaves;
  }
  if (!rangeHasUtf8Boundaries(leaves.value, byteRange, head.byteLength)) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_UTF8_BOUNDARY };
  }
  return materializeWindow(leaves.value, byteRange);
}

function windowLeafSegments(
  reader: GraphRopeRuntimeFactReader,
  head: RopeHeadFact,
  range: TextByteRange,
): TreeResult<readonly LeafSegment[]> {
  const leaves: LeafSegment[] = [];
  const inspectionEnd = Math.min(head.byteLength, range.endByte.value + ONE_VALUE);
  const traversal: WindowTraversal = {
    reader,
    inspectionStart: range.startByte.value,
    inspectionEnd,
    leaves,
  };
  const issue = appendWindowLeafSegments(
    traversal,
    head.rootNodeId,
    ZERO_VALUE,
    head.byteLength,
  );
  return issue === null ? { ok: true, value: leaves } : { ok: false, code: issue };
}

function appendWindowLeafSegments(
  traversal: WindowTraversal,
  nodeId: string,
  nodeStart: number,
  nodeLength: number,
): GraphRopeRuntimeObstructionCode | null {
  if (!rangesOverlap(nodeStart, nodeStart + nodeLength, traversal.inspectionStart, traversal.inspectionEnd)) {
    return null;
  }
  const node = nodeById(traversal.reader, nodeId);
  return node === null
    ? GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_NODE
    : appendWindowNode(traversal, node, nodeStart);
}

function appendWindowNode(
  traversal: WindowTraversal,
  node: RopeNodeFact,
  nodeStart: number,
): GraphRopeRuntimeObstructionCode | null {
  if (node.kind === ROPE_LEAF_FACT_KIND) {
    return appendLeafSegment(traversal.reader, node, nodeStart, traversal.leaves);
  }
  const left = nodeById(traversal.reader, node.left);
  if (left === null) {
    return GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_NODE;
  }
  const rightStart = nodeStart + left.byteLength;
  const leftIssue = rangesOverlap(
    nodeStart,
    rightStart,
    traversal.inspectionStart,
    traversal.inspectionEnd,
  )
    ? appendWindowNode(traversal, left, nodeStart)
    : null;
  return leftIssue ?? appendWindowLeafSegments(
    traversal,
    node.right,
    rightStart,
    node.byteLength - left.byteLength,
  );
}

function rangesOverlap(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

/** Reads an exact byte window without claiming that its boundaries form valid UTF-8 text. */
export function readTreeByteWindow(
  reader: GraphRopeRuntimeFactReader,
  head: RopeHeadFact,
  byteRange: TextByteRange,
): TreeResult<WindowBytes> {
  const leaves = orderedLeafSegments(reader, head);
  if (!leaves.ok) {
    return leaves;
  }
  return byteRangeFits(byteRange, head.byteLength)
    ? { ok: true, value: windowBytesFromLeaves(leaves.value, byteRange) }
    : { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_BYTE_RANGE };
}

export function debugTreeShape(reader: GraphRopeRuntimeFactReader, head: RopeHeadFact): TreeResult<GraphRopeTreeDebugShape> {
  const leaves = orderedLeafSegments(reader, head);
  if (!leaves.ok) {
    return leaves;
  }
  const nodes = collectDebugNodes(reader, head.rootNodeId);
  if (!nodes.ok) {
    return nodes;
  }
  return { ok: true, value: debugShapeFromNodes(leaves.value, nodes.value) };
}

export function orderedLeafSegments(reader: GraphRopeRuntimeFactReader, head: RopeHeadFact): TreeResult<readonly LeafSegment[]> {
  const leaves: LeafSegment[] = [];
  const issue = appendLeafSegments(reader, head.rootNodeId, ZERO_VALUE, leaves);
  return issue === null ? { ok: true, value: leaves } : { ok: false, code: issue };
}

export function windowBytesFromLeaves(leaves: readonly LeafSegment[], range: TextByteRange): WindowBytes {
  const chunks: Uint8Array[] = [];
  const evidence: GraphRopeTreeWindowEvidence[] = [];
  let total = ZERO_VALUE;
  for (const leaf of leaves) {
    const overlap = overlapRange(leaf, range);
    if (overlap !== null) {
      const chunk = leaf.bytes.subarray(overlap.startByte.value - leaf.startByte, overlap.endByte.value - leaf.startByte);
      chunks.push(chunk);
      total += chunk.length;
      evidence.push(evidenceForLeaf(leaf, overlap));
    }
  }
  return { bytes: concatBytes(chunks, total), evidence };
}

function materializeWindow(leaves: readonly LeafSegment[], range: TextByteRange): TreeResult<GraphRopeTreeWindowReading> {
  const window = windowBytesFromLeaves(leaves, range);
  const text = decodeText(window.bytes);
  if (text === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_UTF8_BOUNDARY };
  }
  return { ok: true, value: { text, validationEvidence: window.evidence } };
}

function appendLeafSegments(
  reader: GraphRopeRuntimeFactReader,
  nodeId: string,
  offset: number,
  leaves: LeafSegment[],
): GraphRopeRuntimeObstructionCode | null {
  const node = nodeById(reader, nodeId);
  if (node === null) {
    return GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_NODE;
  }
  if (node.kind === ROPE_LEAF_FACT_KIND) {
    return appendLeafSegment(reader, node, offset, leaves);
  }
  const leftIssue = appendLeafSegments(reader, node.left, offset, leaves);
  return leftIssue ?? appendRightSegments(reader, node, offset, leaves);
}

function appendRightSegments(
  reader: GraphRopeRuntimeFactReader,
  branch: RopeBranchFact,
  offset: number,
  leaves: LeafSegment[],
): GraphRopeRuntimeObstructionCode | null {
  const left = nodeById(reader, branch.left);
  if (left === null) {
    return GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_NODE;
  }
  return appendLeafSegments(reader, branch.right, offset + left.byteLength, leaves);
}

function appendLeafSegment(
  reader: GraphRopeRuntimeFactReader,
  leaf: LeafSegment['leaf'],
  offset: number,
  leaves: LeafSegment[],
): GraphRopeRuntimeObstructionCode | null {
  const blob = blobById(reader, leaf.blobId);
  if (blob === null || blob.storage.kind !== INLINE_UTF8_BYTES_STORAGE_KIND) {
    return GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_BLOB;
  }
  leaves.push({ leaf, blob, startByte: offset, endByte: offset + leaf.byteLength, bytes: leafBytes(leaf, blob) });
  return null;
}

function collectDebugNodes(reader: GraphRopeRuntimeFactReader, rootNodeId: string): TreeResult<readonly GraphRopeTreeDebugNode[]> {
  const nodes: GraphRopeTreeDebugNode[] = [];
  const issue = appendDebugNodes(reader, rootNodeId, nodes);
  return issue === null ? { ok: true, value: nodes } : { ok: false, code: issue };
}

function appendDebugNodes(
  reader: GraphRopeRuntimeFactReader,
  nodeId: string,
  nodes: GraphRopeTreeDebugNode[],
): GraphRopeRuntimeObstructionCode | null {
  const node = nodeById(reader, nodeId);
  if (node === null) {
    return GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_NODE;
  }
  nodes.push({ nodeId, kind: node.kind, byteLength: node.byteLength, contentHash: node.contentHash });
  if (node.kind === ROPE_BRANCH_FACT_KIND) {
    return appendDebugNodes(reader, node.left, nodes) ?? appendDebugNodes(reader, node.right, nodes);
  }
  return null;
}

function debugShapeFromNodes(leaves: readonly LeafSegment[], nodes: readonly GraphRopeTreeDebugNode[]): GraphRopeTreeDebugShape {
  return {
    nodeCount: nodes.length,
    leafCount: leaves.length,
    maxDepth: maxNodeDepth(nodes),
    retainedBlobBytes: retainedBlobBytes(leaves),
    materializedProjectionBytes: ZERO_VALUE,
    nodes,
  };
}
