import type { TextBufferSessionPort } from '../ports/text-buffer-session.js';
import type { ApplyIntentResult, Observed, TextWindowReading } from '../ports/jedit-optic-client.js';
import { REPLACE_RANGE_INTENT_KIND } from '../ports/jedit-optic-client.js';
import type {
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
import {
  mutationReplaceRangeAsTickOperation,
  queryTextWindowOperation,
} from '../generated/jedit/hot-text-runtime.wesley.generated.js';
import { JEDIT_HOT_TEXT_PACKAGE_ID } from './jedit-contract-package.js';

const SUBMISSION_ID_PREFIX = 'jedit-submission:';
const UTF8_ENCODER = new TextEncoder();

export async function runEchoPoweredTextBufferWitness(
  session: TextBufferSessionPort,
  request: EchoPoweredTextBufferWitnessRequest,
): Promise<EchoPoweredTextBufferWitnessReport> {
  const outcomes = createJeditIntentOutcomeLedger();
  const optic = await session.createBuffer({
    bufferKey: request.bufferKey,
    initialText: request.initialText,
    projectionPath: request.projectionPath,
  });
  const intent = createJeditIntentHandle(
    mutationReplaceRangeAsTickOperation.fieldName,
    toReplaceRangeSubmissionId(optic.buffer.bufferId, request),
  );
  const pending = outcomes.acceptIntent(intent);
  const applied = await optic.applyIntent({
    kind: REPLACE_RANGE_INTENT_KIND,
    startByte: request.startByte,
    endByte: request.endByte,
    insertText: request.insertText,
  });
  const outcome = outcomes.applyIntent(intent, createJeditReceiptHandle(applied.receiptId));
  const observed = await optic.textWindow(applied.readBasis, {
    cursorLine: request.cursorLine,
    beforeLines: request.beforeLines,
    viewportLineCount: request.viewportLineCount,
    afterLines: request.afterLines,
    maxBytes: request.maxBytes,
  });

  return toWitnessReport(optic.buffer, pending, outcome, applied, observed);
}

function toWitnessReport(
  buffer: ApplyIntentResult['buffer'],
  pending: JeditAcceptedPendingIntentOutcome,
  outcome: JeditAppliedIntentOutcome,
  applied: ApplyIntentResult,
  observed: Observed<TextWindowReading>,
): EchoPoweredTextBufferWitnessReport {
  const receiptCorrelation = correlateJeditEchoReceipt({
    submissionId: outcome.intent.submissionId,
    receiptId: applied.receiptId,
  });

  return {
    bufferId: buffer.bufferId,
    bufferKey: buffer.bufferKey,
    outcome,
    outcomeTrail: [pending, outcome],
    evidencePosture: localProcessJeditWitnessEvidencePosture({
      receiptCorrelation: receiptCorrelation.status,
    }),
    receiptCorrelation,
    ticketedRuntimeIngress: missingJeditTicketedRuntimeIngress(outcome.intent.submissionId),
    retainedEvidence: createJeditRetainedEvidenceInventory({
      packageId: JEDIT_HOT_TEXT_PACKAGE_ID,
      mutationOperationName: mutationReplaceRangeAsTickOperation.fieldName,
      queryOperationName: queryTextWindowOperation.fieldName,
      receiptId: applied.receiptId,
      readingId: observed.evidence.readingId,
    }),
    restartPosture: currentJeditRestartPosture(),
    receiptId: applied.receiptId,
    readingId: observed.evidence.readingId,
    text: observed.value.lines.map((line) => line.text).join('\n'),
    lines: observed.value.lines,
    truncated: observed.value.truncated,
  };
}

function toReplaceRangeSubmissionId(
  bufferId: string,
  request: EchoPoweredTextBufferWitnessRequest,
): string {
  return `${SUBMISSION_ID_PREFIX}${toHex(JSON.stringify({
    bufferId,
    endByte: request.endByte,
    insertText: request.insertText,
    startByte: request.startByte,
  }))}`;
}

function toHex(value: string): string {
  return Array.from(UTF8_ENCODER.encode(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
