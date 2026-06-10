import {
  classifyWordChar,
  editorText,
  lineStartTextIndex,
  WordClasses,
} from './editor-editing-core.js';
import type { EditorState } from './editor/model.js';
import type {
  VimTextObjectScope,
  VimTextObjectTarget,
} from './vim-grammar-vocabulary.js';
import {
  type VimResolvedTargetShape,
  type VimTextRange,
  vimMotionBasisDigest,
} from './vim-motion-resolver.js';

export type VimTextObjectObstruction =
  | 'empty-buffer'
  | 'missing-delimiter'
  | 'unsupported-text-object';

export interface VimTextObjectRequest {
  readonly count?: number;
  readonly editor: EditorState;
  readonly scope: VimTextObjectScope;
  readonly target: VimTextObjectTarget;
}

export interface VimResolvedTextObject {
  readonly basisDigest: string;
  readonly count: number;
  readonly scope: VimTextObjectScope;
  readonly target: VimTextObjectTarget;
  readonly targetRange: VimTextRange;
  readonly targetShape: VimResolvedTargetShape;
}

export interface VimTextObjectObstructed {
  readonly basisDigest: string;
  readonly obstruction: VimTextObjectObstruction;
  readonly scope: VimTextObjectScope;
  readonly target: VimTextObjectTarget;
}

export type VimTextObjectResolution =
  | VimResolvedTextObject
  | VimTextObjectObstructed;

interface DelimiterPair {
  readonly close: string;
  readonly open: string;
}

interface CandidateRange {
  readonly end: number;
  readonly start: number;
}

interface ParagraphEndIndexRequest {
  readonly endRow: number;
  readonly includeBlankLine: boolean;
}

const DEFAULT_COUNT = 1;
const FIRST_INDEX = 0;
const INNER_OFFSET = 1;
const EMPTY_LENGTH = 0;
const SCOPE_AROUND: VimTextObjectScope = 'around';
const WORD_TARGET: VimTextObjectTarget = 'word';
const WORD_BIG_TARGET: VimTextObjectTarget = 'WORD';
const PARAGRAPH_TARGET: VimTextObjectTarget = 'paragraph';
const TARGET_DOUBLE_QUOTE: VimTextObjectTarget = 'doubleQuote';
const TARGET_SINGLE_QUOTE: VimTextObjectTarget = 'singleQuote';
const TARGET_BACKTICK: VimTextObjectTarget = 'backtick';
const TARGET_PAREN: VimTextObjectTarget = 'paren';
const TARGET_BRACKET: VimTextObjectTarget = 'bracket';
const TARGET_BRACE: VimTextObjectTarget = 'brace';
const TARGET_ANGLE: VimTextObjectTarget = 'angle';
const LINE_BREAK_TEXT = '\n';

export function resolveVimTextObject(
  request: VimTextObjectRequest,
): VimTextObjectResolution {
  const basisDigest = vimMotionBasisDigest(request.editor.lines);
  const text = editorText(request.editor);
  if (text.length === EMPTY_LENGTH) {
    return obstructedTextObject(request, basisDigest, 'empty-buffer');
  }

  const count = Math.max(DEFAULT_COUNT, request.count ?? DEFAULT_COUNT);
  const range = textObjectRange(request.editor, request.scope, request.target);
  if (range == null) {
    return textObjectObstruction(request, basisDigest);
  }

  return {
    basisDigest,
    count,
    scope: request.scope,
    target: request.target,
    targetRange: range,
    targetShape: request.target === PARAGRAPH_TARGET ? 'linewise' : 'charwise',
  };
}

function textObjectRange(
  editor: EditorState,
  scope: VimTextObjectScope,
  target: VimTextObjectTarget,
): VimTextRange | undefined {
  if (target === WORD_TARGET || target === WORD_BIG_TARGET) {
    return wordObjectRange(editor, scope, target);
  }
  if (target === PARAGRAPH_TARGET) {
    return paragraphRange(editor, scope);
  }
  return delimiterRange(editor, scope, target);
}

