import type { OpticSession } from '../ports/jedit-optic-client.js';
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
import type {
  JeditAcceptedPendingIntentOutcome,
  JeditAppliedIntentOutcome,
} from '../ports/jedit-intent-outcomes.js';
import { mutationReplaceRangeAsTickOperation } from '../generated/jedit/hot-text-runtime.wesley.generated.js';

export async function runEchoPoweredTextBufferWitness(
  session: OpticSession,
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
  return {
    bufferId: buffer.bufferId,
    bufferKey: buffer.bufferKey,
    outcome,
    outcomeTrail: [pending, outcome],
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
  return [
    'jedit-submission',
    bufferId,
    request.startByte.toString(),
    request.endByte.toString(),
    request.insertText,
  ].join(':');
}
