import type { RuntimeIssue } from '@flyingrobots/bijou-tui';
import type { ProductionTextSession } from './production-text-session.js';
import {
  WorkspaceTextResultKinds,
  type WorkspaceTextCheckpointResult,
  type WorkspaceTextEditResult,
  type WorkspaceTextExportResult,
} from './workspace-text-results.js';

interface ActiveTextExportOperation {
  readonly target: WorkspaceTextOperationTarget;
  readonly operationSequence: number;
  readonly promise: Promise<WorkspaceTextExportResult>;
}

interface BlockedTextOperation {
  readonly target: WorkspaceTextOperationTarget;
  readonly issue: RuntimeIssue;
}

interface WorkspaceTextOperationSequencerState {
  readonly queues: WeakMap<ProductionTextSession, Promise<void>>;
  readonly obstructions: WeakMap<ProductionTextSession, Map<string, BlockedTextOperation>>;
  readonly exports: WeakMap<ProductionTextSession, ActiveTextExportOperation>;
  readonly operationSequences: WeakMap<ProductionTextSession, number>;
}

interface SequencedOperation<T> {
  readonly operationSequence: number;
  readonly promise: Promise<T>;
}

export interface WorkspaceTextOperationSequencer {
  readonly sequenceEdit: (
    session: ProductionTextSession,
    target: WorkspaceTextOperationTarget,
    operation: () => Promise<WorkspaceTextEditResult>,
  ) => Promise<WorkspaceTextEditResult>;
  readonly sequenceCheckpoint: (
    session: ProductionTextSession,
    target: WorkspaceTextOperationTarget,
    operation: () => Promise<WorkspaceTextCheckpointResult>,
  ) => Promise<WorkspaceTextCheckpointResult>;
  readonly sequenceExport: (
    session: ProductionTextSession,
    target: WorkspaceTextOperationTarget,
    operation: () => Promise<WorkspaceTextExportResult>,
  ) => Promise<WorkspaceTextExportResult>;
}

export interface WorkspaceTextOperationTarget {
  readonly filePath: string;
  readonly bufferId: string;
}

export function createWorkspaceTextOperationSequencer(): WorkspaceTextOperationSequencer {
  const state: WorkspaceTextOperationSequencerState = {
    queues: new WeakMap<ProductionTextSession, Promise<void>>(),
    obstructions: new WeakMap<ProductionTextSession, Map<string, BlockedTextOperation>>(),
    exports: new WeakMap<ProductionTextSession, ActiveTextExportOperation>(),
    operationSequences: new WeakMap<ProductionTextSession, number>(),
  };
  return {
    sequenceEdit: (session, target, operation) => sequenceEditOperation(state, session, target, operation),
    sequenceCheckpoint: (session, target, operation) => sequenceCheckpointOperation(state, session, target, operation),
    sequenceExport: (session, target, operation) => sequenceExportOperation(state, session, target, operation),
  };
}

function sequenceWorkspaceTextOperation<T>(
  state: WorkspaceTextOperationSequencerState,
  session: ProductionTextSession,
  operation: () => Promise<T>,
): SequencedOperation<T> {
  const operationSequence = nextOperationSequence(state, session);
  const previous = state.queues.get(session) ?? Promise.resolve();
  const current = previous
    .catch(() => undefined)
    .then(operation);
  const tail = current.then(() => undefined, () => undefined);
  state.queues.set(session, tail);
  tail.finally(() => {
    if (state.queues.get(session) === tail) {
      state.queues.delete(session);
    }
  });
  return { operationSequence, promise: current };
}

function sequenceEditOperation(
  state: WorkspaceTextOperationSequencerState,
  session: ProductionTextSession,
  target: WorkspaceTextOperationTarget,
  operation: () => Promise<WorkspaceTextEditResult>,
): Promise<WorkspaceTextEditResult> {
  return sequenceWorkspaceTextOperation(state, session, async () => {
    const obstruction = textBufferObstruction(state, session, target);
    if (obstruction != null) {
      return obstructedTextOperation(target.filePath, obstruction.issue);
    }
    const result = await operation();
    recordTextOperationResult(state, session, target, result);
    return result;
  }).promise;
}

