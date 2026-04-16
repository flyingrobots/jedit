import type {
  CloseEditGroupResult,
  HotTextBufferState,
  HotTextRuntimePort,
  SaveHotCheckpointResult,
} from '../ports/hot-text-runtime.js';
import type { TextRange } from '../domain/text-edit-contract.js';

export interface ApplyBufferEditResult {
  readonly nextState: HotTextBufferState;
  readonly tickId?: number;
}

export function startHotBufferSession(
  runtime: HotTextRuntimePort,
  path: string,
  initialText: string,
): HotTextBufferState {
  return runtime.createBuffer(path, initialText);
}

export function materializeHotBuffer(
  runtime: HotTextRuntimePort,
  state: HotTextBufferState,
): string {
  return runtime.materialize(state);
}

export function beginEditGroup(
  runtime: HotTextRuntimePort,
  state: HotTextBufferState,
): HotTextBufferState {
  return runtime.openEditGroup(state);
}

export function applyBufferEdit(
  runtime: HotTextRuntimePort,
  state: HotTextBufferState,
  range: TextRange,
  text: string,
): ApplyBufferEditResult {
  const admitted = runtime.admitReplaceRangeTick(state, range, text);
  if (admitted.receipt === undefined) {
    return { nextState: admitted.nextState };
  }

  if (admitted.nextState.openEditGroup == null) {
    return {
      nextState: admitted.nextState,
      tickId: admitted.receipt.tickId,
    };
  }

  return {
    nextState: runtime.includeTickInOpenGroup(
      admitted.nextState,
      admitted.receipt.tickId,
    ),
    tickId: admitted.receipt.tickId,
  };
}

export function endEditGroup(
  runtime: HotTextRuntimePort,
  state: HotTextBufferState,
): CloseEditGroupResult {
  return runtime.closeEditGroup(state);
}

export function saveHotBuffer(
  runtime: HotTextRuntimePort,
  state: HotTextBufferState,
): SaveHotCheckpointResult {
  return runtime.saveCheckpoint(state);
}
