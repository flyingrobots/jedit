import type { ProductionTextSession } from './production-text-session.js';

const textOperationQueues = new WeakMap<ProductionTextSession, Promise<void>>();

export function sequenceWorkspaceTextOperation<T>(
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
