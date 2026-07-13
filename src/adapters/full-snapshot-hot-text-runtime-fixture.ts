import {
  closeEditGroup as closeDomainEditGroup,
  createEditGroupState,
  includeTickInOpenGroup as includeDomainTickInOpenGroup,
  openEditGroup as openDomainEditGroup,
  type EditGroupState,
} from '../domain/edit-group-contract.js';
import {
  createSaveCheckpointState,
  saveCheckpoint as saveDomainCheckpoint,
  type SaveCheckpointState,
} from '../domain/save-checkpoint-contract.js';
import {
  FIRST_ROOT_ID,
  createBufferRoot,
  materializeRoot,
  type TextRange,
} from '../domain/text-edit-contract.js';
import {
  admitReplaceRangeTick as admitDomainReplaceRangeTick,
  createTickAdmissionState,
  type TickAdmissionState,
} from '../domain/tick-admission-contract.js';
import type {
  AdmitReplaceRangeTickResult,
  CloseEditGroupResult,
  HotTextBufferState,
  HotTextRuntimePort,
  SaveHotCheckpointResult,
} from '../ports/hot-text-runtime.js';

export const FULL_SNAPSHOT_TEXT_AUTHORITY_KIND = 'full-snapshot-fixture';

export interface FullSnapshotHotTextRuntimeFixture extends HotTextRuntimePort {
  readonly textAuthorityKind: typeof FULL_SNAPSHOT_TEXT_AUTHORITY_KIND;
  readonly isProductionSafe: false;
}

export function createFullSnapshotHotTextRuntimeFixture(): FullSnapshotHotTextRuntimeFixture {
  return {
    textAuthorityKind: FULL_SNAPSHOT_TEXT_AUTHORITY_KIND,
    isProductionSafe: false,
    createBuffer,
    materialize,
    admitReplaceRangeTick,
    openEditGroup,
    includeTickInOpenGroup,
    closeEditGroup,
    saveCheckpoint,
  };
}

export function isFullSnapshotHotTextRuntimeFixture(
  runtime: HotTextRuntimePort,
): runtime is FullSnapshotHotTextRuntimeFixture {
  return 'textAuthorityKind' in runtime
    && runtime.textAuthorityKind === FULL_SNAPSHOT_TEXT_AUTHORITY_KIND
    && 'isProductionSafe' in runtime
    && runtime.isProductionSafe === false;
}

function createBuffer(path: string, initialText: string): HotTextBufferState {
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

function materialize(state: HotTextBufferState): string {
  return materializeRoot(state.currentRoot);
}

function admitReplaceRangeTick(
  state: HotTextBufferState,
  range: TextRange,
  text: string,
): AdmitReplaceRangeTickResult {
  const result = admitDomainReplaceRangeTick(toTickAdmissionState(state), range, text);

  if (result.receipt === undefined) {
    return { nextState: state };
  }

  return {
    nextState: {
      path: state.path,
      currentRoot: result.nextState.currentRoot,
      roots: [...state.roots, result.nextState.currentRoot],
      ticks: [...result.nextState.ticks],
      editGroups: [...state.editGroups],
      openEditGroup: copyOpenEditGroup(state),
      checkpoints: [...state.checkpoints],
      nextRootId: result.nextState.nextRootId,
    },
    receipt: result.receipt,
  };
}

function openEditGroup(state: HotTextBufferState): HotTextBufferState {
  const next = openDomainEditGroup(toEditGroupState(state));
  return withEditGroupState(state, next);
}

function includeTickInOpenGroup(state: HotTextBufferState, tickId: number): HotTextBufferState {
  const next = includeDomainTickInOpenGroup(toEditGroupState(state), tickId);
  return withEditGroupState(state, next);
}

function closeEditGroup(state: HotTextBufferState): CloseEditGroupResult {
  const result = closeDomainEditGroup(toEditGroupState(state));
  return {
    nextState: withEditGroupState(state, result.nextState),
    receipt: result.receipt,
  };
}

function saveCheckpoint(state: HotTextBufferState): SaveHotCheckpointResult {
  const result = saveDomainCheckpoint(toSaveCheckpointState(state));
  return {
    nextState: {
      path: state.path,
      currentRoot: state.currentRoot,
      roots: [...state.roots],
      ticks: [...state.ticks],
      editGroups: [...state.editGroups],
      openEditGroup: copyOpenEditGroup(state),
      checkpoints: [...result.nextState.checkpoints],
      nextRootId: state.nextRootId,
    },
    receipt: result.receipt,
  };
}

function toTickAdmissionState(state: HotTextBufferState): TickAdmissionState {
  return createTickAdmissionState(state.currentRoot, state.ticks, state.nextRootId);
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
    nextRootId: state.nextRootId,
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
