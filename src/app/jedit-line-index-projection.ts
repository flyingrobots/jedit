import {
  makeByteOffset,
  makeTextByteRange,
  makeZeroBasedLineIndex,
} from '../domain/graph-rope-coordinates.js';
import type {
  ByteOffset,
  CoordinateResult,
  TextByteRange,
  ZeroBasedLineIndex,
} from '../domain/graph-rope-types.js';
import type {
  HotTextHeadBasis,
  HotTextWindowProjection,
} from '../ports/text-window-projection.js';

export const JEDIT_LINE_INDEX_PROJECTION_KIND = 'jedit-line-offset-index-projection';
export const JEDIT_LINE_INDEX_PROJECTION_VERSION = 1;
const INVALID_PROJECTION_CODE = 'invalid-line-index-projection';
const ZERO_VALUE = 0;
const ONE_VALUE = 1;
const CARRIAGE_RETURN_BYTE = 0x0d;
const LINE_FEED_BYTE = 0x0a;
const UTF8_ENCODER = new TextEncoder();

export interface JeditLineOffsetProjection {
  readonly line: ZeroBasedLineIndex;
  readonly startByte: ByteOffset;
  readonly contentEndByte: ByteOffset;
  readonly nextLineStartByte: ByteOffset;
}

export interface JeditLineIndexProjection {
  readonly kind: typeof JEDIT_LINE_INDEX_PROJECTION_KIND;
  readonly version: typeof JEDIT_LINE_INDEX_PROJECTION_VERSION;
  readonly basis: HotTextHeadBasis;
  readonly coverage: TextByteRange;
  readonly lines: readonly JeditLineOffsetProjection[];
}

export interface JeditLineIndexWindowRequest {
  readonly cursorLine: number;
  readonly viewportLineCount: number;
  readonly beforeLines: number;
  readonly afterLines: number;
  readonly maxBytes: number;
}

export interface JeditLineIndexWindow {
  readonly startLine: ZeroBasedLineIndex;
  readonly totalLineCount: number;
  readonly byteRange: TextByteRange;
  readonly lines: readonly JeditLineOffsetProjection[];
}

export interface DisposableJeditLineIndexStore {
  find(worldlineId: string, basisHeadId: string): JeditLineIndexProjection | null;
  retain(index: JeditLineIndexProjection): void;
  delete(worldlineId: string, basisHeadId: string): void;
  clear(): void;
}

export class JeditLineIndexProjectionError extends Error {
  public readonly code = INVALID_PROJECTION_CODE;

  public constructor() {
    super('Line index projection requires complete, internally consistent UTF-8 head coverage.');
    this.name = 'JeditLineIndexProjectionError';
  }
}

export function buildJeditLineIndexProjection(
  projection: HotTextWindowProjection,
): JeditLineIndexProjection {
  const bytes = UTF8_ENCODER.encode(projection.text);
  assertCompleteProjection(projection, bytes.length);
  const lines = scanLineOffsets(bytes);
  if (lines.length !== projection.basis.lineCount) {
    throw new JeditLineIndexProjectionError();
  }
  return Object.freeze({
    kind: JEDIT_LINE_INDEX_PROJECTION_KIND,
    version: JEDIT_LINE_INDEX_PROJECTION_VERSION,
    basis: Object.freeze({ ...projection.basis }),
    coverage: brandedRange(projection.byteRange.startByte, projection.byteRange.endByte),
    lines: Object.freeze(lines),
  });
}

export function createDisposableJeditLineIndexStore(): DisposableJeditLineIndexStore {
  const byWorldlineAndHead = new Map<string, Map<string, JeditLineIndexProjection>>();
  return Object.freeze({
    find(worldlineId: string, basisHeadId: string): JeditLineIndexProjection | null {
      return byWorldlineAndHead.get(worldlineId)?.get(basisHeadId) ?? null;
    },
    retain(index: JeditLineIndexProjection): void {
      let byHeadId = byWorldlineAndHead.get(index.basis.worldlineId);
      if (byHeadId == null) {
        byHeadId = new Map<string, JeditLineIndexProjection>();
        byWorldlineAndHead.set(index.basis.worldlineId, byHeadId);
      }
      byHeadId.set(index.basis.headId, index);
    },
    delete(worldlineId: string, basisHeadId: string): void {
      const byHeadId = byWorldlineAndHead.get(worldlineId);
      byHeadId?.delete(basisHeadId);
      if (byHeadId?.size === ZERO_VALUE) {
        byWorldlineAndHead.delete(worldlineId);
      }
    },
    clear(): void {
      byWorldlineAndHead.clear();
    },
  });
}

