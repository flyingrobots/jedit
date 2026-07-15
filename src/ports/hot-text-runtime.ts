import type { EditGroup, EditGroupReceipt, OpenEditGroup } from '../domain/edit-group-contract.js';
import type { SaveCheckpoint, SaveCheckpointReceipt } from '../domain/save-checkpoint-contract.js';
import type { BufferRoot, TextRange } from '../domain/text-edit-contract.js';
import type { AdmittedTick, TickAdmissionReceipt } from '../domain/tick-admission-contract.js';

export interface HotTextAuthorityBasis {
  readonly worldlineId: string;
  readonly headId: string;
  readonly rootNodeId: string;
  readonly createdByTickId: string;
  readonly byteLength: number;
  readonly lineCount: number;
  readonly contentHash: string;
}

export interface HotTextAuthorityTransition {
  readonly tickId: string;
  readonly admissionId: string;
  readonly rewriteId: string;
  readonly diffId: string;
  readonly admittedAtSequence: number;
  readonly nextBasis: HotTextAuthorityBasis;
}

export interface HotTextBufferState {
  readonly path: string;
  readonly authorityBasis?: HotTextAuthorityBasis;
  readonly currentRoot: BufferRoot;
  readonly roots: readonly BufferRoot[];
  readonly ticks: readonly AdmittedTick[];
  readonly editGroups: readonly EditGroup[];
  readonly openEditGroup?: OpenEditGroup;
  readonly checkpoints: readonly SaveCheckpoint[];
  readonly nextRootId: number;
}

export interface AdmitReplaceRangeTickResult {
  readonly nextState: HotTextBufferState;
  readonly receipt?: TickAdmissionReceipt;
  readonly authorityTransition?: HotTextAuthorityTransition;
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
  readonly textAuthorityKind?: string;
  readonly isProductionSafe?: boolean;
  createBuffer(path: string, initialText: string): HotTextBufferState;
  materialize(state: HotTextBufferState): string;
  admitReplaceRangeTick(state: HotTextBufferState, range: TextRange, text: string): AdmitReplaceRangeTickResult;
  openEditGroup(state: HotTextBufferState): HotTextBufferState;
  includeTickInOpenGroup(state: HotTextBufferState, tickId: number): HotTextBufferState;
  closeEditGroup(state: HotTextBufferState): CloseEditGroupResult;
  saveCheckpoint(state: HotTextBufferState): SaveHotCheckpointResult;
}

export const GRAPH_BACKED_ROPE_TEXT_AUTHORITY_KIND = 'graph-backed-rope';

export interface GraphBackedRopeTextAuthority extends HotTextRuntimePort {
  readonly textAuthorityKind: typeof GRAPH_BACKED_ROPE_TEXT_AUTHORITY_KIND;
  readonly isProductionSafe: true;
}

export function isGraphBackedRopeTextAuthority(
  runtime: HotTextRuntimePort,
): runtime is GraphBackedRopeTextAuthority {
  return runtime.textAuthorityKind === GRAPH_BACKED_ROPE_TEXT_AUTHORITY_KIND
    && runtime.isProductionSafe === true;
}
