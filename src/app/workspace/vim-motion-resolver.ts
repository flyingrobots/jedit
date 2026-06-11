import type { VimMotionName } from './vim-grammar-vocabulary.js';
import {
  clampNormalCol,
  editorText,
  insertPositionAtIndex,
  leadingWhitespace,
  lineStartTextIndex,
  nextWordStartIndex,
  normalTextIndex,
  previousWordStartIndex,
  wordEndIndex,
} from './editor-editing-core.js';
import type { EditorState } from './editor/model.js';

export type VimResolvedTargetShape = 'charwise' | 'linewise';
export const VimResolvedTargetShapes = Object.freeze({
  Charwise: 'charwise',
  Linewise: 'linewise',
} as const satisfies Record<string, VimResolvedTargetShape>);
export type VimMotionObstruction =
  | 'empty-buffer'
  | 'unsupported-motion';

export interface VimTextCursor {
  readonly column: number;
  readonly row: number;
}

export interface VimTextRange {
  readonly end: number;
  readonly start: number;
}

export interface VimResolvedMotion {
  readonly basisDigest: string;
  readonly count: number;
  readonly cursorAfter: VimTextCursor;
  readonly cursorBefore: VimTextCursor;
  readonly motion: VimMotionName;
  readonly target: VimTextRange;
  readonly targetShape: VimResolvedTargetShape;
}

export interface VimMotionObstructed {
  readonly basisDigest: string;
  readonly motion: VimMotionName;
  readonly obstruction: VimMotionObstruction;
}

export interface VimMotionRequest {
  readonly count?: number;
  readonly editor: EditorState;
  readonly motion: VimMotionName;
}

export type VimMotionResolution = VimMotionObstructed | VimResolvedMotion;

const DEFAULT_COUNT = 1;
const EMPTY_LENGTH = 0;
const FIRST_INDEX = 0;
const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;
const HASH_RADIX = 16;
const HASH_TEXT_WIDTH = 8;
const LINE_BREAK_LENGTH = 1;
const LINE_BREAK_TEXT = '\n';
const BASIS_DIGEST_PREFIX = 'vim-basis';
const HASH_PAD_TEXT = '0';
const LINE_CURRENT_MOTION: VimMotionName = 'lineCurrent';
const FILE_BOTTOM_MOTION: VimMotionName = 'fileBottom';
const FILE_TOP_MOTION: VimMotionName = 'fileTop';
const MOTION_CHAR_LEFT: VimMotionName = 'charLeft';
const MOTION_CHAR_RIGHT: VimMotionName = 'charRight';
const MOTION_FIRST_NON_WHITESPACE: VimMotionName = 'firstNonWhitespace';
const MOTION_LINE_DOWN: VimMotionName = 'lineDown';
const MOTION_LINE_END: VimMotionName = 'lineEnd';
const MOTION_LINE_START: VimMotionName = 'lineStart';
const MOTION_LINE_UP: VimMotionName = 'lineUp';
const MOTION_WORD_BACKWARD: VimMotionName = 'wordBackward';
const MOTION_WORD_END: VimMotionName = 'wordEnd';
const MOTION_WORD_FORWARD: VimMotionName = 'wordForward';
const MOTION_WORD_BIG_BACKWARD: VimMotionName = 'WORDBackward';
const MOTION_WORD_BIG_END: VimMotionName = 'WORDEnd';
const MOTION_WORD_BIG_FORWARD: VimMotionName = 'WORDForward';
const TARGET_SHAPE_CHARWISE = VimResolvedTargetShapes.Charwise;
const TARGET_SHAPE_LINEWISE = VimResolvedTargetShapes.Linewise;

