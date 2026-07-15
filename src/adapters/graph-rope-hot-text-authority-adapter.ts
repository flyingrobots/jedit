import {
  closeEditGroup as closeDomainEditGroup,
  createEditGroupState,
  includeTickInOpenGroup as includeDomainTickInOpenGroup,
  openEditGroup as openDomainEditGroup,
  type EditGroupState,
  type OpenEditGroup,
} from '../domain/edit-group-contract.js';
import {
  makeByteOffset,
  makeTextByteRange,
} from '../domain/graph-rope-coordinates.js';
import type {
  EchoCausalAnchorAdmissionPort,
  RopeCheckpointAnchoredFact,
  RopeCheckpointFact,
  RopeCheckpointReason,
  RopeHeadFact,
  TextByteRange,
} from '../domain/graph-rope-contract.js';
import {
  ROPE_CHECKPOINT_REASON_AUTOSAVE,
  ROPE_CHECKPOINT_REASON_IMPORT,
  ROPE_CHECKPOINT_REASON_MANUAL_SAVE,
} from '../domain/graph-rope-contract.js';
import {
  createGraphRopeRuntime,
  GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT,
  type GraphRopeDebugShape,
  type GraphRopeReplaceRangeResult,
  type GraphRopeRuntime,
  type GraphRopeRuntimeObstructionCode,
  type GraphRopeRuntimeResult,
  type GraphRopeTextWindowReading,
} from '../domain/graph-rope-runtime.js';
import {
  FIRST_ROOT_ID,
  createBufferRoot,
  materializeRoot,
  type TextRange,
} from '../domain/text-edit-contract.js';
import { toWorldlineId } from '../app/jedit-contract-runtime-id.js';
import type { HashPort } from '../ports/hash.js';
import {
  GRAPH_BACKED_ROPE_TEXT_AUTHORITY_KIND,
  type AdmitReplaceRangeTickResult,
  type CloseEditGroupResult,
  type GraphBackedRopeTextAuthority,
  type HotTextAuthorityBasis,
  type HotTextAuthorityTransition,
  type HotTextBufferState,
  type HotTextWindowProjection,
  type HotTextWindowRequest,
  type SaveHotCheckpointRequest,
  type SaveHotCheckpointResult,
} from '../ports/hot-text-runtime.js';

const CREATE_BUFFER_OPERATION = 'createBuffer';
const REPLACE_RANGE_OPERATION = 'admitReplaceRangeTick';
const TEXT_WINDOW_OPERATION = 'textWindow';
const SAVE_CHECKPOINT_OPERATION = 'saveCheckpoint';
const GRAPH_ROPE_OBSTRUCTION_MESSAGE = 'Graph rope text authority operation was obstructed';
const GRAPH_ROPE_STATE_MESSAGE = 'Graph rope text authority received invalid compatibility state';
const GRAPH_ROPE_STATE_MISSING_BASIS = 'missing-authority-basis';
const GRAPH_ROPE_STATE_INVALID_RANGE = 'invalid-byte-range';
const GRAPH_ROPE_STATE_INCOMPLETE_TRANSITION = 'incomplete-authority-transition';
const GRAPH_ROPE_STATE_PROJECTION_MISMATCH = 'projection-basis-mismatch';
const ROOT_IDS_PER_EDIT = 2;
const NEXT_PROJECTION_ROOT_OFFSET = 1;
const NEXT_TICK_OFFSET = 1;
const NEXT_CHECKPOINT_OFFSET = 1;
const ZERO_BYTE_OFFSET = 0;
const INITIAL_CHECKPOINT_KIND = 'INITIAL';
const MANUAL_SAVE_CHECKPOINT_KIND = 'MANUAL_SAVE';
const AUTO_SAVE_CHECKPOINT_KIND = 'AUTO_SAVE';

