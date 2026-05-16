import type {
  CloseEditGroupResult,
  HotTextBufferState,
  HotTextRuntimePort,
  SaveHotCheckpointResult,
} from '../ports/hot-text-runtime.js';
import type { TextRange } from '../domain/text-edit-contract.js';
import { executeReplaceTextRange } from './structural-history-replace-text-range.js';

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
  const execution = executeReplaceTextRange(runtime, state, range, text);
  if (execution.tickId === undefined) {
    return {
      nextState: execution.nextState,
    };
  }
  return {
    nextState: execution.nextState,
    tickId: execution.tickId,
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
