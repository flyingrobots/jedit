import type { RuntimeIssue } from '@flyingrobots/bijou-tui';
import {
  READ_BASIS_HANDLE_KIND,
  TEXT_BUFFER_CHECKPOINT_KIND_MANUAL_SAVE,
  type ApplyIntentResult,
  type CreateTextBufferCheckpointResult,
  type Observed,
  type ReadBasisHandle,
  type ReplaceRangeIntent,
  type TextBuffer,
  type TextBufferOptic,
  type TextWindowRangeInput,
  type TextWindowReading,
} from '../../ports/text-buffer-session.js';
import { RuntimeIssueLevels, RuntimeIssueSources } from './runtime-issue.js';
import {
  ProductionTextSessionOutcomeKinds,
  ProductionTextObstructionCodes,
  type ProductionTextSession,
} from './production-text-session.js';
import {
  PREFLIGHT_DEFAULT_BUFFER_ID,
  PREFLIGHT_DEFAULT_EDITED_READING_TEXT,
  PREFLIGHT_DEFAULT_EXPORT_TEXT,
  PREFLIGHT_DEFAULT_FILE_PATH,
  PREFLIGHT_DEFAULT_READING_TEXT,
  PREFLIGHT_FIRST_INDEX,
  PREFLIGHT_NOW_MS,
  PREFLIGHT_ONE,
  PREFLIGHT_ROWS,
  type PreflightProductionTextCalls,
  type PreflightRuntimeHarnessOptions,
} from './editor-trust-preflight-runtime-fixtures.js';

const OPENED_BUFFER_CREATED_AT = '2026-06-26T00:00:00.000Z';
const DEFAULT_READ_BASIS_ID = 'read-basis:preflight';
const DEFAULT_RECEIPT_ID = 'receipt:preflight';
const DEFAULT_CHECKPOINT_ID = 'checkpoint:preflight';
const DEFAULT_READING_ID = 'reading:preflight';
const DEFAULT_TEXT_START_BYTE = 0;
const DEFAULT_BUFFER_VERSION = 1;
const CHECKPOINT_BUFFER_VERSION = 2;
const RUNTIME_ISSUE_NAME = 'EditorTrustPreflightProbe';
const MULTI_RANGE_OBSTRUCTION_MESSAGE =
  'preflight does not exercise grouped edits';

export function createPreflightProductionTextSession(
  options: PreflightRuntimeHarnessOptions,
  calls: PreflightProductionTextCalls,
): ProductionTextSession {
  const readings = options.readings ?? [
    PREFLIGHT_DEFAULT_READING_TEXT,
    PREFLIGHT_DEFAULT_EDITED_READING_TEXT,
  ];
  return {
    openBuffer: openBufferProbe(options, calls, readings),
    insertText: insertTextProbe(calls),
    replaceRange: replaceRangeProbe(calls),
    deleteRange: deleteRangeProbe(calls),
    multiRangeEdit: multiRangeProbe(calls),
    checkpointBuffer: checkpointProbe(calls),
    observeWindow: observeWindowProbe(calls, readings),
    exportWindow: exportWindowProbe(options, calls),
  };
}

function openBufferProbe(
  options: PreflightRuntimeHarnessOptions,
  calls: PreflightProductionTextCalls,
  readings: readonly string[],
): ProductionTextSession['openBuffer'] {
  return async (request) => {
    calls.open.push(request);
    const buffer = textBuffer(
      request.bufferKey,
      options.bufferIdByKey?.get(request.bufferKey) ?? PREFLIGHT_DEFAULT_BUFFER_ID,
      request.projectionPath,
    );
    return {
      kind: ProductionTextSessionOutcomeKinds.Opened,
      optic: textBufferOptic(buffer, readings),
    };
  };
}

function insertTextProbe(
  calls: PreflightProductionTextCalls,
): ProductionTextSession['insertText'] {
  return async (request) => {
    calls.insert.push(request);
    return appliedTextOutcome(request.bufferId);
  };
}

function replaceRangeProbe(
  calls: PreflightProductionTextCalls,
): ProductionTextSession['replaceRange'] {
  return async (request) => {
    calls.replace.push(request);
    return appliedTextOutcome(request.bufferId);
  };
}

function deleteRangeProbe(
  calls: PreflightProductionTextCalls,
): ProductionTextSession['deleteRange'] {
  return async (request) => {
    calls.delete.push(request);
    return appliedTextOutcome(request.bufferId);
  };
}

function multiRangeProbe(
  calls: PreflightProductionTextCalls,
): ProductionTextSession['multiRangeEdit'] {
  return async (request) => {
    calls.multiRange.push(request);
    return {
      kind: ProductionTextSessionOutcomeKinds.Obstructed,
      obstruction: productionTextObstruction(MULTI_RANGE_OBSTRUCTION_MESSAGE),
    };
  };
}

