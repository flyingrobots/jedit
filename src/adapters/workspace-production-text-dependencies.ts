import type { ProductionTextSession } from '../app/workspace/production-text-session.js';
import { createEchoTextContractHostProcess } from './echo-text-contract-host-process.js';
import { createWorkspaceProductionTextSession } from './workspace-production-text-session.js';

export interface WorkspaceProductionTextDependencies {
  readonly productionTextSession: ProductionTextSession;
}

export async function createWorkspaceProductionTextDependencies(): Promise<WorkspaceProductionTextDependencies> {
  const echo = createEchoTextContractHostProcess();
  return {
    productionTextSession: createWorkspaceProductionTextSession(echo),
  };
}