type GraphRopeTextAuthorityStateCode =
  | typeof GRAPH_ROPE_STATE_MISSING_BASIS
  | typeof GRAPH_ROPE_STATE_INVALID_RANGE
  | typeof GRAPH_ROPE_STATE_INCOMPLETE_TRANSITION
  | typeof GRAPH_ROPE_STATE_PROJECTION_MISMATCH;

type GraphRopeAuthorityOperation =
  | typeof CREATE_BUFFER_OPERATION
  | typeof REPLACE_RANGE_OPERATION
  | typeof TEXT_WINDOW_OPERATION
  | typeof SAVE_CHECKPOINT_OPERATION;

export interface CreateGraphRopeHotTextAuthorityOptions {
  readonly hash: HashPort;
  readonly causalAnchorAdmission?: EchoCausalAnchorAdmissionPort;
}

export interface GraphRopeHotTextAuthority extends GraphBackedRopeTextAuthority {
  debugRopeShape(headId: string): GraphRopeRuntimeResult<GraphRopeDebugShape>;
}

export class GraphRopeTextAuthorityObstructionError extends Error {
  public readonly operation: GraphRopeAuthorityOperation;
  public readonly obstructionCode: GraphRopeRuntimeObstructionCode;

  public constructor(
    operation: GraphRopeAuthorityOperation,
    obstructionCode: GraphRopeRuntimeObstructionCode,
  ) {
    super(`${GRAPH_ROPE_OBSTRUCTION_MESSAGE}: ${operation} (${obstructionCode}).`);
    this.name = 'GraphRopeTextAuthorityObstructionError';
    this.operation = operation;
    this.obstructionCode = obstructionCode;
  }
}

export class GraphRopeTextAuthorityStateError extends Error {
  public readonly code: GraphRopeTextAuthorityStateCode;

  public constructor(code: GraphRopeTextAuthorityStateCode) {
    super(`${GRAPH_ROPE_STATE_MESSAGE}: ${code}.`);
    this.name = 'GraphRopeTextAuthorityStateError';
    this.code = code;
  }
}

export function createGraphRopeHotTextAuthority(
  options: CreateGraphRopeHotTextAuthorityOptions,
): GraphRopeHotTextAuthority {
  return new GraphRopeHotTextAuthorityAdapter(createGraphRopeRuntime({
    hash: options.hash,
    causalAnchorAdmission: options.causalAnchorAdmission,
  }));
}

class GraphRopeHotTextAuthorityAdapter implements GraphRopeHotTextAuthority {
  public readonly textAuthorityKind: typeof GRAPH_BACKED_ROPE_TEXT_AUTHORITY_KIND = GRAPH_BACKED_ROPE_TEXT_AUTHORITY_KIND;
  public readonly isProductionSafe: true = true;

  public constructor(private readonly graph: GraphRopeRuntime) {}

  public createBuffer(path: string, initialText: string): HotTextBufferState {
    const created = this.graph.createBufferWorldline({
      worldlineId: toWorldlineId(path),
      initialText,
    });
    if (!created.ok) {
      throw new GraphRopeTextAuthorityObstructionError(CREATE_BUFFER_OPERATION, created.code);
    }
    return initialProjection(path, initialText, authorityBasis(created.value.head));
  }

  public materialize(state: HotTextBufferState): string {
    return materializeRoot(state.currentRoot);
  }

  public textWindow(_state: HotTextBufferState, request: HotTextWindowRequest): HotTextWindowProjection {
    const reading = this.graph.textWindow({
      basisHeadId: request.basisHeadId,
      byteRange: graphWindowByteRange(request.byteRange),
    });
    if (!reading.ok) {
      throw new GraphRopeTextAuthorityObstructionError(TEXT_WINDOW_OPERATION, reading.code);
    }
    return graphWindowProjection(request, reading.value);
  }

