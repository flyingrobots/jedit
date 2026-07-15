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
import {
  buildJeditLineIndexProjection,
  createDisposableJeditLineIndexStore,
  selectJeditLineIndexWindow,
  type DisposableJeditLineIndexStore,
  type JeditLineIndexProjection,
  type JeditLineIndexWindow,
  type JeditLineOffsetProjection,
} from './jedit-line-index-projection.js';

const TEXT_WINDOW_MIN_LINE = 0;
const TEXT_WINDOW_MIN_COUNT = 1;
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
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

export interface JeditTextWindowObserver {
  read(
    session: JeditWorldlineSession,
    frontierRef: string,
    input: TextWindowInput,
  ): TextWindowReadingEnvelope;
}

interface JeditTextWindowObserverContext {
  readonly runtime: HotTextRuntimePort;
  readonly hash: HashPort;
  readonly lineIndexes: DisposableJeditLineIndexStore;
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

export function createJeditTextWindowObserver(
  runtime: HotTextRuntimePort,
  hash: HashPort,
  lineIndexes: DisposableJeditLineIndexStore = createDisposableJeditLineIndexStore(),
): JeditTextWindowObserver {
  const context = Object.freeze({ runtime, hash, lineIndexes });
  const observer: JeditTextWindowObserver = {
    read(session, frontierRef, input) {
      return readTextWindowWithObserverPlan(context, session, frontierRef, input);
    },
  };
  return Object.freeze(observer);
}

function readTextWindowWithObserverPlan(
  context: JeditTextWindowObserverContext,
  session: JeditWorldlineSession,
  frontierRef: string,
  input: TextWindowInput,
): TextWindowReadingEnvelope {
  const schemas = QueryOperationSchemas.textWindow;
  const parsedInput = schemas.input.parse(input);
  const reading = readTextWindow(context, session, parsedInput);

  return {
    planId: textWindowPlanId(context.hash),
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

function readTextWindow(
  context: JeditTextWindowObserverContext,
  session: JeditWorldlineSession,
  input: TextWindowInput,
): ProjectedTextWindowReading {
  assertWorldlineMatchesSession(session, input);
  assertPositiveCount(input.viewportLineCount, 'viewportLineCount');
  assertNonNegativeCount(input.beforeLines, 'beforeLines');
  assertNonNegativeCount(input.afterLines, 'afterLines');
  assertPositiveCount(input.maxBytes, 'maxBytes');
  assertNonNegativeCount(input.startByte, 'startByte');
  assertNonNegativeCount(input.endByte, 'endByte');
  if (input.startByte > input.endByte) {
    throw new TextWindowRuntimeError('startByte must not exceed endByte.');
  }

  const lineIndex = lineIndexForInput(context, session, input);
  const selection = selectJeditLineIndexWindow(lineIndex, input);
  const byteRange = serializedRange(selection);
  const projection = readProjection(context.runtime, session, {
    basisHeadId: input.basisHeadId,
    byteRange,
  });
  assertLineIndexBasis(context.lineIndexes, lineIndex, projection);
  const lines = toTextLineReadings(projection, selection.lines);
  const startLine = selection.startLine.value;

  return {
    worldline: session.worldline,
    head: lineIndex.basis,
    readingId: toTextWindowReadingId(projection.basisHeadId, byteRange),
    startLine,
    lineCount: lines.length,
    totalLineCount: selection.totalLineCount,
    hasMoreBefore: startLine > TEXT_WINDOW_MIN_LINE,
    hasMoreAfter: startLine + lines.length < selection.totalLineCount,
    lines,
    projection,
  };
}

function assertWorldlineMatchesSession(
  session: JeditWorldlineSession,
  input: TextWindowInput,
): void {
  if (input.worldlineId !== session.worldline.worldlineId) {
    throw new TextWindowRuntimeError('Text window worldline does not match its session basis.');
  }
}

function lineIndexForInput(
  context: JeditTextWindowObserverContext,
  session: JeditWorldlineSession,
  input: TextWindowInput,
): JeditLineIndexProjection {
  const cached = context.lineIndexes.find(input.worldlineId, input.basisHeadId);
  if (cached != null) {
    assertLineIndexCoverage(context.lineIndexes, cached, input);
    return cached;
  }
  const projection = readProjection(context.runtime, session, inputWindowRequest(input));
  const index = buildJeditLineIndexProjection(projection);
  context.lineIndexes.retain(index);
  return index;
}

function toTextLineReadings(
  projection: HotTextWindowProjection,
  indexedLines: readonly JeditLineOffsetProjection[],
): TextLineReading[] {
  const bytes = UTF8_ENCODER.encode(projection.text);
  return indexedLines.map((line) => ({
    lineNumber: line.line.value,
    text: decodeIndexedLine(bytes, projection.byteRange.startByte, line),
    startByte: line.startByte.value,
    endByte: line.contentEndByte.value,
  }));
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

function inputWindowRequest(
  input: TextWindowInput,
): HotTextWindowRequest {
  return {
    basisHeadId: input.basisHeadId,
    byteRange: { startByte: input.startByte, endByte: input.endByte },
  };
}

function serializedRange(selection: JeditLineIndexWindow): HotTextWindowByteRange {
  return {
    startByte: selection.byteRange.startByte.value,
    endByte: selection.byteRange.endByte.value,
  };
}

function assertLineIndexCoverage(
  store: DisposableJeditLineIndexStore,
  index: JeditLineIndexProjection,
  input: TextWindowInput,
): void {
  if (index.coverage.startByte.value !== input.startByte
    || index.coverage.endByte.value !== input.endByte) {
    store.delete(index.basis.worldlineId, index.basis.headId);
    throw new TextWindowRuntimeError('Line index coverage does not match the requested text basis.');
  }
}

function assertLineIndexBasis(
  store: DisposableJeditLineIndexStore,
  index: JeditLineIndexProjection,
  projection: HotTextWindowProjection,
): void {
  const basis = projection.basis;
  if (basis.worldlineId !== index.basis.worldlineId
    || basis.headId !== index.basis.headId
    || basis.rootNodeId !== index.basis.rootNodeId
    || basis.byteLength !== index.basis.byteLength
    || basis.lineCount !== index.basis.lineCount) {
    store.delete(index.basis.worldlineId, index.basis.headId);
    throw new TextWindowRuntimeError('Line index basis does not match the materialized text head.');
  }
}

function decodeIndexedLine(
  bytes: Uint8Array,
  projectionStartByte: number,
  line: JeditLineOffsetProjection,
): string {
  const startByte = line.startByte.value - projectionStartByte;
  const endByte = line.contentEndByte.value - projectionStartByte;
  if (startByte < TEXT_WINDOW_MIN_LINE || endByte < startByte || endByte > bytes.length) {
    throw new TextWindowRuntimeError('Line index offsets fall outside the materialized text window.');
  }
  try {
    return UTF8_DECODER.decode(bytes.slice(startByte, endByte));
  } catch {
    throw new TextWindowRuntimeError('Line index offsets split a UTF-8 sequence.');
  }
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
