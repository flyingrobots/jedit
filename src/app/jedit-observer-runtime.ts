import type {
  QueryOperationMap,
} from '../generated/jedit/rope.types.generated.js';
import { QueryOperationSchemas } from '../generated/jedit/rope.zod.generated.js';
import { queryTextWindowOperation } from '../generated/jedit/rope.wesley.generated.js';
import { worldlineSnapshotObserverPlan } from '../generated/jedit/worldlineSnapshot.observer-plan.generated.js';
import type {
  HotTextRuntimePort,
  HotTextWindowByteRange,
  HotTextWindowProjection,
  HotTextWindowRequest,
} from '../ports/hot-text-runtime.js';
import type { JeditRetainedEvidenceInventory } from '../ports/jedit-retained-evidence.js';
import type { JeditWorldlineSession } from './jedit-contract-runtime.js';
import { readWorldlineSnapshot } from './jedit-contract-runtime.js';
import { JEDIT_HOT_TEXT_PACKAGE_ID } from './jedit-contract-package.js';
import { createJeditReadingRetainedEvidenceInventory } from './jedit-retained-evidence.js';
import type { HashPort } from '../ports/hash.js';

const TEXT_WINDOW_MIN_LINE = 0;
const TEXT_WINDOW_MIN_COUNT = 1;
const TEXT_WINDOW_LINE_SEPARATOR_BYTE_LENGTH = 1;
const UTF8_ENCODER = new TextEncoder();
const TEXT_WINDOW_PLAN_SPEC = Object.freeze({
  idPrefix: 'observer-plan:textWindow:',
  observerName: 'textWindow',
  kind: 'TEXT_WINDOW',
  operationName: queryTextWindowOperation.fieldName,
  aperture: 'BOUNDED_TEXT_WINDOW',
  basis: 'JEDIT_HOT_TEXT',
  state: 'MEMORYLESS',
  emit: 'TEXT_WINDOW_READING',
  // Use 16 hex chars (64 bits) so generated ids stay readable while retaining
  // a stable deterministic digest prefix for this single local observer plan.
  hashLength: 16,
});

type WorldlineSnapshotInput = QueryOperationMap['worldlineSnapshot']['input'];
type WorldlineSnapshotReading = QueryOperationMap['worldlineSnapshot']['result'];
type TextWindowInput = QueryOperationMap['textWindow']['input'];
type TextWindowReading = QueryOperationMap['textWindow']['result'];
type TextLineReading = TextWindowReading['lines'][number];

export interface WorldlineSnapshotReadingEnvelope {
  readonly planId: string;
  readonly observerName: string;
  readonly operationName: string;
  readonly frontierRef: string;
  readonly reading: WorldlineSnapshotReading;
}

export interface TextWindowReadingEnvelope {
  readonly planId: string;
  readonly observerName: string;
  readonly operationName: string;
  readonly frontierRef: string;
  readonly reading: TextWindowReading;
  readonly projection: HotTextWindowProjection;
  readonly retainedEvidence: JeditRetainedEvidenceInventory;
}

export function readWorldlineSnapshotWithObserverPlan(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  frontierRef: string,
  input: WorldlineSnapshotInput,
  hash: HashPort,
): WorldlineSnapshotReadingEnvelope {
  const schemas = QueryOperationSchemas.worldlineSnapshot;
  const parsedInput = schemas.input.parse(input);
  const reading = readWorldlineSnapshot(runtime, session, parsedInput, hash);

  return {
    planId: worldlineSnapshotObserverPlan.planId,
    observerName: worldlineSnapshotObserverPlan.observerName,
    operationName: worldlineSnapshotObserverPlan.operationName,
    frontierRef,
    reading: schemas.result.parse(reading),
  };
}

export function readTextWindowWithObserverPlan(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  frontierRef: string,
  input: TextWindowInput,
  hash: HashPort,
): TextWindowReadingEnvelope {
  const schemas = QueryOperationSchemas.textWindow;
  const parsedInput = schemas.input.parse(input);
  const reading = readTextWindow(runtime, session, parsedInput);

  return {
    planId: textWindowPlanId(hash),
    observerName: TEXT_WINDOW_PLAN_SPEC.observerName,
    operationName: TEXT_WINDOW_PLAN_SPEC.operationName,
    frontierRef,
    reading: schemas.result.parse(reading),
    projection: reading.projection,
    retainedEvidence: createJeditReadingRetainedEvidenceInventory({
      packageId: JEDIT_HOT_TEXT_PACKAGE_ID,
      queryOperationName: TEXT_WINDOW_PLAN_SPEC.operationName,
      readingId: reading.readingId,
    }),
  };
}

function textWindowPlanId(hash: HashPort): string {
  return `${TEXT_WINDOW_PLAN_SPEC.idPrefix}${hash.sha256Hex(JSON.stringify(TEXT_WINDOW_PLAN_SPEC)).slice(0, TEXT_WINDOW_PLAN_SPEC.hashLength)}`;
}

interface ProjectedTextWindowReading extends TextWindowReading {
  readonly projection: HotTextWindowProjection;
}

interface TextWindowSelection {
  readonly startLine: number;
  readonly totalLineCount: number;
  readonly byteRange: HotTextWindowByteRange;
}

