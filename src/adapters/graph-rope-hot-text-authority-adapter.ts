import {
  closeEditGroup as closeDomainEditGroup,
  createEditGroupState,
  includeTickInOpenGroup as includeDomainTickInOpenGroup,
  openEditGroup as openDomainEditGroup,
  type EditGroupState,
  type OpenEditGroup,
} from '../domain/edit-group-contract.js';
import {
  createGraphRopeRuntime,
  type GraphRopeRuntime,
  type GraphRopeRuntimeObstructionCode,
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
  type HotTextBufferState,
  type SaveHotCheckpointResult,
} from '../ports/hot-text-runtime.js';

const CREATE_BUFFER_OPERATION = 'createBuffer';
const REPLACE_RANGE_OPERATION = 'admitReplaceRangeTick';
const SAVE_CHECKPOINT_OPERATION = 'saveCheckpoint';
const GRAPH_ROPE_OBSTRUCTION_MESSAGE = 'Graph rope text authority operation was obstructed';
const GRAPH_ROPE_CAPABILITY_MESSAGE = 'Graph rope text authority capability is not installed yet';

type GraphRopeAuthorityOperation =
  | typeof CREATE_BUFFER_OPERATION
  | typeof REPLACE_RANGE_OPERATION
  | typeof SAVE_CHECKPOINT_OPERATION;

export interface CreateGraphRopeHotTextAuthorityOptions {
  readonly hash: HashPort;
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

export class GraphRopeTextAuthorityCapabilityError extends Error {
  public readonly operation: GraphRopeAuthorityOperation;

  public constructor(operation: GraphRopeAuthorityOperation) {
    super(`${GRAPH_ROPE_CAPABILITY_MESSAGE}: ${operation}.`);
    this.name = 'GraphRopeTextAuthorityCapabilityError';
    this.operation = operation;
  }
}

export function createGraphRopeHotTextAuthority(
  options: CreateGraphRopeHotTextAuthorityOptions,
): GraphBackedRopeTextAuthority {
  return new GraphRopeHotTextAuthority(createGraphRopeRuntime({ hash: options.hash }));
}

class GraphRopeHotTextAuthority implements GraphBackedRopeTextAuthority {
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
    return initialProjection(path, initialText);
  }

  public materialize(state: HotTextBufferState): string {
    return materializeRoot(state.currentRoot);
  }

  public admitReplaceRangeTick(
    _state: HotTextBufferState,
    _range: TextRange,
    _text: string,
  ): AdmitReplaceRangeTickResult {
    throw new GraphRopeTextAuthorityCapabilityError(REPLACE_RANGE_OPERATION);
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

  public saveCheckpoint(_state: HotTextBufferState): SaveHotCheckpointResult {
    throw new GraphRopeTextAuthorityCapabilityError(SAVE_CHECKPOINT_OPERATION);
  }
}

function initialProjection(path: string, initialText: string): HotTextBufferState {
  const currentRoot = createBufferRoot(FIRST_ROOT_ID, initialText);
  return {
    path,
    currentRoot,
    roots: [currentRoot],
    ticks: [],
    editGroups: [],
    checkpoints: [],
    nextRootId: FIRST_ROOT_ID + 1,
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
    roots: [...state.roots],
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
