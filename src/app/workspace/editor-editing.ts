import type { KeyMsg } from '@flyingrobots/bijou-tui';
import { joinLines, normalizeLines } from '../editor-lines.js';
import { clampIndex } from './viewport.js';
import type { EditorMode } from './editor/mode.js';
import type { EditorState, HistoryEntry, RegisterKind } from './editor/model.js';

const NORMAL_MODE = 'normal';
const INSERT_MODE = 'insert';

export function ensureEditorVisible(editor: EditorState, width: number, height: number): EditorState {
  const normalized = normalizeEditor(editor);
  const line = currentLine(normalized);
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);

  let scrollRow = normalized.scrollRow;
  let scrollCol = normalized.scrollCol;

  if (normalized.cursorRow < scrollRow) {
    scrollRow = normalized.cursorRow;
  } else if (normalized.cursorRow >= scrollRow + safeHeight) {
    scrollRow = normalized.cursorRow - safeHeight + 1;
  }

  if (normalized.cursorCol < scrollCol) {
    scrollCol = normalized.cursorCol;
  } else if (normalized.cursorCol >= scrollCol + safeWidth) {
    scrollCol = normalized.cursorCol - safeWidth + 1;
  }

  const maxScrollCol = Math.max(0, line.length - safeWidth + 1);

  return {
    ...normalized,
    scrollRow: Math.max(0, scrollRow),
    scrollCol: Math.max(0, Math.min(scrollCol, maxScrollCol)),
  };
}

export function normalizeEditor(editor: EditorState): EditorState {
  const row = clampIndex(editor.cursorRow, editor.lines.length);
  const line = editor.lines[row] ?? '';
  const maxCol = editor.mode === INSERT_MODE
    ? line.length
    : clampNormalCol(Number.MAX_SAFE_INTEGER, line);

  return {
    ...editor,
    cursorRow: row,
    cursorCol: Math.max(0, Math.min(editor.cursorCol, maxCol)),
  };
}

export function updateInsertMode(
  editor: EditorState,
  msg: KeyMsg,
  viewportWidth: number,
  viewportHeight: number,
  allowTabIndent: boolean,
): EditorState {
  if (editor.readOnly) {
    return editor;
  }
  const viewport = {
    width: Math.max(1, viewportWidth),
    height: Math.max(1, viewportHeight),
  };

  if (msg.key === 'escape') {
    return ensureEditorVisible(enterNormalMode(editor), viewport.width, viewport.height);
  }
  if (msg.key === 'left') {
    return ensureEditorVisible(moveCursorLeftInsert(editor), viewport.width, viewport.height);
  }
  if (msg.key === 'right') {
    return ensureEditorVisible(moveCursorRightInsert(editor), viewport.width, viewport.height);
  }
  if (msg.key === 'up') {
    return ensureEditorVisible(moveCursorVerticalInsert(editor, -1), viewport.width, viewport.height);
  }
  if (msg.key === 'down') {
    return ensureEditorVisible(moveCursorVerticalInsert(editor, 1), viewport.width, viewport.height);
  }
  if (msg.key === 'home') {
    return ensureEditorVisible({ ...editor, cursorCol: 0 }, viewport.width, viewport.height);
  }
  if (msg.key === 'end') {
    return ensureEditorVisible({ ...editor, cursorCol: currentLine(editor).length }, viewport.width, viewport.height);
  }
  if (msg.key === 'pageup') {
    return ensureEditorVisible(moveCursorVerticalInsert(editor, -viewport.height), viewport.width, viewport.height);
  }
  if (msg.key === 'pagedown') {
    return ensureEditorVisible(moveCursorVerticalInsert(editor, viewport.height), viewport.width, viewport.height);
  }
  if (msg.key === 'backspace') {
    return ensureEditorVisible(backspace(editor), viewport.width, viewport.height);
  }
  if (msg.key === 'delete') {
    return ensureEditorVisible(deleteForward(editor), viewport.width, viewport.height);
  }
  if (msg.key === 'enter') {
    return ensureEditorVisible(insertNewline(editor), viewport.width, viewport.height);
  }
  if (allowTabIndent && msg.key === 'tab') {
    return ensureEditorVisible(insertText(editor, '  '), viewport.width, viewport.height);
  }

  const inserted = keyToText(msg);
  if (inserted != null) {
    return ensureEditorVisible(insertText(editor, inserted), viewport.width, viewport.height);
  }

  return ensureEditorVisible(editor, viewport.width, viewport.height);
}

