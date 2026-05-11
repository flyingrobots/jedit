import type { KeyMsg } from '@flyingrobots/bijou-tui';
import { clampIndex } from './viewport.js';
import type { EditorState } from './editor/model.js';
import {
  clampNormalCol,
  currentLine,
  editorText,
  yankTextRange,
  deleteTextRange,
  commitMutation,
  snapshotEditor,
  deleteForward,
  leadingWhitespace,
  lineStartTextIndex,
  nextWordStartIndex,
  normalPositionAtOrBeforeIndex,
  normalTextIndex,
  previousWordStartIndex,
  wordEndIndex,
} from './editor-editing-core.js';

const NORMAL_MODE = 'normal';
const INSERT_MODE = 'insert';

export function applyPendingOperator(
  editor: EditorState,
  operator: 'change' | 'delete' | 'yank',
  msg: KeyMsg,
): EditorState | undefined {
  if (msg.ctrl || msg.alt) {
    return undefined;
  }

  if (!msg.shift) {
    if (operator === 'delete' && msg.key === 'd') {
      return deleteCurrentLine(editor);
    }
    if (operator === 'change' && msg.key === 'c') {
      return changeCurrentLine(editor);
    }
    if (operator === 'yank' && msg.key === 'y') {
      return yankCurrentLine(editor);
    }
    if (msg.key === 'w') {
      return applyWordMotionOperator(editor, operator, 'w');
    }
    if (msg.key === 'e') {
      return applyWordMotionOperator(editor, operator, 'e');
    }
    if (msg.key === '0') {
      return applyLineBoundaryOperator(editor, operator, 'start');
    }
  }

  if (msg.key === '$') {
    return applyLineBoundaryOperator(editor, operator, 'end');
  }

  return undefined;
}

export function applyWordMotionOperator(
  editor: EditorState,
  operator: 'change' | 'delete' | 'yank',
  motion: 'e' | 'w',
): EditorState {
  const text = editorText(editor);
  if (text.length === 0) {
    return operator === 'change'
      ? { ...editor, mode: INSERT_MODE, pendingNormal: undefined }
      : editor;
  }

  const start = normalTextIndex(editor);
  const end = motion === 'w'
    ? nextWordStartIndex(text, start, true)
    : Math.min(text.length, wordEndIndex(text, start) + 1);

  const safeEnd = Math.max(start + 1, end);
  return applyCharwiseOperator(editor, operator, start, Math.min(text.length, safeEnd));
}

export function applyLineBoundaryOperator(
  editor: EditorState,
  operator: 'change' | 'delete' | 'yank',
  boundary: 'end' | 'start',
): EditorState {
  const line = currentLine(editor);
  const lineStart = lineStartTextIndex(editor.lines, editor.cursorRow);
  const cursor = normalTextIndex(editor);
  const from = boundary === 'start' ? lineStart : cursor;
  const to = boundary === 'start' ? cursor + 1 : lineStart + line.length;

  if (from >= to) {
    return operator === 'change'
      ? { ...editor, mode: INSERT_MODE, pendingNormal: undefined }
      : editor;
  }

  return applyCharwiseOperator(editor, operator, from, to);
}

export function applyCharwiseOperator(
  editor: EditorState,
  operator: 'change' | 'delete' | 'yank',
  start: number,
  end: number,
): EditorState {
  if (operator === 'yank') {
    return yankTextRange(editor, start, end, 'char');
  }

  return deleteTextRange(editor, start, end, {
    mode: operator === 'change' ? INSERT_MODE : NORMAL_MODE,
    register: 'char',
  });
}

export function enterNormalMode(editor: EditorState): EditorState {
  const line = currentLine(editor);
  if (line.length === 0) {
    return {
      ...editor,
      mode: NORMAL_MODE,
      cursorCol: 0,
      pendingNormal: undefined,
    };
  }

  const nextCol = Math.max(0, Math.min(editor.cursorCol - 1, line.length - 1));
  return {
    ...editor,
    mode: NORMAL_MODE,
    cursorCol: nextCol,
    pendingNormal: undefined,
  };
}

export function enterInsertAfterCursor(editor: EditorState): EditorState {
  const line = currentLine(editor);
  const nextCol = line.length === 0 ? 0 : Math.min(editor.cursorCol + 1, line.length);
  return {
    ...editor,
    mode: INSERT_MODE,
    cursorCol: nextCol,
    pendingNormal: undefined,
  };
}

export function enterInsertAtLineEnd(editor: EditorState): EditorState {
  return {
    ...editor,
    mode: INSERT_MODE,
    cursorCol: currentLine(editor).length,
    pendingNormal: undefined,
  };
}

