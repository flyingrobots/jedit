import type { Cmd } from '@flyingrobots/bijou-tui';
import { WorkspaceMessageTypes } from './msg.js';
import { RuntimeIssueLevels, RuntimeIssueSources } from './runtime-issue.js';
import type { WorkspaceMsg } from './msg.js';

const GRAFT_CLOSE_FAILURE_MESSAGE = 'Failed to close graft connection';
const UNKNOWN_CLOSE_FAILURE = 'unknown close failure';

export function manageGraftLifecycle(closeConnection: () => Promise<void>, nowMs: () => number = Date.now): Cmd<WorkspaceMsg> {
  return async () => {
    try {
      await closeConnection();
    } catch (error) {
      return {
        type: WorkspaceMessageTypes.RuntimeIssue,
        issue: {
          message: `${GRAFT_CLOSE_FAILURE_MESSAGE}: ${error instanceof Error ? error.message : UNKNOWN_CLOSE_FAILURE}`,
          level: RuntimeIssueLevels.Error,
          source: RuntimeIssueSources.Command,
          atMs: nowMs(),
        },
      };
    }
    return undefined;
  };
}
