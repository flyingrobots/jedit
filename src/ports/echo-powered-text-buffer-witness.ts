import type {
  BufferKey,
  ReadingId,
  TextBufferId,
  TextWindowLine,
} from './jedit-optic-client.js';
import type { JeditIntentOutcome } from './jedit-intent-outcomes.js';
import type { JeditReceiptCorrelation } from './jedit-receipt-correlation.js';
import type { JeditRetainedEvidenceInventory } from './jedit-retained-evidence.js';
import type { JEDIT_DURABILITY_POSTURE_UNAVAILABLE } from './jedit-restart-posture.js';
import type { JeditRestartPosture } from './jedit-restart-posture.js';
import type { JEDIT_TICKETED_RUNTIME_INGRESS_MISSING } from './jedit-ticketed-runtime-ingress.js';
import type { JeditTicketedRuntimeIngressPosture } from './jedit-ticketed-runtime-ingress.js';
import type { StructuralHistoryReplaceTextRangeRequest } from './structural-history-replace-text-range.js';

export const JEDIT_WITNESS_EVIDENCE_SCOPE_LOCAL_PROCESS = 'LOCAL_PROCESS_WITNESS';

export interface JeditWitnessEvidencePosture {
  readonly scope: typeof JEDIT_WITNESS_EVIDENCE_SCOPE_LOCAL_PROCESS;
  readonly receiptCorrelation: JeditReceiptCorrelation['status'];
  readonly ticketedRuntimeIngress: typeof JEDIT_TICKETED_RUNTIME_INGRESS_MISSING;
  readonly durableAcceptedSubmissionRecovery: typeof JEDIT_DURABILITY_POSTURE_UNAVAILABLE;
  readonly syntheticReceiptClaimed: false;
}

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
  readonly editIntent: StructuralHistoryReplaceTextRangeRequest;
  readonly outcome: JeditIntentOutcome;
  readonly outcomeTrail: readonly JeditIntentOutcome[];
  readonly evidencePosture: JeditWitnessEvidencePosture;
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
