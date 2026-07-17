import type { EditGroup, EditGroupReceipt, OpenEditGroup } from '../domain/edit-group-contract.js';
import type { SaveCheckpoint, SaveCheckpointReceipt } from '../domain/save-checkpoint-contract.js';
import type { RopeCheckpointAnchoredFact, RopeCheckpointFact } from '../domain/graph-rope-contract.js';
import type { CheckpointKind } from '../generated/jedit/rope.types.generated.js';
import type { WhyRangeInput, WhyRangeReading } from '../generated/jedit/rope.wesley.generated.js';
import type { BufferRoot, TextRange } from '../domain/text-edit-contract.js';
import type { AdmittedTick, TickAdmissionReceipt } from '../domain/tick-admission-contract.js';

export interface HotTextHeadBasis {
  readonly worldlineId: string;
  readonly headId: string;
  readonly rootNodeId: string;
  readonly byteLength: number;
  readonly lineCount: number;
}

export interface HotTextAuthorityBasis extends HotTextHeadBasis {
  readonly createdByTickId: string;
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

export interface HotTextWindowByteRange {
  readonly startByte: number;
  readonly endByte: number;
}

export interface HotTextWindowSupport {
  readonly leafId: string;
  readonly blobId: string;
  readonly contentHash: string;
  readonly byteRange: HotTextWindowByteRange;
}

export interface HotTextWindowProjection {
  readonly basisHeadId: string;
  readonly basis: HotTextHeadBasis;
  readonly byteRange: HotTextWindowByteRange;
  readonly text: string;
  readonly support: readonly HotTextWindowSupport[];
}

export interface HotTextWindowRequest {
  readonly basisHeadId: string;
  readonly byteRange: HotTextWindowByteRange;
}

export interface HotTextCausalLineDiffRequest {
  readonly worldlineId: string;
  readonly basisHeadId: string;
  readonly nextHeadId: string;
  readonly maxByteCount: number;
  readonly maxLineCount: number;
  readonly maxRewriteCount: number;
  readonly maxMarkerCount: number;
}

export interface HotTextCausalLineMarker {
  readonly lineNumber: number;
  readonly kind: 'INSERTED' | 'MODIFIED';
  readonly tickReceiptIds: readonly string[];
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
}

export interface HotTextCausalLineDeletionMarker {
  readonly boundaryLineNumber: number;
  readonly deletedLineCount: number;
  readonly tickReceiptIds: readonly string[];
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
}

export interface HotTextCausalLineDiffReading {
  readonly worldlineId: string;
  readonly basisHeadId: string;
  readonly nextHeadId: string;
  readonly insertedLineCount: number;
  readonly deletedLineCount: number;
  readonly tickReceiptIds: readonly string[];
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
  readonly markers: readonly HotTextCausalLineMarker[];
  readonly deletions: readonly HotTextCausalLineDeletionMarker[];
  readonly observerVersion: string;
}

export interface HotTextBufferState {
  readonly path: string;
  readonly authorityBasis?: HotTextAuthorityBasis;
  readonly currentRoot: BufferRoot;
  readonly roots?: readonly BufferRoot[];
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
  readonly checkpointDeclaration?: RopeCheckpointFact;
  readonly anchorAssociation?: RopeCheckpointAnchoredFact;
}

export interface SaveHotCheckpointRequest {
  readonly kind: CheckpointKind;
}

export interface HotTextRuntimePort {
  readonly textAuthorityKind?: string;
  readonly isProductionSafe?: boolean;
  createBuffer(path: string, initialText: string): HotTextBufferState;
  materialize(state: HotTextBufferState): string;
  textWindow(state: HotTextBufferState, request: HotTextWindowRequest): HotTextWindowProjection;
  causalLineDiff?(
    state: HotTextBufferState,
    request: HotTextCausalLineDiffRequest,
  ): HotTextCausalLineDiffReading;
  whyRange?(state: HotTextBufferState, request: WhyRangeInput): WhyRangeReading;
  admitReplaceRangeTick(state: HotTextBufferState, range: TextRange, text: string): AdmitReplaceRangeTickResult;
  openEditGroup(state: HotTextBufferState): HotTextBufferState;
  includeTickInOpenGroup(state: HotTextBufferState, tickId: number): HotTextBufferState;
  closeEditGroup(state: HotTextBufferState): CloseEditGroupResult;
  saveCheckpoint(state: HotTextBufferState, request: SaveHotCheckpointRequest): SaveHotCheckpointResult;
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
