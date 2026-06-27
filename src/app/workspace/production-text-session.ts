import type { RuntimeIssue } from '@flyingrobots/bijou-tui';
import type {
  ApplyIntentResult,
  Observed,
  CreateTextBufferCheckpointResult,
  TextBufferOptic,
  TextBufferSessionPort,
  TextWindowRangeInput,
  TextWindowReading,
} from '../../ports/text-buffer-session.js';
import {
  REPLACE_RANGE_INTENT_KIND,
  TEXT_BUFFER_CHECKPOINT_KIND_MANUAL_SAVE,
} from '../../ports/text-buffer-session.js';
import { RuntimeIssueLevels, RuntimeIssueSources } from './runtime-issue.js';

const EMPTY_INSERT_TEXT = '';
const OPEN_OBSTRUCTION_CODE = 'text-buffer-open-obstructed';
const EDIT_OBSTRUCTION_CODE = 'text-buffer-edit-obstructed';
const QUERY_OBSTRUCTION_CODE = 'text-buffer-query-obstructed';
const CHECKPOINT_OBSTRUCTION_CODE = 'text-buffer-checkpoint-obstructed';
const MISSING_BUFFER_OBSTRUCTION_CODE = 'text-buffer-missing-obstructed';
const TEXT_EXPORT_OBSTRUCTION_CODE = 'text-buffer-export-obstructed';
const GROUPED_EDIT_OBSTRUCTION_MESSAGE = 'Grouped production text edits require explicit jedit command planning.';
const FULL_SNAPSHOT_OBSTRUCTION_MESSAGE = 'Text export requires a full untruncated text snapshot.';
const TEXT_EXPORT_LINE_SEPARATOR = '\n';
const OUTCOME_OPENED = 'opened';
const OUTCOME_APPLIED = 'applied';
const OUTCOME_CHECKPOINTED = 'checkpointed';
const OUTCOME_OBSERVED = 'observed';
const OUTCOME_EXPORTED = 'exported';
const OUTCOME_OBSTRUCTED = 'obstructed';
const FULL_SNAPSHOT_CURSOR_LINE = 0;
const FULL_SNAPSHOT_BEFORE_LINES = 0;
const FULL_SNAPSHOT_AFTER_LINES = 0;
const FULL_SNAPSHOT_VIEWPORT_LINE_COUNT = Number.MAX_SAFE_INTEGER;
const FULL_SNAPSHOT_MAX_BYTES = Number.MAX_SAFE_INTEGER;

export const ProductionTextSessionOutcomeKinds = Object.freeze({
  Opened: OUTCOME_OPENED,
  Applied: OUTCOME_APPLIED,
  Checkpointed: OUTCOME_CHECKPOINTED,
  Observed: OUTCOME_OBSERVED,
  Exported: OUTCOME_EXPORTED,
  Obstructed: OUTCOME_OBSTRUCTED,
} as const);

export const ProductionTextObstructionCodes = Object.freeze({
  Open: OPEN_OBSTRUCTION_CODE,
  Edit: EDIT_OBSTRUCTION_CODE,
  Query: QUERY_OBSTRUCTION_CODE,
  Checkpoint: CHECKPOINT_OBSTRUCTION_CODE,
  Export: TEXT_EXPORT_OBSTRUCTION_CODE,
  MissingBuffer: MISSING_BUFFER_OBSTRUCTION_CODE,
} as const);

export type ProductionTextSessionOutcomeKind =
  typeof ProductionTextSessionOutcomeKinds[keyof typeof ProductionTextSessionOutcomeKinds];

export type ProductionTextObstructionCode =
  typeof ProductionTextObstructionCodes[keyof typeof ProductionTextObstructionCodes];

export interface ProductionTextOpenRequest {
  readonly bufferKey: string;
  readonly initialText: string;
  readonly projectionPath?: string | null;
  readonly atMs: number;
}

