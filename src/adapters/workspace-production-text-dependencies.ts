import { createWorkspaceTextOperationSequencer } from '../app/workspace/workspace-text-operation-sequencer.js';
import { createWorkspaceProductionTextSession } from './workspace-production-text-session.js';

export function createWorkspaceProductionTextDependencies() {
  return {
    productionTextSession: createWorkspaceProductionTextSession(),
    textOperationSequencer: createWorkspaceTextOperationSequencer(),
  };
}
