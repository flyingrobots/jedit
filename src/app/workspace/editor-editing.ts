import type { KeyMsg } from '@flyingrobots/bijou-tui';
import { clampIndex } from './viewport.js';
import { EditorModes, PendingNormals, PendingOperators as PENDING_OPERATOR, type PendingNormal, type PendingOperator } from './editor/mode.js';
import { EditorKeys as EDITOR_KEY, PastePlacements as PASTE_PLACEMENT } from './editor/key.js';
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

const INSERT_MODE = EditorModes.Insert;
const INSERT_TAB_TEXT = '  ';
const KEY_DESCRIPTOR_SEPARATOR = '|';
const MODIFIER_ACTIVE = '1';
const MODIFIER_INACTIVE = '0';
const PREVIEW_MIN_SCROLL_ROW = 0;
const PREVIEW_SCROLL_STEP = 1;
const NORMAL_CURSOR_CLAMP_SENTINEL = Number.MAX_SAFE_INTEGER;

interface EditorViewport {
  readonly width: number;
  readonly height: number;
}

interface KeyDescriptor {
  readonly key: string;
  readonly ctrl?: boolean;
  readonly alt?: boolean;
  readonly shift?: boolean;
}

interface NormalCommandDefinition extends KeyDescriptor {
  readonly run: (editor: EditorState, viewport: EditorViewport) => EditorState;
}

const PENDING_OPERATOR_BY_TOKEN = new Map<PendingNormal, PendingOperator>([
  [PendingNormals.Change, PENDING_OPERATOR.Change],
  [PendingNormals.Delete, PENDING_OPERATOR.Delete],
  [PendingNormals.Yank, PENDING_OPERATOR.Yank],
]);

const NORMAL_COMMANDS: readonly NormalCommandDefinition[] = [
  { key: EDITOR_KEY.I, run: (editor) => ({ ...editor, mode: INSERT_MODE }) },
  { key: EDITOR_KEY.A, run: (editor) => enterInsertAfterCursor(editor) },
  { key: EDITOR_KEY.A, shift: true, run: (editor) => enterInsertAtLineEnd(editor) },
  { key: EDITOR_KEY.I, shift: true, run: (editor) => enterInsertAtFirstNonWhitespace(editor) },
  { key: EDITOR_KEY.O, run: (editor) => openLineBelow(editor) },
  { key: EDITOR_KEY.O, shift: true, run: (editor) => openLineAbove(editor) },
  { key: EDITOR_KEY.U, run: (editor) => undo(editor) },
  { key: EDITOR_KEY.R, ctrl: true, run: (editor) => redo(editor) },
  { key: EDITOR_KEY.P, run: (editor) => pasteRegister(editor, PASTE_PLACEMENT.After) },
  { key: EDITOR_KEY.P, shift: true, run: (editor) => pasteRegister(editor, PASTE_PLACEMENT.Before) },
  { key: EDITOR_KEY.X, run: (editor) => deleteCharUnderCursor(editor) },
  { key: EDITOR_KEY.W, run: (editor) => moveCursorToNextWordStart(editor) },
  { key: EDITOR_KEY.B, run: (editor) => moveCursorToPreviousWordStart(editor) },
  { key: EDITOR_KEY.E, run: (editor) => moveCursorToWordEnd(editor) },
  { key: EDITOR_KEY.FirstNonWhitespace, run: (editor) => moveCursorToFirstNonWhitespace(editor) },
  { key: EDITOR_KEY.D, run: (editor) => ({ ...editor, pendingNormal: PendingNormals.Delete }) },
  { key: EDITOR_KEY.C, run: (editor) => ({ ...editor, pendingNormal: PendingNormals.Change }) },
  { key: EDITOR_KEY.Y, run: (editor) => ({ ...editor, pendingNormal: PendingNormals.Yank }) },
  { key: EDITOR_KEY.G, run: (editor) => ({ ...editor, pendingNormal: PendingNormals.GoTo }) },
  { key: EDITOR_KEY.G, shift: true, run: (editor) => moveCursorToBottom(editor) },
  { key: EDITOR_KEY.D, shift: true, run: (editor) => deleteToLineEnd(editor) },
  { key: EDITOR_KEY.C, shift: true, run: (editor) => changeToLineEnd(editor) },
  { key: EDITOR_KEY.Y, shift: true, run: (editor) => yankCurrentLine(editor) },
  { key: EDITOR_KEY.LineStart, run: (editor) => moveCursorToLineStart(editor) },
  { key: EDITOR_KEY.LineEnd, run: (editor) => moveCursorToLineEnd(editor) },
  { key: EDITOR_KEY.H, run: (editor) => moveCursorLeftNormal(editor) },
  { key: EDITOR_KEY.Left, run: (editor) => moveCursorLeftNormal(editor) },
  { key: EDITOR_KEY.L, run: (editor) => moveCursorRightNormal(editor) },
  { key: EDITOR_KEY.Right, run: (editor) => moveCursorRightNormal(editor) },
  { key: EDITOR_KEY.J, run: (editor) => moveCursorVerticalNormal(editor, 1) },
  { key: EDITOR_KEY.Down, run: (editor) => moveCursorVerticalNormal(editor, 1) },
  { key: EDITOR_KEY.K, run: (editor) => moveCursorVerticalNormal(editor, -1) },
  { key: EDITOR_KEY.Up, run: (editor) => moveCursorVerticalNormal(editor, -1) },
  { key: EDITOR_KEY.PageUp, run: (editor, viewport) => moveCursorVerticalNormal(editor, -viewport.height) },
  { key: EDITOR_KEY.PageDown, run: (editor, viewport) => moveCursorVerticalNormal(editor, viewport.height) },
  { key: EDITOR_KEY.Home, run: (editor) => moveCursorToLineStart(editor) },
  { key: EDITOR_KEY.End, run: (editor) => moveCursorToLineEnd(editor) },
];

