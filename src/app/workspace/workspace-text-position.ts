const FIRST_LINE = 0;
const FIRST_COLUMN = 0;
const LINE_FEED = '\n';
const TEXT_ENCODER = new TextEncoder();

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
      column: column - 1,
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
): number {
  const row = clampRow(lines, position.row);
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
  const row = clampRow(lines, position.row);
  const line = lines[row] ?? '';
  const column = Math.min(position.column + 1, line.length);
  return byteOffsetForTextPosition(lines, { row, column });
}

export function previousByteOffset(
  lines: readonly string[],
  position: TextPosition,
): number {
  const row = clampRow(lines, position.row);
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

function clampRow(lines: readonly string[], row: number): number {
  return Math.max(FIRST_LINE, Math.min(row, Math.max(FIRST_LINE, lines.length - 1)));
}

function utf8ByteLength(value: string): number {
  return TEXT_ENCODER.encode(value).length;
}
