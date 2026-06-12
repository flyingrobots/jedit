import type { VimMotionName } from './vim-grammar-vocabulary.js';
import {
  vimMatchingPairMotionDestination,
  type VimStructuralPairMotion,
} from './vim-matching-pair-motion.js';
import { vimMotionBasisDigest } from './vim-motion-basis-digest.js';
import { vimParagraphMotionDestination } from './vim-paragraph-motion.js';
import {
  vimSearchMotionDestination,
  type VimSearchMatchMotion,
} from './vim-search-motion.js';
import {
  VimMotionRangePolicies,
  VimMotionStrategyKinds,
  VimMotionTargetShapeKinds,
  VimPrimitiveMotionKinds,
  vimMotionStrategy,
  type VimMotionStrategy,
  type VimPrimitiveMotionStrategy,
} from './vim-motion-strategy.js';
import {
  clampNormalCol,
  editorText,
  insertPositionAtIndex,
  leadingWhitespace,
  lineStartTextIndex,
  normalTextIndex,
} from './editor-editing-core.js';
import type { EditorState } from './editor/model.js';
import { vimWordMotionDestination } from './vim-word-motion.js';

export type VimResolvedTargetShape = 'charwise' | 'linewise';
export const VimResolvedTargetShapes = Object.freeze({
  Charwise: 'charwise',
  Linewise: 'linewise',
} as const satisfies Record<string, VimResolvedTargetShape>);
export type VimMotionObstruction =
  | 'empty-buffer'
  | 'unsupported-section-motion'
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
  readonly searchMatch?: VimSearchMatchMotion;
  readonly structuralPair?: VimStructuralPairMotion;
  readonly target: VimTextRange;
  readonly targetShape: VimResolvedTargetShape;
}

export interface VimMotionObstructed {
  readonly basisDigest: string;
  readonly motion: VimMotionName;
  readonly obstruction: VimMotionObstruction;
}

interface VimMotionDestinationResolution {
  readonly destination: number;
  readonly searchMatch?: VimSearchMatchMotion;
  readonly structuralPair?: VimStructuralPairMotion;
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
const LINE_BREAK_LENGTH = 1;
const KIND_MATCHING_PAIR = VimMotionStrategyKinds.MatchingPair;
const KIND_PARAGRAPH = VimMotionStrategyKinds.Paragraph;
const KIND_PRIMITIVE = VimMotionStrategyKinds.Primitive;
const KIND_SEARCH = VimMotionStrategyKinds.Search;
const KIND_SECTION = VimMotionStrategyKinds.Section;
const PRIMITIVE_CHAR_LEFT = VimPrimitiveMotionKinds.CharacterLeft;
const PRIMITIVE_CHAR_RIGHT = VimPrimitiveMotionKinds.CharacterRight;
const PRIMITIVE_FILE_BOTTOM = VimPrimitiveMotionKinds.FileBottom;
const PRIMITIVE_FILE_TOP = VimPrimitiveMotionKinds.FileTop;
const PRIMITIVE_FIRST_NON_WHITESPACE = VimPrimitiveMotionKinds.FirstNonWhitespace;
const PRIMITIVE_LINE_CURRENT = VimPrimitiveMotionKinds.LineCurrent;
const PRIMITIVE_LINE_DOWN = VimPrimitiveMotionKinds.LineDown;
const PRIMITIVE_LINE_END = VimPrimitiveMotionKinds.LineEnd;
const PRIMITIVE_LINE_START = VimPrimitiveMotionKinds.LineStart;
const PRIMITIVE_LINE_UP = VimPrimitiveMotionKinds.LineUp;
const PRIMITIVE_WORD = VimPrimitiveMotionKinds.Word;
const RANGE_CURRENT_LINE = VimMotionRangePolicies.CurrentLine;
const RANGE_INCLUDE_LINE_BREAK = VimMotionRangePolicies.IncludeLineBreak;
const RANGE_INCLUSIVE_CHARWISE = VimMotionRangePolicies.InclusiveCharwise;
const SHAPE_LINEWISE = VimMotionTargetShapeKinds.Linewise;
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
  const strategy = vimMotionStrategy(request.motion);
  const resolved = motionDestination(editor, strategy, count);
  if (resolved == null) {
    return obstructedMotion(strategy.motion, basisDigest, obstructionForMotion(strategy));
  }

  const target = motionTargetRange(editor, strategy, resolved.destination, count);
  return {
    basisDigest,
    count,
    cursorAfter: cursorAtTextIndex(editor.lines, resolved.destination),
    cursorBefore,
    motion: strategy.motion,
    ...(resolved.searchMatch == null ? {} : { searchMatch: resolved.searchMatch }),
    ...(resolved.structuralPair == null ? {} : { structuralPair: resolved.structuralPair }),
    target,
    targetShape: targetShape(strategy),
  };
}

export { vimMotionBasisDigest };

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

function motionDestination(
  editor: EditorState,
  strategy: VimMotionStrategy,
  count: number,
): VimMotionDestinationResolution | undefined {
  if (strategy.kind === KIND_MATCHING_PAIR) {
    return vimMatchingPairMotionDestination(editor.lines, editor.cursorRow, editor.cursorCol);
  }
  if (strategy.kind === KIND_SEARCH) {
    return vimSearchMotionDestination(editorText(editor), normalTextIndex(editor), strategy.motion, count, editor.lastSearch);
  }
  if (strategy.kind === KIND_PARAGRAPH) {
    return {
      destination: vimParagraphMotionDestination(
        editor.lines,
        editor.cursorRow,
        editor.cursorCol,
        strategy.paragraphMotion,
        count,
      ),
    };
  }
  if (strategy.kind === KIND_PRIMITIVE) {
    return primitiveMotionDestination(editor, strategy, count);
  }
  return undefined;
}

