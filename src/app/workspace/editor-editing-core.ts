import type { KeyMsg } from '@flyingrobots/bijou-tui';
import { joinLines, normalizeLines } from '../editor-lines.js';
import { EditorModes, type EditorMode } from './editor/mode.js';
import { RegisterKinds, type EditorState, type HistoryEntry, type RegisterKind } from './editor/model.js';
import { EditorKeys, PastePlacements, type PastePlacement } from './editor/key.js';

const NORMAL_MODE = EditorModes.Normal;
const INSERT_MODE = EditorModes.Insert;
const SPACE_KEY = EditorKeys.Space;
const SPACE_TEXT = ' ';
const LOWERCASE_A = 'a';
const LOWERCASE_Z = 'z';
const SINGLE_CHARACTER_KEY_LENGTH = 1;
export const WordClasses = Object.freeze({
  Punct: 'punct',
  Space: 'space',
  Word: 'word',
} as const);

export type WordClass = typeof WordClasses[keyof typeof WordClasses];

export interface DeleteTextRangeOptions {
  readonly mode: EditorMode;
  readonly register: RegisterKind;
}

export interface ReplaceCurrentLineOptions {
  readonly line: string;
  readonly cursorCol: number;
  readonly dirty: boolean;
}

export function pasteRegister(editor: EditorState, placement: PastePlacement): EditorState {
  const register = editor.register;
  if (register == null) {
    return editor;
  }

  if (register.kind === RegisterKinds.Line) {
    const index = placement === PastePlacements.Before ? editor.cursorRow : editor.cursorRow + 1;
    const inserted = register.text.split('\n');
    return commitMutation(editor, {
      lines: [...editor.lines.slice(0, index), ...inserted, ...editor.lines.slice(index)],
      cursorRow: index,
      cursorCol: 0,
      mode: NORMAL_MODE,
    });
  }

  const insertionIndex = placement === PastePlacements.Before
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

export function yankTextRange(
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

export function deleteTextRange(
  editor: EditorState,
  start: number,
  end: number,
  options: DeleteTextRangeOptions,
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

export function backspace(editor: EditorState): EditorState {
  if (editor.cursorCol > 0) {
    const line = currentLine(editor);
    const nextLine = `${line.slice(0, editor.cursorCol - 1)}${line.slice(editor.cursorCol)}`;
    return replaceCurrentLine(editor, {
      line: nextLine,
      cursorCol: editor.cursorCol - 1,
      dirty: true,
    });
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

export function deleteForward(editor: EditorState): EditorState {
  const line = currentLine(editor);
  if (editor.cursorCol < line.length) {
    const nextLine = `${line.slice(0, editor.cursorCol)}${line.slice(editor.cursorCol + 1)}`;
    return replaceCurrentLine(editor, {
      line: nextLine,
      cursorCol: editor.cursorCol,
      dirty: true,
    });
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

export function insertNewline(editor: EditorState): EditorState {
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

export function insertText(editor: EditorState, text: string): EditorState {
  const line = currentLine(editor);
  const nextLine = `${line.slice(0, editor.cursorCol)}${text}${line.slice(editor.cursorCol)}`;
  return replaceCurrentLine(editor, {
    line: nextLine,
    cursorCol: editor.cursorCol + text.length,
    dirty: true,
  });
}

export function replaceCurrentLine(
  editor: EditorState,
  options: ReplaceCurrentLineOptions,
): EditorState {
  const nextLines = editor.lines.map((value, index) => (index === editor.cursorRow ? options.line : value));
  return commitMutation(editor, {
    lines: nextLines,
    cursorCol: options.cursorCol,
    dirty: options.dirty || editor.dirty,
  });
}

export function currentLine(editor: EditorState): string {
  return editor.lines[editor.cursorRow] ?? '';
}

export function leadingWhitespace(line: string): string {
  return line.match(/^\s*/)?.[0] ?? '';
}

export function editorText(editor: EditorState): string {
  return joinLines(editor.lines);
}

export function lineStartTextIndex(lines: readonly string[], row: number): number {
  let index = 0;
  for (let currentRow = 0; currentRow < row; currentRow += 1) {
    index += (lines[currentRow] ?? '').length;
    if (currentRow < lines.length - 1) {
      index += 1;
    }
  }
  return index;
}

export function normalTextIndex(editor: EditorState): number {
  return lineStartTextIndex(editor.lines, editor.cursorRow) + clampNormalCol(editor.cursorCol, currentLine(editor));
}

export function insertPositionAtIndex(lines: readonly string[], index: number): { row: number; col: number } {
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

export function normalPositionAtOrBeforeIndex(lines: readonly string[], index: number): { row: number; col: number } {
  const position = insertPositionAtIndex(lines, index);
  const line = lines[position.row] ?? '';
  return {
    row: position.row,
    col: line.length === 0 ? 0 : Math.min(position.col, line.length - 1),
  };
}

export function nextWordStartIndex(text: string, index: number, allowEnd = false): number {
  if (text.length === 0) {
    return 0;
  }

  let cursor = Math.max(0, Math.min(index, text.length - 1));
  if (classifyWordChar(text[cursor]) === WordClasses.Space) {
    cursor = skipWordClassForward(text, cursor, WordClasses.Space);
  } else {
    const currentClass = classifyWordChar(text[cursor]);
    cursor = skipWordClassForward(text, cursor, currentClass);
    cursor = skipWordClassForward(text, cursor, WordClasses.Space);
  }

  if (allowEnd) {
    return Math.max(0, Math.min(text.length, cursor));
  }

  return Math.max(0, Math.min(text.length - 1, cursor));
}

function skipWordClassForward(text: string, start: number, wordClass: WordClass): number {
  let cursor = start;
  while (cursor < text.length && classifyWordChar(text[cursor]) === wordClass) {
    cursor += 1;
  }
  return cursor;
}

export function previousWordStartIndex(text: string, index: number): number {
  if (text.length === 0) {
    return 0;
  }

  let cursor = Math.max(0, Math.min(index, text.length - 1));
  if (cursor === 0) {
    return 0;
  }

  cursor -= 1;
  while (cursor > 0 && classifyWordChar(text[cursor]) === WordClasses.Space) {
    cursor -= 1;
  }

  const currentClass = classifyWordChar(text[cursor]);
  while (cursor > 0 && classifyWordChar(text[cursor - 1]) === currentClass) {
    cursor -= 1;
  }

  return cursor;
}

export function wordEndIndex(text: string, index: number): number {
  if (text.length === 0) {
    return 0;
  }

  let cursor = Math.max(0, Math.min(index, text.length - 1));
  while (cursor < text.length && classifyWordChar(text[cursor]) === WordClasses.Space) {
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

export function classifyWordChar(char: string | undefined): WordClass {
  if (char == null || /\s/.test(char)) {
    return WordClasses.Space;
  }
  if (/[A-Za-z0-9_]/.test(char)) {
    return WordClasses.Word;
  }
  return WordClasses.Punct;
}

export function keyToText(msg: KeyMsg): string | undefined {
  if (msg.ctrl || msg.alt) {
    return undefined;
  }

  if (msg.key === SPACE_KEY) {
    return SPACE_TEXT;
  }

  if (msg.key.length !== SINGLE_CHARACTER_KEY_LENGTH) {
    return undefined;
  }

  if (msg.shift && msg.key >= LOWERCASE_A && msg.key <= LOWERCASE_Z) {
    return msg.key.toUpperCase();
  }

  return msg.key;
}

export function snapshotEditor(editor: EditorState): HistoryEntry {
  return {
    lines: [...editor.lines],
    cursorRow: editor.cursorRow,
    cursorCol: editor.cursorCol,
    scrollRow: editor.scrollRow,
    scrollCol: editor.scrollCol,
    dirty: editor.dirty,
  };
}

export function commitMutation(editor: EditorState, patch: Partial<EditorState>): EditorState {
  return {
    ...editor,
    undoStack: [...editor.undoStack, snapshotEditor(editor)],
    redoStack: [],
    ...patch,
    dirty: patch.dirty ?? true,
    pendingNormal: undefined,
  };
}

export function clampNormalCol(cursorCol: number, line: string): number {
  if (line.length === 0) {
    return 0;
  }
  return Math.max(0, Math.min(cursorCol, line.length - 1));
}