export interface ProductionTextReplaceRequest {
  readonly bufferId: string;
  readonly startByte: number;
  readonly endByte: number;
  readonly insertText: string;
  readonly atMs: number;
}

export interface ProductionTextInsertRequest {
  readonly bufferId: string;
  readonly startByte: number;
  readonly insertText: string;
  readonly atMs: number;
}

export interface ProductionTextDeleteRequest {
  readonly bufferId: string;
  readonly startByte: number;
  readonly endByte: number;
  readonly atMs: number;
}

export interface ProductionTextRange {
  readonly startByte: number;
  readonly endByte: number;
  readonly insertText: string;
}

export interface ProductionTextMultiRangeRequest {
  readonly bufferId: string;
  readonly ranges: readonly ProductionTextRange[];
  readonly atMs: number;
}

export interface ProductionTextViewportAperture {
  readonly cursorLine: number;
  readonly viewportLineCount: number;
  readonly beforeLines: number;
  readonly afterLines: number;
  readonly maxBytes: number;
}

export interface ProductionTextWindowRequest {
  readonly bufferId: string;
  readonly aperture: ProductionTextViewportAperture;
  readonly atMs: number;
}

export interface ProductionTextCheckpointRequest {
  readonly bufferId: string;
  readonly label?: string | null;
  readonly atMs: number;
}

export interface ProductionTextExportRequest {
  readonly bufferId: string;
  readonly atMs: number;
}

export interface ProductionTextObstruction {
  readonly code: ProductionTextObstructionCode;
  readonly issue: RuntimeIssue;
}

export interface ProductionTextOpenApplied {
  readonly kind: typeof OUTCOME_OPENED;
  readonly optic: TextBufferOptic;
}

export interface ProductionTextEditApplied {
  readonly kind: typeof OUTCOME_APPLIED;
  readonly result: ApplyIntentResult;
}

export interface ProductionTextCheckpointed {
  readonly kind: typeof OUTCOME_CHECKPOINTED;
  readonly result: CreateTextBufferCheckpointResult;
}

export interface ProductionTextWindowObserved {
  readonly kind: typeof OUTCOME_OBSERVED;
  readonly observed: Observed<TextWindowReading>;
}

export interface ProductionTextExported {
  readonly kind: typeof OUTCOME_EXPORTED;
  readonly text: string;
  readonly readingId: string;
}

export interface ProductionTextObstructed {
  readonly kind: typeof OUTCOME_OBSTRUCTED;
  readonly obstruction: ProductionTextObstruction;
}

export type ProductionTextOpenOutcome =
  | ProductionTextOpenApplied
  | ProductionTextObstructed;

export type ProductionTextEditOutcome =
  | ProductionTextEditApplied
  | ProductionTextObstructed;

export type ProductionTextWindowOutcome =
  | ProductionTextWindowObserved
  | ProductionTextObstructed;

export type ProductionTextCheckpointOutcome =
  | ProductionTextCheckpointed
  | ProductionTextObstructed;

export type ProductionTextExportOutcome =
  | ProductionTextExported
  | ProductionTextObstructed;

export interface ProductionTextSession {
  openBuffer(request: ProductionTextOpenRequest): Promise<ProductionTextOpenOutcome>;
  insertText(request: ProductionTextInsertRequest): Promise<ProductionTextEditOutcome>;
  replaceRange(request: ProductionTextReplaceRequest): Promise<ProductionTextEditOutcome>;
  deleteRange(request: ProductionTextDeleteRequest): Promise<ProductionTextEditOutcome>;
  multiRangeEdit(request: ProductionTextMultiRangeRequest): Promise<ProductionTextEditOutcome>;
  checkpointBuffer(request: ProductionTextCheckpointRequest): Promise<ProductionTextCheckpointOutcome>;
  observeWindow(request: ProductionTextWindowRequest): Promise<ProductionTextWindowOutcome>;
  exportSnapshot(request: ProductionTextExportRequest): Promise<ProductionTextExportOutcome>;
}