export function resolveVimMotion(request: VimMotionRequest): VimMotionResolution {
  const editor = request.editor;
  const basisDigest = vimMotionBasisDigest(editor.lines);
  if (editor.lines.length === EMPTY_LENGTH) {
    return obstructedMotion(request.motion, basisDigest, 'empty-buffer');
  }

  const count = normalizedMotionCount(request.count);
  const cursorBefore = editorCursor(editor);
  const afterIndex = motionDestinationIndex(editor, request.motion, count);
  if (afterIndex == null) {
    return obstructedMotion(request.motion, basisDigest, 'unsupported-motion');
  }

  const target = motionTargetRange(editor, request.motion, afterIndex, count);
  return {
    basisDigest,
    count,
    cursorAfter: cursorAtTextIndex(editor.lines, afterIndex),
    cursorBefore,
    motion: request.motion,
    target,
    targetShape: targetShape(request.motion),
  };
}

export function vimMotionBasisDigest(lines: readonly string[]): string {
  const text = lines.join(LINE_BREAK_TEXT);
  return `${BASIS_DIGEST_PREFIX}:${lines.length}:${text.length}:${fnv1a32Hex(text)}`;
}

export function cursorAtTextIndex(
  lines: readonly string[],
  index: number,
): VimTextCursor {
  const position = insertPositionAtIndex(lines, index);
  const line = lines[position.row] ?? '';
  return {
    row: position.row,
    column: clampNormalCol(position.col, line),
  };
}

function motionDestinationIndex(
  editor: EditorState,
  motion: VimMotionName,
  count: number,
): number | undefined {
  if (motion === LINE_CURRENT_MOTION) {
    return lineStartTextIndex(editor.lines, editor.cursorRow);
  }
  return destinationByMotion(editor, motion, count);
}

function destinationByMotion(
  editor: EditorState,
  motion: VimMotionName,
  count: number,
): number | undefined {
  const text = editorText(editor);
  if (motion === FILE_TOP_MOTION) {
    return lineStartTextIndex(editor.lines, boundedRow(editor.lines, count - LINE_BREAK_LENGTH));
  }
  if (motion === FILE_BOTTOM_MOTION) {
    return lineStartTextIndex(editor.lines, fileBottomRow(editor, count));
  }
  return rowOrCharacterDestination(editor, motion, count, text);
}

function rowOrCharacterDestination(
  editor: EditorState,
  motion: VimMotionName,
  count: number,
  text: string,
): number | undefined {
  if (motion === MOTION_CHAR_LEFT) {
    return normalTextIndex(editor) - count;
  }
  if (motion === MOTION_CHAR_RIGHT) {
    return normalTextIndex(editor) + count;
  }
  return lineOrWordDestination(editor, motion, count, text);
}

function lineOrWordDestination(
  editor: EditorState,
  motion: VimMotionName,
  count: number,
  text: string,
): number | undefined {
  if (motion === MOTION_LINE_DOWN || motion === MOTION_LINE_UP) {
    return lineMotionDestination(editor, motion, count);
  }
  if (motion === MOTION_LINE_START) {
    return lineStartTextIndex(editor.lines, editor.cursorRow);
  }
  return boundaryOrWordDestination(editor, motion, count, text);
}

function boundaryOrWordDestination(
  editor: EditorState,
  motion: VimMotionName,
  count: number,
  text: string,
): number | undefined {
  if (motion === MOTION_FIRST_NON_WHITESPACE) {
    return firstNonWhitespaceIndex(editor);
  }
  if (motion === MOTION_LINE_END) {
    return lineEndTextIndex(editor);
  }
  return wordMotionDestination(editor, motion, count, text);
}

function wordMotionDestination(
  editor: EditorState,
  motion: VimMotionName,
  count: number,
  text: string,
): number | undefined {
  let index = normalTextIndex(editor);
  for (let step = FIRST_INDEX; step < count; step += 1) {
    const next = nextWordMotionIndex(text, index, motion);
    if (next == null) {
      return undefined;
    }
    index = next;
  }
  return index;
}

function nextWordMotionIndex(
  text: string,
  index: number,
  motion: VimMotionName,
): number | undefined {
  if (motion === MOTION_WORD_FORWARD) {
    return nextWordStartIndex(text, index, true);
  }
  if (motion === MOTION_WORD_BACKWARD) {
    return previousWordStartIndex(text, index);
  }
  if (motion === MOTION_WORD_END) {
    return wordEndIndex(text, index);
  }
  return nextBigWordMotionIndex(text, index, motion);
}

