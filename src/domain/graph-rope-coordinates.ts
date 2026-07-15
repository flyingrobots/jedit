import {
  BYTE_OFFSET_COORDINATE_KIND,
  COORDINATE_VALIDATION_ERROR_INVALID_COORDINATE,
  UTF16_OFFSET_COORDINATE_KIND,
  ZERO_BASED_LINE_INDEX_KIND,
  type ByteOffset,
  type CoordinateResult,
  type LineColumn,
  type TextByteRange,
  type Utf16Offset,
  type ZeroBasedLineIndex,
} from './graph-rope-types.js';

const ZERO_VALUE = 0;
const ORDER_BEFORE = -1;
const ORDER_EQUAL = 0;
const ORDER_AFTER = 1;
const CARRIAGE_RETURN = '\r';
const LINE_FEED = '\n';
const HIGH_SURROGATE_START = 0xd800;
const HIGH_SURROGATE_END = 0xdbff;
const LOW_SURROGATE_START = 0xdc00;
const LOW_SURROGATE_END = 0xdfff;
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

export type ByteOffsetOrder =
  | typeof ORDER_BEFORE
  | typeof ORDER_EQUAL
  | typeof ORDER_AFTER;

export function makeByteOffset(value: number): CoordinateResult<ByteOffset> {
  if (!isNonNegativeInteger(value)) {
    return invalidCoordinate();
  }
  return { ok: true, value: { kind: BYTE_OFFSET_COORDINATE_KIND, value } };
}

export function makeUtf16Offset(value: number): CoordinateResult<Utf16Offset> {
  if (!isNonNegativeInteger(value)) {
    return invalidCoordinate();
  }
  return { ok: true, value: { kind: UTF16_OFFSET_COORDINATE_KIND, value } };
}

export function makeZeroBasedLineIndex(value: number): CoordinateResult<ZeroBasedLineIndex> {
  if (!isNonNegativeInteger(value)) {
    return invalidCoordinate();
  }
  return { ok: true, value: { kind: ZERO_BASED_LINE_INDEX_KIND, value } };
}

export function makeLineColumn(line: ZeroBasedLineIndex, columnUtf16: Utf16Offset): LineColumn {
  return { line, columnUtf16 };
}

export function makeTextByteRange(startByte: ByteOffset, endByte: ByteOffset): CoordinateResult<TextByteRange> {
  if (startByte.value > endByte.value) {
    return invalidCoordinate();
  }
  return { ok: true, value: { startByte, endByte } };
}

export function byteOffsetFromUtf16Offset(
  text: string,
  utf16Offset: Utf16Offset,
): CoordinateResult<ByteOffset> {
  if (!isValidUtf16Boundary(text, utf16Offset)) {
    return invalidCoordinate();
  }
  return makeByteOffset(UTF8_ENCODER.encode(text.slice(ZERO_VALUE, utf16Offset.value)).length);
}

export function utf16OffsetFromByteOffset(
  text: string,
  byteOffset: ByteOffset,
): CoordinateResult<Utf16Offset> {
  if (byteOffset.kind !== BYTE_OFFSET_COORDINATE_KIND || !isNonNegativeInteger(byteOffset.value)) {
    return invalidCoordinate();
  }
  const bytes = UTF8_ENCODER.encode(text);
  if (byteOffset.value > bytes.length) {
    return invalidCoordinate();
  }
  try {
    return makeUtf16Offset(UTF8_DECODER.decode(bytes.slice(ZERO_VALUE, byteOffset.value)).length);
  } catch {
    return invalidCoordinate();
  }
}

export function utf16OffsetFromLineColumn(
  text: string,
  lineColumn: LineColumn,
): CoordinateResult<Utf16Offset> {
  if (lineColumn.line.kind !== ZERO_BASED_LINE_INDEX_KIND
    || lineColumn.columnUtf16.kind !== UTF16_OFFSET_COORDINATE_KIND) {
    return invalidCoordinate();
  }
  const line = textLines(text)[lineColumn.line.value];
  if (line == null || !isNonNegativeInteger(lineColumn.columnUtf16.value)) {
    return invalidCoordinate();
  }
  const utf16Value = line.startUtf16 + lineColumn.columnUtf16.value;
  if (utf16Value > line.contentEndUtf16) {
    return invalidCoordinate();
  }
  const utf16Offset = makeUtf16Offset(utf16Value);
  return utf16Offset.ok && isValidUtf16Boundary(text, utf16Offset.value)
    ? utf16Offset
    : invalidCoordinate();
}