  public admitReplaceRangeTick(
    state: HotTextBufferState,
    range: TextRange,
    text: string,
  ): AdmitReplaceRangeTickResult {
    const basis = requireAuthorityBasis(state);
    const replaced = this.graph.replaceRangeAsTick({
      basisHeadId: basis.headId,
      range: graphByteRange(range),
      replacementText: text,
    });
    if (!replaced.ok) {
      throw new GraphRopeTextAuthorityObstructionError(REPLACE_RANGE_OPERATION, replaced.code);
    }
    return replaced.value.changed
      ? changedReplaceResult(this.graph, state, range, replaced.value)
      : { nextState: state };
  }

  public openEditGroup(state: HotTextBufferState): HotTextBufferState {
    return withEditGroupState(state, openDomainEditGroup(toEditGroupState(state)));
  }

  public includeTickInOpenGroup(state: HotTextBufferState, tickId: number): HotTextBufferState {
    return withEditGroupState(
      state,
      includeDomainTickInOpenGroup(toEditGroupState(state), tickId),
    );
  }

  public closeEditGroup(state: HotTextBufferState): CloseEditGroupResult {
    return closeEditGroup(state);
  }

  public saveCheckpoint(
    state: HotTextBufferState,
    request: SaveHotCheckpointRequest,
  ): SaveHotCheckpointResult {
    return saveGraphCheckpoint(this.graph, state, request);
  }

  public debugRopeShape(headId: string): GraphRopeRuntimeResult<GraphRopeDebugShape> {
    return this.graph.debugRopeShape(headId);
  }
}

function saveGraphCheckpoint(
  graph: GraphRopeRuntime,
  state: HotTextBufferState,
  request: SaveHotCheckpointRequest,
): SaveHotCheckpointResult {
  const basis = requireAuthorityBasis(state);
  const checkpoint = requireCheckpoint(graph.createCheckpoint({
    worldlineId: basis.worldlineId,
    headId: basis.headId,
    reason: checkpointReason(request),
  }));
  const existing = state.checkpoints.find((entry) => entry.authorityCheckpointId === checkpoint.checkpointId);
  if (existing != null) {
    return { nextState: state, checkpointDeclaration: checkpoint };
  }
  const association = checkpointRequiresAnchor(request)
    ? requireCheckpointAnchor(graph.anchorCheckpoint({ checkpointId: checkpoint.checkpointId }))
    : undefined;
  return admittedCheckpointResult(state, checkpoint, association);
}

function requireCheckpoint(
  result: GraphRopeRuntimeResult<{ readonly checkpoint: RopeCheckpointFact }>,
): RopeCheckpointFact {
  if (!result.ok) {
    throw new GraphRopeTextAuthorityObstructionError(SAVE_CHECKPOINT_OPERATION, result.code);
  }
  return result.value.checkpoint;
}

function requireCheckpointAnchor(
  result: GraphRopeRuntimeResult<{ readonly association: RopeCheckpointAnchoredFact }>,
): RopeCheckpointAnchoredFact {
  if (!result.ok) {
    throw new GraphRopeTextAuthorityObstructionError(SAVE_CHECKPOINT_OPERATION, result.code);
  }
  return result.value.association;
}

function admittedCheckpointResult(
  state: HotTextBufferState,
  checkpoint: RopeCheckpointFact,
  association: RopeCheckpointAnchoredFact | undefined,
): SaveHotCheckpointResult {
  const id = state.checkpoints.length + NEXT_CHECKPOINT_OFFSET;
  const saved = { id, rootId: state.currentRoot.id, path: state.path, authorityCheckpointId: checkpoint.checkpointId };
  return {
    nextState: { ...state, checkpoints: [...state.checkpoints, saved] },
    receipt: { checkpointId: id, rootId: saved.rootId, path: saved.path, authorityCheckpointId: checkpoint.checkpointId },
    checkpointDeclaration: checkpoint,
    anchorAssociation: association,
  };
}

