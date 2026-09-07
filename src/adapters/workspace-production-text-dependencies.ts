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