function nextBigWordMotionIndex(
  text: string,
  index: number,
  motion: VimMotionName,
): number | undefined {
  if (motion === MOTION_WORD_BIG_FORWARD) {
    return nextBigWordStartIndex(text, index);
  }
  if (motion === MOTION_WORD_BIG_BACKWARD) {
    return previousBigWordStartIndex(text, index);
  }
  if (motion === MOTION_WORD_BIG_END) {
    return bigWordEndIndex(text, index);
  }
  return undefined;
}

function lineMotionDestination(
  editor: EditorState,
  motion: VimMotionName,
  count: number,
): number {
  const delta = motion === MOTION_LINE_DOWN ? count : -count;
  const row = boundedRow(editor.lines, editor.cursorRow + delta);
  const line = editor.lines[row] ?? '';
  return lineStartTextIndex(editor.lines, row) + clampNormalCol(editor.cursorCol, line);
}

function motionTargetRange(
  editor: EditorState,
  motion: VimMotionName,
  destination: number,
  count: number,
): VimTextRange {
  if (motion === LINE_CURRENT_MOTION) {
    return currentLineRange(editor, count);
  }
  if (targetShape(motion) === TARGET_SHAPE_LINEWISE) {
    return linewiseMotionRange(editor, destination);
  }
  const cursor = normalTextIndex(editor);
  return charwiseMotionRange(
    cursor,
    rangeEndForMotion(editor, motion, destination),
  );
}

function rangeEndForMotion(
  editor: EditorState,
  motion: VimMotionName,
  destination: number,
): number {
  if (motion === MOTION_LINE_END || motion === MOTION_WORD_END || motion === MOTION_WORD_BIG_END) {
    return Math.min(editorText(editor).length, destination + LINE_BREAK_LENGTH);
  }
  return destination;
}

function currentLineRange(editor: EditorState, count: number): VimTextRange {
  const row = boundedRow(editor.lines, editor.cursorRow);
  const lastRow = boundedRow(editor.lines, row + count - LINE_BREAK_LENGTH);
  return rowsRange(editor, row, lastRow);
}

function linewiseMotionRange(editor: EditorState, destination: number): VimTextRange {
  const cursorRow = boundedRow(editor.lines, editor.cursorRow);
  const destinationRow = cursorAtTextIndex(editor.lines, destination).row;
  return rowsRange(
    editor,
    Math.min(cursorRow, destinationRow),
    Math.max(cursorRow, destinationRow),
  );
}

function rowsRange(
  editor: EditorState,
  firstRow: number,
  lastRow: number,
): VimTextRange {
  const row = boundedRow(editor.lines, firstRow);
  const endRow = boundedRow(editor.lines, lastRow);
  const start = lineStartTextIndex(editor.lines, row);
  const line = editor.lines[endRow] ?? '';
  const includesBreak = endRow < editor.lines.length - LINE_BREAK_LENGTH;
  return {
    start,
    end: lineStartTextIndex(editor.lines, endRow) +
      line.length +
      (includesBreak ? LINE_BREAK_LENGTH : EMPTY_LENGTH),
  };
}

function charwiseMotionRange(start: number, end: number): VimTextRange {
  return start <= end
    ? { start, end }
    : { start: end, end: start };
}

function targetShape(motion: VimMotionName): VimResolvedTargetShape {
  return motion === LINE_CURRENT_MOTION ||
    motion === FILE_TOP_MOTION ||
    motion === FILE_BOTTOM_MOTION ||
    motion === MOTION_LINE_DOWN ||
    motion === MOTION_LINE_UP
    ? TARGET_SHAPE_LINEWISE
    : TARGET_SHAPE_CHARWISE;
}

function firstNonWhitespaceIndex(editor: EditorState): number {
  const line = editor.lines[editor.cursorRow] ?? '';
  return lineStartTextIndex(editor.lines, editor.cursorRow) + leadingWhitespace(line).length;
}

function lineEndTextIndex(editor: EditorState): number {
  const line = editor.lines[editor.cursorRow] ?? '';
  return lineStartTextIndex(editor.lines, editor.cursorRow) + Math.max(FIRST_INDEX, line.length - LINE_BREAK_LENGTH);
}

