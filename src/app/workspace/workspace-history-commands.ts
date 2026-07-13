import type { KeyMsg } from '@flyingrobots/bijou-tui';
import {
  createPlannedJeditCommandEvent,
  type JeditCommandEvent,
  type JeditPlannedCommandEvent,
} from './command-provenance.js';
import { EditorKeys } from './editor/key.js';
import type { EditorState } from './editor/model.js';
import { createJeditWhyObservation } from './jedit-why-observation.js';
import {
  WorkspaceTextPendingCommandKinds,
  type WorkspaceTextAuthority,
  type WorkspaceTextPendingCommandKind,
} from './workspace-text-authority.js';

export const JEDIT_HISTORY_COMMAND_FAMILY = 'history';

const HISTORY_COMMAND_UNDO = 'u';
const HISTORY_COMMAND_REDO = '<C-r>';
const HISTORY_LABEL_UNDO = 'undo';
const HISTORY_LABEL_REDO = 'redo';
const HISTORY_EVENT_ID_PREFIX = 'history';
const HISTORY_EVENT_ID_SEPARATOR = ':';
const HISTORY_SUMMARY_SEPARATOR = ' | ';
const HISTORY_RECEIPT_PENDING = 'pending';
const HISTORY_REVERSES_UNDO = 'reverses the previous edit';
const HISTORY_REVERSES_REDO = 'reapplies the reversed edit';

export function isNormalModeHistoryKey(msg: KeyMsg): boolean {
  return (msg.key === EditorKeys.U && !msg.ctrl && !msg.alt)
    || (msg.key === EditorKeys.R && msg.ctrl && !msg.alt && !msg.shift);
}

export function pendingCommandKindForNormalModeKey(msg: KeyMsg): WorkspaceTextPendingCommandKind {
  if (!isNormalModeHistoryKey(msg)) {
    return WorkspaceTextPendingCommandKinds.Vim;
  }
  return msg.key === EditorKeys.U
    ? WorkspaceTextPendingCommandKinds.Undo
    : WorkspaceTextPendingCommandKinds.Redo;
}

export function isHistoryPendingCommandKind(
  pendingCommandKind: WorkspaceTextPendingCommandKind | undefined,
): pendingCommandKind is
  | typeof WorkspaceTextPendingCommandKinds.Undo
  | typeof WorkspaceTextPendingCommandKinds.Redo {
  return pendingCommandKind === WorkspaceTextPendingCommandKinds.Undo
    || pendingCommandKind === WorkspaceTextPendingCommandKinds.Redo;
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
  if (isHistoryPendingCommandKind(input.pendingCommandKind)) {
    return {
      requestId: input.requestId,
      event: historyCommandEvent(input, input.pendingCommandKind),
    };
  }
  return plannedVimCommandEventForQueuedEdit(input);
}

function plannedVimCommandEventForQueuedEdit(
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

function historyCommandEvent(
  input: PlannedWorkspaceCommandEventInput,
  pendingCommandKind:
    | typeof WorkspaceTextPendingCommandKinds.Undo
    | typeof WorkspaceTextPendingCommandKinds.Redo,
): JeditCommandEvent {
  const undo = pendingCommandKind === WorkspaceTextPendingCommandKinds.Undo;
  const command = undo ? HISTORY_COMMAND_UNDO : HISTORY_COMMAND_REDO;
  const label = undo ? HISTORY_LABEL_UNDO : HISTORY_LABEL_REDO;
  const reverses = undo ? HISTORY_REVERSES_UNDO : HISTORY_REVERSES_REDO;
  return {
    kind: 'vim',
    eventId: historyEventId(label, input.requestId),
    command,
    keys: [command],
    family: JEDIT_HISTORY_COMMAND_FAMILY,
    observation: createJeditWhyObservation({ textAuthority: input.textAuthority }),
    requestId: input.requestId,
    receipt: { posture: HISTORY_RECEIPT_PENDING },
    result: historyCommandResult(input.editor),
    summary: [
      `${command} ${label}`,
      reverses,
      `receipt ${HISTORY_RECEIPT_PENDING}`,
    ].join(HISTORY_SUMMARY_SEPARATOR),
  };
}

function historyEventId(label: string, requestId: number): string {
  return [HISTORY_EVENT_ID_PREFIX, label, String(requestId)].join(HISTORY_EVENT_ID_SEPARATOR);
}

function historyCommandResult(editor: EditorState): JeditCommandEvent['result'] {
  return {
    cursorCol: editor.cursorCol,
    cursorRow: editor.cursorRow,
    dirty: editor.dirty,
    mode: editor.mode,
  };
}
