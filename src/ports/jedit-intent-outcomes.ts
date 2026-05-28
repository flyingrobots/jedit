export const JEDIT_INTENT_HANDLE_KIND = 'jedit-intent-handle';
export const JEDIT_RECEIPT_HANDLE_KIND = 'jedit-receipt-handle';
export const JEDIT_INTENT_OUTCOME_ACCEPTED_PENDING = 'ACCEPTED_PENDING';
export const JEDIT_INTENT_OUTCOME_APPLIED = 'APPLIED';
export const JEDIT_INTENT_OUTCOME_REJECTED = 'REJECTED';
export const JEDIT_INTENT_OUTCOME_OBSTRUCTED = 'OBSTRUCTED';
export const JEDIT_INTENT_OUTCOME_UNKNOWN = 'UNKNOWN_INTENT';

export interface JeditIntentHandle {
  readonly kind: typeof JEDIT_INTENT_HANDLE_KIND;
  readonly operationName: string;
  readonly submissionId: string;
}

export interface JeditReceiptHandle {
  readonly kind: typeof JEDIT_RECEIPT_HANDLE_KIND;
  readonly receiptId: string;
}

export interface JeditAcceptedPendingIntentOutcome {
  readonly status: typeof JEDIT_INTENT_OUTCOME_ACCEPTED_PENDING;
  readonly intent: JeditIntentHandle;
}

export interface JeditAppliedIntentOutcome {
  readonly status: typeof JEDIT_INTENT_OUTCOME_APPLIED;
  readonly intent: JeditIntentHandle;
  readonly receipt: JeditReceiptHandle;
}

export interface JeditRejectedIntentOutcome {
  readonly status: typeof JEDIT_INTENT_OUTCOME_REJECTED;
  readonly intent: JeditIntentHandle;
  readonly reason: string;
}

export interface JeditObstructedIntentOutcome {
  readonly status: typeof JEDIT_INTENT_OUTCOME_OBSTRUCTED;
  readonly intent: JeditIntentHandle;
  readonly obstructionCode: string;
}

export interface JeditUnknownIntentOutcome {
  readonly status: typeof JEDIT_INTENT_OUTCOME_UNKNOWN;
  readonly intent: JeditIntentHandle;
}

export type JeditIntentOutcome =
  | JeditAcceptedPendingIntentOutcome
  | JeditAppliedIntentOutcome
  | JeditRejectedIntentOutcome
  | JeditObstructedIntentOutcome
  | JeditUnknownIntentOutcome;

export function createJeditIntentHandle(
  operationName: string,
  submissionId: string,
): JeditIntentHandle {
  return {
    kind: JEDIT_INTENT_HANDLE_KIND,
    operationName,
    submissionId,
  };
}

export function createJeditReceiptHandle(receiptId: string): JeditReceiptHandle {
  return {
    kind: JEDIT_RECEIPT_HANDLE_KIND,
    receiptId,
  };
}