export function enterInsertAtFirstNonWhitespace(editor: EditorState): EditorState {
  const line = currentLine(editor);
  const match = line.match(/\S/);
  return {
    ...editor,
    mode: INSERT_MODE,
    cursorCol: match == null ? 0 : (match.index ?? 0),
    pendingNormal: undefined,
  };
}

export function openLineBelow(editor: EditorState): EditorState {
  const nextLines = [
    ...editor.lines.slice(0, editor.cursorRow + 1),
    '',
    ...editor.lines.slice(editor.cursorRow + 1),
  ];

  return commitMutation(editor, {
    lines: nextLines,
    cursorRow: editor.cursorRow + 1,
    cursorCol: 0,
    mode: INSERT_MODE,
    pendingNormal: undefined,
  });
}

export function openLineAbove(editor: EditorState): EditorState {
  const nextLines = [
    ...editor.lines.slice(0, editor.cursorRow),
    '',
    ...editor.lines.slice(editor.cursorRow),
  ];

  return commitMutation(editor, {
    lines: nextLines,
    cursorRow: editor.cursorRow,
    cursorCol: 0,
    mode: INSERT_MODE,
    pendingNormal: undefined,
  });
}

export function undo(editor: EditorState): EditorState {
  const snapshot = editor.undoStack.at(-1);
  if (snapshot == null) {
    return editor;
  }

  return {
    ...editor,
    lines: snapshot.lines,
    cursorRow: snapshot.cursorRow,
    cursorCol: snapshot.cursorCol,
    scrollRow: snapshot.scrollRow,
    scrollCol: snapshot.scrollCol,
    dirty: snapshot.dirty,
    mode: NORMAL_MODE,
    pendingNormal: undefined,
    undoStack: editor.undoStack.slice(0, -1),
    redoStack: [...editor.redoStack, snapshotEditor(editor)],
  };
}

export function redo(editor: EditorState): EditorState {
  const snapshot = editor.redoStack.at(-1);
  if (snapshot == null) {
    return editor;
  }

  return {
    ...editor,
    lines: snapshot.lines,
    cursorRow: snapshot.cursorRow,
    cursorCol: snapshot.cursorCol,
    scrollRow: snapshot.scrollRow,
    scrollCol: snapshot.scrollCol,
    dirty: snapshot.dirty,
    mode: NORMAL_MODE,
    pendingNormal: undefined,
    undoStack: [...editor.undoStack, snapshotEditor(editor)],
    redoStack: editor.redoStack.slice(0, -1),
  };
}

export function deleteCharUnderCursor(editor: EditorState): EditorState {
  if (editor.readOnly) {
    return editor;
  }
  return deleteForward(editor);
}

export function deleteToLineEnd(editor: EditorState): EditorState {
  return deleteTextRange(editor, normalTextIndex(editor), lineStartTextIndex(editor.lines, editor.cursorRow) + currentLine(editor).length,
    {
      mode: NORMAL_MODE,
      register: 'char',
    });
}

export function changeToLineEnd(editor: EditorState): EditorState {
  return deleteToLineEnd(editor).readOnly ? { ...editor, mode: INSERT_MODE, pendingNormal: undefined } : {
    ...editor,
    pendingNormal: undefined,
    mode: INSERT_MODE,
  };
}

export function yankCurrentLine(editor: EditorState): EditorState {
  const line = currentLine(editor);
  const start = lineStartTextIndex(editor.lines, editor.cursorRow);
  return yankTextRange(editor, start, start + line.length, 'line');
}

export function deleteCurrentLine(editor: EditorState): EditorState {
  const line = currentLine(editor);
  const start = lineStartTextIndex(editor.lines, editor.cursorRow);
  const includeLineBreak = editor.cursorRow < editor.lines.length - 1 ? 1 : 0;
  return deleteTextRange(editor, start, start + line.length + includeLineBreak, {
    mode: NORMAL_MODE,
    register: 'line',
  });
}

export function changeCurrentLine(editor: EditorState): EditorState {
  return {
    ...deleteCurrentLine(editor),
    mode: INSERT_MODE,
    pendingNormal: undefined,
  };
}

export function moveCursorLeftInsert(editor: EditorState): EditorState {
  if (editor.cursorCol > 0) {
    return {
      ...editor,
      cursorCol: editor.cursorCol - 1,
      pendingNormal: undefined,
    };
  }

  if (editor.cursorRow === 0) {
    return editor;
  }

  const prevLine = editor.lines[editor.cursorRow - 1] ?? '';
  return {
    ...editor,
    cursorRow: editor.cursorRow - 1,
    cursorCol: prevLine.length,
    pendingNormal: undefined,
  };
}

