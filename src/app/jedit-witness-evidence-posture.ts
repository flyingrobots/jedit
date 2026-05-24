import {
  JEDIT_WITNESS_EVIDENCE_SCOPE_LOCAL_PROCESS,
  type JeditWitnessEvidencePosture,
} from '../ports/echo-powered-text-buffer-witness.js';
import { JEDIT_RECEIPT_CORRELATION_MISSING } from '../ports/jedit-receipt-correlation.js';
import { JEDIT_DURABILITY_POSTURE_UNAVAILABLE } from '../ports/jedit-restart-posture.js';
import { JEDIT_TICKETED_RUNTIME_INGRESS_MISSING } from '../ports/jedit-ticketed-runtime-ingress.js';

export function localProcessJeditWitnessEvidencePosture(): JeditWitnessEvidencePosture {
  return {
    scope: JEDIT_WITNESS_EVIDENCE_SCOPE_LOCAL_PROCESS,
    receiptCorrelation: JEDIT_RECEIPT_CORRELATION_MISSING,
    ticketedRuntimeIngress: JEDIT_TICKETED_RUNTIME_INGRESS_MISSING,
    durableAcceptedSubmissionRecovery: JEDIT_DURABILITY_POSTURE_UNAVAILABLE,
    syntheticReceiptClaimed: false,
  };
}
