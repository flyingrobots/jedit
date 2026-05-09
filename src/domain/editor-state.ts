import { joinLines } from '../app/editor-lines.js';

export type ViewMode = 'source' | 'preview';
export type EditorMode = 'normal' | 'insert';
export type PendingNormal = 'c' | 'd' | 'g' | 'y';
export type RegisterKind = 'char' | 'line';

export interface RegisterState {
  readonly kind: RegisterKind;
  readonly text: string;
}

export interface HistoryEntry {
  readonly lines: readonly string[];
  readonly cursorRow: number;
  readonly cursorCol: number;
  readonly scrollRow: number;
  readonly scrollCol: number;
  readonly dirty: boolean;
}

export interface EditorState {
  readonly path: string;
  readonly lines: readonly string[];
  readonly cursorRow: number;
  readonly cursorCol: number;
  readonly scrollRow: number;
  readonly scrollCol: number;
  readonly dirty: boolean;
  readonly readOnly: boolean;
  readonly mode: EditorMode;
  readonly pendingNormal?: PendingNormal;
  readonly register?: RegisterState;
  readonly undoStack: readonly HistoryEntry[];
  readonly redoStack: readonly HistoryEntry[];
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

export function clampNormalCol(cursorCol: number, line: string): number {
  if (line.length === 0) {
    return 0;
  }
  return Math.max(0, Math.min(cursorCol, line.length - 1));
}

export function normalizeEditor(editor: EditorState): EditorState {
  const row = Math.max(0, Math.min(editor.cursorRow, editor.lines.length - 1));
  const line = editor.lines[row] ?? '';
  const maxCol = editor.mode === 'insert'
    ? line.length
    : clampNormalCol(Number.MAX_SAFE_INTEGER, line);

  return {
    ...editor,
    cursorRow: row,
    cursorCol: Math.max(0, Math.min(editor.cursorCol, maxCol)),
  };
}

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
