import type {
  ReadBasisHandle,
  TextBuffer,
  TextBufferOptic,
  TextBufferSessionPort,
} from '../ports/text-buffer-session.js';
import type { ApplyIntentResult, Observed, TextWindowReading } from '../ports/jedit-optic-client.js';
import { REPLACE_RANGE_INTENT_KIND } from '../ports/jedit-optic-client.js';
import type {
  EchoPoweredTextBufferRoundTripReport,
  EchoPoweredTextBufferWitnessReport,
  EchoPoweredTextBufferWitnessRequest,
} from '../ports/echo-powered-text-buffer-witness.js';
import {
  createJeditIntentHandle,
  createJeditIntentOutcomeLedger,
  createJeditReceiptHandle,
} from './jedit-intent-outcomes.js';
import { correlateJeditEchoReceipt } from './jedit-receipt-correlation.js';
import { createJeditRetainedEvidenceInventory } from './jedit-retained-evidence.js';
import { currentJeditRestartPosture } from './jedit-restart-posture.js';
import { missingJeditTicketedRuntimeIngress } from './jedit-ticketed-runtime-ingress.js';
import { localProcessJeditWitnessEvidencePosture } from './jedit-witness-evidence-posture.js';
import type {
  JeditAcceptedPendingIntentOutcome,
  JeditAppliedIntentOutcome,
} from '../ports/jedit-intent-outcomes.js';
import { queryTextWindowOperation } from '../generated/jedit/rope.wesley.generated.js';
import {
  JEDIT_HOT_TEXT_PACKAGE_ID,
  JEDIT_STRUCTURAL_HISTORY_PACKAGE_ID,
} from './jedit-contract-package.js';
import {
  createStructuralHistoryReplaceTextRangeRequest,
} from './structural-history-replace-text-range.js';
import type { StructuralHistoryReplaceTextRangeRequest } from '../ports/structural-history-replace-text-range.js';

const SUBMISSION_ID_PREFIX = 'jedit-submission:';
const INITIAL_TEXT_REVISION_SEQUENCE = 0;
const STRUCTURAL_HISTORY_SOURCE_LABEL = 'jedit.echo-powered-text-buffer-witness';
const UTF8_ENCODER = new TextEncoder();

interface WitnessReportInput {
  readonly buffer: ApplyIntentResult['buffer'];
  readonly editIntent: StructuralHistoryReplaceTextRangeRequest;
  readonly pending: JeditAcceptedPendingIntentOutcome;
  readonly outcome: JeditAppliedIntentOutcome;
  readonly applied: ApplyIntentResult;
  readonly observed: Observed<TextWindowReading>;
}

export async function runEchoPoweredTextBufferWitness(
  session: TextBufferSessionPort,
  request: EchoPoweredTextBufferWitnessRequest,
): Promise<EchoPoweredTextBufferWitnessReport> {
  const outcomes = createJeditIntentOutcomeLedger();
  const optic = await createWitnessBuffer(session, request);
  const editIntent = createWitnessEditIntent(optic.buffer, request, optic.currentReadBasis());
  const intent = createJeditIntentHandle(editIntent.operationName, toReplaceRangeSubmissionId(editIntent));
  const pending = outcomes.acceptIntent(intent);
  const applied = await applyWitnessIntent(optic, request);
  const outcome = outcomes.applyIntent(intent, createJeditReceiptHandle(applied.receiptId));
  const observed = await observeWitnessWindow(optic, applied, request);

  return toWitnessReport({
    buffer: optic.buffer,
    editIntent,
    pending,
    outcome,
    applied,
    observed,
  });
}

async function createWitnessBuffer(
  session: TextBufferSessionPort,
  request: EchoPoweredTextBufferWitnessRequest,
): Promise<TextBufferOptic> {
  return session.createBuffer({
    bufferKey: request.bufferKey,
    initialText: request.initialText,
    projectionPath: request.projectionPath,
  });
}

