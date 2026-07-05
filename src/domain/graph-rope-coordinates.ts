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

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= ZERO_VALUE;
}

function invalidCoordinate<TValue>(): CoordinateResult<TValue> {
  return { ok: false, code: COORDINATE_VALIDATION_ERROR_INVALID_COORDINATE };
}