const NORMAL_COMMAND_MAP = new Map<string, NormalCommandDefinition['run']>(
  NORMAL_COMMANDS.map((command) => [keyDescriptorId(command), command.run]),
);

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
    : clampNormalCol(NORMAL_CURSOR_CLAMP_SENTINEL, line);

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
  const viewport = {
    width: Math.max(1, viewportWidth),
    height: Math.max(1, viewportHeight),
  };

  if (msg.key === EDITOR_KEY.Escape) {
    return ensureEditorVisible(enterNormalMode(editor), viewport.width, viewport.height);
  }
  if (editor.readOnly) {
    return editor;
  }
  if (msg.key === EDITOR_KEY.Left) {
    return ensureEditorVisible(moveCursorLeftInsert(editor), viewport.width, viewport.height);
  }
  if (msg.key === EDITOR_KEY.Right) {
    return ensureEditorVisible(moveCursorRightInsert(editor), viewport.width, viewport.height);
  }
  if (msg.key === EDITOR_KEY.Up) {
    return ensureEditorVisible(moveCursorVerticalInsert(editor, -1), viewport.width, viewport.height);
  }
  if (msg.key === EDITOR_KEY.Down) {
    return ensureEditorVisible(moveCursorVerticalInsert(editor, 1), viewport.width, viewport.height);
  }
  if (msg.key === EDITOR_KEY.Home) {
    return ensureEditorVisible({ ...editor, cursorCol: 0 }, viewport.width, viewport.height);
  }
  if (msg.key === EDITOR_KEY.End) {
    return ensureEditorVisible({ ...editor, cursorCol: currentLine(editor).length }, viewport.width, viewport.height);
  }
  if (msg.key === EDITOR_KEY.PageUp) {
    return ensureEditorVisible(moveCursorVerticalInsert(editor, -viewport.height), viewport.width, viewport.height);
  }
  if (msg.key === EDITOR_KEY.PageDown) {
    return ensureEditorVisible(moveCursorVerticalInsert(editor, viewport.height), viewport.width, viewport.height);
  }
  if (msg.key === EDITOR_KEY.Backspace) {
    return ensureEditorVisible(backspace(editor), viewport.width, viewport.height);
  }
  if (msg.key === EDITOR_KEY.Delete) {
    return ensureEditorVisible(deleteForward(editor), viewport.width, viewport.height);
  }
  if (msg.key === EDITOR_KEY.Enter) {
    return ensureEditorVisible(insertNewline(editor), viewport.width, viewport.height);
  }
  if (allowTabIndent && msg.key === EDITOR_KEY.Tab) {
    return ensureEditorVisible(insertText(editor, INSERT_TAB_TEXT), viewport.width, viewport.height);
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

  if (msg.key === EDITOR_KEY.Escape) {
    return ensureEditorVisible({ ...editor, pendingNormal: undefined }, viewport.width, viewport.height);
  }

  if (editor.readOnly) {
    return ensureEditorVisible(editor, viewport.width, viewport.height);
  }

  const pendingResult = applyPendingNormal(editor, msg, viewport);
  if (pendingResult != null) {
    return pendingResult;
  }

  const command = NORMAL_COMMAND_MAP.get(keyDescriptorId(msg));
  if (command != null) {
    return ensureEditorVisible(command(editor, viewport), viewport.width, viewport.height);
  }

  return ensureEditorVisible(editor, viewport.width, viewport.height);
}

