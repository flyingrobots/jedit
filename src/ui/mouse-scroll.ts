import type { MouseMsg } from '@flyingrobots/bijou-tui';

const MOUSE_ACTION_SCROLL_UP = 'scroll-up';
const MOUSE_ACTION_SCROLL_DOWN = 'scroll-down';

const NO_SCROLL_DELTA = 0;
const MIN_BOUND = 0;
const MIN_SIZE = 1;
const INDEX_OFFSET = 1;

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
  return NO_SCROLL_DELTA;
}

export function scrollTextViewport<Editor extends MouseScrollableEditor>(editor: Editor, deltaRows: number, viewportHeight: number): Editor {
  const safeHeight = Math.max(MIN_SIZE, viewportHeight);
  const totalRows = Math.max(MIN_SIZE, editor.lines.length);
  const maxScrollRow = Math.max(MIN_BOUND, totalRows - safeHeight);
  const scrollRow = clamp(editor.scrollRow + deltaRows, MIN_BOUND, maxScrollRow);
  const cursorRow = clamp(editor.cursorRow, scrollRow, Math.min(totalRows - INDEX_OFFSET, scrollRow + safeHeight - INDEX_OFFSET));
  const cursorLine = editor.lines[cursorRow] ?? '';

  return {
    ...editor,
    scrollRow,
    cursorRow,
    cursorCol: clamp(editor.cursorCol, MIN_BOUND, cursorLine.length),
  };
}

export function scrollIndexByRows(index: number, total: number, deltaRows: number): number {
  return clamp(index + deltaRows, MIN_BOUND, Math.max(MIN_BOUND, total - INDEX_OFFSET));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}
