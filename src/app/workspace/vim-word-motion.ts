import {
  nextWordStartIndex,
  previousWordStartIndex,
  wordEndIndex,
} from './editor-editing-core.js';
import type { VimMotionName } from './vim-grammar-vocabulary.js';

const DEFAULT_STEP = 1;
const EMPTY_LENGTH = 0;
const FIRST_INDEX = 0;
const MOTION_WORD_BACKWARD: VimMotionName = 'wordBackward';
const MOTION_WORD_END: VimMotionName = 'wordEnd';
const MOTION_WORD_FORWARD: VimMotionName = 'wordForward';
const MOTION_WORD_BIG_BACKWARD: VimMotionName = 'WORDBackward';
const MOTION_WORD_BIG_END: VimMotionName = 'WORDEnd';
const MOTION_WORD_BIG_FORWARD: VimMotionName = 'WORDForward';

export function vimWordMotionDestination(
  text: string,
  startIndex: number,
  motion: VimMotionName,
  count: number,
): number | undefined {
  let index = startIndex;
  for (let step = FIRST_INDEX; step < count; step += DEFAULT_STEP) {
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

  cursor -= DEFAULT_STEP;
  while (cursor > FIRST_INDEX && isWhitespaceTextChar(text[cursor])) {
    cursor -= DEFAULT_STEP;
  }
  while (cursor > FIRST_INDEX && !isWhitespaceTextChar(text[cursor - DEFAULT_STEP])) {
    cursor -= DEFAULT_STEP;
  }
  return cursor;
}

function bigWordEndIndex(text: string, index: number): number {
  if (text.length === EMPTY_LENGTH) {
    return FIRST_INDEX;
  }

  let cursor = boundedTextIndex(text, index);
  while (cursor < text.length && isWhitespaceTextChar(text[cursor])) {
    cursor += DEFAULT_STEP;
  }
  if (cursor >= text.length) {
    return text.length - DEFAULT_STEP;
  }

  while (
    cursor < text.length - DEFAULT_STEP &&
    !isWhitespaceTextChar(text[cursor + DEFAULT_STEP])
  ) {
    cursor += DEFAULT_STEP;
  }
  return cursor;
}

function skipWhitespaceForward(text: string, start: number): number {
  let cursor = start;
  while (cursor < text.length && isWhitespaceTextChar(text[cursor])) {
    cursor += DEFAULT_STEP;
  }
  return cursor;
}

function skipNonWhitespaceForward(text: string, start: number): number {
  let cursor = start;
  while (cursor < text.length && !isWhitespaceTextChar(text[cursor])) {
    cursor += DEFAULT_STEP;
  }
  return cursor;
}

function boundedTextIndex(text: string, index: number): number {
  return Math.max(FIRST_INDEX, Math.min(index, text.length - DEFAULT_STEP));
}

function isWhitespaceTextChar(char: string | undefined): boolean {
  return char == null || /\s/.test(char);
}
