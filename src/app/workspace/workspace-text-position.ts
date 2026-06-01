const FIRST_LINE = 0;
const FIRST_COLUMN = 0;
const LINE_FEED = '\n';
const TEXT_ENCODER = new TextEncoder();

export interface TextPosition {
  readonly row: number;
  readonly column: number;
}

export function utf8ByteLength(value: string): number {
  return TEXT_ENCODER.encode(value).length;
}

export function byteOffsetForTextPosition(
  lines: readonly string[],
  position: TextPosition,
): number {
  const row = Math.max(FIRST_LINE, Math.min(position.row, Math.max(FIRST_LINE, lines.length - 1)));
  const column = Math.max(FIRST_COLUMN, position.column);
  let offset = 0;
  for (let index = FIRST_LINE; index < row; index += 1) {
    offset += utf8ByteLength(`${lines[index] ?? ''}${LINE_FEED}`);
  }
  return offset + utf8ByteLength((lines[row] ?? '').slice(FIRST_COLUMN, column));
}

export function nextByteOffset(
  lines: readonly string[],
  position: TextPosition,
): number {
  const row = Math.max(FIRST_LINE, Math.min(position.row, Math.max(FIRST_LINE, lines.length - 1)));
  const line = lines[row] ?? '';
  const column = Math.min(position.column + 1, line.length);
  return byteOffsetForTextPosition(lines, { row, column });
}

export function previousByteOffset(
  lines: readonly string[],
  position: TextPosition,
): number {
  const row = Math.max(FIRST_LINE, Math.min(position.row, Math.max(FIRST_LINE, lines.length - 1)));
  if (position.column > FIRST_COLUMN) {
    return byteOffsetForTextPosition(lines, {
      row,
      column: position.column - 1,
    });
  }
  if (row === FIRST_LINE) {
    return byteOffsetForTextPosition(lines, {
      row,
      column: FIRST_COLUMN,
    });
  }
  return byteOffsetForTextPosition(lines, {
    row: row - 1,
    column: (lines[row - 1] ?? '').length,
  });
}

export function textPositionForByteOffset(
  lines: readonly string[],
  byteOffset: number,
): TextPosition {
  let remaining = Math.max(FIRST_COLUMN, byteOffset);
  for (let row = FIRST_LINE; row < lines.length; row += 1) {
    const line = lines[row] ?? '';
    const lineBytes = utf8ByteLength(line);
    if (remaining <= lineBytes) {
      return { row, column: columnForUtf8ByteOffset(line, remaining) };
    }
    remaining -= lineBytes;
    if (row >= lines.length - 1) {
      return { row, column: line.length };
    }
    const lineFeedBytes = utf8ByteLength(LINE_FEED);
    if (remaining <= lineFeedBytes) {
      return { row: row + 1, column: FIRST_COLUMN };
    }
    remaining -= lineFeedBytes;
  }
  return { row: FIRST_LINE, column: FIRST_COLUMN };
}

function columnForUtf8ByteOffset(line: string, byteOffset: number): number {
  let column = FIRST_COLUMN;
  for (const char of line) {
    const nextColumn = column + char.length;
    if (utf8ByteLength(line.slice(FIRST_COLUMN, nextColumn)) > byteOffset) {
      return column;
    }
    column = nextColumn;
  }
  return line.length;
}
