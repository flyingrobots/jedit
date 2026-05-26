import type { TextRange } from '../domain/text-edit-contract.js';
import { mutationReplaceTextRangeOperation } from '../generated/jedit/structural-history-replace-text-range.wesley.generated.js';
import type { HotTextBufferState, HotTextRuntimePort } from '../ports/hot-text-runtime.js';
import {
  TEXT_HISTORY_SOURCE_KIND_BOUNDARY_ADAPTER,
  type CreateStructuralHistoryReplaceTextRangeRequestInput,
  type ReplaceTextRangeOperationName,
  type StructuralHistoryReplaceTextRangeRequest,
} from '../ports/structural-history-replace-text-range.js';

const TEXT_REVISION_ID_PREFIX = 'text-revision:';

export type {
  CreateStructuralHistoryReplaceTextRangeRequestInput,
  ReplaceTextRangeOperationName,
  StructuralHistoryReplaceTextRangeRequest,
} from '../ports/structural-history-replace-text-range.js';

export interface ReplaceTextRangeExecution {
  readonly operationName: ReplaceTextRangeOperationName;
  readonly nextState: HotTextBufferState;
  readonly tickId?: number;
}

export function replaceTextRangeOperationName(): ReplaceTextRangeOperationName {
  return mutationReplaceTextRangeOperation.fieldName;
}

export function createStructuralHistoryReplaceTextRangeRequest(
  input: CreateStructuralHistoryReplaceTextRangeRequestInput,
): StructuralHistoryReplaceTextRangeRequest {
  return {
    operationName: replaceTextRangeOperationName(),
    input: {
      historyId: input.historyId,
      baseRevisionId: toTextRevisionId(input.historyId, input.baseRevisionSequence),
      startByte: input.startByte,
      endByte: input.endByte,
      insertText: input.insertText,
      author: input.author,
      provenance: {
        sourceKind: TEXT_HISTORY_SOURCE_KIND_BOUNDARY_ADAPTER,
        sourceLabel: input.sourceLabel,
        externalEvidenceId: input.externalEvidenceId,
        projectionPath: input.projectionPath ?? undefined,
      },
    },
  };
}

export function executeReplaceTextRange(
  runtime: HotTextRuntimePort,
  state: HotTextBufferState,
  range: TextRange,
  text: string,
): ReplaceTextRangeExecution {
  const operationName = replaceTextRangeOperationName();
  const admitted = runtime.admitReplaceRangeTick(state, range, text);

  if (admitted.receipt === undefined) {
    return {
      operationName,
      nextState: admitted.nextState,
    };
  }

  if (admitted.nextState.openEditGroup == null) {
    return {
      operationName,
      nextState: admitted.nextState,
      tickId: admitted.receipt.tickId,
    };
  }

  return {
    operationName,
    nextState: runtime.includeTickInOpenGroup(
      admitted.nextState,
      admitted.receipt.tickId,
    ),
    tickId: admitted.receipt.tickId,
  };
}

function toTextRevisionId(historyId: string, sequence: number): string {
  return `${TEXT_REVISION_ID_PREFIX}${historyId}:${sequence}`;
}
