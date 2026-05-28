import type { JeditReceiptHandle } from './jedit-intent-outcomes.js';

export const JEDIT_RECEIPT_CORRELATION_AVAILABLE = 'RECEIPT_CORRELATION_AVAILABLE';
export const JEDIT_RECEIPT_CORRELATION_MISSING = 'RECEIPT_CORRELATION_MISSING';
export const JEDIT_RECEIPT_CORRELATION_UNSUPPORTED = 'RECEIPT_CORRELATION_UNSUPPORTED';
export const JEDIT_RECEIPT_CORRELATION_MISSING_CODE = 'JEDIT_RECEIPT_CORRELATION_UNAVAILABLE';
export const JEDIT_RECEIPT_CORRELATION_UNSUPPORTED_CODE = 'JEDIT_RECEIPT_CORRELATION_UNSUPPORTED_OPERATION';

export interface JeditReceiptCorrelationInput {
  readonly submissionId: string;
  readonly receiptId: string;
}

export interface JeditReceiptCorrelationAvailable {
  readonly status: typeof JEDIT_RECEIPT_CORRELATION_AVAILABLE;
  readonly submissionId: string;
  readonly receipt: JeditReceiptHandle;
}

export interface JeditReceiptCorrelationMissing {
  readonly status: typeof JEDIT_RECEIPT_CORRELATION_MISSING;
  readonly submissionId: string;
  readonly obstruction: JeditReceiptCorrelationObstruction;
}

export interface JeditReceiptCorrelationUnsupported {
  readonly status: typeof JEDIT_RECEIPT_CORRELATION_UNSUPPORTED;
  readonly submissionId: string;
  readonly obstruction: JeditReceiptCorrelationUnsupportedObstruction;
}

export interface JeditReceiptCorrelationObstruction {
  readonly code: typeof JEDIT_RECEIPT_CORRELATION_MISSING_CODE;
  readonly reason: string;
}

export interface JeditReceiptCorrelationUnsupportedObstruction {
  readonly code: typeof JEDIT_RECEIPT_CORRELATION_UNSUPPORTED_CODE;
  readonly reason: string;
}

export type JeditReceiptCorrelation =
  | JeditReceiptCorrelationAvailable
  | JeditReceiptCorrelationMissing
  | JeditReceiptCorrelationUnsupported;
