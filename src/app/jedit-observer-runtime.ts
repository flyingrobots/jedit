import {
  queryTextWindowOperation,
  type TextLineReading,
  type TextWindowInput,
  type TextWindowReading,
  type WorldlineSnapshot as WorldlineSnapshotReading,
  type WorldlineSnapshotInput,
} from '../generated/jedit/rope.wesley.generated.js';
import type {
  HotTextRuntimePort,
  HotTextWindowByteRange,
  HotTextWindowProjection,
  HotTextWindowRequest,
} from '../ports/hot-text-runtime.js';
import type { JeditRetainedEvidenceInventory } from '../ports/jedit-retained-evidence.js';
import { readWorldlineSnapshot, type JeditWorldlineSession } from './jedit-contract-runtime.js';
import { JEDIT_HOT_TEXT_PACKAGE_ID } from './jedit-contract-package.js';
import { createJeditReadingRetainedEvidenceInventory } from './jedit-retained-evidence.js';
import { createWorldlineSnapshotObserverPlan } from './jedit-observer-plan.js';
import {
  TextWindowInputSchema,
  TextWindowReadingSchema,
  WorldlineSnapshotInputSchema,
  WorldlineSnapshotSchema,
} from './jedit-hot-text-json-schemas.js';
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
import {
  createDisposableJeditTextWindowMaterializationCache,
  createJeditTextWindowMaterialization,
  createJeditTextWindowMaterializationKey,
  JEDIT_MATERIALIZATION_CACHE_HIT,
  jeditTextWindowMaterializationProvenance,
  type DisposableJeditTextWindowMaterializationCache,
  type JeditTextWindowMaterialization,
  type JeditTextWindowMaterializationKey,
  type JeditTextWindowMaterializationProvenance,
} from './jedit-text-window-materialization-cache.js';

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
  readonly materialization: JeditTextWindowMaterializationProvenance;
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
  readonly materializations: DisposableJeditTextWindowMaterializationCache;
}

interface JeditMaterializationObserverCoordinate {
  readonly frontierRef: string;
  readonly observerPlanId: string;
  readonly basisHeadId: string;
  readonly selection: JeditLineIndexWindow;
}

export function readWorldlineSnapshotWithObserverPlan(
  runtime: HotTextRuntimePort,
  session: JeditWorldlineSession,
  frontierRef: string,
  input: WorldlineSnapshotInput,
  hash: HashPort,
): WorldlineSnapshotReadingEnvelope {
  const parsedInput = WorldlineSnapshotInputSchema.parse(input);
  const reading = readWorldlineSnapshot(runtime, session, parsedInput, hash);
  const observerPlan = createWorldlineSnapshotObserverPlan(hash);

  return {
    planId: observerPlan.planId,
    observerName: observerPlan.observerName,
    operationName: observerPlan.operationName,
    frontierRef,
    reading: WorldlineSnapshotSchema.parse(reading),
  };
}

export function createJeditTextWindowObserver(
  runtime: HotTextRuntimePort,
  hash: HashPort,
  lineIndexes: DisposableJeditLineIndexStore = createDisposableJeditLineIndexStore(),
  materializations: DisposableJeditTextWindowMaterializationCache = createDisposableJeditTextWindowMaterializationCache(),
): JeditTextWindowObserver {
  const context = Object.freeze({ runtime, hash, lineIndexes, materializations });
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
  const parsedInput = TextWindowInputSchema.parse(input);
  const planId = textWindowPlanId(context.hash);
  const reading = readTextWindow(context, session, frontierRef, planId, parsedInput);

  return {
    planId,
    observerName: TEXT_WINDOW_PLAN_SPEC.observerName,
    operationName: TEXT_WINDOW_PLAN_SPEC.operationName,
    frontierRef,
    reading: TextWindowReadingSchema.parse(reading),
    projection: reading.projection,
    materialization: reading.materialization,
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
  readonly materialization: JeditTextWindowMaterializationProvenance;
}

function readTextWindow(
  context: JeditTextWindowObserverContext,
  session: JeditWorldlineSession,
  frontierRef: string,
  observerPlanId: string,
  input: TextWindowInput,
): ProjectedTextWindowReading {
  assertTextWindowInput(session, input);

  const lineIndex = lineIndexForInput(context, session, input);
  const selection = selectJeditLineIndexWindow(lineIndex, input);
  const key = materializationKey(context, session, {
    frontierRef,
    observerPlanId,
    basisHeadId: input.basisHeadId,
    selection,
  });
  const materialization = materializeTextWindow(context, session, lineIndex, key);
  const projection = materialization.projection;
  const byteRange = serializedRange(selection);
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
    materialization: jeditTextWindowMaterializationProvenance(materialization),
  };
}

function assertTextWindowInput(session: JeditWorldlineSession, input: TextWindowInput): void {
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
}

function materializationKey(
  context: JeditTextWindowObserverContext,
  session: JeditWorldlineSession,
  coordinate: JeditMaterializationObserverCoordinate,
): JeditTextWindowMaterializationKey {
  return createJeditTextWindowMaterializationKey({
    worldlineId: session.worldline.worldlineId,
    headId: coordinate.basisHeadId,
    requestFrontierRef: coordinate.frontierRef,
    coverage: coordinate.selection.byteRange,
    observerPlanId: coordinate.observerPlanId,
  }, context.hash);
}

function materializeTextWindow(
  context: JeditTextWindowObserverContext,
  session: JeditWorldlineSession,
  lineIndex: JeditLineIndexProjection,
  key: JeditTextWindowMaterializationKey,
): JeditTextWindowMaterialization {
  const cached = context.materializations.lookup(key);
  if (cached.status === JEDIT_MATERIALIZATION_CACHE_HIT) {
    return cached.entry;
  }
  const projection = readProjection(context.runtime, session, {
    basisHeadId: key.basis.headId,
    byteRange: serializedMaterializationCoverage(key),
  });
  assertLineIndexBasis(context.lineIndexes, lineIndex, projection);
  const materialization = createJeditTextWindowMaterialization(key, projection);
  context.materializations.retain(materialization);
  return materialization;
}

function serializedMaterializationCoverage(
  key: JeditTextWindowMaterializationKey,
): HotTextWindowByteRange {
  return {
    startByte: key.coverage.startByte.value,
    endByte: key.coverage.endByte.value,
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
