import type {
  QueryOperationMap,
} from '../generated/jedit/hot-text-runtime.types.generated.js';
import { QueryOperationSchemas } from '../generated/jedit/hot-text-runtime.zod.generated.js';
import { worldlineSnapshotObserverPlan } from '../generated/jedit/worldlineSnapshot.observer-plan.generated.js';
import type { HotTextRuntimePort } from '../ports/hot-text-runtime.js';
import type { JeditWorldlineSession } from './jedit-contract-runtime.js';
import { readWorldlineSnapshot } from './jedit-contract-runtime.js';

const TEXT_WINDOW_PLAN_ID = 'observer-plan:textWindow:fake-v1';
const TEXT_WINDOW_OBSERVER_NAME = 'textWindow';
const TEXT_WINDOW_OPERATION_NAME = 'textWindow';
const TEXT_WINDOW_MIN_LINE = 0;
const TEXT_WINDOW_MIN_COUNT = 1;
const TEXT_WINDOW_LINE_SEPARATOR_BYTE_LENGTH = 1;
const UTF8_ENCODER = new TextEncoder();

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
}

export function readWorldlineSnapshotWithObserverPlan(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  frontierRef: string,
  input: WorldlineSnapshotInput,
): WorldlineSnapshotReadingEnvelope {
  const schemas = QueryOperationSchemas.worldlineSnapshot;
  const parsedInput = schemas.input.parse(input);
  const reading = readWorldlineSnapshot(runtime, session, parsedInput);

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
): TextWindowReadingEnvelope {
  const schemas = QueryOperationSchemas.textWindow;
  const parsedInput = schemas.input.parse(input);
  const reading = readTextWindow(runtime, session, parsedInput);

  return {
    planId: TEXT_WINDOW_PLAN_ID,
    observerName: TEXT_WINDOW_OBSERVER_NAME,
    operationName: TEXT_WINDOW_OPERATION_NAME,
    frontierRef,
    reading: schemas.result.parse(reading),
  };
}

function readTextWindow(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  input: TextWindowInput,
): TextWindowReading {
  assertPositiveCount(input.viewportLineCount, 'viewportLineCount');
  assertNonNegativeCount(input.beforeLines, 'beforeLines');
  assertNonNegativeCount(input.afterLines, 'afterLines');
  assertPositiveCount(input.maxBytes, 'maxBytes');

  // Fake-only implementation detail: derive the bounded reading from the
  // current snapshot until Echo can stream line windows directly.
  const snapshot = readWorldlineSnapshot(runtime, session, {
    worldlineId: input.worldlineId,
  });
  const allLines = toTextLineReadings(snapshot.text);
  const cursorLine = clampLine(input.cursorLine, allLines.length);
  const startLine = Math.max(TEXT_WINDOW_MIN_LINE, cursorLine - input.beforeLines);
  const requestedLineCount = input.beforeLines + input.viewportLineCount + input.afterLines;
  const requestedLines = allLines.slice(startLine, startLine + requestedLineCount);
  const lines = takeWithinByteBudget(requestedLines, input.maxBytes);

  return {
    worldline: snapshot.worldline,
    head: snapshot.head,
    readingId: toTextWindowReadingId(snapshot.head.headId, startLine, lines.length, input.maxBytes),
    startLine,
    lineCount: lines.length,
    totalLineCount: allLines.length,
    hasMoreBefore: startLine > TEXT_WINDOW_MIN_LINE,
    hasMoreAfter: startLine + lines.length < allLines.length,
    lines,
  };
}

function toTextLineReadings(text: string): TextLineReading[] {
  const lines = text.split('\n');
  let startByte = TEXT_WINDOW_MIN_LINE;

  return lines.map((line, lineNumber) => {
    const endByte = startByte + byteLength(line);
    const reading = {
      lineNumber,
      text: line,
      startByte,
      endByte,
    };
    startByte = endByte + TEXT_WINDOW_LINE_SEPARATOR_BYTE_LENGTH;
    return reading;
  });
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
  startLine: number,
  lineCount: number,
  maxBytes: number,
): string {
  return `text-window:${headId}:${startLine}:${lineCount}:${maxBytes}`;
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
