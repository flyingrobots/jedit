import { normalizeLines } from '../editor-lines.js';
import type { EditorState } from './editor/model.js';
import { EditorModes } from './editor/mode.js';
import {
  clampNormalCol,
  commitMutation,
  editorText,
  leadingWhitespace,
  normalPositionAtOrBeforeIndex,
} from './editor-editing-core.js';
import type { VimTextRange } from './vim-motion-resolver.js';

export type VimCaseTransform = 'lowercase' | 'swapCase' | 'uppercase';
export type VimCaseTransformOperator = 'lowercase' | 'swapCase' | 'uppercase';
export type VimJoinSpacing = 'compact' | 'spaced';
export type VimMarkJumpMode = 'exact' | 'line';

const EMPTY_TEXT = '';
const FIRST_INDEX = 0;
const LINE_BREAK_LENGTH = 1;
const JOINED_LINE_SKIP = 2;
const NORMAL_MODE = EditorModes.Normal;
const SINGLE_SPACE = ' ';
const VIM_CASE_LOWERCASE: VimCaseTransform = 'lowercase';
const VIM_CASE_SWAP: VimCaseTransform = 'swapCase';
const VIM_CASE_UPPERCASE: VimCaseTransform = 'uppercase';
const VIM_JOIN_SPACED: VimJoinSpacing = 'spaced';
const VIM_MARK_JUMP_EXACT: VimMarkJumpMode = 'exact';

export function applyVimCaseTransform(
  editor: EditorState,
  range: VimTextRange,
  transform: VimCaseTransform,
): EditorState {
  const text = editorText(editor);
  const from = boundedRangeStart(text, range);
  const to = boundedRangeEnd(text, range, from);
  if (from === to) {
    return editor;
  }

  const replacement = transformText(text.slice(from, to), transform);
  const nextText = `${text.slice(FIRST_INDEX, from)}${replacement}${text.slice(to)}`;
  const nextLines = normalizeLines(nextText);
  const position = normalPositionAtOrBeforeIndex(nextLines, from);
  return commitMutation(editor, {
    lines: nextLines,
    cursorRow: position.row,
    cursorCol: position.col,
    mode: NORMAL_MODE,
  });
}

export function isVimCaseTransformOperator(operator: string | undefined): operator is VimCaseTransformOperator {
  return operator === VIM_CASE_UPPERCASE || operator === VIM_CASE_LOWERCASE || operator === VIM_CASE_SWAP;
}

export function vimCaseTransformForOperator(operator: VimCaseTransformOperator): VimCaseTransform {
  if (operator === VIM_CASE_UPPERCASE) {
    return VIM_CASE_UPPERCASE;
  }
  return operator === VIM_CASE_LOWERCASE ? VIM_CASE_LOWERCASE : VIM_CASE_SWAP;
}

export function applyVimJoinCurrentLine(
  editor: EditorState,
  spacing: VimJoinSpacing,
): EditorState {
  if (editor.cursorRow >= editor.lines.length - LINE_BREAK_LENGTH) {
    return editor;
  }

  const current = editor.lines[editor.cursorRow] ?? EMPTY_TEXT;
  const next = editor.lines[editor.cursorRow + LINE_BREAK_LENGTH] ?? EMPTY_TEXT;
  const joined = joinedLineText(current, next, spacing);
  return commitMutation(editor, {
    lines: [
      ...editor.lines.slice(FIRST_INDEX, editor.cursorRow),
      joined,
      ...editor.lines.slice(editor.cursorRow + JOINED_LINE_SKIP),
    ],
    cursorCol: clampNormalCol(joinCursorColumn(current, spacing), joined),
    mode: NORMAL_MODE,
  });
}

export function setVimMark(
  editor: EditorState,
  mark: string,
  basisDigest: string,
): EditorState {
  return {
    ...editor,
    marks: {
      ...(editor.marks ?? {}),
      [mark]: {
        basisDigest,
        column: editor.cursorCol,
        row: editor.cursorRow,
      },
    },
    pendingNormal: undefined,
    pendingVimKeys: undefined,
  };
}

export function jumpToVimMark(
  editor: EditorState,
  mark: string,
  mode: VimMarkJumpMode,
): EditorState {
  const target = editor.marks?.[mark];
  if (target == null) {
    return editor;
  }

  const row = boundedRow(editor, target.row);
  const line = editor.lines[row] ?? EMPTY_TEXT;
  const column = mode === VIM_MARK_JUMP_EXACT
    ? clampNormalCol(target.column, line)
    : leadingWhitespace(line).length;
  return {
    ...editor,
    cursorRow: row,
    cursorCol: clampNormalCol(column, line),
    pendingNormal: undefined,
    pendingVimKeys: undefined,
  };
}

function transformText(text: string, transform: VimCaseTransform): string {
  if (transform === VIM_CASE_UPPERCASE) {
    return text.toUpperCase();
  }
  if (transform === VIM_CASE_LOWERCASE) {
    return text.toLowerCase();
  }
  return Array.from(text, swapCaseChar).join(EMPTY_TEXT);
}

function joinedLineText(current: string, next: string, spacing: VimJoinSpacing): string {
  return spacing === VIM_JOIN_SPACED
    ? spacedJoinedLineText(current, next)
    : `${current}${next}`;
}

function spacedJoinedLineText(current: string, next: string): string {
  const currentTrimmed = current.trimEnd();
  const nextTrimmed = next.trimStart();
  return `${currentTrimmed}${joinSeparator(currentTrimmed, nextTrimmed)}${nextTrimmed}`;
}

function joinSeparator(current: string, next: string): string {
  return current.length > EMPTY_TEXT.length && next.length > EMPTY_TEXT.length
    ? SINGLE_SPACE
    : EMPTY_TEXT;
}

function joinCursorColumn(current: string, spacing: VimJoinSpacing): number {
  return spacing === VIM_JOIN_SPACED ? current.trimEnd().length : current.length;
}

function swapCaseChar(char: string): string {
  const upper = char.toUpperCase();
  const lower = char.toLowerCase();
  return char === upper ? lower : upper;
}

function boundedRangeStart(text: string, range: VimTextRange): number {
  return Math.max(FIRST_INDEX, Math.min(range.start, range.end, text.length));
}

function boundedRangeEnd(text: string, range: VimTextRange, from: number): number {
  return Math.max(from, Math.min(text.length, Math.max(range.start, range.end)));
}

function boundedRow(editor: EditorState, row: number): number {
  return Math.max(FIRST_INDEX, Math.min(row, Math.max(FIRST_INDEX, editor.lines.length - LINE_BREAK_LENGTH)));
}
