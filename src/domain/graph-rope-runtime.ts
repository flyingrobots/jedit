import {
  BUFFER_WORLDLINE_FACT_KIND,
  BYTE_OFFSET_COORDINATE_KIND,
  GRAPH_ROPE_SCHEMA_VERSION,
  INLINE_UTF8_BYTES_STORAGE_KIND,
  ROPE_HEAD_FACT_KIND,
  ROPE_LEAF_FACT_KIND,
  TEXT_BLOB_FACT_KIND,
  makeByteOffset,
  makeTextBlobFact,
  ropeFactId,
  validateRopeFact,
  type BufferWorldlineFact,
  type ByteOffset,
  type RopeAdmittedFact,
  type RopeFactValidationContext,
  type RopeHeadFact,
  type RopeLeafFact,
  type TextBlobFact,
  type TextBlobHashPort,
  type TextByteRange,
} from './graph-rope-contract.js';

const ZERO_VALUE = 0;
const ONE_VALUE = 1;
const LINE_FEED_BYTE = 10;
const CARRIAGE_RETURN_BYTE = 13;
const RUNTIME_HASH_PREFIX_HEAD = 'head:';
const RUNTIME_HASH_PREFIX_LEAF = 'leaf:';
const RUNTIME_HASH_PREFIX_TICK = 'tick:';
const RUNTIME_HASH_PREFIX_NODE = 'rope-node:';
const RUNTIME_HASH_PREFIX_HEAD_ID = 'rope-head:';
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true });
const TEXT_ENCODER = new TextEncoder();

export const GRAPH_ROPE_TEXT_WINDOW_CACHE_STATUS_UNCACHED = 'uncached-materialization';
export const GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_HEAD = 'missing-head';
export const GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_NODE = 'missing-node';
export const GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_BLOB = 'missing-blob';
export const GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_BYTE_RANGE = 'invalid-byte-range';
export const GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_UTF8_BOUNDARY = 'invalid-utf8-boundary';
export const GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT = 'invalid-fact';

export type GraphRopeRuntimeObstructionCode =
  | typeof GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_HEAD
  | typeof GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_NODE
  | typeof GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_BLOB
  | typeof GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_BYTE_RANGE
  | typeof GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_UTF8_BOUNDARY
  | typeof GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT;

export type GraphRopeRuntimeResult<TValue> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly code: GraphRopeRuntimeObstructionCode };

export interface CreateGraphRopeRuntimeInput {
  readonly hash: TextBlobHashPort;
}

export interface CreateBufferWorldlineInput {
  readonly worldlineId: string;
  readonly initialText: string;
}

export interface GraphRopeCreateWorldlineResult {
  readonly worldline: BufferWorldlineFact;
  readonly head: RopeHeadFact;
  readonly leaf: RopeLeafFact;
  readonly blob: TextBlobFact;
}

export interface GraphRopeTextWindowInput {
  readonly basisHeadId: string;
  readonly byteRange: TextByteRange;
}

export interface GraphRopeTextWindowEvidence {
  readonly leafId: string;
  readonly blobId: string;
  readonly contentHash: string;
  readonly byteRange: TextByteRange;
}

export interface GraphRopeTextWindowReading {
  readonly basisHeadId: string;
  readonly byteRange: TextByteRange;
  readonly cacheStatus: typeof GRAPH_ROPE_TEXT_WINDOW_CACHE_STATUS_UNCACHED;
  readonly text: string;
  readonly validationEvidence: readonly GraphRopeTextWindowEvidence[];
}

export interface GraphRopeDebugShape {
  readonly headId: string;
  readonly rootNodeId: string;
  readonly byteLength: number;
  readonly nodeCount: number;
  readonly leafCount: number;
  readonly maxDepth: number;
  readonly retainedBlobBytes: number;
  readonly materializedProjectionBytes: number;
  readonly nodes: readonly GraphRopeDebugNode[];
}

export interface GraphRopeDebugNode {
  readonly nodeId: string;
  readonly kind: typeof ROPE_LEAF_FACT_KIND;
  readonly byteLength: number;
  readonly contentHash: string;
}

export interface GraphRopeRuntime {
  createBufferWorldline(input: CreateBufferWorldlineInput): GraphRopeRuntimeResult<GraphRopeCreateWorldlineResult>;
  textWindow(input: GraphRopeTextWindowInput): GraphRopeRuntimeResult<GraphRopeTextWindowReading>;
  debugRopeShape(headId: string): GraphRopeRuntimeResult<GraphRopeDebugShape>;
}

interface GraphRopeRuntimeState {
  readonly hash: TextBlobHashPort;
  readonly factsById: Map<string, RopeAdmittedFact>;
}

