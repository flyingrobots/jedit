import {
  byteOffsetFromLineColumn,
  makeLineColumn,
  makeUtf16Offset,
  makeZeroBasedLineIndex,
} from '../../domain/graph-rope-coordinates.js';
import type {
  ByteOffset,
  CoordinateResult,
  LineColumn,
} from '../../domain/graph-rope-types.js';
import { joinLines } from '../editor-lines.js';

const FIRST_LINE = 0;
const FIRST_COLUMN = 0;
const LINE_FEED = '\n';
const HIGH_SURROGATE_START = 0xd800;
const HIGH_SURROGATE_END = 0xdbff;
const LOW_SURROGATE_START = 0xdc00;
const LOW_SURROGATE_END = 0xdfff;

export interface TextPosition {
  readonly row: number;
  readonly column: number;
}

export function positionAfterInsertedText(
  position: TextPosition,
  insertText: string,
): TextPosition {
  const lines = insertText.split(LINE_FEED);
  if (lines.length === 1) {
    return {
      row: position.row,
      column: position.column + insertText.length,
    };
  }
  return {
    row: position.row + lines.length - 1,
    column: lines[lines.length - 1]?.length ?? FIRST_COLUMN,
  };
}

export function previousTextPosition(
  lines: readonly string[],
  position: TextPosition,
): TextPosition {
  const row = clampRow(lines, position.row);
  const line = lines[row] ?? '';
  const column = Math.max(FIRST_COLUMN, Math.min(position.column, line.length));
  if (column > FIRST_COLUMN) {
    return {
      row,
      column: previousUtf16Boundary(line, column),
    };
  }
  if (row === FIRST_LINE) {
    return {
      row,
      column: FIRST_COLUMN,
    };
  }
  return {
    row: row - 1,
    column: (lines[row - 1] ?? '').length,
  };
}

export function byteOffsetForTextPosition(
  lines: readonly string[],
  position: TextPosition,
): ByteOffset {
  const lineColumn = lineColumnForTextPosition(lines, position);
  return requiredCoordinate(
    byteOffsetFromLineColumn(joinLines(lines), lineColumn),
    'UI line-column does not identify a UTF-8 boundary',
  );
}

export function lineColumnForTextPosition(
  lines: readonly string[],
  position: TextPosition,
): LineColumn {
  const row = clampRow(lines, position.row);
  const line = lines[row] ?? '';
  const column = Math.max(FIRST_COLUMN, Math.min(position.column, line.length));
  return makeLineColumn(
    requiredCoordinate(makeZeroBasedLineIndex(row), 'UI row is not a valid line index'),
    requiredCoordinate(makeUtf16Offset(column), 'UI column is not a valid UTF-16 offset'),
  );
}

export function nextByteOffset(
  lines: readonly string[],
  position: TextPosition,
): ByteOffset {
  const row = clampRow(lines, position.row);
  const line = lines[row] ?? '';
  const column = nextUtf16Boundary(line, position.column);
  return byteOffsetForTextPosition(lines, { row, column });
}

export function previousByteOffset(
  lines: readonly string[],
  position: TextPosition,
): ByteOffset {
  return byteOffsetForTextPosition(lines, previousTextPosition(lines, position));
}

function clampRow(lines: readonly string[], row: number): number {
  return Math.max(FIRST_LINE, Math.min(row, Math.max(FIRST_LINE, lines.length - 1)));
}

function nextUtf16Boundary(line: string, column: number): number {
  const clamped = Math.max(FIRST_COLUMN, Math.min(column, line.length));
  if (clamped >= line.length) {
    return line.length;
  }
  return isHighSurrogate(line.charCodeAt(clamped)) && isLowSurrogate(line.charCodeAt(clamped + 1))
    ? clamped + 2
    : clamped + 1;
}

function previousUtf16Boundary(line: string, column: number): number {
  const clamped = Math.max(FIRST_COLUMN, Math.min(column, line.length));
  if (clamped <= FIRST_COLUMN) {
    return FIRST_COLUMN;
  }
  return isLowSurrogate(line.charCodeAt(clamped - 1)) && isHighSurrogate(line.charCodeAt(clamped - 2))
    ? clamped - 2
    : clamped - 1;
}

function isHighSurrogate(value: number): boolean {
  return value >= HIGH_SURROGATE_START && value <= HIGH_SURROGATE_END;
}

function isLowSurrogate(value: number): boolean {
  return value >= LOW_SURROGATE_START && value <= LOW_SURROGATE_END;
}

function requiredCoordinate<TValue>(result: CoordinateResult<TValue>, message: string): TValue {
  if (!result.ok) {
    throw new WorkspaceTextCoordinateError(message);
  }
  return result.value;
}

export class WorkspaceTextCoordinateError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkspaceTextCoordinateError';
  }
}
