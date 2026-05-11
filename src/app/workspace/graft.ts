import type { Cmd } from '@flyingrobots/bijou-tui';
import type { WorkspaceMsg } from './msg.js';

export function manageGraftLifecycle(closeConnection: () => Promise<void>): Cmd<WorkspaceMsg> {
  return () => () => {
    void closeConnection();
  };
}
