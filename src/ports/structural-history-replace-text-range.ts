import type { mutationReplaceTextRangeOperation } from '../generated/jedit/structural-history-replace-text-range.wesley.generated.js';

export type ReplaceTextRangeOperationName = typeof mutationReplaceTextRangeOperation.fieldName;

export const TEXT_HISTORY_SOURCE_KIND_BOUNDARY_ADAPTER = 'BOUNDARY_ADAPTER';

export interface StructuralHistoryProvenanceInput {
  readonly sourceKind: typeof TEXT_HISTORY_SOURCE_KIND_BOUNDARY_ADAPTER;
  readonly sourceLabel: string;
  readonly externalEvidenceId?: string;
  readonly projectionPath?: string;
}

export interface StructuralHistoryReplaceTextRangeInput {
  readonly historyId: string;
  readonly baseRevisionId: string;
  readonly startByte: number;
  readonly endByte: number;
  readonly insertText: string;
  readonly author: string;
  readonly provenance: StructuralHistoryProvenanceInput;
}

export interface StructuralHistoryReplaceTextRangeRequest {
  readonly operationName: ReplaceTextRangeOperationName;
  readonly input: StructuralHistoryReplaceTextRangeInput;
}

export interface CreateStructuralHistoryReplaceTextRangeRequestInput {
  readonly historyId: string;
  readonly baseRevisionSequence: number;
  readonly startByte: number;
  readonly endByte: number;
  readonly insertText: string;
  readonly author: string;
  readonly sourceLabel: string;
  readonly externalEvidenceId?: string;
  readonly projectionPath?: string | null;
}