function readTextWindow(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  input: TextWindowInput,
): ProjectedTextWindowReading {
  assertPositiveCount(input.viewportLineCount, 'viewportLineCount');
  assertNonNegativeCount(input.beforeLines, 'beforeLines');
  assertNonNegativeCount(input.afterLines, 'afterLines');
  assertPositiveCount(input.maxBytes, 'maxBytes');
  assertNonNegativeCount(input.startByte, 'startByte');
  assertNonNegativeCount(input.endByte, 'endByte');
  if (input.startByte > input.endByte) {
    throw new TextWindowRuntimeError('startByte must not exceed endByte.');
  }

  const basisProjection = readProjection(runtime, session, {
    basisHeadId: input.basisHeadId,
    byteRange: { startByte: input.startByte, endByte: input.endByte },
  });
  const allLines = toTextLineReadings(basisProjection.text, TEXT_WINDOW_MIN_LINE, input.startByte);
  const selection = selectTextWindow(allLines, input);
  const projection = readProjection(runtime, session, {
    basisHeadId: input.basisHeadId,
    byteRange: selection.byteRange,
  });
  const lines = toTextLineReadings(projection.text, selection.startLine, selection.byteRange.startByte);

  return {
    worldline: session.worldline,
    head: basisProjection.basis,
    readingId: toTextWindowReadingId(projection.basisHeadId, selection.byteRange),
    startLine: selection.startLine,
    lineCount: lines.length,
    totalLineCount: selection.totalLineCount,
    hasMoreBefore: selection.startLine > TEXT_WINDOW_MIN_LINE,
    hasMoreAfter: selection.startLine + lines.length < selection.totalLineCount,
    lines,
    projection,
  };
}

function toTextLineReadings(text: string, firstLine: number, firstByte: number): TextLineReading[] {
  const lines = text.split('\n');
  let startByte = firstByte;

  return lines.map((line, lineOffset) => {
    const endByte = startByte + byteLength(line);
    const reading = {
      lineNumber: firstLine + lineOffset,
      text: line,
      startByte,
      endByte,
    };
    startByte = endByte + TEXT_WINDOW_LINE_SEPARATOR_BYTE_LENGTH;
    return reading;
  });
}

function readProjection(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  request: HotTextWindowRequest,
): HotTextWindowProjection {
  const projection = runtime.textWindow(session.state, request);
  if (!projectionMatchesRequest(projection, request, session.worldline.worldlineId)) {
    throw new TextWindowRuntimeError('Text projection does not match its requested causal basis.');
  }
  return projection;
}

function projectionMatchesRequest(
  projection: HotTextWindowProjection,
  request: HotTextWindowRequest,
  expectedWorldlineId: string,
): boolean {
  return projection.basisHeadId === request.basisHeadId
    && projection.basis.headId === request.basisHeadId
    && projection.basis.worldlineId === expectedWorldlineId
    && projection.byteRange.startByte === request.byteRange.startByte
    && projection.byteRange.endByte === request.byteRange.endByte
    && projection.byteRange.endByte <= projection.basis.byteLength
    && byteLength(projection.text) === request.byteRange.endByte - request.byteRange.startByte
    && projection.support.every((support) => supportWithinRange(support.byteRange, request.byteRange));
}

function supportWithinRange(
  support: HotTextWindowByteRange,
  requested: HotTextWindowByteRange,
): boolean {
  return support.startByte >= requested.startByte
    && support.endByte <= requested.endByte
    && support.startByte <= support.endByte;
}

function selectTextWindow(
  allLines: readonly TextLineReading[],
  input: TextWindowInput,
): TextWindowSelection {
  const cursorLine = clampLine(input.cursorLine, allLines.length);
  const startLine = Math.max(TEXT_WINDOW_MIN_LINE, cursorLine - input.beforeLines);
  const requestedLineCount = input.beforeLines + input.viewportLineCount + input.afterLines;
  const requestedLines = allLines.slice(startLine, startLine + requestedLineCount);
  const lines = takeWithinByteBudget(requestedLines, input.maxBytes);
  return {
    startLine,
    totalLineCount: allLines.length,
    byteRange: byteRangeForLines(lines),
  };
}

function byteRangeForLines(lines: readonly TextLineReading[]): HotTextWindowByteRange {
  const first = lines[0];
  const last = lines.at(-1);
  if (first == null || last == null) {
    return { startByte: TEXT_WINDOW_MIN_LINE, endByte: TEXT_WINDOW_MIN_LINE };
  }
  return { startByte: first.startByte, endByte: last.endByte };
}

function takeWithinByteBudget(
  lines: readonly TextLineReading[],
  maxBytes: number,
): TextLineReading[] {
  let consumedBytes = TEXT_WINDOW_MIN_LINE;
  const bounded: TextLineReading[] = [];

  for (const line of lines) {
    const lineBytes = line.endByte - line.startByte;
    if (bounded.length > TEXT_WINDOW_MIN_LINE && consumedBytes + lineBytes > maxBytes) {
      break;
    }
    bounded.push(line);
    consumedBytes += lineBytes;
  }

  return bounded;
}

function assertPositiveCount(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < TEXT_WINDOW_MIN_COUNT) {
    throw new TextWindowRuntimeError(`${fieldName} must be a positive integer.`);
  }
}

function assertNonNegativeCount(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < TEXT_WINDOW_MIN_LINE) {
    throw new TextWindowRuntimeError(`${fieldName} must be a non-negative integer.`);
  }
}

function clampLine(line: number, totalLineCount: number): number {
  if (line < TEXT_WINDOW_MIN_LINE) {
    return TEXT_WINDOW_MIN_LINE;
  }
  return Math.min(line, Math.max(TEXT_WINDOW_MIN_LINE, totalLineCount - TEXT_WINDOW_MIN_COUNT));
}

function toTextWindowReadingId(
  headId: string,
  byteRange: HotTextWindowByteRange,
): string {
  return `text-window:${headId}:${byteRange.startByte}:${byteRange.endByte}`;
}

function byteLength(text: string): number {
  return UTF8_ENCODER.encode(text).length;
}

class TextWindowRuntimeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'TextWindowRuntimeError';
  }
}
