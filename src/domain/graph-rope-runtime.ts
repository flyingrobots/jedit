import {
  BUFFER_WORLDLINE_FACT_KIND,
  GRAPH_ROPE_SCHEMA_VERSION,
  ROPE_CHECKPOINT_FACT_KIND,
  ROPE_HEAD_FACT_KIND,
  makeTextBlobFact,
  ropeFactId,
  validateRopeFact,
  type BufferWorldlineFact,
  type EchoCausalAnchorAdmissionPort,
  type RopeAdmittedFact,
  type RopeCheckpointFact,
  type RopeDiffFact,
  type RopeFactValidationContext,
  type RopeHeadFact,
  type RopeRewriteFact,
  type TextBlobFact,
  type TextBlobHashPort,
  type TextByteRange,
  type TickReceiptFact,
} from './graph-rope-contract.js';
import { validateCheckpointAnchorAdmissionRequest } from './graph-rope-causal-anchor-validation.js';
import {
  createCheckpointAnchorAdmissionRequest,
  createCheckpointAnchorAssociation,
  createCheckpointFact,
  type GraphRopeAnchorCheckpointInput,
  type GraphRopeAnchorCheckpointResult,
  type GraphRopeCreateCheckpointInput,
  type GraphRopeCreateCheckpointResult,
} from './graph-rope-runtime-checkpoint.js';
import { requestCheckpointAnchorAdmission } from './graph-rope-runtime-echo-adapter.js';
import {
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_CAUSAL_ANCHOR_ADMISSION_FAILED,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_CAUSAL_ANCHOR_UNAVAILABLE,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_UTF8_BOUNDARY,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CHECKPOINT,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_HEAD,
  GRAPH_ROPE_TEXT_WINDOW_CACHE_STATUS_UNCACHED,
  type GraphRopeRuntimeObstructionCode,
} from './graph-rope-runtime-issues.js';
import {
  createInitialHead,
  createInitialTree,
  debugTreeShape,
  readTreeWindow,
  replaceRangeInTree,
  type GraphRopeReplacePlan,
  type GraphRopeRuntimeFactReader,
  type NodeRef,
  type RopeNodeFact,
} from './graph-rope-runtime-tree.js';

export {
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_BYTE_RANGE,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_UTF8_BOUNDARY,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_BLOB,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CHECKPOINT,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_HEAD,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_NODE,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_CAUSAL_ANCHOR_ADMISSION_FAILED,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_CAUSAL_ANCHOR_UNAVAILABLE,
  GRAPH_ROPE_TEXT_WINDOW_CACHE_STATUS_UNCACHED,
} from './graph-rope-runtime-issues.js';
export type { GraphRopeRuntimeObstructionCode } from './graph-rope-runtime-issues.js';
export type {
  GraphRopeAnchorCheckpointInput,
  GraphRopeAnchorCheckpointResult,
  GraphRopeCreateCheckpointInput,
  GraphRopeCreateCheckpointResult,
} from './graph-rope-runtime-checkpoint.js';

const ONE_VALUE = 1;
const INITIAL_ADMISSION_SEQUENCE = 1;
const RUNTIME_HASH_PREFIX_TICK = 'tick:';
const TEXT_ENCODER = new TextEncoder();

export type GraphRopeRuntimeResult<TValue> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly code: GraphRopeRuntimeObstructionCode };

export interface CreateGraphRopeRuntimeInput {
  readonly hash: TextBlobHashPort;
  readonly causalAnchorAdmission?: EchoCausalAnchorAdmissionPort;
}

export interface CreateBufferWorldlineInput {
  readonly worldlineId: string;
  readonly initialText: string;
}

