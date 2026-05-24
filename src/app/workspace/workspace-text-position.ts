const FIRST_LINE = 0;
const FIRST_COLUMN = 0;
const LINE_FEED = '\n';
const TEXT_ENCODER = new TextEncoder();

export interface TextPosition {
  readonly row: number;
  readonly column: number;
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

function utf8ByteLength(value: string): number {
  return TEXT_ENCODER.encode(value).length;
}
