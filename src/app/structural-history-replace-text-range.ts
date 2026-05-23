import type { TextRange } from '../domain/text-edit-contract.js';
import { mutationReplaceTextRangeOperation } from '../generated/jedit/structural-history-replace-text-range.wesley.generated.js';
import type { HotTextBufferState, HotTextRuntimePort } from '../ports/hot-text-runtime.js';

export type ReplaceTextRangeOperationName = typeof mutationReplaceTextRangeOperation.fieldName;

export interface ReplaceTextRangeExecution {
  readonly operationName: ReplaceTextRangeOperationName;
  readonly nextState: HotTextBufferState;
  readonly tickId?: number;
}

export function replaceTextRangeOperationName(): ReplaceTextRangeOperationName {
  return mutationReplaceTextRangeOperation.fieldName;
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
