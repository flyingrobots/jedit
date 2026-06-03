import type { EditorState } from './editor/model.js';
import {
  editorText,
  insertPositionAtIndex,
} from './editor-editing-core.js';
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
const UNSUPPORTED_EMPTY_TRANSITION = 'empty-transition';

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
  EmptyTransition: UNSUPPORTED_EMPTY_TRANSITION,
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
  readonly reason:
    | typeof UNSUPPORTED_SELECTION
    | typeof UNSUPPORTED_EMPTY_BACKSPACE
    | typeof UNSUPPORTED_EMPTY_DELETE
    | typeof UNSUPPORTED_EMPTY_TRANSITION;
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

export function planWorkspaceTextDeleteTransition(
  editor: EditorState,
  nextEditor: EditorState,
): WorkspaceTextDeletePlan | WorkspaceTextUnsupportedPlan {
  const transition = workspaceTextTransition(editor, nextEditor);
  return transition == null || transition.insertText.length > 0
    ? unsupportedPlan(UNSUPPORTED_EMPTY_TRANSITION)
    : {
      kind: PLAN_DELETE,
      startByte: transition.startByte,
      endByte: transition.endByte,
      cursorAfter: transition.cursorAfter,
    };
}

export function planWorkspaceTextDeleteLine(
  editor: EditorState,
  nextEditor: EditorState,
): WorkspaceTextDeletePlan | WorkspaceTextUnsupportedPlan {
  const range = currentLineRange(editor);
  return range.startByte === range.endByte
    ? unsupportedPlan(UNSUPPORTED_EMPTY_TRANSITION)
    : {
      kind: PLAN_DELETE,
      startByte: range.startByte,
      endByte: range.endByte,
      cursorAfter: editorTextPosition(nextEditor),
    };
}

export function planWorkspaceTextReplaceTransition(
  editor: EditorState,
  nextEditor: EditorState,
): WorkspaceTextReplacePlan | WorkspaceTextUnsupportedPlan {
  const transition = workspaceTextTransition(editor, nextEditor);
  return transition == null
    ? unsupportedPlan(UNSUPPORTED_EMPTY_TRANSITION)
    : {
      kind: PLAN_REPLACE,
      startByte: transition.startByte,
      endByte: transition.endByte,
      insertText: transition.insertText,
      cursorAfter: transition.cursorAfter,
    };
}

export function planWorkspaceTextReplaceLine(
  editor: EditorState,
  nextEditor: EditorState,
): WorkspaceTextReplacePlan | WorkspaceTextUnsupportedPlan {
  const range = currentLineRange(editor);
  return range.startByte === range.endByte
    ? unsupportedPlan(UNSUPPORTED_EMPTY_TRANSITION)
    : {
      kind: PLAN_REPLACE,
      startByte: range.startByte,
      endByte: range.endByte,
      insertText: '',
      cursorAfter: editorTextPosition(nextEditor),
    };
}

function editorTextPosition(editor: EditorState): TextPosition {
  return {
    row: editor.cursorRow,
    column: editor.cursorCol,
  };
}

function currentLineRange(editor: EditorState): WorkspaceTextRange {
  const row = Math.max(0, Math.min(editor.cursorRow, Math.max(0, editor.lines.length - 1)));
  const line = editor.lines[row] ?? '';
  return {
    startByte: byteOffsetForTextPosition(editor.lines, { row, column: 0 }),
    endByte: byteOffsetForTextPosition(editor.lines, lineEndPosition(editor, row, line)),
  };
}

function lineEndPosition(editor: EditorState, row: number, line: string): TextPosition {
  return row < editor.lines.length - 1
    ? { row: row + 1, column: 0 }
    : { row, column: line.length };
}

function workspaceTextTransition(
  editor: EditorState,
  nextEditor: EditorState,
): WorkspaceTextTransition | undefined {
  const before = editorText(editor);
  const after = editorText(nextEditor);
  const prefixLength = commonPrefixLength(before, after);
  const suffixLength = commonSuffixLength(before, after, prefixLength);
  const endIndex = before.length - suffixLength;
  if (prefixLength === endIndex && suffixLength === after.length - prefixLength) {
    return undefined;
  }
  const start = textPositionAtIndex(editor.lines, prefixLength);
  const end = textPositionAtIndex(editor.lines, endIndex);
  return {
    startByte: byteOffsetForTextPosition(editor.lines, start),
    endByte: byteOffsetForTextPosition(editor.lines, end),
    insertText: after.slice(prefixLength, after.length - suffixLength),
    cursorAfter: editorTextPosition(nextEditor),
  };
}

function textPositionAtIndex(lines: readonly string[], index: number): TextPosition {
  const position = insertPositionAtIndex(lines, index);
  return {
    row: position.row,
    column: position.col,
  };
}

function commonPrefixLength(before: string, after: string): number {
  let index = 0;
  while (index < before.length && index < after.length && before[index] === after[index]) {
    index += 1;
  }
  return index;
}

function commonSuffixLength(before: string, after: string, prefixLength: number): number {
  let length = 0;
  while (shouldExtendCommonSuffix(before, after, prefixLength, length)) {
    length += 1;
  }
  return length;
}

function shouldExtendCommonSuffix(
  before: string,
  after: string,
  prefixLength: number,
  suffixLength: number,
): boolean {
  const beforeIndex = before.length - suffixLength - 1;
  const afterIndex = after.length - suffixLength - 1;
  return beforeIndex >= prefixLength
    && afterIndex >= prefixLength
    && before[beforeIndex] === after[afterIndex];
}

interface WorkspaceTextTransition {
  readonly startByte: number;
  readonly endByte: number;
  readonly insertText: string;
  readonly cursorAfter: TextPosition;
}

interface WorkspaceTextRange {
  readonly startByte: number;
  readonly endByte: number;
}

function unsupportedPlan(
  reason: WorkspaceTextUnsupportedPlan['reason'],
): WorkspaceTextUnsupportedPlan {
  return {
    kind: PLAN_UNSUPPORTED,
    reason,
  };
}