export function createProductionTextSession(
  session: TextBufferSessionPort,
): ProductionTextSession {
  return Object.freeze({
    openBuffer: (request: ProductionTextOpenRequest) => openBuffer(session, request),
    async insertText(request: ProductionTextInsertRequest): Promise<ProductionTextEditOutcome> {
      return applyReplaceRange(session, {
        bufferId: request.bufferId,
        startByte: request.startByte,
        endByte: request.startByte,
        insertText: request.insertText,
        atMs: request.atMs,
      });
    },
    async replaceRange(request: ProductionTextReplaceRequest): Promise<ProductionTextEditOutcome> {
      return applyReplaceRange(session, request);
    },
    deleteRange: (request: ProductionTextDeleteRequest) => deleteRange(session, request),
    multiRangeEdit: (request: ProductionTextMultiRangeRequest) => multiRangeEdit(request),
    checkpointBuffer: (request: ProductionTextCheckpointRequest) => checkpointBuffer(session, request),
    observeWindow: (request: ProductionTextWindowRequest) => observeWindow(session, request),
    exportSnapshot: (request: ProductionTextExportRequest) => exportSnapshot(session, request),
  });
}

async function checkpointBuffer(
  session: TextBufferSessionPort,
  request: ProductionTextCheckpointRequest,
): Promise<ProductionTextCheckpointOutcome> {
  try {
    const optic = await session.getBufferOptic(request.bufferId);
    if (optic == null) {
      return missingBuffer(request.atMs);
    }
    const result = await optic.createCheckpoint({
      kind: TEXT_BUFFER_CHECKPOINT_KIND_MANUAL_SAVE,
      label: request.label,
    });
    return {
      kind: OUTCOME_CHECKPOINTED,
      result,
    };
  } catch (cause) {
    return obstructed(
      CHECKPOINT_OBSTRUCTION_CODE,
      request.atMs,
      cause instanceof Error ? cause.message : String(cause),
    );
  }
}

async function exportSnapshot(
  session: TextBufferSessionPort,
  request: ProductionTextExportRequest,
): Promise<ProductionTextExportOutcome> {
  const observed = await observeWindow(session, {
    bufferId: request.bufferId,
    aperture: fullSnapshotAperture(),
    atMs: request.atMs,
  });
  if (observed.kind === OUTCOME_OBSTRUCTED) {
    return obstructed(
      TEXT_EXPORT_OBSTRUCTION_CODE,
      request.atMs,
      observed.obstruction.issue.message,
    );
  }
  if (!observedReadingCoversFullSnapshot(observed.observed.value)) {
    return obstructed(
      TEXT_EXPORT_OBSTRUCTION_CODE,
      request.atMs,
      FULL_SNAPSHOT_OBSTRUCTION_MESSAGE,
    );
  }
  return {
    kind: OUTCOME_EXPORTED,
    text: materializeObservedText(observed.observed),
    readingId: observed.observed.evidence.readingId,
  };
}

function fullSnapshotAperture(): ProductionTextViewportAperture {
  return {
    cursorLine: FULL_SNAPSHOT_CURSOR_LINE,
    viewportLineCount: FULL_SNAPSHOT_VIEWPORT_LINE_COUNT,
    beforeLines: FULL_SNAPSHOT_BEFORE_LINES,
    afterLines: FULL_SNAPSHOT_AFTER_LINES,
    maxBytes: FULL_SNAPSHOT_MAX_BYTES,
  };
}

function observedReadingCoversFullSnapshot(reading: TextWindowReading): boolean {
  return reading.startLine === FULL_SNAPSHOT_CURSOR_LINE
    && reading.hasMoreBefore !== true
    && reading.hasMoreAfter !== true
    && reading.truncated !== true
    && reading.lineCount === reading.totalLineCount
    && reading.lines.length === reading.totalLineCount;
}

async function multiRangeEdit(
  request: ProductionTextMultiRangeRequest,
): Promise<ProductionTextEditOutcome> {
  return obstructed(EDIT_OBSTRUCTION_CODE, request.atMs, GROUPED_EDIT_OBSTRUCTION_MESSAGE);
}