export interface GraphRopeCreateWorldlineResult {
  readonly worldline: BufferWorldlineFact;
  readonly head: RopeHeadFact;
  readonly rootNodeId: string;
  readonly nodes: readonly RopeNodeFact[];
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

export interface GraphRopeReplaceRangeInput {
  readonly basisHeadId: string;
  readonly range: TextByteRange;
  readonly replacementText: string;
}

export interface GraphRopeReplaceRangeResult {
  readonly changed: boolean;
  readonly basisHead: RopeHeadFact;
  readonly nextHead: RopeHeadFact;
  readonly replacementBlob: TextBlobFact | null;
  readonly rewrite: RopeRewriteFact | null;
  readonly diff: RopeDiffFact | null;
  readonly receipt: TickReceiptFact | null;
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
  readonly kind: RopeNodeFact['kind'];
  readonly byteLength: number;
  readonly contentHash: string;
}

export interface GraphRopeRuntime {
  createBufferWorldline(input: CreateBufferWorldlineInput): GraphRopeRuntimeResult<GraphRopeCreateWorldlineResult>;
  replaceRangeAsTick(input: GraphRopeReplaceRangeInput): GraphRopeRuntimeResult<GraphRopeReplaceRangeResult>;
  createCheckpoint(input: GraphRopeCreateCheckpointInput): GraphRopeRuntimeResult<GraphRopeCreateCheckpointResult>;
  anchorCheckpoint(input: GraphRopeAnchorCheckpointInput): GraphRopeRuntimeResult<GraphRopeAnchorCheckpointResult>;
  textWindow(input: GraphRopeTextWindowInput): GraphRopeRuntimeResult<GraphRopeTextWindowReading>;
  debugRopeShape(headId: string): GraphRopeRuntimeResult<GraphRopeDebugShape>;
}

interface GraphRopeRuntimeState extends GraphRopeRuntimeFactReader {
  readonly hash: TextBlobHashPort;
  readonly causalAnchorAdmission: EchoCausalAnchorAdmissionPort | null;
  readonly factsById: Map<string, RopeAdmittedFact>;
  readonly currentHeadByWorldlineId: Map<string, string>;
  nextAdmissionSequence: number;
}

interface CreateWorldlineFacts extends GraphRopeCreateWorldlineResult {
  readonly root: NodeRef;
}

export function createGraphRopeRuntime(input: CreateGraphRopeRuntimeInput): GraphRopeRuntime {
  const factsById = new Map<string, RopeAdmittedFact>();
  const state: GraphRopeRuntimeState = {
    hash: input.hash,
    causalAnchorAdmission: input.causalAnchorAdmission ?? null,
    factsById,
    currentHeadByWorldlineId: new Map<string, string>(),
    nextAdmissionSequence: INITIAL_ADMISSION_SEQUENCE,
    getFact(id) {
      return factsById.get(id) ?? null;
    },
  };

  return {
    createBufferWorldline(createInput) {
      return createBufferWorldline(state, createInput);
    },
    replaceRangeAsTick(replaceInput) {
      return replaceRangeAsTick(state, replaceInput);
    },
    createCheckpoint(checkpointInput) {
      return createCheckpoint(state, checkpointInput);
    },
    anchorCheckpoint(anchorInput) {
      return anchorCheckpoint(state, anchorInput);
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
  if (state.currentHeadByWorldlineId.has(input.worldlineId) || state.factsById.has(input.worldlineId)) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT };
  }
  const bytes = TEXT_ENCODER.encode(input.initialText);
  const blobResult = makeTextBlobFact({ bytes, hash: state.hash });
  if (!blobResult.ok) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_UTF8_BOUNDARY };
  }
  const facts = createWorldlineFacts(input.worldlineId, blobResult.fact, bytes, state.hash);
  const admissionIssue = admitFacts(state, [facts.blob, ...facts.nodes, facts.head, facts.worldline]);
  if (admissionIssue !== null) {
    return { ok: false, code: admissionIssue };
  }
  state.currentHeadByWorldlineId.set(input.worldlineId, facts.head.headId);
  return { ok: true, value: cloneCreateWorldlineResult(facts) };
}