export function selectJeditLineIndexWindow(
  index: JeditLineIndexProjection,
  request: JeditLineIndexWindowRequest,
): JeditLineIndexWindow {
  const cursorLine = clampLine(request.cursorLine, index.lines.length);
  const startLine = Math.max(ZERO_VALUE, cursorLine - request.beforeLines);
  const requestedLineCount = request.beforeLines + request.viewportLineCount + request.afterLines;
  const requestedLines = index.lines.slice(startLine, startLine + requestedLineCount);
  const lines = takeWithinByteBudget(requestedLines, request.maxBytes);
  return Object.freeze({
    startLine: requiredCoordinate(makeZeroBasedLineIndex(startLine)),
    totalLineCount: index.lines.length,
    byteRange: byteRangeForLines(lines),
    lines: Object.freeze(lines),
  });
}

function assertCompleteProjection(
  projection: HotTextWindowProjection,
  materializedByteLength: number,
): void {
  const range = projection.byteRange;
  if (projection.basisHeadId !== projection.basis.headId
    || range.startByte !== ZERO_VALUE
    || range.endByte !== projection.basis.byteLength
    || materializedByteLength !== projection.basis.byteLength) {
    throw new JeditLineIndexProjectionError();
  }
}

function scanLineOffsets(bytes: Uint8Array): readonly JeditLineOffsetProjection[] {
  const lines: JeditLineOffsetProjection[] = [];
  let lineStart = ZERO_VALUE;
  let byteIndex = ZERO_VALUE;
  while (byteIndex < bytes.length) {
    const nextLineStart = lineBreakEnd(bytes, byteIndex);
    if (nextLineStart === null) {
      byteIndex += ONE_VALUE;
      continue;
    }
    lines.push(lineOffset(lines.length, lineStart, byteIndex, nextLineStart));
    lineStart = nextLineStart;
    byteIndex = nextLineStart;
  }
  lines.push(lineOffset(lines.length, lineStart, bytes.length, bytes.length));
  return lines;
}

function lineBreakEnd(bytes: Uint8Array, byteIndex: number): number | null {
  if (bytes[byteIndex] === CARRIAGE_RETURN_BYTE) {
    return bytes[byteIndex + ONE_VALUE] === LINE_FEED_BYTE
      ? byteIndex + ONE_VALUE + ONE_VALUE
      : byteIndex + ONE_VALUE;
  }
  return bytes[byteIndex] === LINE_FEED_BYTE ? byteIndex + ONE_VALUE : null;
}

function takeWithinByteBudget(
  lines: readonly JeditLineOffsetProjection[],
  maxBytes: number,
): JeditLineOffsetProjection[] {
  const firstStartByte = lines[ZERO_VALUE]?.startByte.value ?? ZERO_VALUE;
  const bounded: JeditLineOffsetProjection[] = [];
  for (const line of lines) {
    const coveredBytes = line.contentEndByte.value - firstStartByte;
    if (bounded.length > ZERO_VALUE && coveredBytes > maxBytes) {
      break;
    }
    bounded.push(line);
  }
  return bounded;
}

function byteRangeForLines(lines: readonly JeditLineOffsetProjection[]): TextByteRange {
  const first = lines[ZERO_VALUE];
  const last = lines.at(-ONE_VALUE);
  return first == null || last == null
    ? brandedRange(ZERO_VALUE, ZERO_VALUE)
    : brandedRange(first.startByte.value, last.contentEndByte.value);
}

function clampLine(line: number, totalLineCount: number): number {
  if (line < ZERO_VALUE) {
    return ZERO_VALUE;
  }
  return Math.min(line, Math.max(ZERO_VALUE, totalLineCount - ONE_VALUE));
}

function lineOffset(
  line: number,
  startByte: number,
  contentEndByte: number,
  nextLineStartByte: number,
): JeditLineOffsetProjection {
  return Object.freeze({
    line: requiredCoordinate(makeZeroBasedLineIndex(line)),
    startByte: requiredCoordinate(makeByteOffset(startByte)),
    contentEndByte: requiredCoordinate(makeByteOffset(contentEndByte)),
    nextLineStartByte: requiredCoordinate(makeByteOffset(nextLineStartByte)),
  });
}

function brandedRange(startByte: number, endByte: number): TextByteRange {
  return requiredCoordinate(makeTextByteRange(
    requiredCoordinate(makeByteOffset(startByte)),
    requiredCoordinate(makeByteOffset(endByte)),
  ));
}

function requiredCoordinate<TValue>(result: CoordinateResult<TValue>): TValue {
  if (!result.ok) {
    throw new JeditLineIndexProjectionError();
  }
  return result.value;
}
