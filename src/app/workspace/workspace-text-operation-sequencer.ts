import type { RuntimeIssue } from '@flyingrobots/bijou-tui';
import type { ProductionTextSession } from './production-text-session.js';
import {
  WorkspaceTextResultKinds,
  type WorkspaceTextCheckpointResult,
  type WorkspaceTextEditResult,
  type WorkspaceTextExportResult,
} from './workspace-text-results.js';

interface ActiveTextExportOperation {
  readonly bufferId: string;
  readonly filePath: string;
  readonly operationSequence: number;
  readonly promise: Promise<WorkspaceTextExportResult>;
}

interface BlockedTextOperation {
  readonly filePath: string;
  readonly issue: RuntimeIssue;
}

interface WorkspaceTextOperationSequencerState {
  readonly queues: WeakMap<ProductionTextSession, Promise<void>>;
  readonly obstructions: WeakMap<ProductionTextSession, BlockedTextOperation>;
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
    operation: () => Promise<WorkspaceTextEditResult>,
  ) => Promise<WorkspaceTextEditResult>;
  readonly sequenceCheckpoint: (
    session: ProductionTextSession,
    filePath: string,
    operation: () => Promise<WorkspaceTextCheckpointResult>,
  ) => Promise<WorkspaceTextCheckpointResult>;
  readonly sequenceExport: (
    session: ProductionTextSession,
    filePath: string,
    bufferId: string,
    operation: () => Promise<WorkspaceTextExportResult>,
  ) => Promise<WorkspaceTextExportResult>;
}

export function createWorkspaceTextOperationSequencer(): WorkspaceTextOperationSequencer {
  const state: WorkspaceTextOperationSequencerState = {
    queues: new WeakMap<ProductionTextSession, Promise<void>>(),
    obstructions: new WeakMap<ProductionTextSession, BlockedTextOperation>(),
    exports: new WeakMap<ProductionTextSession, ActiveTextExportOperation>(),
    operationSequences: new WeakMap<ProductionTextSession, number>(),
  };
  return {
    sequenceEdit: (session, operation) => sequenceEditOperation(state, session, operation),
    sequenceCheckpoint: (session, filePath, operation) => sequenceCheckpointOperation(state, session, filePath, operation),
    sequenceExport: (session, filePath, bufferId, operation) => sequenceExportOperation(state, session, filePath, bufferId, operation),
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
  operation: () => Promise<WorkspaceTextEditResult>,
): Promise<WorkspaceTextEditResult> {
  return sequenceWorkspaceTextOperation(state, session, async () => {
    const obstruction = state.obstructions.get(session);
    if (obstruction != null) {
      return obstructedTextOperation(obstruction.filePath, obstruction.issue);
    }
    const result = await operation();
    recordTextOperationResult(state, session, result);
    return result;
  }).promise;
}

function sequenceCheckpointOperation(
  state: WorkspaceTextOperationSequencerState,
  session: ProductionTextSession,
  filePath: string,
  operation: () => Promise<WorkspaceTextCheckpointResult>,
): Promise<WorkspaceTextCheckpointResult> {
  return sequenceWorkspaceTextOperation(state, session, () => {
    const obstruction = state.obstructions.get(session);
    return obstruction == null ? operation() : Promise.resolve(obstructedTextOperation(filePath, obstruction.issue));
  }).promise;
}

function sequenceExportOperation(
  state: WorkspaceTextOperationSequencerState,
  session: ProductionTextSession,
  filePath: string,
  bufferId: string,
  operation: () => Promise<WorkspaceTextExportResult>,
): Promise<WorkspaceTextExportResult> {
  const active = state.exports.get(session);
  if (active?.filePath === filePath && active.bufferId === bufferId && active.operationSequence === currentOperationSequence(state, session)) {
    return active.promise;
  }
  const sequenced = sequenceWorkspaceTextOperation(state, session, () => {
    const obstruction = state.obstructions.get(session);
    return obstruction == null ? operation() : Promise.resolve(obstructedTextOperation(filePath, obstruction.issue));
  });
  return trackTextExport(state, session, filePath, bufferId, sequenced);
}

function trackTextExport(
  state: WorkspaceTextOperationSequencerState,
  session: ProductionTextSession,
  filePath: string,
  bufferId: string,
  sequenced: SequencedOperation<WorkspaceTextExportResult>,
): Promise<WorkspaceTextExportResult> {
  state.exports.set(session, { bufferId, filePath, operationSequence: sequenced.operationSequence, promise: sequenced.promise });
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
  result: WorkspaceTextEditResult,
): void {
  if (result.kind === WorkspaceTextResultKinds.Obstructed) {
    state.obstructions.set(session, {
      filePath: result.filePath,
      issue: result.issue,
    });
    return;
  }
  state.obstructions.delete(session);
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