interface LeafBytes {
  readonly leaf: RopeLeafFact;
  readonly blob: TextBlobFact;
  readonly bytes: Uint8Array;
}

export function createGraphRopeRuntime(input: CreateGraphRopeRuntimeInput): GraphRopeRuntime {
  const state = {
    hash: input.hash,
    factsById: new Map<string, RopeAdmittedFact>(),
  };

  return {
    createBufferWorldline(createInput) {
      return createBufferWorldline(state, createInput);
    },
    textWindow(readInput) {
      return textWindow(state, readInput);
    },
    debugRopeShape(headId) {
      return debugRopeShape(state, headId);
    },
  };
}

function createBufferWorldline(
  state: GraphRopeRuntimeState,
  input: CreateBufferWorldlineInput,
): GraphRopeRuntimeResult<GraphRopeCreateWorldlineResult> {
  const bytes = TEXT_ENCODER.encode(input.initialText);
  const blobResult = makeTextBlobFact({ bytes, hash: state.hash });
  if (!blobResult.ok) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_UTF8_BOUNDARY };
  }
  const blob = blobResult.fact;
  const leaf = createInitialLeaf(blob, bytes, state.hash);
  const head = createInitialHead(input.worldlineId, leaf, state.hash);
  const worldline = createWorldline(input.worldlineId, head, state.hash);
  const admissionIssue = admitFacts(state, [blob, leaf, head, worldline]);
  if (admissionIssue !== null) {
    return { ok: false, code: admissionIssue };
  }
  return { ok: true, value: cloneCreateWorldlineResult({ worldline, head, leaf, blob }) };
}

function textWindow(
  state: GraphRopeRuntimeState,
  input: GraphRopeTextWindowInput,
): GraphRopeRuntimeResult<GraphRopeTextWindowReading> {
  const head = headById(state, input.basisHeadId);
  if (head === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_HEAD };
  }
  const leafBytes = leafBytesForHead(state, head);
  if (!leafBytes.ok) {
    return leafBytes;
  }
  return textWindowFromLeaf(input, leafBytes.value);
}

function debugRopeShape(state: GraphRopeRuntimeState, headId: string): GraphRopeRuntimeResult<GraphRopeDebugShape> {
  const head = headById(state, headId);
  if (head === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_HEAD };
  }
  const leafBytes = leafBytesForHead(state, head);
  if (!leafBytes.ok) {
    return leafBytes;
  }
  const leaf = leafBytes.value.leaf;
  return {
    ok: true,
    value: {
      headId: head.headId,
      rootNodeId: head.rootNodeId,
      byteLength: head.byteLength,
      nodeCount: ONE_VALUE,
      leafCount: ONE_VALUE,
      maxDepth: ZERO_VALUE,
      retainedBlobBytes: leafBytes.value.blob.byteLength,
      materializedProjectionBytes: ZERO_VALUE,
      nodes: [{ nodeId: leaf.nodeId, kind: leaf.kind, byteLength: leaf.byteLength, contentHash: leaf.contentHash }],
    },
  };
}

function textWindowFromLeaf(
  input: GraphRopeTextWindowInput,
  leafBytes: LeafBytes,
): GraphRopeRuntimeResult<GraphRopeTextWindowReading> {
  if (!byteRangeFits(input.byteRange, leafBytes.bytes.length)) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_BYTE_RANGE };
  }
  const requestedBytes = leafBytes.bytes.subarray(input.byteRange.startByte.value, input.byteRange.endByte.value);
  const text = decodeText(requestedBytes);
  if (text === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_UTF8_BOUNDARY };
  }
  return {
    ok: true,
    value: {
      basisHeadId: input.basisHeadId,
      byteRange: input.byteRange,
      cacheStatus: GRAPH_ROPE_TEXT_WINDOW_CACHE_STATUS_UNCACHED,
      text,
      validationEvidence: [{
        leafId: leafBytes.leaf.nodeId,
        blobId: leafBytes.blob.blobId,
        contentHash: leafBytes.blob.contentHash,
        byteRange: input.byteRange,
      }],
    },
  };
}

function createInitialLeaf(blob: TextBlobFact, bytes: Uint8Array, hash: TextBlobHashPort): RopeLeafFact {
  const contentHash = hash.sha256Hex(`${RUNTIME_HASH_PREFIX_LEAF}${blob.contentHash}:${blob.byteLength}`);
  return {
    kind: ROPE_LEAF_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    nodeId: `${RUNTIME_HASH_PREFIX_NODE}${contentHash}`,
    blobId: blob.blobId,
    byteStart: zeroByteOffset(),
    byteLength: blob.byteLength,
    lineCount: lineCountForBytes(bytes),
    contentHash,
  };
}

