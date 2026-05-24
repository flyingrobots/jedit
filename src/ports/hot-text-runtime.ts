import type { EditGroup, EditGroupReceipt, OpenEditGroup } from '../domain/edit-group-contract.js';
import type { SaveCheckpoint, SaveCheckpointReceipt } from '../domain/save-checkpoint-contract.js';
import type { BufferRoot, TextRange } from '../domain/text-edit-contract.js';
import type { AdmittedTick, TickAdmissionReceipt } from '../domain/tick-admission-contract.js';

export interface HotTextBufferState {
  readonly path: string;
  readonly currentRoot: BufferRoot;
  readonly roots: readonly BufferRoot[];
  readonly ticks: readonly AdmittedTick[];
  readonly editGroups: readonly EditGroup[];
  readonly openEditGroup?: OpenEditGroup;
  readonly checkpoints: readonly SaveCheckpoint[];
}

export interface AdmitReplaceRangeTickResult {
  readonly nextState: HotTextBufferState;
  readonly receipt?: TickAdmissionReceipt;
}

export interface CloseEditGroupResult {
  readonly nextState: HotTextBufferState;
  readonly receipt?: EditGroupReceipt;
}

export interface SaveHotCheckpointResult {
  readonly nextState: HotTextBufferState;
  readonly receipt?: SaveCheckpointReceipt;
}

export interface HotTextRuntimePort {
  createBuffer(path: string, initialText: string): HotTextBufferState;
  materialize(state: HotTextBufferState): string;
  admitReplaceRangeTick(state: HotTextBufferState, range: TextRange, text: string): AdmitReplaceRangeTickResult;
  openEditGroup(state: HotTextBufferState): HotTextBufferState;
  includeTickInOpenGroup(state: HotTextBufferState, tickId: number): HotTextBufferState;
  closeEditGroup(state: HotTextBufferState): CloseEditGroupResult;
  saveCheckpoint(state: HotTextBufferState): SaveHotCheckpointResult;
}