export function moveCursorRightInsert(editor: EditorState): EditorState {
  const line = currentLine(editor);
  if (editor.cursorCol < line.length) {
    return {
      ...editor,
      cursorCol: editor.cursorCol + 1,
      pendingNormal: undefined,
    };
  }

  if (editor.cursorRow >= editor.lines.length - 1) {
    return editor;
  }

  return {
    ...editor,
    cursorRow: editor.cursorRow + 1,
    cursorCol: 0,
    pendingNormal: undefined,
  };
}

export function moveCursorVerticalInsert(editor: EditorState, delta: number): EditorState {
  const nextRow = clampIndex(editor.cursorRow + delta, editor.lines.length);
  const nextLine = editor.lines[nextRow] ?? '';
  return {
    ...editor,
    cursorRow: nextRow,
    cursorCol: Math.min(editor.cursorCol, nextLine.length),
    pendingNormal: undefined,
  };
}

export function moveCursorLeftNormal(editor: EditorState): EditorState {
  return {
    ...editor,
    cursorCol: Math.max(0, editor.cursorCol - 1),
    pendingNormal: undefined,
  };
}

export function moveCursorRightNormal(editor: EditorState): EditorState {
  const line = currentLine(editor);
  const maxCol = line.length === 0 ? 0 : line.length - 1;
  return {
    ...editor,
    cursorCol: Math.min(maxCol, editor.cursorCol + 1),
    pendingNormal: undefined,
  };
}

export function moveCursorVerticalNormal(editor: EditorState, delta: number): EditorState {
  const nextRow = clampIndex(editor.cursorRow + delta, editor.lines.length);
  const nextLine = editor.lines[nextRow] ?? '';
  return {
    ...editor,
    cursorRow: nextRow,
    cursorCol: clampNormalCol(editor.cursorCol, nextLine),
    pendingNormal: undefined,
  };
}

export function moveCursorToLineStart(editor: EditorState): EditorState {
  return {
    ...editor,
    cursorCol: 0,
    pendingNormal: undefined,
  };
}

export function moveCursorToLineEnd(editor: EditorState): EditorState {
  const line = currentLine(editor);
  return {
    ...editor,
    cursorCol: line.length === 0 ? 0 : line.length - 1,
    pendingNormal: undefined,
  };
}

export function moveCursorToFirstNonWhitespace(editor: EditorState): EditorState {
  return {
    ...editor,
    cursorCol: leadingWhitespace(currentLine(editor)).length,
    pendingNormal: undefined,
  };
}

export function moveCursorToTop(editor: EditorState): EditorState {
  const line = editor.lines[0] ?? '';
  return {
    ...editor,
    cursorRow: 0,
    cursorCol: clampNormalCol(editor.cursorCol, line),
    pendingNormal: undefined,
  };
}

export function moveCursorToBottom(editor: EditorState): EditorState {
  const row = Math.max(0, editor.lines.length - 1);
  const line = editor.lines[row] ?? '';
  return {
    ...editor,
    cursorRow: row,
    cursorCol: clampNormalCol(editor.cursorCol, line),
    pendingNormal: undefined,
  };
}

export function moveCursorToWordEnd(editor: EditorState): EditorState {
  const text = editorText(editor);
  if (text.length === 0) {
    return editor;
  }

  const current = normalTextIndex(editor);
  const next = Math.min(text.length - 1, wordEndIndex(text, current));
  const nextPos = normalPositionAtOrBeforeIndex(editor.lines, next);
  return {
    ...editor,
    cursorRow: nextPos.row,
    cursorCol: nextPos.col,
    pendingNormal: undefined,
  };
}

export function moveCursorToNextWordStart(editor: EditorState): EditorState {
  const text = editorText(editor);
  if (text.length === 0) {
    return editor;
  }

  const target = nextWordStartIndex(text, normalTextIndex(editor));
  const position = normalPositionAtOrBeforeIndex(editor.lines, target);
  return {
    ...editor,
    cursorRow: position.row,
    cursorCol: position.col,
    pendingNormal: undefined,
  };
}

export function moveCursorToPreviousWordStart(editor: EditorState): EditorState {
  const text = editorText(editor);
  if (text.length === 0) {
    return editor;
  }

  const target = previousWordStartIndex(text, normalTextIndex(editor));
  const position = normalPositionAtOrBeforeIndex(editor.lines, target);
  return {
    ...editor,
    cursorRow: position.row,
    cursorCol: position.col,
    pendingNormal: undefined,
  };
}


export * from './editor-editing-core.js';