function createInitialHead(worldlineId: string, leaf: RopeLeafFact, hash: TextBlobHashPort): RopeHeadFact {
  const contentHash = hash.sha256Hex(`${RUNTIME_HASH_PREFIX_HEAD}${leaf.contentHash}:${leaf.byteLength}`);
  return {
    kind: ROPE_HEAD_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    headId: `${RUNTIME_HASH_PREFIX_HEAD_ID}${contentHash}`,
    worldlineId,
    rootNodeId: leaf.nodeId,
    createdByTickId: tickIdFor(worldlineId, contentHash, hash),
    byteLength: leaf.byteLength,
    lineCount: leaf.lineCount,
    contentHash,
  };
}

function createWorldline(worldlineId: string, head: RopeHeadFact, hash: TextBlobHashPort): BufferWorldlineFact {
  return {
    kind: BUFFER_WORLDLINE_FACT_KIND,
    schemaVersion: GRAPH_ROPE_SCHEMA_VERSION,
    worldlineId,
    createdAtTick: tickIdFor(worldlineId, head.contentHash, hash),
    initialHeadId: head.headId,
  };
}

function admitFacts(
  state: GraphRopeRuntimeState,
  facts: readonly RopeAdmittedFact[],
): GraphRopeRuntimeObstructionCode | null {
  const context = validationContext(state, facts);
  for (const fact of facts) {
    const result = validateRopeFact(fact, context);
    if (!result.ok) {
      return GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT;
    }
  }
  for (const fact of facts) {
    state.factsById.set(ropeFactId(fact), cloneFact(fact));
  }
  return null;
}

function cloneCreateWorldlineResult(result: GraphRopeCreateWorldlineResult): GraphRopeCreateWorldlineResult {
  return {
    worldline: cloneFact(result.worldline),
    head: cloneFact(result.head),
    leaf: cloneFact(result.leaf),
    blob: cloneFact(result.blob),
  };
}

function cloneFact<TFact>(fact: TFact): TFact {
  return structuredClone(fact);
}

function validationContext(
  state: GraphRopeRuntimeState,
  writeSet: readonly RopeAdmittedFact[],
): RopeFactValidationContext {
  return {
    writeSet,
    admittedBasis: {
      getFact(id) {
        return state.factsById.get(id) ?? null;
      },
    },
    blobStore: {
      readBlobBytes() {
        return null;
      },
    },
    hash: state.hash,
  };
}

function leafBytesForHead(state: GraphRopeRuntimeState, head: RopeHeadFact): GraphRopeRuntimeResult<LeafBytes> {
  const leaf = leafById(state, head.rootNodeId);
  if (leaf === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_NODE };
  }
  const blob = blobById(state, leaf.blobId);
  if (blob === null || blob.storage.kind !== INLINE_UTF8_BYTES_STORAGE_KIND) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_BLOB };
  }
  return { ok: true, value: { leaf, blob, bytes: blob.storage.bytes } };
}

function headById(state: GraphRopeRuntimeState, headId: string): RopeHeadFact | null {
  const fact = state.factsById.get(headId);
  return fact?.kind === ROPE_HEAD_FACT_KIND ? fact : null;
}

function leafById(state: GraphRopeRuntimeState, nodeId: string): RopeLeafFact | null {
  const fact = state.factsById.get(nodeId);
  return fact?.kind === ROPE_LEAF_FACT_KIND ? fact : null;
}

function blobById(state: GraphRopeRuntimeState, blobId: string): TextBlobFact | null {
  const fact = state.factsById.get(blobId);
  return fact?.kind === TEXT_BLOB_FACT_KIND ? fact : null;
}

function tickIdFor(worldlineId: string, contentHash: string, hash: TextBlobHashPort): string {
  return `${RUNTIME_HASH_PREFIX_TICK}${hash.sha256Hex(`${worldlineId}:${contentHash}`)}`;
}

function zeroByteOffset(): ByteOffset {
  const byteStart = makeByteOffset(ZERO_VALUE);
  if (byteStart.ok) {
    return byteStart.value;
  }
  return { kind: BYTE_OFFSET_COORDINATE_KIND, value: ZERO_VALUE };
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

function byteRangeFits(byteRange: TextByteRange, byteLength: number): boolean {
  return byteRange.startByte.value <= byteLength && byteRange.endByte.value <= byteLength;
}

function isLogicalLineBreak(bytes: Uint8Array, index: number): boolean {
  if (bytes[index] === LINE_FEED_BYTE) {
    return bytes[index - ONE_VALUE] !== CARRIAGE_RETURN_BYTE;
  }
  return bytes[index] === CARRIAGE_RETURN_BYTE;
}

function decodeText(bytes: Uint8Array): string | null {
  try {
    return TEXT_DECODER.decode(bytes);
  } catch {
    return null;
  }
}