function createWitnessEditIntent(
  buffer: TextBuffer,
  request: EchoPoweredTextBufferWitnessRequest,
  readBasis: ReadBasisHandle,
): StructuralHistoryReplaceTextRangeRequest {
  return createStructuralHistoryReplaceTextRangeRequest({
    historyId: buffer.bufferId,
    baseRevisionSequence: INITIAL_TEXT_REVISION_SEQUENCE,
    startByte: request.startByte,
    endByte: request.endByte,
    insertText: request.insertText,
    author: STRUCTURAL_HISTORY_SOURCE_LABEL,
    sourceLabel: STRUCTURAL_HISTORY_SOURCE_LABEL,
    externalEvidenceId: readBasis.id,
    projectionPath: buffer.projectionPath,
  });
}

function applyWitnessIntent(
  optic: TextBufferOptic,
  request: EchoPoweredTextBufferWitnessRequest,
): Promise<ApplyIntentResult> {
  return optic.applyIntent({
    kind: REPLACE_RANGE_INTENT_KIND,
    startByte: request.startByte,
    endByte: request.endByte,
    insertText: request.insertText,
  });
}

function observeWitnessWindow(
  optic: TextBufferOptic,
  applied: ApplyIntentResult,
  request: EchoPoweredTextBufferWitnessRequest,
): Promise<Observed<TextWindowReading>> {
  return optic.textWindow(applied.readBasis, {
    cursorLine: request.cursorLine,
    beforeLines: request.beforeLines,
    viewportLineCount: request.viewportLineCount,
    afterLines: request.afterLines,
    maxBytes: request.maxBytes,
  });
}

function toWitnessReport(input: WitnessReportInput): EchoPoweredTextBufferWitnessReport {
  const receiptCorrelation = correlateJeditEchoReceipt({
    submissionId: input.outcome.intent.submissionId,
    receiptId: input.applied.receiptId,
  });
  const text = input.observed.value.lines.map((line) => line.text).join('\n');
  const retainedEvidence = createJeditRetainedEvidenceInventory({
    packageId: JEDIT_STRUCTURAL_HISTORY_PACKAGE_ID,
    mutationOperationName: input.editIntent.operationName,
    queryOperationName: queryTextWindowOperation.fieldName,
    receiptId: input.applied.receiptId,
    readingId: input.observed.evidence.readingId,
    readingEvidence: input.observed.evidence.retainedEvidence,
  });

  return {
    bufferId: input.buffer.bufferId,
    bufferKey: input.buffer.bufferKey,
    editIntent: input.editIntent,
    outcome: input.outcome,
    outcomeTrail: [input.pending, input.outcome],
    evidencePosture: localProcessJeditWitnessEvidencePosture({
      receiptCorrelation: receiptCorrelation.status,
    }),
    receiptCorrelation,
    ticketedRuntimeIngress: missingJeditTicketedRuntimeIngress(input.outcome.intent.submissionId),
    retainedEvidence,
    restartPosture: currentJeditRestartPosture(),
    receiptId: input.applied.receiptId,
    readingId: input.observed.evidence.readingId,
    roundTrip: toRoundTripReport(input, retainedEvidence.refs.length, text),
    text,
    lines: input.observed.value.lines,
    truncated: input.observed.value.truncated,
  };
}

function toRoundTripReport(
  input: WitnessReportInput,
  retainedEvidenceRefCount: number,
  text: string,
): EchoPoweredTextBufferRoundTripReport {
  return {
    mutationPackageId: JEDIT_STRUCTURAL_HISTORY_PACKAGE_ID,
    mutationOperationName: input.editIntent.operationName,
    mutationOutcomeStatus: input.outcome.status,
    queryPackageId: JEDIT_HOT_TEXT_PACKAGE_ID,
    queryOperationName: queryTextWindowOperation.fieldName,
    readingId: input.observed.evidence.readingId,
    text,
    retainedEvidenceRefCount,
    appCanTick: false,
  };
}

function toReplaceRangeSubmissionId(editIntent: StructuralHistoryReplaceTextRangeRequest): string {
  return `${SUBMISSION_ID_PREFIX}${toHex(JSON.stringify(editIntent))}`;
}

function toHex(value: string): string {
  return Array.from(UTF8_ENCODER.encode(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
