import type { Cmd } from '@flyingrobots/bijou-tui';
import type { WorkspaceMsg } from './msg.js';

const ISSUE_LEVEL_ERROR = 'error';
const ISSUE_SOURCE_COMMAND = 'command';
const GRAFT_CLOSE_FAILURE_MESSAGE = 'Failed to close graft connection';
const UNKNOWN_CLOSE_FAILURE = 'unknown close failure';
const GRAFT_LIFECYCLE_EVENT_TIME = 0;

export function manageGraftLifecycle(closeConnection: () => Promise<void>): Cmd<WorkspaceMsg> {
  return async () => {
    try {
      await closeConnection();
    } catch (error) {
      return {
        type: 'runtime-issue',
        issue: {
          message: `${GRAFT_CLOSE_FAILURE_MESSAGE}: ${error instanceof Error ? error.message : UNKNOWN_CLOSE_FAILURE}`,
          level: ISSUE_LEVEL_ERROR,
          source: ISSUE_SOURCE_COMMAND,
          atMs: GRAFT_LIFECYCLE_EVENT_TIME,
        },
      };
    }
    return undefined;
  };
}