function primitiveMotionDestination(
  editor: EditorState,
  strategy: VimPrimitiveMotionStrategy,
  count: number,
): VimMotionDestinationResolution | undefined {
  const destination = primitiveDestinationIndex(editor, strategy, count);
  return destination == null ? undefined : { destination };
}

function primitiveDestinationIndex(
  editor: EditorState,
  strategy: VimPrimitiveMotionStrategy,
  count: number,
): number | undefined {
  return filePrimitiveDestination(editor, strategy, count) ??
    characterPrimitiveDestination(editor, strategy, count) ??
    linePrimitiveDestination(editor, strategy, count) ??
    wordPrimitiveDestination(editor, strategy, count);
}

function filePrimitiveDestination(
  editor: EditorState,
  strategy: VimPrimitiveMotionStrategy,
  count: number,
): number | undefined {
  if (strategy.primitiveKind === PRIMITIVE_FILE_TOP) {
    return lineStartTextIndex(editor.lines, boundedRow(editor.lines, count - LINE_BREAK_LENGTH));
  }
  if (strategy.primitiveKind === PRIMITIVE_FILE_BOTTOM) {
    return lineStartTextIndex(editor.lines, fileBottomRow(editor, count));
  }
  return undefined;
}

function characterPrimitiveDestination(
  editor: EditorState,
  strategy: VimPrimitiveMotionStrategy,
  count: number,
): number | undefined {
  if (strategy.primitiveKind === PRIMITIVE_CHAR_LEFT) {
    return Math.max(lineStartTextIndex(editor.lines, editor.cursorRow), normalTextIndex(editor) - count);
  }
  if (strategy.primitiveKind === PRIMITIVE_CHAR_RIGHT) {
    return Math.min(lineEndTextIndex(editor), normalTextIndex(editor) + count);
  }
  return undefined;
}

function linePrimitiveDestination(
  editor: EditorState,
  strategy: VimPrimitiveMotionStrategy,
  count: number,
): number | undefined {
  if (strategy.primitiveKind === PRIMITIVE_LINE_CURRENT) {
    return lineStartTextIndex(editor.lines, editor.cursorRow);
  }
  if (strategy.primitiveKind === PRIMITIVE_LINE_DOWN || strategy.primitiveKind === PRIMITIVE_LINE_UP) {
    return lineMotionDestination(editor, strategy, count);
  }
  return lineBoundaryPrimitiveDestination(editor, strategy);
}

function lineBoundaryPrimitiveDestination(
  editor: EditorState,
  strategy: VimPrimitiveMotionStrategy,
): number | undefined {
  if (strategy.primitiveKind === PRIMITIVE_LINE_START) {
    return lineStartTextIndex(editor.lines, editor.cursorRow);
  }
  if (strategy.primitiveKind === PRIMITIVE_FIRST_NON_WHITESPACE) {
    return firstNonWhitespaceIndex(editor);
  }
  if (strategy.primitiveKind === PRIMITIVE_LINE_END) {
    return lineEndTextIndex(editor);
  }
  return undefined;
}

function wordPrimitiveDestination(
  editor: EditorState,
  strategy: VimPrimitiveMotionStrategy,
  count: number,
): number | undefined {
  return strategy.primitiveKind === PRIMITIVE_WORD
    ? vimWordMotionDestination(editorText(editor), normalTextIndex(editor), strategy.motion, count)
    : undefined;
}

function obstructionForMotion(strategy: VimMotionStrategy): VimMotionObstruction {
  return strategy.kind === KIND_SECTION
    ? 'unsupported-section-motion'
    : 'unsupported-motion';
}

function lineMotionDestination(
  editor: EditorState,
  strategy: VimPrimitiveMotionStrategy,
  count: number,
): number {
  const delta = strategy.lineStep * count;
  const row = boundedRow(editor.lines, editor.cursorRow + delta);
  const line = editor.lines[row] ?? '';
  return lineStartTextIndex(editor.lines, row) + clampNormalCol(editor.cursorCol, line);
}

function motionTargetRange(
  editor: EditorState,
  strategy: VimMotionStrategy,
  destination: number,
  count: number,
): VimTextRange {
  if (strategy.rangePolicy === RANGE_CURRENT_LINE) {
    return currentLineRange(editor, count);
  }
  if (targetShape(strategy) === TARGET_SHAPE_LINEWISE) {
    return linewiseMotionRange(editor, destination);
  }
  const cursor = normalTextIndex(editor);
  if (strategy.rangePolicy === RANGE_INCLUSIVE_CHARWISE) {
    return inclusiveCharwiseMotionRange(cursor, destination);
  }
  return charwiseMotionRange(
    cursor,
    rangeEndForMotion(editor, strategy, destination),
  );
}

function rangeEndForMotion(
  editor: EditorState,
  strategy: VimMotionStrategy,
  destination: number,
): number {
  if (strategy.rangePolicy === RANGE_INCLUDE_LINE_BREAK) {
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

function inclusiveCharwiseMotionRange(start: number, end: number): VimTextRange {
  return start <= end
    ? { start, end: end + LINE_BREAK_LENGTH }
    : { start: end, end: start + LINE_BREAK_LENGTH };
}

function targetShape(strategy: VimMotionStrategy): VimResolvedTargetShape {
  return strategy.targetShapeKind === SHAPE_LINEWISE
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