function sequenceCheckpointOperation(
  state: WorkspaceTextOperationSequencerState,
  session: ProductionTextSession,
  target: WorkspaceTextOperationTarget,
  operation: () => Promise<WorkspaceTextCheckpointResult>,
): Promise<WorkspaceTextCheckpointResult> {
  return sequenceWorkspaceTextOperation(state, session, () => {
    const obstruction = textBufferObstruction(state, session, target);
    return obstruction == null ? operation() : Promise.resolve(obstructedTextOperation(target.filePath, obstruction.issue));
  }).promise;
}

function sequenceExportOperation(
  state: WorkspaceTextOperationSequencerState,
  session: ProductionTextSession,
  target: WorkspaceTextOperationTarget,
  operation: () => Promise<WorkspaceTextExportResult>,
): Promise<WorkspaceTextExportResult> {
  const active = state.exports.get(session);
  if (active != null && sameWorkspaceTextOperationTarget(active.target, target) && active.operationSequence === currentOperationSequence(state, session)) {
    return active.promise;
  }
  const sequenced = sequenceWorkspaceTextOperation(state, session, () => {
    const obstruction = textBufferObstruction(state, session, target);
    return obstruction == null ? operation() : Promise.resolve(obstructedTextOperation(target.filePath, obstruction.issue));
  });
  return trackTextExport(state, session, target, sequenced);
}

function trackTextExport(
  state: WorkspaceTextOperationSequencerState,
  session: ProductionTextSession,
  target: WorkspaceTextOperationTarget,
  sequenced: SequencedOperation<WorkspaceTextExportResult>,
): Promise<WorkspaceTextExportResult> {
  state.exports.set(session, { target, operationSequence: sequenced.operationSequence, promise: sequenced.promise });
  sequenced.promise.finally(() => {
    if (state.exports.get(session)?.promise === sequenced.promise) {
      state.exports.delete(session);
    }
  });
  return sequenced.promise;
}

function recordTextOperationResult(
  state: WorkspaceTextOperationSequencerState,
  session: ProductionTextSession,
  target: WorkspaceTextOperationTarget,
  result: WorkspaceTextEditResult,
): void {
  if (result.kind === WorkspaceTextResultKinds.Obstructed) {
    setTextBufferObstruction(state, session, {
      target: {
        ...target,
        filePath: result.filePath,
      },
      issue: result.issue,
    });
    return;
  }
  clearTextBufferObstruction(state, session, target);
}

function obstructedTextOperation(
  filePath: string,
  issue: RuntimeIssue,
) {
  return {
    kind: WorkspaceTextResultKinds.Obstructed,
    filePath,
    issue,
  };
}

function nextOperationSequence(
  state: WorkspaceTextOperationSequencerState,
  session: ProductionTextSession,
): number {
  const next = currentOperationSequence(state, session) + 1;
  state.operationSequences.set(session, next);
  return next;
}

function currentOperationSequence(
  state: WorkspaceTextOperationSequencerState,
  session: ProductionTextSession,
): number {
  return state.operationSequences.get(session) ?? 0;
}

function textBufferObstruction(
  state: WorkspaceTextOperationSequencerState,
  session: ProductionTextSession,
  target: WorkspaceTextOperationTarget,
): BlockedTextOperation | undefined {
  return state.obstructions.get(session)?.get(target.bufferId);
}

function setTextBufferObstruction(
  state: WorkspaceTextOperationSequencerState,
  session: ProductionTextSession,
  obstruction: BlockedTextOperation,
): void {
  const obstructions = state.obstructions.get(session) ?? new Map<string, BlockedTextOperation>();
  obstructions.set(obstruction.target.bufferId, obstruction);
  state.obstructions.set(session, obstructions);
}

function clearTextBufferObstruction(
  state: WorkspaceTextOperationSequencerState,
  session: ProductionTextSession,
  target: WorkspaceTextOperationTarget,
): void {
  const obstructions = state.obstructions.get(session);
  obstructions?.delete(target.bufferId);
}

function sameWorkspaceTextOperationTarget(
  left: WorkspaceTextOperationTarget,
  right: WorkspaceTextOperationTarget,
): boolean {
  return left.bufferId === right.bufferId;
}
