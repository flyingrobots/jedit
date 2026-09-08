import type { EchoTextContractHostPort } from '../ports/echo-text-contract-host.js';
import type { ProductionTextSession } from '../app/workspace/production-text-session.js';
import { createEchoTextContractHostProcess } from './echo-text-contract-host-process.js';
import { createWorkspaceProductionTextSession } from './workspace-production-text-session.js';

export interface WorkspaceProductionTextDependencies {
  readonly productionTextSession: ProductionTextSession;
  // The native Echo host is a spawned child process whose stdio pipes keep the
  // event loop alive. Nothing retained a handle to it, so `close` -- which the
  // host has always implemented -- was unreachable and jedit never returned the
  // terminal on quit. The disposer is part of the contract now.
  readonly closeProductionText: () => Promise<void>;
}

export async function createWorkspaceProductionTextDependencies(
  createHost: () => EchoTextContractHostPort = createEchoTextContractHostProcess,
): Promise<WorkspaceProductionTextDependencies> {
  const echo = createHost();
  return {
    productionTextSession: createWorkspaceProductionTextSession(echo),
    closeProductionText: async () => {
      await echo.close?.();
    },
  };
}

// Runs `use`, then closes the native Echo host whether `use` returned or threw.
//
// The host owns a child process holding stdio pipes open, so anything that
// escapes without closing it leaves the terminal unrestored and the event loop
// alive -- the failure #306 was filed for. Building the app is part of `use`,
// not something that happens before the guard: app construction can throw, and
// when it did the host stayed open.
export async function closingProductionText<T>(
  dependencies: WorkspaceProductionTextDependencies,
  use: () => Promise<T>,
): Promise<T> {
  try {
    return await use();
  } finally {
    await dependencies.closeProductionText();
  }
}
