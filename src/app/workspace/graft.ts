import type { Cmd } from '@flyingrobots/bijou-tui';
import { closeGraftConnection } from '../../adapters/graft-mcp-session.js';
import type { WorkspaceMsg } from './msg.js';

export function manageGraftLifecycle(): Cmd<WorkspaceMsg> {
  return () => () => {
    void closeGraftConnection();
  };
}
