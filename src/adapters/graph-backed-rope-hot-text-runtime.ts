import {
  closeEditGroup as closeDomainEditGroup,
  createEditGroupState,
  includeTickInOpenGroup as includeDomainTickInOpenGroup,
  openEditGroup as openDomainEditGroup,
  type EditGroupState,
} from '../domain/edit-group-contract.js';
import {
  createGraphRopeRuntime,
  type GraphRopeRuntime,
} from '../domain/graph-rope-runtime.js';
import {
  makeByteOffset,
  makeTextByteRange,
  ROPE_CHECKPOINT_REASON_MANUAL_SAVE,
  type TextByteRange,
} from '../domain/graph-rope-contract.js';
import {
  createSaveCheckpointState,
  saveCheckpoint as saveDomainCheckpoint,
  type SaveCheckpointState,
} from '../domain/save-checkpoint-contract.js';
import {
  createBufferRoot,
  type BufferRoot,
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

const FIRST_TICK_ID = 1;
const ZERO_BYTE_OFFSET = 0;

export interface CreateGraphBackedRopeHotTextRuntimeOptions {
  readonly hash: HashPort;
  readonly graph?: GraphRopeRuntime;
}

interface GraphBackedRopeHotTextRuntimeState {
  readonly graph: GraphRopeRuntime;
  readonly bindingsByRootId: Map<number, RootGraphBinding>;
}

interface RootGraphBinding {
  readonly worldlineId: string;
  readonly headId: string;
}

interface ChangedReplaceInput {
  readonly bufferState: HotTextBufferState;
  readonly range: TextRange;
  readonly text: string;
  readonly binding: RootGraphBinding;
  readonly nextHeadId: string;
}

export class GraphBackedRopeHotTextRuntimeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'GraphBackedRopeHotTextRuntimeError';
  }
}

export function createGraphBackedRopeHotTextRuntime(
  options: CreateGraphBackedRopeHotTextRuntimeOptions,
): GraphBackedRopeTextAuthority {
  const state = {
    graph: options.graph ?? createGraphRopeRuntime({ hash: options.hash }),
    bindingsByRootId: new Map<number, RootGraphBinding>(),
  };
  return {
    textAuthorityKind: GRAPH_BACKED_ROPE_TEXT_AUTHORITY_KIND,
    isProductionSafe: true,
    createBuffer: (path, initialText) => createBuffer(state, path, initialText),
    materialize: (bufferState) => materialize(state, bufferState),
    admitReplaceRangeTick: (bufferState, range, text) => admitReplaceRangeTick(state, bufferState, range, text),
    openEditGroup,
    includeTickInOpenGroup,
    closeEditGroup,
    saveCheckpoint: (bufferState) => saveCheckpoint(state, bufferState),
  };
}

function createBuffer(
  state: GraphBackedRopeHotTextRuntimeState,
  path: string,
  initialText: string,
): HotTextBufferState {
  const worldlineId = toWorldlineId(path);
  const created = state.graph.createBufferWorldline({ worldlineId, initialText });
  if (!created.ok) {
    throw new GraphBackedRopeHotTextRuntimeError(`Cannot create graph rope worldline ${worldlineId}: ${created.code}.`);
  }
  const currentRoot = bindRoot(state, createBufferRoot(initialText), {
    worldlineId,
    headId: created.value.head.headId,
  });
  return {
    path,
    currentRoot,
    roots: [currentRoot],
    ticks: [],
    editGroups: [],
    checkpoints: [],
  };
}

function materialize(
  state: GraphBackedRopeHotTextRuntimeState,
  bufferState: HotTextBufferState,
): string {
  return materializeHead(state, requireBinding(state, bufferState.currentRoot.id).headId);
}

function admitReplaceRangeTick(
  state: GraphBackedRopeHotTextRuntimeState,
  bufferState: HotTextBufferState,
  range: TextRange,
  text: string,
): AdmitReplaceRangeTickResult {
  const binding = requireBinding(state, bufferState.currentRoot.id);
  const replaced = state.graph.replaceRangeAsTick({
    basisHeadId: binding.headId,
    range: toGraphTextRange(range),
    replacementText: text,
  });
  if (!replaced.ok) {
    throw new GraphBackedRopeHotTextRuntimeError(`Cannot replace graph rope range: ${replaced.code}.`);
  }
  if (!replaced.value.changed) {
    return { nextState: bufferState };
  }
  return changedReplaceResult(state, {
    bufferState,
    range,
    text,
    binding,
    nextHeadId: replaced.value.nextHead.headId,
  });
}

function changedReplaceResult(
  state: GraphBackedRopeHotTextRuntimeState,
  input: ChangedReplaceInput,
): AdmitReplaceRangeTickResult {
  const nextRoot = bindRoot(state, createBufferRoot(materializeHead(state, input.nextHeadId)), {
    worldlineId: input.binding.worldlineId,
    headId: input.nextHeadId,
  });
  const insertedRoot = createBufferRoot(input.text);
  const tickId = nextTickId(input.bufferState);
  return {
    nextState: replaceCurrentRoot(input.bufferState, nextRoot, tickId),
    receipt: {
      tickId,
      replaceReceipt: {
        baseRootId: input.bufferState.currentRoot.id,
        nextRootId: nextRoot.id,
        replaced: input.range,
        insertedRootId: insertedRoot.id,
      },
    },
  };
}

function openEditGroup(state: HotTextBufferState): HotTextBufferState {
  return withEditGroupState(state, openDomainEditGroup(toEditGroupState(state)));
}