function wordObjectRange(
  editor: EditorState,
  scope: VimTextObjectScope,
  target: VimTextObjectTarget,
): VimTextRange | undefined {
  const text = editorText(editor);
  const cursor = cursorIndex(editor);
  const at = nearestWordIndex(text, cursor, target);
  if (at == null) {
    return undefined;
  }
  const base = contiguousWordRange(text, at, target);
  return scope === SCOPE_AROUND ? aroundWordRange(text, base) : base;
}

function nearestWordIndex(
  text: string,
  cursor: number,
  target: VimTextObjectTarget,
): number | undefined {
  if (isWordObjectChar(text[cursor], target)) {
    return cursor;
  }
  for (let index = cursor + INNER_OFFSET; index < text.length; index += 1) {
    if (isWordObjectChar(text[index], target)) {
      return index;
    }
    if (/\n/.test(text[index] ?? '')) {
      return undefined;
    }
  }
  return undefined;
}

function contiguousWordRange(
  text: string,
  index: number,
  target: VimTextObjectTarget,
): VimTextRange {
  let start = index;
  let end = index + INNER_OFFSET;
  while (start > FIRST_INDEX && isWordObjectChar(text[start - INNER_OFFSET], target)) {
    start -= INNER_OFFSET;
  }
  while (end < text.length && isWordObjectChar(text[end], target)) {
    end += INNER_OFFSET;
  }
  return { start, end };
}

function aroundWordRange(text: string, base: VimTextRange): VimTextRange {
  let end = base.end;
  while (end < text.length && isInlineWhitespace(text[end])) {
    end += INNER_OFFSET;
  }
  if (end > base.end) {
    return { start: base.start, end };
  }
  let start = base.start;
  while (start > FIRST_INDEX && isInlineWhitespace(text[start - INNER_OFFSET])) {
    start -= INNER_OFFSET;
  }
  return { start, end: base.end };
}

function delimiterRange(
  editor: EditorState,
  scope: VimTextObjectScope,
  target: VimTextObjectTarget,
): VimTextRange | undefined {
  const pair = delimiterPair(target);
  if (pair == null) {
    return undefined;
  }
  const text = editorText(editor);
  const pairRange = enclosingDelimiterRange(text, cursorIndex(editor), pair);
  if (pairRange == null) {
    return undefined;
  }
  return scope === SCOPE_AROUND
    ? pairRange
    : {
      start: pairRange.start + INNER_OFFSET,
      end: pairRange.end - INNER_OFFSET,
    };
}

function enclosingDelimiterRange(
  text: string,
  cursor: number,
  pair: DelimiterPair,
): CandidateRange | undefined {
  let best: CandidateRange | undefined;
  for (let start = FIRST_INDEX; start <= cursor; start += 1) {
    if (text[start] !== pair.open) {
      continue;
    }
    const end = matchingCloseIndex(text, start, pair);
    if (end != null && start < cursor + INNER_OFFSET && cursor < end) {
      best = narrowerRange(best, { start, end: end + INNER_OFFSET });
    }
  }
  return best;
}

function matchingCloseIndex(
  text: string,
  start: number,
  pair: DelimiterPair,
): number | undefined {
  if (pair.open === pair.close) {
    return matchingSymmetricDelimiterIndex(text, start, pair.open);
  }
  let depth = EMPTY_LENGTH;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === pair.open) {
      depth += INNER_OFFSET;
    } else if (text[index] === pair.close) {
      depth -= INNER_OFFSET;
      if (depth === EMPTY_LENGTH) {
        return index;
      }
    }
  }
  return undefined;
}

function matchingSymmetricDelimiterIndex(
  text: string,
  start: number,
  delimiter: string,
): number | undefined {
  for (let index = start + INNER_OFFSET; index < text.length; index += 1) {
    if (text[index] === delimiter) {
      return index;
    }
  }
  return undefined;
}