function applyPendingNormal(
  editor: EditorState,
  msg: KeyMsg,
  viewport: EditorViewport,
): EditorState | undefined {
  const pending = editor.pendingNormal;
  if (pending == null) {
    return undefined;
  }

  const cleared = { ...editor, pendingNormal: undefined };
  if (pending === PendingNormals.GoTo) {
    if (keyDescriptorId(msg) === keyDescriptorId({ key: EDITOR_KEY.G })) {
      return ensureEditorVisible(moveCursorToTop(cleared), viewport.width, viewport.height);
    }
    return updateNormalMode(cleared, msg, viewport.width, viewport.height);
  }

  const operator = PENDING_OPERATOR_BY_TOKEN.get(pending);
  const operated = operator == null ? undefined : applyPendingOperator(cleared, operator, msg);
  if (operated != null) {
    return ensureEditorVisible(operated, viewport.width, viewport.height);
  }
  return updateNormalMode(cleared, msg, viewport.width, viewport.height);
}

function keyDescriptorId(descriptor: KeyDescriptor): string {
  return [
    modifierId(descriptor.ctrl),
    modifierId(descriptor.alt),
    modifierId(descriptor.shift),
    descriptor.key,
  ].join(KEY_DESCRIPTOR_SEPARATOR);
}

function modifierId(value: boolean | undefined): string {
  return value === true ? MODIFIER_ACTIVE : MODIFIER_INACTIVE;
}

export function scrollPreview(editor: EditorState, msg: KeyMsg, height: number): EditorState {
  const maxScrollRow = Math.max(PREVIEW_MIN_SCROLL_ROW, editor.lines.length - PREVIEW_SCROLL_STEP);
  if (msg.key === EDITOR_KEY.Up || msg.key === EDITOR_KEY.K) {
    return { ...editor, scrollRow: Math.max(PREVIEW_MIN_SCROLL_ROW, editor.scrollRow - PREVIEW_SCROLL_STEP) };
  }
  if (msg.key === EDITOR_KEY.Down || msg.key === EDITOR_KEY.J) {
    return { ...editor, scrollRow: Math.min(maxScrollRow, editor.scrollRow + PREVIEW_SCROLL_STEP) };
  }
  if (msg.key === EDITOR_KEY.PageUp) {
    return { ...editor, scrollRow: Math.max(PREVIEW_MIN_SCROLL_ROW, editor.scrollRow - height) };
  }
  if (msg.key === EDITOR_KEY.PageDown) {
    return { ...editor, scrollRow: Math.min(maxScrollRow, editor.scrollRow + height) };
  }
  return editor;
}
