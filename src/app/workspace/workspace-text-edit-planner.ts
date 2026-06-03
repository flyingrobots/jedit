import type { EditorState } from './editor/model.js';
import {
  byteOffsetForTextPosition,
  nextByteOffset,
  positionAfterInsertedText,
  previousByteOffset,
  previousTextPosition,
  type TextPosition,
} from './workspace-text-position.js';

const PLAN_INSERT = 'insert';
const PLAN_REPLACE = 'replace';
const PLAN_DELETE = 'delete';
const PLAN_UNSUPPORTED = 'unsupported';
const UNSUPPORTED_SELECTION = 'unsupported-selection';
const UNSUPPORTED_EMPTY_BACKSPACE = 'empty-backspace';
const UNSUPPORTED_EMPTY_DELETE = 'empty-delete';

export const WorkspaceTextEditPlanKinds = Object.freeze({
  Insert: PLAN_INSERT,
  Replace: PLAN_REPLACE,
  Delete: PLAN_DELETE,
  Unsupported: PLAN_UNSUPPORTED,
} as const);

export const WorkspaceTextEditPlanUnsupportedReasons = Object.freeze({
  Selection: UNSUPPORTED_SELECTION,
  EmptyBackspace: UNSUPPORTED_EMPTY_BACKSPACE,
  EmptyDelete: UNSUPPORTED_EMPTY_DELETE,
} as const);

export interface WorkspaceTextSelectionRange {
  readonly startRow: number;
  readonly startColumn: number;
  readonly endRow: number;
  readonly endColumn: number;
}

export interface WorkspaceTextInsertPlan {
  readonly kind: typeof PLAN_INSERT;
  readonly startByte: number;
  readonly insertText: string;
  readonly cursorAfter: TextPosition;
}

export interface WorkspaceTextReplacePlan {
  readonly kind: typeof PLAN_REPLACE;
  readonly startByte: number;
  readonly endByte: number;
  readonly insertText: string;
  readonly cursorAfter: TextPosition;
}

export interface WorkspaceTextDeletePlan {
  readonly kind: typeof PLAN_DELETE;
  readonly startByte: number;
  readonly endByte: number;
  readonly cursorAfter: TextPosition;
}

export interface WorkspaceTextUnsupportedPlan {
  readonly kind: typeof PLAN_UNSUPPORTED;
  readonly reason: typeof UNSUPPORTED_SELECTION | typeof UNSUPPORTED_EMPTY_BACKSPACE | typeof UNSUPPORTED_EMPTY_DELETE;
}

export type WorkspaceTextEditPlan =
  | WorkspaceTextInsertPlan
  | WorkspaceTextReplacePlan
  | WorkspaceTextDeletePlan
  | WorkspaceTextUnsupportedPlan;

export function planWorkspaceTextInsert(
  editor: EditorState,
  insertText: string,
): WorkspaceTextInsertPlan {
  const position = editorTextPosition(editor);
  return {
    kind: PLAN_INSERT,
    startByte: byteOffsetForTextPosition(editor.lines, position),
    insertText,
    cursorAfter: positionAfterInsertedText(position, insertText),
  };
}

export function planWorkspaceTextSelectionReplace(
  editor: EditorState,
  selection: WorkspaceTextSelectionRange | undefined,
  insertText: string,
): WorkspaceTextReplacePlan | WorkspaceTextUnsupportedPlan {
  if (selection == null) {
    return unsupportedPlan(UNSUPPORTED_SELECTION);
  }
  const startByte = byteOffsetForTextPosition(editor.lines, {
    row: selection.startRow,
    column: selection.startColumn,
  });
  const endByte = byteOffsetForTextPosition(editor.lines, {
    row: selection.endRow,
    column: selection.endColumn,
  });
  return {
    kind: PLAN_REPLACE,
    startByte: Math.min(startByte, endByte),
    endByte: Math.max(startByte, endByte),
    insertText,
    cursorAfter: positionAfterInsertedText(
      startByte <= endByte
        ? { row: selection.startRow, column: selection.startColumn }
        : { row: selection.endRow, column: selection.endColumn },
      insertText,
    ),
  };
}

export function planWorkspaceTextBackspace(
  editor: EditorState,
): WorkspaceTextDeletePlan | WorkspaceTextUnsupportedPlan {
  const position = editorTextPosition(editor);
  const endByte = byteOffsetForTextPosition(editor.lines, position);
  const startByte = previousByteOffset(editor.lines, position);
  return startByte === endByte
    ? unsupportedPlan(UNSUPPORTED_EMPTY_BACKSPACE)
    : {
      kind: PLAN_DELETE,
      startByte,
      endByte,
      cursorAfter: previousTextPosition(editor.lines, position),
    };
}

export function planWorkspaceTextDeleteUnderCursor(
  editor: EditorState,
): WorkspaceTextDeletePlan | WorkspaceTextUnsupportedPlan {
  const position = editorTextPosition(editor);
  const startByte = byteOffsetForTextPosition(editor.lines, position);
  const endByte = nextByteOffset(editor.lines, position);
  return startByte === endByte
    ? unsupportedPlan(UNSUPPORTED_EMPTY_DELETE)
    : {
      kind: PLAN_DELETE,
      startByte,
      endByte,
      cursorAfter: position,
    };
}

function editorTextPosition(editor: EditorState): TextPosition {
  return {
    row: editor.cursorRow,
    column: editor.cursorCol,
  };
}

function unsupportedPlan(
  reason: WorkspaceTextUnsupportedPlan['reason'],
): WorkspaceTextUnsupportedPlan {
  return {
    kind: PLAN_UNSUPPORTED,
    reason,
  };
}
