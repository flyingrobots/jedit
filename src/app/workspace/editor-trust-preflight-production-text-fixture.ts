import type { RuntimeIssue } from '@flyingrobots/bijou-tui';
import {
  TEXT_BUFFER_CHECKPOINT_KIND_MANUAL_SAVE,
  type ApplyIntentResult,
  type CreateTextBufferCheckpointResult,
  type Observed,
  type ReplaceRangeIntent,
  type TextBuffer,
  type TextBufferOptic,
  type TextWindowBasis,
  type TextWindowReading,
} from '../../ports/text-buffer-session.js';
import {
  JEDIT_TEXT_WINDOW_MATERIALIZATION_COMPLETENESS_COMPLETE,
  JEDIT_TEXT_WINDOW_MATERIALIZATION_SCHEMA_VERSION,
  JEDIT_TEXT_WINDOW_MATERIALIZER_VERSION,
  type JeditTextWindowMaterializationProvenance,
} from '../../ports/jedit-text-window-materialization.js';
import {
  REPORT_KIND_RANGE,
  REPORT_TITLE,
  RESULT_UNAVAILABLE,
  type JeditWhyByteRange,
  type JeditWhyRangeReport,
} from '../../ports/jedit-why-range.js';
import { RuntimeIssueLevels, RuntimeIssueSources } from './runtime-issue.js';
import { CausalLineDiffRuntimeError } from '../jedit-causal-line-diff-observer.js';
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
const DEFAULT_RECEIPT_ID = 'receipt:preflight';
const DEFAULT_CHECKPOINT_ID = 'checkpoint:preflight';
const DEFAULT_READING_ID = 'reading:preflight';
const DEFAULT_HEAD_ID = 'head:preflight';
const DEFAULT_WORLDLINE_ID = 'worldline:preflight';
const DEFAULT_ROOT_NODE_ID = 'root:preflight';
const FIXTURE_FRONTIER_REF = 'fixture:preflight-request-frontier';
const FIXTURE_OBSERVER_PLAN_ID = 'fixture:preflight-observer-plan';
const FIXTURE_POLICY_DIGEST = 'fixture:preflight-policy';
const FIXTURE_COORDINATE_DIGEST = 'fixture:preflight-coordinate';
const FIXTURE_CACHE_KEY_DIGEST = 'fixture:preflight-cache-key';
const DEFAULT_TEXT_START_BYTE = 0;
const UTF8_ENCODER = new TextEncoder();
const DEFAULT_BUFFER_VERSION = 1;
const CHECKPOINT_BUFFER_VERSION = 2;
const RUNTIME_ISSUE_NAME = 'EditorTrustPreflightProbe';
const MULTI_RANGE_OBSTRUCTION_MESSAGE =
  'preflight does not exercise grouped edits';
const CAUSAL_LINE_DIFF_UNAVAILABLE_MESSAGE =
  'preflight fixture does not retain causal line-diff evidence';

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
    observeCausalLineDiff: async () => ({
      kind: ProductionTextSessionOutcomeKinds.Obstructed,
      obstruction: {
        code: ProductionTextObstructionCodes.Query,
        issue: productionTextObstruction(CAUSAL_LINE_DIFF_UNAVAILABLE_MESSAGE).issue,
      },
    }),
    exportSnapshot: exportSnapshotProbe(options, calls),
    explainRange: explainRangeProbe(),
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
    const optic = textBufferOptic(buffer, readings);
    return {
      kind: ProductionTextSessionOutcomeKinds.Opened,
      optic,
      textBasis: optic.openedTextBasis,
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
      observed: observedReading(readings, calls.observe.length, request),
    };
  };
}

function exportSnapshotProbe(
  options: PreflightRuntimeHarnessOptions,
  calls: PreflightProductionTextCalls,
): ProductionTextSession['exportSnapshot'] {
  return async (request) => {
    calls.export.push(request);
    return {
      kind: ProductionTextSessionOutcomeKinds.Exported,
      text: options.exportText ?? PREFLIGHT_DEFAULT_EXPORT_TEXT,
      readingId: DEFAULT_READING_ID,
      basisHeadId: DEFAULT_HEAD_ID,
    };
  };
}

function explainRangeProbe(): ProductionTextSession['explainRange'] {
  return async (request) => ({
    kind: ProductionTextSessionOutcomeKinds.RangeExplained,
    report: preflightWhyRangeReport({
      startByte: request.range.startByte.value,
      endByte: request.range.endByte.value,
    }),
  });
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
    openedTextBasis: textBasis(readings[PREFLIGHT_FIRST_INDEX] ?? ''),
    applyIntent: async (intent: ReplaceRangeIntent) => ({
      ...applyIntentResult(buffer.bufferId),
      receiptId: `${DEFAULT_RECEIPT_ID}:${intent.kind}`,
    }),
    createCheckpoint: async () => checkpointResult(buffer.bufferId),
    textWindow: async (request) =>
      observedReading(readings, request.aperture.cursorLine + PREFLIGHT_ONE, request),
    causalLineDiff: async () => {
      throw new CausalLineDiffRuntimeError(CAUSAL_LINE_DIFF_UNAVAILABLE_MESSAGE);
    },
    explainRange: async (range: JeditWhyByteRange) => preflightWhyRangeReport(range),
  };
}

