import type { KeyMsg } from '@flyingrobots/bijou-tui';
import { clampIndex } from './viewport.js';
import type { EditorState } from './editor/model.js';
import * as editingHelpers from './editor-editing-helpers.js';

const {
  applyPendingOperator,
  enterNormalMode,
  enterInsertAfterCursor,
  enterInsertAtLineEnd,
  enterInsertAtFirstNonWhitespace,
  openLineBelow,
  openLineAbove,
  undo,
  redo,
  deleteCharUnderCursor,
  deleteToLineEnd,
  changeToLineEnd,
  yankCurrentLine,
  moveCursorLeftInsert,
  moveCursorRightInsert,
  moveCursorVerticalInsert,
  moveCursorLeftNormal,
  moveCursorRightNormal,
  moveCursorVerticalNormal,
  moveCursorToLineStart,
  moveCursorToLineEnd,
  moveCursorToFirstNonWhitespace,
  moveCursorToTop,
  moveCursorToBottom,
  moveCursorToWordEnd,
  moveCursorToNextWordStart,
  moveCursorToPreviousWordStart,
  pasteRegister,
  backspace,
  insertText,
  deleteForward,
  insertNewline,
  currentLine,
  keyToText,
  clampNormalCol,
} = editingHelpers;

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
