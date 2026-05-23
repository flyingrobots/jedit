import type { OpticSession } from '../ports/jedit-optic-client.js';
import { REPLACE_RANGE_INTENT_KIND } from '../ports/jedit-optic-client.js';
import type {
  EchoPoweredTextBufferWitnessReport,
  EchoPoweredTextBufferWitnessRequest,
} from '../ports/echo-powered-text-buffer-witness.js';

export async function runEchoPoweredTextBufferWitness(
  session: OpticSession,
  request: EchoPoweredTextBufferWitnessRequest,
): Promise<EchoPoweredTextBufferWitnessReport> {
  const optic = await session.createBuffer({
    bufferKey: request.bufferKey,
    initialText: request.initialText,
    projectionPath: request.projectionPath,
  });
  const applied = await optic.applyIntent({
    kind: REPLACE_RANGE_INTENT_KIND,
    startByte: request.startByte,
    endByte: request.endByte,
    insertText: request.insertText,
  });
  const observed = await optic.textWindow(applied.readBasis, {
    cursorLine: request.cursorLine,
    beforeLines: request.beforeLines,
    viewportLineCount: request.viewportLineCount,
    afterLines: request.afterLines,
    maxBytes: request.maxBytes,
  });

  return {
    bufferId: optic.buffer.bufferId,
    bufferKey: optic.buffer.bufferKey,
    receiptId: applied.receiptId,
    readingId: observed.evidence.readingId,
    text: observed.value.lines.map((line) => line.text).join('\n'),
    lines: observed.value.lines,
    truncated: observed.value.truncated,
  };
}
