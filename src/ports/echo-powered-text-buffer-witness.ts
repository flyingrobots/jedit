import type {
  BufferKey,
  ReadingId,
  TextBufferId,
  TextWindowLine,
} from './jedit-optic-client.js';
import type { JeditIntentOutcome } from './jedit-intent-outcomes.js';
import type { JeditReceiptCorrelation } from './jedit-receipt-correlation.js';
import type { JeditRetainedEvidenceInventory } from './jedit-retained-evidence.js';
import type { JeditRestartPosture } from './jedit-restart-posture.js';
import type { JeditTicketedRuntimeIngressPosture } from './jedit-ticketed-runtime-ingress.js';

export interface EchoPoweredTextBufferWitnessRequest {
  readonly bufferKey: BufferKey;
  readonly initialText: string;
  readonly projectionPath?: string | null;
  readonly startByte: number;
  readonly endByte: number;
  readonly insertText: string;
  readonly cursorLine: number;
  readonly beforeLines: number;
  readonly viewportLineCount: number;
  readonly afterLines: number;
  readonly maxBytes: number;
}

export interface EchoPoweredTextBufferWitnessReport {
  readonly bufferId: TextBufferId;
  readonly bufferKey: BufferKey;
  readonly outcome: JeditIntentOutcome;
  readonly outcomeTrail: readonly JeditIntentOutcome[];
  readonly receiptCorrelation: JeditReceiptCorrelation;
  readonly ticketedRuntimeIngress: JeditTicketedRuntimeIngressPosture;
  readonly retainedEvidence: JeditRetainedEvidenceInventory;
  readonly restartPosture: JeditRestartPosture;
  readonly receiptId: string;
  readonly readingId: ReadingId;
  readonly text: string;
  readonly lines: readonly TextWindowLine[];
  readonly truncated: boolean;
}