function replaceRangeAsTick(
  state: GraphRopeRuntimeState,
  input: GraphRopeReplaceRangeInput,
): GraphRopeRuntimeResult<GraphRopeReplaceRangeResult> {
  const basisHead = headById(state, input.basisHeadId);
  if (basisHead === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_HEAD };
  }
  const plan = replaceRangeInTree({
    basisHead,
    range: input.range,
    replacementText: input.replacementText,
    hash: state.hash,
    sequence: state.nextAdmissionSequence,
    reader: state,
  });
  return plan.ok ? admitReplacePlan(state, plan.value) : plan;
}

function createCheckpoint(
  state: GraphRopeRuntimeState,
  input: GraphRopeCreateCheckpointInput,
): GraphRopeRuntimeResult<GraphRopeCreateCheckpointResult> {
  const head = headById(state, input.headId);
  if (head === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_HEAD };
  }
  if (head.worldlineId !== input.worldlineId) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT };
  }
  const checkpoint = createCheckpointFact(head, input.reason, state.hash);
  const admissionIssue = admitFacts(state, [checkpoint]);
  if (admissionIssue !== null) {
    return { ok: false, code: admissionIssue };
  }
  return { ok: true, value: cloneCheckpointResult({ head, checkpoint }) };
}

function anchorCheckpoint(
  state: GraphRopeRuntimeState,
  input: GraphRopeAnchorCheckpointInput,
): GraphRopeRuntimeResult<GraphRopeAnchorCheckpointResult> {
  const checkpoint = checkpointById(state, input.checkpointId);
  if (checkpoint === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_CHECKPOINT };
  }
  const head = headById(state, checkpoint.headId);
  if (head === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_HEAD };
  }
  const request = createCheckpointAnchorAdmissionRequest(checkpoint, input.materializationRoots);
  if (request === null || validateCheckpointAnchorAdmissionRequest(request) !== null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT };
  }
  if (state.causalAnchorAdmission === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_CAUSAL_ANCHOR_UNAVAILABLE };
  }
  const evidence = requestCheckpointAnchorAdmission(state.causalAnchorAdmission, request);
  if (evidence === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_CAUSAL_ANCHOR_ADMISSION_FAILED };
  }
  const association = createCheckpointAnchorAssociation(checkpoint, evidence, state.hash);
  const admissionIssue = admitFacts(state, [association]);
  if (admissionIssue !== null) {
    return { ok: false, code: admissionIssue };
  }
  return {
    ok: true,
    value: cloneAnchorCheckpointResult({ head, checkpoint, echoEvidence: evidence, association }),
  };
}

function textWindow(
  state: GraphRopeRuntimeState,
  input: GraphRopeTextWindowInput,
): GraphRopeRuntimeResult<GraphRopeTextWindowReading> {
  const head = headById(state, input.basisHeadId);
  if (head === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_HEAD };
  }
  const reading = readTreeWindow(state, head, input.byteRange);
  if (!reading.ok) {
    return reading;
  }
  return {
    ok: true,
    value: {
      basisHeadId: input.basisHeadId,
      byteRange: input.byteRange,
      cacheStatus: GRAPH_ROPE_TEXT_WINDOW_CACHE_STATUS_UNCACHED,
      text: reading.value.text,
      validationEvidence: reading.value.validationEvidence,
    },
  };
}

function debugRopeShape(state: GraphRopeRuntimeState, headId: string): GraphRopeRuntimeResult<GraphRopeDebugShape> {
  const head = headById(state, headId);
  if (head === null) {
    return { ok: false, code: GRAPH_ROPE_RUNTIME_OBSTRUCTION_MISSING_HEAD };
  }
  const shape = debugTreeShape(state, head);
  if (!shape.ok) {
    return shape;
  }
  return { ok: true, value: { headId: head.headId, rootNodeId: head.rootNodeId, byteLength: head.byteLength, ...shape.value } };
}