function includeTickInOpenGroup(state: HotTextBufferState, tickId: number): HotTextBufferState {
  return withEditGroupState(state, includeDomainTickInOpenGroup(toEditGroupState(state), tickId));
}

function closeEditGroup(state: HotTextBufferState): CloseEditGroupResult {
  const result = closeDomainEditGroup(toEditGroupState(state));
  return {
    nextState: withEditGroupState(state, result.nextState),
    receipt: result.receipt,
  };
}

function saveCheckpoint(
  state: GraphBackedRopeHotTextRuntimeState,
  bufferState: HotTextBufferState,
): SaveHotCheckpointResult {
  const saved = saveDomainCheckpoint(toSaveCheckpointState(bufferState));
  if (saved.receipt == null) {
    return { nextState: bufferState };
  }
  const binding = requireBinding(state, bufferState.currentRoot.id);
  const checkpointed = state.graph.createCheckpoint({
    worldlineId: binding.worldlineId,
    headId: binding.headId,
    reason: ROPE_CHECKPOINT_REASON_MANUAL_SAVE,
  });
  if (!checkpointed.ok) {
    throw new GraphBackedRopeHotTextRuntimeError(`Cannot checkpoint graph rope head ${binding.headId}: ${checkpointed.code}.`);
  }
  return {
    nextState: withCheckpoints(bufferState, saved.nextState.checkpoints),
    receipt: saved.receipt,
  };
}

function bindRoot(
  state: GraphBackedRopeHotTextRuntimeState,
  root: BufferRoot,
  binding: RootGraphBinding,
): BufferRoot {
  state.bindingsByRootId.set(root.id, binding);
  return root;
}

function requireBinding(
  state: GraphBackedRopeHotTextRuntimeState,
  rootId: number,
): RootGraphBinding {
  const binding = state.bindingsByRootId.get(rootId);
  if (binding == null) {
    throw new GraphBackedRopeHotTextRuntimeError(`Missing graph rope binding for root ${rootId}.`);
  }
  return binding;
}

function materializeHead(state: GraphBackedRopeHotTextRuntimeState, headId: string): string {
  const shape = state.graph.debugRopeShape(headId);
  if (!shape.ok) {
    throw new GraphBackedRopeHotTextRuntimeError(`Cannot inspect graph rope head ${headId}: ${shape.code}.`);
  }
  const window = state.graph.textWindow({
    basisHeadId: headId,
    byteRange: toGraphRange(ZERO_BYTE_OFFSET, shape.value.byteLength),
  });
  if (!window.ok) {
    throw new GraphBackedRopeHotTextRuntimeError(`Cannot materialize graph rope head ${headId}: ${window.code}.`);
  }
  return window.value.text;
}

function replaceCurrentRoot(
  state: HotTextBufferState,
  nextRoot: BufferRoot,
  tickId: number,
): HotTextBufferState {
  return {
    path: state.path,
    currentRoot: nextRoot,
    roots: [...state.roots, nextRoot],
    ticks: [...state.ticks, { id: tickId, rootId: nextRoot.id }],
    editGroups: [...state.editGroups],
    openEditGroup: copyOpenEditGroup(state),
    checkpoints: [...state.checkpoints],
  };
}

function withCheckpoints(
  state: HotTextBufferState,
  checkpoints: HotTextBufferState['checkpoints'],
): HotTextBufferState {
  return {
    path: state.path,
    currentRoot: state.currentRoot,
    roots: [...state.roots],
    ticks: [...state.ticks],
    editGroups: [...state.editGroups],
    openEditGroup: copyOpenEditGroup(state),
    checkpoints: [...checkpoints],
  };
}

function toGraphTextRange(range: TextRange): TextByteRange {
  return toGraphRange(range.start.byte, range.end.byte);
}

function toGraphRange(startByte: number, endByte: number): TextByteRange {
  const start = makeByteOffset(startByte);
  const end = makeByteOffset(endByte);
  if (!start.ok || !end.ok) {
    throw new GraphBackedRopeHotTextRuntimeError('Graph rope ranges require non-negative integer byte offsets.');
  }
  const range = makeTextByteRange(start.value, end.value);
  if (!range.ok) {
    throw new GraphBackedRopeHotTextRuntimeError('Graph rope ranges require startByte <= endByte.');
  }
  return range.value;
}

function nextTickId(state: HotTextBufferState): number {
  const lastTick = state.ticks[state.ticks.length - 1];
  return lastTick == null ? FIRST_TICK_ID : lastTick.id + 1;
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
    openGroup: {
      id: state.openEditGroup.id,
      tickIds: [...state.openEditGroup.tickIds],
    },
  };
}

function toSaveCheckpointState(state: HotTextBufferState): SaveCheckpointState {
  const base = createSaveCheckpointState(
    state.currentRoot.id,
    state.path,
    state.ticks.map((tick) => tick.id),
  );
  return {
    ...base,
    checkpoints: [...state.checkpoints],
  };
}

function withEditGroupState(state: HotTextBufferState, next: EditGroupState): HotTextBufferState {
  return {
    path: state.path,
    currentRoot: state.currentRoot,
    roots: [...state.roots],
    ticks: [...state.ticks],
    editGroups: [...next.groups],
    openEditGroup: next.openGroup == null ? undefined : {
      id: next.openGroup.id,
      tickIds: [...next.openGroup.tickIds],
    },
    checkpoints: [...state.checkpoints],
  };
}

function copyOpenEditGroup(state: HotTextBufferState) {
  if (state.openEditGroup == null) {
    return undefined;
  }
  return {
    id: state.openEditGroup.id,
    tickIds: [...state.openEditGroup.tickIds],
  };
}