function paragraphRange(
  editor: EditorState,
  scope: VimTextObjectScope,
): VimTextRange {
  const row = editor.cursorRow;
  let startRow = row;
  let endRow = row + INNER_OFFSET;
  while (startRow > FIRST_INDEX && !blankLine(editor.lines[startRow - INNER_OFFSET])) {
    startRow -= INNER_OFFSET;
  }
  while (endRow < editor.lines.length && !blankLine(editor.lines[endRow])) {
    endRow += INNER_OFFSET;
  }
  const includeBlank = scope === SCOPE_AROUND && endRow < editor.lines.length;
  return {
    start: lineStartTextIndex(editor.lines, startRow),
    end: paragraphEndIndex(editor, {
      endRow,
      includeBlankLine: includeBlank,
    }),
  };
}

function paragraphEndIndex(
  editor: EditorState,
  request: ParagraphEndIndexRequest,
): number {
  const cappedRow = request.includeBlankLine ? request.endRow + INNER_OFFSET : request.endRow;
  const row = Math.min(cappedRow, editor.lines.length);
  if (row >= editor.lines.length) {
    return editorText(editor).length;
  }
  return lineStartTextIndex(editor.lines, row);
}

function delimiterPair(target: VimTextObjectTarget): DelimiterPair | undefined {
  if (target === TARGET_DOUBLE_QUOTE) {
    return { open: '"', close: '"' };
  }
  if (target === TARGET_SINGLE_QUOTE) {
    return { open: "'", close: "'" };
  }
  if (target === TARGET_BACKTICK) {
    return { open: '`', close: '`' };
  }
  return bracketDelimiterPair(target);
}

function bracketDelimiterPair(target: VimTextObjectTarget): DelimiterPair | undefined {
  if (target === TARGET_PAREN) {
    return { open: '(', close: ')' };
  }
  if (target === TARGET_BRACKET) {
    return { open: '[', close: ']' };
  }
  if (target === TARGET_BRACE) {
    return { open: '{', close: '}' };
  }
  return target === TARGET_ANGLE ? { open: '<', close: '>' } : undefined;
}

function textObjectObstruction(
  request: VimTextObjectRequest,
  basisDigest: string,
): VimTextObjectObstructed {
  const obstruction = delimiterPair(request.target) == null &&
    request.target !== WORD_TARGET &&
    request.target !== WORD_BIG_TARGET &&
    request.target !== PARAGRAPH_TARGET
    ? 'unsupported-text-object'
    : 'missing-delimiter';
  return obstructedTextObject(request, basisDigest, obstruction);
}

function obstructedTextObject(
  request: VimTextObjectRequest,
  basisDigest: string,
  obstruction: VimTextObjectObstruction,
): VimTextObjectObstructed {
  return {
    basisDigest,
    obstruction,
    scope: request.scope,
    target: request.target,
  };
}

function narrowerRange(
  current: CandidateRange | undefined,
  next: CandidateRange,
): CandidateRange {
  return current == null || rangeLength(next) < rangeLength(current) ? next : current;
}

function rangeLength(range: CandidateRange): number {
  return range.end - range.start;
}

function cursorIndex(editor: EditorState): number {
  return lineStartTextIndex(editor.lines, editor.cursorRow) + editor.cursorCol;
}

function isWordObjectChar(
  char: string | undefined,
  target: VimTextObjectTarget,
): boolean {
  if (target === WORD_BIG_TARGET) {
    return char != null && !/\s/.test(char);
  }
  return classifyWordChar(char) === WordClasses.Word;
}

function isInlineWhitespace(char: string | undefined): boolean {
  return char != null && char !== LINE_BREAK_TEXT && /\s/.test(char);
}

function blankLine(line: string | undefined): boolean {
  return line == null || line.trim().length === EMPTY_LENGTH;
}