function checkpointReason(request: SaveHotCheckpointRequest): RopeCheckpointReason {
  switch (request.kind) {
    case INITIAL_CHECKPOINT_KIND:
      return ROPE_CHECKPOINT_REASON_IMPORT;
    case MANUAL_SAVE_CHECKPOINT_KIND:
      return ROPE_CHECKPOINT_REASON_MANUAL_SAVE;
    case AUTO_SAVE_CHECKPOINT_KIND:
      return ROPE_CHECKPOINT_REASON_AUTOSAVE;
    default:
      return rejectUnsupportedCheckpointKind(request.kind);
  }
}

function rejectUnsupportedCheckpointKind(kind: never): never {
  void kind;
  throw new GraphRopeTextAuthorityObstructionError(
    SAVE_CHECKPOINT_OPERATION,
    GRAPH_ROPE_RUNTIME_OBSTRUCTION_INVALID_FACT,
  );
}

function checkpointRequiresAnchor(request: SaveHotCheckpointRequest): boolean {
  return request.kind !== INITIAL_CHECKPOINT_KIND;
}

function initialProjection(
  path: string,
  initialText: string,
  basis: HotTextAuthorityBasis,
): HotTextBufferState {
  const currentRoot = createBufferRoot(FIRST_ROOT_ID, initialText);
  return {
    path,
    authorityBasis: basis,
    currentRoot,
    ticks: [],
    editGroups: [],
    checkpoints: [],
    nextRootId: FIRST_ROOT_ID + 1,
  };
}

function authorityBasis(head: RopeHeadFact): HotTextAuthorityBasis {
  return {
    worldlineId: head.worldlineId,
    headId: head.headId,
    rootNodeId: head.rootNodeId,
    createdByTickId: head.createdByTickId,
    byteLength: head.byteLength,
    lineCount: head.lineCount,
    contentHash: head.contentHash,
  };
}

function requireAuthorityBasis(state: HotTextBufferState): HotTextAuthorityBasis {
  if (state.authorityBasis == null) {
    throw new GraphRopeTextAuthorityStateError(GRAPH_ROPE_STATE_MISSING_BASIS);
  }
  return state.authorityBasis;
}

function graphByteRange(range: TextRange): TextByteRange {
  return graphWindowByteRange({ startByte: range.start.byte, endByte: range.end.byte });
}

function graphWindowByteRange(range: HotTextWindowRequest['byteRange']): TextByteRange {
  const start = makeByteOffset(range.startByte);
  const end = makeByteOffset(range.endByte);
  if (!start.ok || !end.ok) {
    throw new GraphRopeTextAuthorityStateError(GRAPH_ROPE_STATE_INVALID_RANGE);
  }
  const graphRange = makeTextByteRange(start.value, end.value);
  if (!graphRange.ok) {
    throw new GraphRopeTextAuthorityStateError(GRAPH_ROPE_STATE_INVALID_RANGE);
  }
  return graphRange.value;
}

function graphWindowProjection(
  request: HotTextWindowRequest,
  reading: GraphRopeTextWindowReading,
): HotTextWindowProjection {
  if (!windowReadingMatchesRequest(request, reading)) {
    throw new GraphRopeTextAuthorityStateError(GRAPH_ROPE_STATE_PROJECTION_MISMATCH);
  }
  return {
    basisHeadId: reading.basisHeadId,
    byteRange: request.byteRange,
    text: reading.text,
    support: reading.validationEvidence.map((evidence) => ({
      leafId: evidence.leafId,
      blobId: evidence.blobId,
      contentHash: evidence.contentHash,
      byteRange: {
        startByte: evidence.byteRange.startByte.value,
        endByte: evidence.byteRange.endByte.value,
      },
    })),
  };
}

function windowReadingMatchesRequest(
  request: HotTextWindowRequest,
  reading: GraphRopeTextWindowReading,
): boolean {
  return reading.basisHeadId === request.basisHeadId
    && reading.byteRange.startByte.value === request.byteRange.startByte
    && reading.byteRange.endByte.value === request.byteRange.endByte;
}