async function openBuffer(
  session: TextBufferSessionPort,
  request: ProductionTextOpenRequest,
): Promise<ProductionTextOpenOutcome> {
  try {
    const optic = await session.createBuffer({
      bufferKey: request.bufferKey,
      initialText: request.initialText,
      projectionPath: request.projectionPath,
    });
    const outcome: ProductionTextOpenApplied = {
      kind: OUTCOME_OPENED,
      optic,
    };
    return outcome;
  } catch (cause) {
    return obstructed(
      OPEN_OBSTRUCTION_CODE,
      request.atMs,
      cause instanceof Error ? cause.message : String(cause),
    );
  }
}

function deleteRange(
  session: TextBufferSessionPort,
  request: ProductionTextDeleteRequest,
): Promise<ProductionTextEditOutcome> {
  return applyReplaceRange(session, {
    bufferId: request.bufferId,
    startByte: request.startByte,
    endByte: request.endByte,
    insertText: EMPTY_INSERT_TEXT,
    atMs: request.atMs,
  });
}

async function observeWindow(
  session: TextBufferSessionPort,
  request: ProductionTextWindowRequest,
): Promise<ProductionTextWindowOutcome> {
  try {
    const optic = await session.getBufferOptic(request.bufferId);
    if (optic == null) {
      return missingBuffer(request.atMs);
    }
    const observed = await optic.textWindow(
      optic.currentReadBasis(),
      textWindowInputFromViewport(request.aperture),
    );
    const outcome: ProductionTextWindowObserved = {
      kind: OUTCOME_OBSERVED,
      observed,
    };
    return outcome;
  } catch (cause) {
    return obstructed(
      QUERY_OBSTRUCTION_CODE,
      request.atMs,
      cause instanceof Error ? cause.message : String(cause),
    );
  }
}

export function textWindowInputFromViewport(
  aperture: ProductionTextViewportAperture,
): TextWindowRangeInput {
  return {
    cursorLine: aperture.cursorLine,
    viewportLineCount: aperture.viewportLineCount,
    beforeLines: aperture.beforeLines,
    afterLines: aperture.afterLines,
    maxBytes: aperture.maxBytes,
  };
}

export function materializeObservedText(
  observed: Observed<TextWindowReading>,
): string {
  return observed.value.lines.map((line) => line.text).join(TEXT_EXPORT_LINE_SEPARATOR);
}

async function applyReplaceRange(
  session: TextBufferSessionPort,
  request: ProductionTextReplaceRequest,
): Promise<ProductionTextEditOutcome> {
  try {
    const optic = await session.getBufferOptic(request.bufferId);
    if (optic == null) {
      return missingBuffer(request.atMs);
    }
    const result = await optic.applyIntent({
      kind: REPLACE_RANGE_INTENT_KIND,
      startByte: request.startByte,
      endByte: request.endByte,
      insertText: request.insertText,
    });
    const outcome: ProductionTextEditApplied = {
      kind: OUTCOME_APPLIED,
      result,
    };
    return outcome;
  } catch (cause) {
    return obstructed(
      EDIT_OBSTRUCTION_CODE,
      request.atMs,
      cause instanceof Error ? cause.message : String(cause),
    );
  }
}

function missingBuffer(atMs: number): ProductionTextObstructed {
  return obstructed(
    MISSING_BUFFER_OBSTRUCTION_CODE,
    atMs,
    'Production text buffer is not available.',
  );
}

function obstructed(
  code: ProductionTextObstructionCode,
  atMs: number,
  message: string,
): ProductionTextObstructed {
  return {
    kind: OUTCOME_OBSTRUCTED,
    obstruction: {
      code,
      issue: {
        level: RuntimeIssueLevels.Error,
        source: RuntimeIssueSources.Command,
        message,
        atMs,
      },
    },
  };
}