export function lineColumnFromUtf16Offset(
  text: string,
  utf16Offset: Utf16Offset,
): CoordinateResult<LineColumn> {
  if (!isValidUtf16Boundary(text, utf16Offset)) {
    return invalidCoordinate();
  }
  const lines = textLines(text);
  const lineIndex = lines.findIndex((line) => (
    utf16Offset.value >= line.startUtf16 && utf16Offset.value <= line.contentEndUtf16
  ));
  if (lineIndex < ZERO_VALUE) {
    return invalidCoordinate();
  }
  const line = lines[lineIndex];
  if (line == null) {
    return invalidCoordinate();
  }
  const brandedLine = makeZeroBasedLineIndex(lineIndex);
  const brandedColumn = makeUtf16Offset(utf16Offset.value - line.startUtf16);
  return brandedLine.ok && brandedColumn.ok
    ? { ok: true, value: makeLineColumn(brandedLine.value, brandedColumn.value) }
    : invalidCoordinate();
}

export function byteOffsetFromLineColumn(
  text: string,
  lineColumn: LineColumn,
): CoordinateResult<ByteOffset> {
  const utf16Offset = utf16OffsetFromLineColumn(text, lineColumn);
  return utf16Offset.ok
    ? byteOffsetFromUtf16Offset(text, utf16Offset.value)
    : invalidCoordinate();
}

export function lineColumnFromByteOffset(
  text: string,
  byteOffset: ByteOffset,
): CoordinateResult<LineColumn> {
  const utf16Offset = utf16OffsetFromByteOffset(text, byteOffset);
  return utf16Offset.ok
    ? lineColumnFromUtf16Offset(text, utf16Offset.value)
    : invalidCoordinate();
}

export function compareByteOffsets(left: ByteOffset, right: ByteOffset): ByteOffsetOrder {
  if (left.value < right.value) {
    return ORDER_BEFORE;
  }
  if (left.value > right.value) {
    return ORDER_AFTER;
  }
  return ORDER_EQUAL;
}

export function byteOffsetsEqual(left: ByteOffset, right: ByteOffset): boolean {
  return compareByteOffsets(left, right) === ORDER_EQUAL;
}

export function textByteRangesEqual(left: TextByteRange, right: TextByteRange): boolean {
  return byteOffsetsEqual(left.startByte, right.startByte)
    && byteOffsetsEqual(left.endByte, right.endByte);
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= ZERO_VALUE;
}

function isValidUtf16Boundary(text: string, offset: Utf16Offset): boolean {
  if (offset.kind !== UTF16_OFFSET_COORDINATE_KIND
    || !isNonNegativeInteger(offset.value)
    || offset.value > text.length) {
    return false;
  }
  if (offset.value === ZERO_VALUE || offset.value === text.length) {
    return true;
  }
  return !isHighSurrogate(text.charCodeAt(offset.value - 1))
    || !isLowSurrogate(text.charCodeAt(offset.value));
}

function isHighSurrogate(value: number): boolean {
  return value >= HIGH_SURROGATE_START && value <= HIGH_SURROGATE_END;
}

function isLowSurrogate(value: number): boolean {
  return value >= LOW_SURROGATE_START && value <= LOW_SURROGATE_END;
}

function textLines(text: string): readonly TextLineBoundary[] {
  const lines: TextLineBoundary[] = [];
  let lineStart = ZERO_VALUE;
  let index = ZERO_VALUE;
  while (index < text.length) {
    const character = text[index];
    if (character !== CARRIAGE_RETURN && character !== LINE_FEED) {
      index += 1;
      continue;
    }
    const breakLength = character === CARRIAGE_RETURN && text[index + 1] === LINE_FEED ? 2 : 1;
    lines.push({ startUtf16: lineStart, contentEndUtf16: index });
    index += breakLength;
    lineStart = index;
  }
  lines.push({ startUtf16: lineStart, contentEndUtf16: text.length });
  return lines;
}

interface TextLineBoundary {
  readonly startUtf16: number;
  readonly contentEndUtf16: number;
}

function invalidCoordinate<TValue>(): CoordinateResult<TValue> {
  return { ok: false, code: COORDINATE_VALIDATION_ERROR_INVALID_COORDINATE };
}