function changedReplaceResult(
  graph: GraphRopeRuntime,
  state: HotTextBufferState,
  range: TextRange,
  replaced: GraphRopeReplaceRangeResult,
): AdmitReplaceRangeTickResult {
  const transition = authorityTransition(replaced);
  const projectionText = materializeGraphHead(graph, replaced.nextHead);
  const tickId = state.ticks.length + NEXT_TICK_OFFSET;
  const nextRootId = state.nextRootId + NEXT_PROJECTION_ROOT_OFFSET;
  const nextRoot = createBufferRoot(nextRootId, projectionText);
  return {
    nextState: nextProjectionState(state, nextRoot, tickId, transition.nextBasis),
    receipt: {
      tickId,
      replaceReceipt: {
        baseRootId: state.currentRoot.id,
        nextRootId,
        replaced: range,
        insertedRootId: state.nextRootId,
      },
    },
    authorityTransition: transition,
  };
}

function authorityTransition(replaced: GraphRopeReplaceRangeResult): HotTextAuthorityTransition {
  if (replaced.rewrite == null || replaced.diff == null || replaced.receipt == null) {
    throw new GraphRopeTextAuthorityStateError(GRAPH_ROPE_STATE_INCOMPLETE_TRANSITION);
  }
  return {
    tickId: replaced.receipt.tickId,
    admissionId: replaced.receipt.admissionId,
    rewriteId: replaced.rewrite.rewriteId,
    diffId: replaced.diff.diffId,
    admittedAtSequence: replaced.receipt.admittedAtSequence,
    nextBasis: authorityBasis(replaced.nextHead),
  };
}

function materializeGraphHead(graph: GraphRopeRuntime, head: RopeHeadFact): string {
  const reading = graph.textWindow({
    basisHeadId: head.headId,
    byteRange: graphWindowByteRange({ startByte: ZERO_BYTE_OFFSET, endByte: head.byteLength }),
  });
  if (!reading.ok) {
    throw new GraphRopeTextAuthorityObstructionError(REPLACE_RANGE_OPERATION, reading.code);
  }
  return reading.value.text;
}

function nextProjectionState(
  state: HotTextBufferState,
  currentRoot: HotTextBufferState['currentRoot'],
  tickId: number,
  basis: HotTextAuthorityBasis,
): HotTextBufferState {
  return {
    ...state,
    authorityBasis: basis,
    currentRoot,
    ticks: [...state.ticks, { id: tickId, rootId: currentRoot.id }],
    editGroups: [...state.editGroups],
    openEditGroup: state.openEditGroup == null ? undefined : copyOpenEditGroup(state.openEditGroup),
    checkpoints: [...state.checkpoints],
    nextRootId: state.nextRootId + ROOT_IDS_PER_EDIT,
  };
}

function toEditGroupState(state: HotTextBufferState): EditGroupState {
  const base = createEditGroupState(
    state.ticks.map((tick) => tick.id),
    state.editGroups,
  );
  if (state.openEditGroup == null) {
    return base;
  }
  return {
    ...base,
    openGroup: copyOpenEditGroup(state.openEditGroup),
  };
}

function closeEditGroup(state: HotTextBufferState): CloseEditGroupResult {
  const result = closeDomainEditGroup(toEditGroupState(state));
  return {
    nextState: withEditGroupState(state, result.nextState),
    receipt: result.receipt,
  };
}

function withEditGroupState(
  state: HotTextBufferState,
  next: EditGroupState,
): HotTextBufferState {
  return {
    ...state,
    ticks: [...state.ticks],
    editGroups: [...next.groups],
    openEditGroup: next.openGroup == null
      ? undefined
      : copyOpenEditGroup(next.openGroup),
    checkpoints: [...state.checkpoints],
  };
}

function copyOpenEditGroup(group: OpenEditGroup): OpenEditGroup {
  return {
    id: group.id,
    tickIds: [...group.tickIds],
  };
}
