import type { KeyMsg } from '@flyingrobots/bijou-tui';
import {
  JEDIT_HISTORY_COMMAND_EVENT_FAMILY,
  createPlannedJeditCommandEvent,
  type JeditCommandEvent,
  type JeditPlannedCommandEvent,
} from './command-provenance.js';
import { EditorKeys } from './editor/key.js';
import type { EditorState } from './editor/model.js';
import { jeditHistoryCommandEventSummary } from './jedit-command-event-summary.js';
import { createJeditWhyObservation } from './jedit-why-observation.js';
import {
  WorkspaceTextPendingCommandKinds,
  type WorkspaceTextAuthority,
  type WorkspaceTextPendingCommandKind,
} from './workspace-text-authority.js';

export const JEDIT_HISTORY_COMMAND_FAMILY = JEDIT_HISTORY_COMMAND_EVENT_FAMILY;

const HISTORY_COMMAND_UNDO = 'u';
const HISTORY_COMMAND_REDO = '<C-r>';
const HISTORY_LABEL_UNDO = 'undo';
const HISTORY_LABEL_REDO = 'redo';
const HISTORY_EVENT_ID_PREFIX = 'history';
const HISTORY_EVENT_ID_SEPARATOR = ':';
const HISTORY_RECEIPT_PENDING = 'pending';

export function isNormalModeHistoryKey(msg: KeyMsg): boolean {
  return (msg.key === EditorKeys.U && !msg.ctrl && !msg.alt && !msg.shift)
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
  readonly reversedRequestId?: number;
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
  const receipt = { posture: HISTORY_RECEIPT_PENDING } as const;
  return {
    kind: 'vim',
    eventId: historyEventId(label, input.requestId),
    command,
    keys: [command],
    family: JEDIT_HISTORY_COMMAND_FAMILY,
    operator: label,
    observation: createJeditWhyObservation({ textAuthority: input.textAuthority }),
    requestId: input.requestId,
    receipt,
    result: historyCommandResult(input.editor),
    reversedRequestId: input.reversedRequestId,
    summary: jeditHistoryCommandEventSummary(
      command,
      label,
      undefined,
      receipt,
      input.reversedRequestId,
    ),
  };
}

export function reversedRequestIdForHistoryCommand(
  editor: EditorState,
  pendingCommandKind: WorkspaceTextPendingCommandKind | undefined,
): number | undefined {
  if (pendingCommandKind === WorkspaceTextPendingCommandKinds.Undo) {
    return editor.undoStack.at(-1)?.transitionRequestId;
  }
  return pendingCommandKind === WorkspaceTextPendingCommandKinds.Redo
    ? editor.redoStack.at(-1)?.transitionRequestId
    : undefined;
}

export function editorWithTransitionRequest(
  editor: EditorState,
  pendingCommandKind: WorkspaceTextPendingCommandKind | undefined,
  requestId: number,
): EditorState {
  if (pendingCommandKind === WorkspaceTextPendingCommandKinds.Undo) {
    return {
      ...editor,
      redoStack: historyStackWithTransitionRequest(editor.redoStack, requestId),
    };
  }
  return {
    ...editor,
    undoStack: historyStackWithTransitionRequest(editor.undoStack, requestId),
  };
}

export function reachableHistoryRequestIds(editor: EditorState): readonly number[] {
  return [...editor.undoStack, ...editor.redoStack]
    .map((entry) => entry.transitionRequestId)
    .filter((requestId): requestId is number => requestId != null);
}

function historyStackWithTransitionRequest(
  stack: EditorState['undoStack'],
  requestId: number,
) {
  const entry = stack.at(-1);
  return entry == null
    ? stack
    : [...stack.slice(0, -1), { ...entry, transitionRequestId: requestId }];
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
