import type { MouseMsg } from '@flyingrobots/bijou-tui';

const MOUSE_ACTION_SCROLL_UP = 'scroll-up';
const MOUSE_ACTION_SCROLL_DOWN = 'scroll-down';

export const MOUSE_SCROLL_LINE_STEP = 3;

export interface MouseScrollableEditor {
  readonly lines: readonly string[];
  readonly cursorRow: number;
  readonly cursorCol: number;
  readonly scrollRow: number;
}

export function mouseScrollDeltaRows(msg: Pick<MouseMsg, 'action'>): number {
  if (msg.action === MOUSE_ACTION_SCROLL_UP) {
    return -MOUSE_SCROLL_LINE_STEP;
  }
  if (msg.action === MOUSE_ACTION_SCROLL_DOWN) {
    return MOUSE_SCROLL_LINE_STEP;
  }
  return 0;
}

export function scrollTextViewport<Editor extends MouseScrollableEditor>(editor: Editor, deltaRows: number, viewportHeight: number): Editor {
  const safeHeight = Math.max(1, viewportHeight);
  const totalRows = Math.max(1, editor.lines.length);
  const maxScrollRow = Math.max(0, totalRows - safeHeight);
  const scrollRow = clamp(editor.scrollRow + deltaRows, 0, maxScrollRow);
  const cursorRow = clamp(editor.cursorRow, scrollRow, Math.min(totalRows - 1, scrollRow + safeHeight - 1));
  const cursorLine = editor.lines[cursorRow] ?? '';

  return {
    ...editor,
    scrollRow,
    cursorRow,
    cursorCol: clamp(editor.cursorCol, 0, cursorLine.length),
  };
}

export function scrollIndexByRows(index: number, total: number, deltaRows: number): number {
  return clamp(index + deltaRows, 0, Math.max(0, total - 1));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}