function preflightWhyRangeReport(range: JeditWhyByteRange): JeditWhyRangeReport {
  return {
    kind: REPORT_KIND_RANGE,
    title: REPORT_TITLE,
    message: 'Preflight range why is unavailable.',
    witness: {
      worldlineId: 'wl:preflight',
      basisHeadId: 'head:preflight',
      queriedRange: range,
      result: {
        kind: RESULT_UNAVAILABLE,
        code: 'preflight_why_range_unavailable',
        reason: 'Preflight fixture does not retain rope diff history.',
      },
    },
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
    textBasis: textBasis(PREFLIGHT_DEFAULT_EDITED_READING_TEXT),
    bufferVersion: DEFAULT_BUFFER_VERSION,
    receiptId: DEFAULT_RECEIPT_ID,
  };
}

function checkpointResult(bufferId: string): CreateTextBufferCheckpointResult {
  return {
    buffer: textBuffer(PREFLIGHT_DEFAULT_FILE_PATH, bufferId, PREFLIGHT_DEFAULT_FILE_PATH),
    textBasis: textBasis(PREFLIGHT_DEFAULT_EDITED_READING_TEXT),
    bufferVersion: CHECKPOINT_BUFFER_VERSION,
    checkpointId: DEFAULT_CHECKPOINT_ID,
    checkpointKind: TEXT_BUFFER_CHECKPOINT_KIND_MANUAL_SAVE,
  };
}

function observedReading(
  readings: readonly string[],
  readingCount: number,
  basis: TextWindowBasis,
): Observed<TextWindowReading> {
  const index = Math.min(readingCount - PREFLIGHT_ONE, readings.length - PREFLIGHT_ONE);
  const readingId = `${DEFAULT_READING_ID}:${readingCount}`;
  return {
    value: textWindowReading(readings[index] ?? '', readingId, basis),
    evidence: {
      readingId,
      receiptId: DEFAULT_RECEIPT_ID,
    },
  };
}

function textWindowReading(text: string, readingId: string, basis: TextWindowBasis): TextWindowReading {
  const textByteLength = UTF8_ENCODER.encode(text).length;
  return {
    readingId,
    textBasis: basis,
    projection: fixtureProjection(text, textByteLength),
    materialization: fixtureMaterialization(textByteLength),
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

function fixtureProjection(
  text: string,
  textByteLength: number,
): NonNullable<TextWindowReading['projection']> {
  return {
    basisHeadId: DEFAULT_HEAD_ID,
    basis: {
      worldlineId: DEFAULT_WORLDLINE_ID,
      headId: DEFAULT_HEAD_ID,
      rootNodeId: DEFAULT_ROOT_NODE_ID,
      byteLength: textByteLength,
      lineCount: text.split('\n').length,
    },
    byteRange: { startByte: DEFAULT_TEXT_START_BYTE, endByte: textByteLength },
    text,
    support: [],
  };
}

function fixtureMaterialization(
  textByteLength: number,
): JeditTextWindowMaterializationProvenance {
  return {
    key: {
      schemaVersion: JEDIT_TEXT_WINDOW_MATERIALIZATION_SCHEMA_VERSION,
      materializerVersion: JEDIT_TEXT_WINDOW_MATERIALIZER_VERSION,
      basis: {
        worldlineId: DEFAULT_WORLDLINE_ID,
        headId: DEFAULT_HEAD_ID,
        requestFrontierRef: FIXTURE_FRONTIER_REF,
      },
      coverage: {
        startByte: { kind: 'utf8-byte-offset', value: DEFAULT_TEXT_START_BYTE },
        endByte: { kind: 'utf8-byte-offset', value: textByteLength },
      },
      observerPlanId: FIXTURE_OBSERVER_PLAN_ID,
      policyDigest: FIXTURE_POLICY_DIGEST,
      coordinateDigest: FIXTURE_COORDINATE_DIGEST,
      cacheKeyDigest: FIXTURE_CACHE_KEY_DIGEST,
    },
    completeness: JEDIT_TEXT_WINDOW_MATERIALIZATION_COMPLETENESS_COMPLETE,
    materializedProjectionBytes: textByteLength,
  };
}

function textBasis(text: string): TextWindowBasis {
  return {
    basisHeadId: DEFAULT_HEAD_ID,
    byteRange: {
      startByte: { kind: 'utf8-byte-offset', value: DEFAULT_TEXT_START_BYTE },
      endByte: { kind: 'utf8-byte-offset', value: UTF8_ENCODER.encode(text).length },
    },
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