export function updateNormalMode(
  editor: EditorState,
  msg: KeyMsg,
  viewportWidth: number,
  viewportHeight: number,
): EditorState {
  const viewport = {
    width: Math.max(1, viewportWidth),
    height: Math.max(1, viewportHeight),
  };

  if (msg.key === 'escape') {
    return ensureEditorVisible({ ...editor, pendingNormal: undefined }, viewport.width, viewport.height);
  }

  if (editor.pendingNormal === 'd') {
    const cleared = { ...editor, pendingNormal: undefined };
    const operated = applyPendingOperator(cleared, 'delete', msg);
    if (operated != null) {
      return ensureEditorVisible(operated, viewport.width, viewport.height);
    }
    return updateNormalMode(cleared, msg, viewport.width, viewport.height);
  }

  if (editor.pendingNormal === 'c') {
    const cleared = { ...editor, pendingNormal: undefined };
    const operated = applyPendingOperator(cleared, 'change', msg);
    if (operated != null) {
      return ensureEditorVisible(operated, viewport.width, viewport.height);
    }
    return updateNormalMode(cleared, msg, viewport.width, viewport.height);
  }

  if (editor.pendingNormal === 'y') {
    const cleared = { ...editor, pendingNormal: undefined };
    const operated = applyPendingOperator(cleared, 'yank', msg);
    if (operated != null) {
      return ensureEditorVisible(operated, viewport.width, viewport.height);
    }
    return updateNormalMode(cleared, msg, viewport.width, viewport.height);
  }

  if (editor.pendingNormal === 'g') {
    const cleared = { ...editor, pendingNormal: undefined };
    if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'g') {
      return ensureEditorVisible(moveCursorToTop(cleared), viewport.width, viewport.height);
    }
    return updateNormalMode(cleared, msg, viewport.width, viewport.height);
  }

  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'i') {
    return ensureEditorVisible({ ...editor, mode: INSERT_MODE }, viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'a') {
    return ensureEditorVisible(enterInsertAfterCursor(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.shift && msg.key === 'a') {
    return ensureEditorVisible(enterInsertAtLineEnd(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.shift && msg.key === 'i') {
    return ensureEditorVisible(enterInsertAtFirstNonWhitespace(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'o') {
    return ensureEditorVisible(openLineBelow(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.shift && msg.key === 'o') {
    return ensureEditorVisible(openLineAbove(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'u') {
    return ensureEditorVisible(undo(editor), viewport.width, viewport.height);
  }
  if (msg.ctrl && !msg.alt && !msg.shift && msg.key === 'r') {
    return ensureEditorVisible(redo(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'p') {
    return ensureEditorVisible(pasteRegister(editor, 'after'), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.shift && msg.key === 'p') {
    return ensureEditorVisible(pasteRegister(editor, 'before'), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'x') {
    return ensureEditorVisible(deleteCharUnderCursor(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'w') {
    return ensureEditorVisible(moveCursorToNextWordStart(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'b') {
    return ensureEditorVisible(moveCursorToPreviousWordStart(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'e') {
    return ensureEditorVisible(moveCursorToWordEnd(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === '^') {
    return ensureEditorVisible(moveCursorToFirstNonWhitespace(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'd') {
    return ensureEditorVisible({ ...editor, pendingNormal: 'd' }, viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'c') {
    return ensureEditorVisible({ ...editor, pendingNormal: 'c' }, viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'y') {
    return ensureEditorVisible({ ...editor, pendingNormal: 'y' }, viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === 'g') {
    return ensureEditorVisible({ ...editor, pendingNormal: 'g' }, viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.shift && msg.key === 'g') {
    return ensureEditorVisible(moveCursorToBottom(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.shift && msg.key === 'd') {
    return ensureEditorVisible(deleteToLineEnd(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.shift && msg.key === 'c') {
    return ensureEditorVisible(changeToLineEnd(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.shift && msg.key === 'y') {
    return ensureEditorVisible(yankCurrentLine(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === '0') {
    return ensureEditorVisible(moveCursorToLineStart(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && !msg.shift && msg.key === '$') {
    return ensureEditorVisible(moveCursorToLineEnd(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && (msg.key === 'h' || msg.key === 'left')) {
    return ensureEditorVisible(moveCursorLeftNormal(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && (msg.key === 'l' || msg.key === 'right')) {
    return ensureEditorVisible(moveCursorRightNormal(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && (msg.key === 'j' || msg.key === 'down')) {
    return ensureEditorVisible(moveCursorVerticalNormal(editor, 1), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && (msg.key === 'k' || msg.key === 'up')) {
    return ensureEditorVisible(moveCursorVerticalNormal(editor, -1), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.key === 'pageup') {
    return ensureEditorVisible(moveCursorVerticalNormal(editor, -viewport.height), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.key === 'pagedown') {
    return ensureEditorVisible(moveCursorVerticalNormal(editor, viewport.height), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.key === 'home') {
    return ensureEditorVisible(moveCursorToLineStart(editor), viewport.width, viewport.height);
  }
  if (!msg.ctrl && !msg.alt && msg.key === 'end') {
    return ensureEditorVisible(moveCursorToLineEnd(editor), viewport.width, viewport.height);
  }

  return ensureEditorVisible(editor, viewport.width, viewport.height);
}

export function scrollPreview(editor: EditorState, msg: KeyMsg, height: number): EditorState {
  if (msg.key === 'up' || msg.key === 'k') {
    return { ...editor, scrollRow: Math.max(0, editor.scrollRow - 1) };
  }
  if (msg.key === 'down' || msg.key === 'j') {
    return { ...editor, scrollRow: editor.scrollRow + 1 };
  }
  if (msg.key === 'pageup') {
    return { ...editor, scrollRow: Math.max(0, editor.scrollRow - height) };
  }
  if (msg.key === 'pagedown') {
    return { ...editor, scrollRow: editor.scrollRow + height };
  }
  return editor;
}

function applyPendingOperator(
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

function applyWordMotionOperator(
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

function applyLineBoundaryOperator(
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

function applyCharwiseOperator(
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

function enterNormalMode(editor: EditorState): EditorState {
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

function enterInsertAfterCursor(editor: EditorState): EditorState {
  const line = currentLine(editor);
  const nextCol = line.length === 0 ? 0 : Math.min(editor.cursorCol + 1, line.length);
  return {
    ...editor,
    mode: INSERT_MODE,
    cursorCol: nextCol,
    pendingNormal: undefined,
  };
}

function enterInsertAtLineEnd(editor: EditorState): EditorState {
  return {
    ...editor,
    mode: INSERT_MODE,
    cursorCol: currentLine(editor).length,
    pendingNormal: undefined,
  };
}

function enterInsertAtFirstNonWhitespace(editor: EditorState): EditorState {
  const line = currentLine(editor);
  const match = line.match(/\S/);
  return {
    ...editor,
    mode: INSERT_MODE,
    cursorCol: match == null ? 0 : (match.index ?? 0),
    pendingNormal: undefined,
  };
}

function openLineBelow(editor: EditorState): EditorState {
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

function openLineAbove(editor: EditorState): EditorState {
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

function undo(editor: EditorState): EditorState {
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

function redo(editor: EditorState): EditorState {
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

function deleteCharUnderCursor(editor: EditorState): EditorState {
  if (editor.readOnly) {
    return editor;
  }
  return deleteForward(editor);
}

function deleteToLineEnd(editor: EditorState): EditorState {
  return deleteTextRange(editor, normalTextIndex(editor), lineStartTextIndex(editor.lines, editor.cursorRow) + currentLine(editor).length,
    {
      mode: NORMAL_MODE,
      register: 'char',
    });
}

function changeToLineEnd(editor: EditorState): EditorState {
  return deleteToLineEnd(editor).readOnly ? { ...editor, mode: INSERT_MODE, pendingNormal: undefined } : {
    ...editor,
    pendingNormal: undefined,
    mode: INSERT_MODE,
  };
}

function yankCurrentLine(editor: EditorState): EditorState {
  const line = currentLine(editor);
  const start = lineStartTextIndex(editor.lines, editor.cursorRow);
  return yankTextRange(editor, start, start + line.length, 'line');
}

function deleteCurrentLine(editor: EditorState): EditorState {
  const line = currentLine(editor);
  const start = lineStartTextIndex(editor.lines, editor.cursorRow);
  const includeLineBreak = editor.cursorRow < editor.lines.length - 1 ? 1 : 0;
  return deleteTextRange(editor, start, start + line.length + includeLineBreak, {
    mode: NORMAL_MODE,
    register: 'line',
  });
}

function changeCurrentLine(editor: EditorState): EditorState {
  return {
    ...deleteCurrentLine(editor),
    mode: INSERT_MODE,
    pendingNormal: undefined,
  };
}

function moveCursorLeftInsert(editor: EditorState): EditorState {
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

function moveCursorRightInsert(editor: EditorState): EditorState {
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

function moveCursorVerticalInsert(editor: EditorState, delta: number): EditorState {
  const nextRow = clampIndex(editor.cursorRow + delta, editor.lines.length);
  const nextLine = editor.lines[nextRow] ?? '';
  return {
    ...editor,
    cursorRow: nextRow,
    cursorCol: Math.min(editor.cursorCol, nextLine.length),
    pendingNormal: undefined,
  };
}

function moveCursorLeftNormal(editor: EditorState): EditorState {
  return {
    ...editor,
    cursorCol: Math.max(0, editor.cursorCol - 1),
    pendingNormal: undefined,
  };
}

function moveCursorRightNormal(editor: EditorState): EditorState {
  const line = currentLine(editor);
  const maxCol = line.length === 0 ? 0 : line.length - 1;
  return {
    ...editor,
    cursorCol: Math.min(maxCol, editor.cursorCol + 1),
    pendingNormal: undefined,
  };
}

function moveCursorVerticalNormal(editor: EditorState, delta: number): EditorState {
  const nextRow = clampIndex(editor.cursorRow + delta, editor.lines.length);
  const nextLine = editor.lines[nextRow] ?? '';
  return {
    ...editor,
    cursorRow: nextRow,
    cursorCol: clampNormalCol(editor.cursorCol, nextLine),
    pendingNormal: undefined,
  };
}

function moveCursorToLineStart(editor: EditorState): EditorState {
  return {
    ...editor,
    cursorCol: 0,
    pendingNormal: undefined,
  };
}

function moveCursorToLineEnd(editor: EditorState): EditorState {
  const line = currentLine(editor);
  return {
    ...editor,
    cursorCol: line.length === 0 ? 0 : line.length - 1,
    pendingNormal: undefined,
  };
}

function moveCursorToFirstNonWhitespace(editor: EditorState): EditorState {
  return {
    ...editor,
    cursorCol: leadingWhitespace(currentLine(editor)).length,
    pendingNormal: undefined,
  };
}

function moveCursorToTop(editor: EditorState): EditorState {
  const line = editor.lines[0] ?? '';
  return {
    ...editor,
    cursorRow: 0,
    cursorCol: clampNormalCol(editor.cursorCol, line),
    pendingNormal: undefined,
  };
}

function moveCursorToBottom(editor: EditorState): EditorState {
  const row = Math.max(0, editor.lines.length - 1);
  const line = editor.lines[row] ?? '';
  return {
    ...editor,
    cursorRow: row,
    cursorCol: clampNormalCol(editor.cursorCol, line),
    pendingNormal: undefined,
  };
}

function moveCursorToWordEnd(editor: EditorState): EditorState {
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

function moveCursorToNextWordStart(editor: EditorState): EditorState {
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

function moveCursorToPreviousWordStart(editor: EditorState): EditorState {
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

function pasteRegister(editor: EditorState, placement: 'before' | 'after'): EditorState {
  const register = editor.register;
  if (register == null) {
    return editor;
  }

  if (register.kind === 'line') {
    const index = placement === 'before' ? editor.cursorRow : editor.cursorRow + 1;
    const inserted = register.text.split('\n');
    return commitMutation(editor, {
      lines: [...editor.lines.slice(0, index), ...inserted, ...editor.lines.slice(index)],
      cursorRow: index,
      cursorCol: 0,
      mode: NORMAL_MODE,
    });
  }

  const insertionIndex = placement === 'before'
    ? normalTextIndex(editor)
    : normalTextIndex(editor) + (currentLine(editor).length === 0 ? 0 : 1);
  const text = editorText(editor);
  const nextText = `${text.slice(0, insertionIndex)}${register.text}${text.slice(insertionIndex)}`;
  const nextLines = normalizeLines(nextText);
  const position = normalPositionAtOrBeforeIndex(nextLines, insertionIndex + register.text.length - 1);

  return commitMutation(editor, {
    lines: nextLines,
    cursorRow: position.row,
    cursorCol: position.col,
    mode: NORMAL_MODE,
  });
}

function yankTextRange(
  editor: EditorState,
  start: number,
  end: number,
  kind: RegisterKind,
): EditorState {
  const text = editorText(editor);
  const from = Math.max(0, Math.min(start, end));
  const to = Math.max(from, Math.min(text.length, Math.max(start, end)));

  return {
    ...editor,
    register: {
      kind,
      text: text.slice(from, to),
    },
    pendingNormal: undefined,
  };
}

function deleteTextRange(
  editor: EditorState,
  start: number,
  end: number,
  options: {
    readonly mode: EditorMode;
    readonly register: RegisterKind;
  },
): EditorState {
  const text = editorText(editor);
  const from = Math.max(0, Math.min(start, end));
  const to = Math.max(from, Math.min(text.length, Math.max(start, end)));
  if (from === to) {
    return options.mode === INSERT_MODE
      ? { ...editor, mode: INSERT_MODE, pendingNormal: undefined }
      : editor;
  }

  const nextText = `${text.slice(0, from)}${text.slice(to)}`;
  const nextLines = normalizeLines(nextText);
  const position = options.mode === INSERT_MODE
    ? insertPositionAtIndex(nextLines, from)
    : normalPositionAtOrBeforeIndex(nextLines, from);

  return commitMutation(editor, {
    lines: nextLines,
    cursorRow: position.row,
    cursorCol: position.col,
    mode: options.mode,
    register: {
      kind: options.register,
      text: text.slice(from, to),
    },
  });
}

function backspace(editor: EditorState): EditorState {
  if (editor.cursorCol > 0) {
    const line = currentLine(editor);
    const nextLine = `${line.slice(0, editor.cursorCol - 1)}${line.slice(editor.cursorCol)}`;
    return replaceCurrentLine(editor, nextLine, editor.cursorCol - 1, true);
  }

  if (editor.cursorRow === 0) {
    return editor;
  }

  const prevLine = editor.lines[editor.cursorRow - 1] ?? '';
  const line = currentLine(editor);
  const nextLines = [...editor.lines.slice(0, editor.cursorRow - 1), `${prevLine}${line}`, ...editor.lines.slice(editor.cursorRow + 1)];

  return commitMutation(editor, {
    lines: nextLines,
    cursorRow: editor.cursorRow - 1,
    cursorCol: prevLine.length,
  });
}

function deleteForward(editor: EditorState): EditorState {
  const line = currentLine(editor);
  if (editor.cursorCol < line.length) {
    const nextLine = `${line.slice(0, editor.cursorCol)}${line.slice(editor.cursorCol + 1)}`;
    return replaceCurrentLine(editor, nextLine, editor.cursorCol, true);
  }

  if (editor.cursorRow >= editor.lines.length - 1) {
    return editor;
  }

  const nextLine = editor.lines[editor.cursorRow + 1] ?? '';
  const merged = `${line}${nextLine}`;
  const nextLines = [
    ...editor.lines.slice(0, editor.cursorRow),
    merged,
    ...editor.lines.slice(editor.cursorRow + 2),
  ];

  return commitMutation(editor, {
    lines: nextLines,
  });
}

function insertNewline(editor: EditorState): EditorState {
  const line = currentLine(editor);
  const before = line.slice(0, editor.cursorCol);
  const after = line.slice(editor.cursorCol);
  const nextLines = [...editor.lines.slice(0, editor.cursorRow), before, after, ...editor.lines.slice(editor.cursorRow + 1)];

  return commitMutation(editor, {
    lines: nextLines,
    cursorRow: editor.cursorRow + 1,
    cursorCol: 0,
  });
}

function insertText(editor: EditorState, text: string): EditorState {
  const line = currentLine(editor);
  const nextLine = `${line.slice(0, editor.cursorCol)}${text}${line.slice(editor.cursorCol)}`;
  return replaceCurrentLine(editor, nextLine, editor.cursorCol + text.length, true);
}

function replaceCurrentLine(
  editor: EditorState,
  line: string,
  cursorCol: number,
  dirty: boolean,
): EditorState {
  const nextLines = editor.lines.map((value, index) => (index === editor.cursorRow ? line : value));
  return commitMutation(editor, {
    lines: nextLines,
    cursorCol,
    dirty: dirty || editor.dirty,
  });
}

function currentLine(editor: EditorState): string {
  return editor.lines[editor.cursorRow] ?? '';
}

function leadingWhitespace(line: string): string {
  return line.match(/^\s*/)?.[0] ?? '';
}

function editorText(editor: EditorState): string {
  return joinLines(editor.lines);
}

function lineStartTextIndex(lines: readonly string[], row: number): number {
  let index = 0;
  for (let currentRow = 0; currentRow < row; currentRow += 1) {
    index += (lines[currentRow] ?? '').length;
    if (currentRow < lines.length - 1) {
      index += 1;
    }
  }
  return index;
}

function normalTextIndex(editor: EditorState): number {
  return lineStartTextIndex(editor.lines, editor.cursorRow) + clampNormalCol(editor.cursorCol, currentLine(editor));
}

function insertPositionAtIndex(lines: readonly string[], index: number): { row: number; col: number } {
  let remaining = Math.max(0, index);

  for (let row = 0; row < lines.length; row += 1) {
    const line = lines[row] ?? '';
    if (remaining <= line.length) {
      return { row, col: remaining };
    }

    remaining -= line.length;
    if (row < lines.length - 1) {
      remaining -= 1;
    }
  }

  const lastRow = Math.max(0, lines.length - 1);
  return {
    row: lastRow,
    col: (lines[lastRow] ?? '').length,
  };
}

function normalPositionAtOrBeforeIndex(lines: readonly string[], index: number): { row: number; col: number } {
  const position = insertPositionAtIndex(lines, index);
  const line = lines[position.row] ?? '';
  return {
    row: position.row,
    col: line.length === 0 ? 0 : Math.min(position.col, line.length - 1),
  };
}

function nextWordStartIndex(text: string, index: number, allowEnd = false): number {
  if (text.length === 0) {
    return 0;
  }

  let cursor = Math.max(0, Math.min(index, text.length - 1));
  if (classifyWordChar(text[cursor]) === 'space') {
    while (cursor < text.length && classifyWordChar(text[cursor]) === 'space') {
      cursor += 1;
    }
  } else {
    const currentClass = classifyWordChar(text[cursor]);
    while (cursor < text.length && classifyWordChar(text[cursor]) === currentClass) {
      cursor += 1;
    }
    while (cursor < text.length && classifyWordChar(text[cursor]) === 'space') {
      cursor += 1;
    }
  }

  if (allowEnd) {
    return Math.max(0, Math.min(text.length, cursor));
  }

  return Math.max(0, Math.min(text.length - 1, cursor));
}

function previousWordStartIndex(text: string, index: number): number {
  if (text.length === 0) {
    return 0;
  }

  let cursor = Math.max(0, Math.min(index, text.length - 1));
  if (cursor === 0) {
    return 0;
  }

  cursor -= 1;
  while (cursor > 0 && classifyWordChar(text[cursor]) === 'space') {
    cursor -= 1;
  }

  const currentClass = classifyWordChar(text[cursor]);
  while (cursor > 0 && classifyWordChar(text[cursor - 1]) === currentClass) {
    cursor -= 1;
  }

  return cursor;
}

function wordEndIndex(text: string, index: number): number {
  if (text.length === 0) {
    return 0;
  }

  let cursor = Math.max(0, Math.min(index, text.length - 1));
  while (cursor < text.length && classifyWordChar(text[cursor]) === 'space') {
    cursor += 1;
  }
  if (cursor >= text.length) {
    return text.length - 1;
  }

  const currentClass = classifyWordChar(text[cursor]);
  while (cursor < text.length - 1 && classifyWordChar(text[cursor + 1]) === currentClass) {
    cursor += 1;
  }

  return cursor;
}

function classifyWordChar(char: string | undefined): 'punct' | 'space' | 'word' {
  if (char == null || /\s/.test(char)) {
    return 'space';
  }
  if (/[A-Za-z0-9_]/.test(char)) {
    return 'word';
  }
  return 'punct';
}

function keyToText(msg: KeyMsg): string | undefined {
  if (msg.ctrl || msg.alt) {
    return undefined;
  }

  if (msg.key === 'space') {
    return ' ';
  }

  if (msg.key.length !== 1) {
    return undefined;
  }

  if (msg.shift && msg.key >= 'a' && msg.key <= 'z') {
    return msg.key.toUpperCase();
  }

  return msg.key;
}

function snapshotEditor(editor: EditorState): HistoryEntry {
  return {
    lines: [...editor.lines],
    cursorRow: editor.cursorRow,
    cursorCol: editor.cursorCol,
    scrollRow: editor.scrollRow,
    scrollCol: editor.scrollCol,
    dirty: editor.dirty,
  };
}

function commitMutation(editor: EditorState, patch: Partial<EditorState>): EditorState {
  return {
    ...editor,
    undoStack: [...editor.undoStack, snapshotEditor(editor)],
    redoStack: [],
    ...patch,
    dirty: patch.dirty ?? true,
    pendingNormal: undefined,
  };
}

function clampNormalCol(cursorCol: number, line: string): number {
  if (line.length === 0) {
    return 0;
  }
  return Math.max(0, Math.min(cursorCol, line.length - 1));
}
