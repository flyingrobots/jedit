import { lineStartTextIndex } from './editor-editing-core.js';
import type { VimMotionName } from './vim-grammar-vocabulary.js';

const EMPTY_LENGTH = 0;
const FIRST_INDEX = 0;
const ROW_STEP = 1;
const MOTION_PARAGRAPH_FORWARD: VimMotionName = 'paragraphForward';

export function vimParagraphMotionDestination(
  lines: readonly string[],
  startRow: number,
  motion: VimMotionName,
  count: number,
): number {
  return lineStartTextIndex(
    lines,
    paragraphDestinationRow(lines, startRow, motion, count),
  );
}

function paragraphDestinationRow(
  lines: readonly string[],
  startRow: number,
  motion: VimMotionName,
  count: number,
): number {
  let row = boundedRow(lines, startRow);
  for (let step = FIRST_INDEX; step < count; step += ROW_STEP) {
    row = motion === MOTION_PARAGRAPH_FORWARD
      ? nextParagraphStartRow(lines, row)
      : previousParagraphStartRow(lines, row);
  }
  return row;
}

function nextParagraphStartRow(lines: readonly string[], row: number): number {
  let cursor = row;
  if (!isBlankLine(lines[cursor])) {
    cursor = nextBlankLineRow(lines, cursor);
  }
  return nextNonBlankLineRow(lines, cursor);
}

function previousParagraphStartRow(lines: readonly string[], row: number): number {
  let cursor = previousParagraphInteriorRow(lines, row);
  if (isParagraphStartRow(lines, cursor) && cursor > FIRST_INDEX) {
    cursor -= ROW_STEP;
  }
  cursor = previousNonBlankLineRow(lines, cursor);
  return currentParagraphStartRow(lines, cursor);
}

function nextBlankLineRow(lines: readonly string[], row: number): number {
  let cursor = Math.min(lines.length, row + ROW_STEP);
  while (cursor < lines.length && !isBlankLine(lines[cursor])) {
    cursor += ROW_STEP;
  }
  return cursor;
}

function nextNonBlankLineRow(lines: readonly string[], row: number): number {
  let cursor = row;
  while (cursor < lines.length && isBlankLine(lines[cursor])) {
    cursor += ROW_STEP;
  }
  return boundedRow(lines, cursor);
}

function previousParagraphInteriorRow(
  lines: readonly string[],
  row: number,
): number {
  let cursor = boundedRow(lines, row);
  while (cursor > FIRST_INDEX && isBlankLine(lines[cursor])) {
    cursor -= ROW_STEP;
  }
  return cursor;
}

function previousNonBlankLineRow(lines: readonly string[], row: number): number {
  let cursor = boundedRow(lines, row);
  while (cursor > FIRST_INDEX && isBlankLine(lines[cursor])) {
    cursor -= ROW_STEP;
  }
  return cursor;
}

function currentParagraphStartRow(lines: readonly string[], row: number): number {
  let cursor = boundedRow(lines, row);
  while (cursor > FIRST_INDEX && !isBlankLine(lines[cursor - ROW_STEP])) {
    cursor -= ROW_STEP;
  }
  return cursor;
}

function isParagraphStartRow(lines: readonly string[], row: number): boolean {
  return row === FIRST_INDEX || isBlankLine(lines[row - ROW_STEP]);
}

function boundedRow(lines: readonly string[], row: number): number {
  return Math.max(
    FIRST_INDEX,
    Math.min(row, Math.max(FIRST_INDEX, lines.length - ROW_STEP)),
  );
}

function isBlankLine(line: string | undefined): boolean {
  return (line ?? '').trim().length === EMPTY_LENGTH;
}