function checkpointProbe(
  calls: PreflightProductionTextCalls,
): ProductionTextSession['checkpointBuffer'] {
  return async (request) => {
    calls.checkpoint.push(request);
    return {
      kind: ProductionTextSessionOutcomeKinds.Checkpointed,
      result: checkpointResult(request.bufferId),
    };
  };
}

function observeWindowProbe(
  calls: PreflightProductionTextCalls,
  readings: readonly string[],
): ProductionTextSession['observeWindow'] {
  return async (request) => {
    calls.observe.push(request);
    return {
      kind: ProductionTextSessionOutcomeKinds.Observed,
      observed: observedReading(readings, calls.observe.length),
    };
  };
}

function exportWindowProbe(
  options: PreflightRuntimeHarnessOptions,
  calls: PreflightProductionTextCalls,
): ProductionTextSession['exportWindow'] {
  return async (request) => {
    calls.export.push(request);
    return {
      kind: ProductionTextSessionOutcomeKinds.Exported,
      text: options.exportText ?? PREFLIGHT_DEFAULT_EXPORT_TEXT,
      readingId: DEFAULT_READING_ID,
    };
  };
}

function textBuffer(
  bufferKey: string,
  bufferId: string,
  projectionPath: string | null | undefined,
): TextBuffer {
  return {
    bufferId,
    bufferKey,
    projectionPath: projectionPath ?? null,
    createdAt: OPENED_BUFFER_CREATED_AT,
  };
}

function textBufferOptic(
  buffer: TextBuffer,
  readings: readonly string[],
): TextBufferOptic {
  return {
    buffer,
    currentReadBasis: () => readBasis(),
    applyIntent: async (intent: ReplaceRangeIntent) => ({
      ...applyIntentResult(buffer.bufferId),
      receiptId: `${DEFAULT_RECEIPT_ID}:${intent.kind}`,
    }),
    createCheckpoint: async () => checkpointResult(buffer.bufferId),
    textWindow: async (_readBasis: ReadBasisHandle, input: TextWindowRangeInput) =>
      observedReading(readings, input.cursorLine + PREFLIGHT_ONE),
  };
}

function appliedTextOutcome(bufferId: string) {
  return {
    kind: ProductionTextSessionOutcomeKinds.Applied,
    result: applyIntentResult(bufferId),
  };
}

function applyIntentResult(bufferId: string): ApplyIntentResult {
  return {
    buffer: textBuffer(PREFLIGHT_DEFAULT_FILE_PATH, bufferId, PREFLIGHT_DEFAULT_FILE_PATH),
    readBasis: readBasis(),
    bufferVersion: DEFAULT_BUFFER_VERSION,
    receiptId: DEFAULT_RECEIPT_ID,
  };
}

function checkpointResult(bufferId: string): CreateTextBufferCheckpointResult {
  return {
    buffer: textBuffer(PREFLIGHT_DEFAULT_FILE_PATH, bufferId, PREFLIGHT_DEFAULT_FILE_PATH),
    readBasis: readBasis(),
    bufferVersion: CHECKPOINT_BUFFER_VERSION,
    checkpointId: DEFAULT_CHECKPOINT_ID,
    checkpointKind: TEXT_BUFFER_CHECKPOINT_KIND_MANUAL_SAVE,
  };
}

function readBasis(): ReadBasisHandle {
  return {
    kind: READ_BASIS_HANDLE_KIND,
    id: DEFAULT_READ_BASIS_ID,
  };
}

function observedReading(
  readings: readonly string[],
  readingCount: number,
): Observed<TextWindowReading> {
  const index = Math.min(readingCount - PREFLIGHT_ONE, readings.length - PREFLIGHT_ONE);
  const readingId = `${DEFAULT_READING_ID}:${readingCount}`;
  return {
    value: textWindowReading(readings[index] ?? '', readingId),
    evidence: {
      readingId,
      receiptId: DEFAULT_RECEIPT_ID,
    },
  };
}

function textWindowReading(text: string, readingId: string): TextWindowReading {
  return {
    readingId,
    lines: [
      {
        lineNumber: PREFLIGHT_FIRST_INDEX,
        startByte: DEFAULT_TEXT_START_BYTE,
        endByte: text.length,
        text,
      },
    ],
    byteLength: text.length,
    startLine: PREFLIGHT_FIRST_INDEX,
    lineCount: PREFLIGHT_ONE,
    totalLineCount: PREFLIGHT_ONE,
    hasMoreBefore: false,
    hasMoreAfter: false,
    cursorLine: PREFLIGHT_FIRST_INDEX,
    viewportLineCount: PREFLIGHT_ROWS,
    truncated: false,
  };
}

function productionTextObstruction(message: string) {
  return {
    code: ProductionTextObstructionCodes.Edit,
    issue: runtimeIssue(message),
  };
}

function runtimeIssue(message: string): RuntimeIssue {
  return {
    message: `${RUNTIME_ISSUE_NAME}: ${message}`,
    level: RuntimeIssueLevels.Error,
    source: RuntimeIssueSources.Command,
    atMs: PREFLIGHT_NOW_MS,
  };
}
