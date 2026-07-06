import { createWorkspaceTextOperationSequencer } from '../app/workspace/workspace-text-operation-sequencer.js';
import type { ProductionTextSession } from '../app/workspace/production-text-session.js';
import type { WorkspaceTextOperationSequencer } from '../app/workspace/workspace-text-operation-sequencer.js';
import { createWorkspaceProductionTextSession } from './workspace-production-text-session.js';

export interface WorkspaceProductionTextDependencies {
  readonly productionTextSession: ProductionTextSession;
  readonly textOperationSequencer: WorkspaceTextOperationSequencer;
}

export function createWorkspaceProductionTextDependencies(): WorkspaceProductionTextDependencies {
  return {
    productionTextSession: createWorkspaceProductionTextSession(),
    textOperationSequencer: createWorkspaceTextOperationSequencer(),
  };
}