function createWorldlineFacts(worldlineId: string, blob: TextBlobFact, bytes: Uint8Array, hash: TextBlobHashPort): CreateWorldlineFacts {
  const tree = createInitialTree(blob, bytes, hash);
  const head = createInitialHead(worldlineId, tree.root, hash);
  return { worldline: createWorldline(worldlineId, head, hash), head, root: tree.root, rootNodeId: tree.root.nodeId, nodes: tree.facts, blob };
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

function admitReplacePlan(
  state: GraphRopeRuntimeState,
  plan: GraphRopeReplacePlan,
): GraphRopeRuntimeResult<GraphRopeReplaceRangeResult> {
  if (!plan.changed) {
    return { ok: true, value: cloneReplaceResult(noopReplaceResult(plan.basisHead)) };
  }
  const admissionIssue = admitFacts(state, plan.facts);
  if (admissionIssue !== null) {
    return { ok: false, code: admissionIssue };
  }
  state.nextAdmissionSequence += ONE_VALUE;
  state.currentHeadByWorldlineId.set(plan.nextHead.worldlineId, plan.nextHead.headId);
  return { ok: true, value: cloneReplaceResult(changedReplaceResult(plan)) };
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

function noopReplaceResult(head: RopeHeadFact): GraphRopeReplaceRangeResult {
  return { changed: false, basisHead: head, nextHead: head, replacementBlob: null, rewrite: null, diff: null, receipt: null };
}

function changedReplaceResult(plan: Extract<GraphRopeReplacePlan, { readonly changed: true }>): GraphRopeReplaceRangeResult {
  return {
    changed: true,
    basisHead: plan.basisHead,
    nextHead: plan.nextHead,
    replacementBlob: plan.replacementBlob,
    rewrite: plan.rewrite,
    diff: plan.diff,
    receipt: plan.receipt,
  };
}

function cloneCreateWorldlineResult(result: GraphRopeCreateWorldlineResult): GraphRopeCreateWorldlineResult {
  return {
    worldline: cloneFact(result.worldline),
    head: cloneFact(result.head),
    rootNodeId: result.rootNodeId,
    nodes: result.nodes.map((node) => cloneFact(node)),
    blob: cloneFact(result.blob),
  };
}

function cloneReplaceResult(result: GraphRopeReplaceRangeResult): GraphRopeReplaceRangeResult {
  return {
    changed: result.changed,
    basisHead: cloneFact(result.basisHead),
    nextHead: cloneFact(result.nextHead),
    replacementBlob: nullableClone(result.replacementBlob),
    rewrite: nullableClone(result.rewrite),
    diff: nullableClone(result.diff),
    receipt: nullableClone(result.receipt),
  };
}

function cloneCheckpointResult(result: GraphRopeCreateCheckpointResult): GraphRopeCreateCheckpointResult {
  return {
    head: cloneFact(result.head),
    checkpoint: cloneFact(result.checkpoint),
  };
}

function cloneAnchorCheckpointResult(result: GraphRopeAnchorCheckpointResult): GraphRopeAnchorCheckpointResult {
  return {
    head: cloneFact(result.head),
    checkpoint: cloneFact(result.checkpoint),
    echoEvidence: cloneFact(result.echoEvidence),
    association: cloneFact(result.association),
  };
}

function cloneFact<TFact>(fact: TFact): TFact {
  return structuredClone(fact);
}

function nullableClone<TValue>(value: TValue | null): TValue | null {
  return value === null ? null : cloneFact(value);
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

function headById(state: GraphRopeRuntimeState, headId: string): RopeHeadFact | null {
  const fact = state.factsById.get(headId);
  return fact?.kind === ROPE_HEAD_FACT_KIND ? fact : null;
}

function checkpointById(state: GraphRopeRuntimeState, checkpointId: string): RopeCheckpointFact | null {
  const fact = state.factsById.get(checkpointId);
  return fact?.kind === ROPE_CHECKPOINT_FACT_KIND ? fact : null;
}

function tickIdFor(worldlineId: string, contentHash: string, hash: TextBlobHashPort): string {
  return `${RUNTIME_HASH_PREFIX_TICK}${hash.sha256Hex(`${worldlineId}:${contentHash}`)}`;
}