function fileBottomRow(editor: EditorState, count: number): number {
  return count === DEFAULT_COUNT
    ? Math.max(FIRST_INDEX, editor.lines.length - LINE_BREAK_LENGTH)
    : boundedRow(editor.lines, count - LINE_BREAK_LENGTH);
}

function boundedRow(lines: readonly string[], row: number): number {
  return Math.max(FIRST_INDEX, Math.min(row, Math.max(FIRST_INDEX, lines.length - LINE_BREAK_LENGTH)));
}

function nextBigWordStartIndex(text: string, index: number): number {
  if (text.length === EMPTY_LENGTH) {
    return FIRST_INDEX;
  }

  let cursor = boundedTextIndex(text, index);
  cursor = isWhitespaceTextChar(text[cursor])
    ? skipWhitespaceForward(text, cursor)
    : skipWhitespaceForward(text, skipNonWhitespaceForward(text, cursor));
  return boundedTextIndex(text, cursor);
}

function previousBigWordStartIndex(text: string, index: number): number {
  if (text.length === EMPTY_LENGTH) {
    return FIRST_INDEX;
  }

  let cursor = boundedTextIndex(text, index);
  if (cursor === FIRST_INDEX) {
    return FIRST_INDEX;
  }

  cursor -= LINE_BREAK_LENGTH;
  while (cursor > FIRST_INDEX && isWhitespaceTextChar(text[cursor])) {
    cursor -= LINE_BREAK_LENGTH;
  }
  while (cursor > FIRST_INDEX && !isWhitespaceTextChar(text[cursor - LINE_BREAK_LENGTH])) {
    cursor -= LINE_BREAK_LENGTH;
  }
  return cursor;
}

function bigWordEndIndex(text: string, index: number): number {
  if (text.length === EMPTY_LENGTH) {
    return FIRST_INDEX;
  }

  let cursor = boundedTextIndex(text, index);
  while (cursor < text.length && isWhitespaceTextChar(text[cursor])) {
    cursor += LINE_BREAK_LENGTH;
  }
  if (cursor >= text.length) {
    return text.length - LINE_BREAK_LENGTH;
  }

  while (
    cursor < text.length - LINE_BREAK_LENGTH &&
    !isWhitespaceTextChar(text[cursor + LINE_BREAK_LENGTH])
  ) {
    cursor += LINE_BREAK_LENGTH;
  }
  return cursor;
}

function skipWhitespaceForward(text: string, start: number): number {
  let cursor = start;
  while (cursor < text.length && isWhitespaceTextChar(text[cursor])) {
    cursor += LINE_BREAK_LENGTH;
  }
  return cursor;
}

function skipNonWhitespaceForward(text: string, start: number): number {
  let cursor = start;
  while (cursor < text.length && !isWhitespaceTextChar(text[cursor])) {
    cursor += LINE_BREAK_LENGTH;
  }
  return cursor;
}

function boundedTextIndex(text: string, index: number): number {
  return Math.max(FIRST_INDEX, Math.min(index, text.length - LINE_BREAK_LENGTH));
}

function isWhitespaceTextChar(char: string | undefined): boolean {
  return char == null || /\s/.test(char);
}

function fnv1a32Hex(text: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let index = FIRST_INDEX; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), FNV_PRIME);
  }
  return (hash >>> FIRST_INDEX).toString(HASH_RADIX).padStart(HASH_TEXT_WIDTH, HASH_PAD_TEXT);
}

function editorCursor(editor: EditorState): VimTextCursor {
  return {
    row: editor.cursorRow,
    column: editor.cursorCol,
  };
}

function normalizedMotionCount(count: number | undefined): number {
  return Math.max(DEFAULT_COUNT, count ?? DEFAULT_COUNT);
}

function obstructedMotion(
  motion: VimMotionName,
  basisDigest: string,
  obstruction: VimMotionObstruction,
): VimMotionObstructed {
  return {
    basisDigest,
    motion,
    obstruction,
  };
}
