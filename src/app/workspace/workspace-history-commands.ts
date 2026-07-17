import type { KeyMsg } from '@flyingrobots/bijou-tui';
import { createPlannedJeditCommandEvent, type JeditPlannedCommandEvent } from './command-provenance.js';
import { EditorKeys } from './editor/key.js';
import type { EditorState } from './editor/model.js';
import {
  WorkspaceTextPendingCommandKinds,
  type WorkspaceTextAuthority,
  type WorkspaceTextPendingCommandKind,
} from './workspace-text-authority.js';

export function isNormalModeHistoryKey(msg: KeyMsg): boolean {
  return (msg.key === EditorKeys.U && !msg.ctrl && !msg.alt && !msg.shift)
    || (msg.key === EditorKeys.R && msg.ctrl && !msg.alt && !msg.shift);
}

export interface PlannedWorkspaceCommandEventInput {
  readonly editor: EditorState;
  readonly pendingCommandKind?: WorkspaceTextPendingCommandKind;
  readonly requestId: number;
  readonly textAuthority: WorkspaceTextAuthority;
}

export function plannedWorkspaceCommandEventForQueuedEdit(
  input: PlannedWorkspaceCommandEventInput,
): JeditPlannedCommandEvent | undefined {
  if (input.pendingCommandKind !== WorkspaceTextPendingCommandKinds.Vim
    || input.editor.lastVimEdit == null) {
    return undefined;
  }
  const result = createPlannedJeditCommandEvent({
    editor: input.editor,
    requestId: input.requestId,
    repeat: input.editor.lastVimEdit,
    textAuthority: input.textAuthority,
  });
  return 'event' in result ? result : undefined;
}
