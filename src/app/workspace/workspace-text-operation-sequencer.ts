import type { RuntimeIssue } from '@flyingrobots/bijou-tui';
import type { ProductionTextSession } from './production-text-session.js';
import {
  WorkspaceTextResultKinds,
  type WorkspaceTextCheckpointResult,
  type WorkspaceTextEditResult,
  type WorkspaceTextExportResult,
} from './workspace-text-results.js';

const textOperationQueues = new WeakMap<ProductionTextSession, Promise<void>>();
const textOperationObstructions = new WeakMap<ProductionTextSession, RuntimeIssue>();
const textOperationExports = new WeakMap<ProductionTextSession, ActiveTextExportOperation>();

interface ActiveTextExportOperation {
  readonly bufferId: string;
  readonly filePath: string;
  readonly promise: Promise<WorkspaceTextExportResult>;
}

export function sequenceWorkspaceTextEditOperation(
  session: ProductionTextSession,
  operation: () => Promise<WorkspaceTextEditResult>,
): Promise<WorkspaceTextEditResult> {
  return sequenceWorkspaceTextOperation(session, async () => {
    const result = await operation();
    recordTextOperationResult(session, result);
    return result;
  });
}

export function sequenceWorkspaceTextCheckpointOperation(
  session: ProductionTextSession,
  filePath: string,
  operation: () => Promise<WorkspaceTextCheckpointResult>,
): Promise<WorkspaceTextCheckpointResult> {
  return sequenceWorkspaceTextOperation(session, () => {
    const issue = textOperationObstructions.get(session);
    return issue == null ? operation() : Promise.resolve(obstructedTextOperation(filePath, issue));
  });
}

export function sequenceWorkspaceTextExportOperation(
  session: ProductionTextSession,
  filePath: string,
  bufferId: string,
  operation: () => Promise<WorkspaceTextExportResult>,
): Promise<WorkspaceTextExportResult> {
  const active = textOperationExports.get(session);
  if (active?.filePath === filePath && active.bufferId === bufferId) {
    return active.promise;
  }
  const promise = sequenceWorkspaceTextOperation(session, () => {
    const issue = textOperationObstructions.get(session);
    return issue == null ? operation() : Promise.resolve(obstructedTextOperation(filePath, issue));
  });
  textOperationExports.set(session, { bufferId, filePath, promise });
  promise.finally(() => {
    if (textOperationExports.get(session)?.promise === promise) {
      textOperationExports.delete(session);
    }
  });
  return promise;
}

function sequenceWorkspaceTextOperation<T>(
  session: ProductionTextSession,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = textOperationQueues.get(session) ?? Promise.resolve();
  const current = previous
    .catch(() => undefined)
    .then(operation);
  const tail = current.then(() => undefined, () => undefined);
  textOperationQueues.set(session, tail);
  tail.finally(() => {
    if (textOperationQueues.get(session) === tail) {
      textOperationQueues.delete(session);
    }
  });
  return current;
}

function recordTextOperationResult(
  session: ProductionTextSession,
  result: WorkspaceTextEditResult,
): void {
  if (result.kind === WorkspaceTextResultKinds.Obstructed) {
    textOperationObstructions.set(session, result.issue);
    return;
  }
  textOperationObstructions.delete(session);
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
