export {
  JEDIT_RECEIPT_CORRELATION_AVAILABLE,
  JEDIT_RECEIPT_CORRELATION_MISSING,
  JEDIT_RECEIPT_CORRELATION_MISSING_CODE,
  JEDIT_RECEIPT_CORRELATION_UNSUPPORTED,
  JEDIT_RECEIPT_CORRELATION_UNSUPPORTED_CODE,
} from '../ports/jedit-receipt-correlation.js';
import { createJeditReceiptHandle } from '../ports/jedit-intent-outcomes.js';
import {
  JEDIT_RECEIPT_CORRELATION_AVAILABLE,
  JEDIT_RECEIPT_CORRELATION_MISSING,
  JEDIT_RECEIPT_CORRELATION_MISSING_CODE,
  JEDIT_RECEIPT_CORRELATION_UNSUPPORTED,
  JEDIT_RECEIPT_CORRELATION_UNSUPPORTED_CODE,
  type JeditReceiptCorrelationAvailable,
  type JeditReceiptCorrelationInput,
  type JeditReceiptCorrelationMissing,
  type JeditReceiptCorrelationUnsupported,
} from '../ports/jedit-receipt-correlation.js';

const MISSING_RECEIPT_CORRELATION_REASON =
  'Echo receipt correlation is not available for this submission';

export function correlateJeditEchoReceipt(
  input: JeditReceiptCorrelationInput,
): JeditReceiptCorrelationAvailable {
  return {
    status: JEDIT_RECEIPT_CORRELATION_AVAILABLE,
    submissionId: input.submissionId,
    receipt: createJeditReceiptHandle(input.receiptId),
  };
}

export function missingJeditReceiptCorrelation(
  submissionId: string,
): JeditReceiptCorrelationMissing {
  return {
    status: JEDIT_RECEIPT_CORRELATION_MISSING,
    submissionId,
    obstruction: {
      code: JEDIT_RECEIPT_CORRELATION_MISSING_CODE,
      reason: MISSING_RECEIPT_CORRELATION_REASON,
    },
  };
}

export function unsupportedJeditReceiptCorrelation(
  submissionId: string,
  reason: string,
): JeditReceiptCorrelationUnsupported {
  return {
    status: JEDIT_RECEIPT_CORRELATION_UNSUPPORTED,
    submissionId,
    obstruction: {
      code: JEDIT_RECEIPT_CORRELATION_UNSUPPORTED_CODE,
      reason,
    },
  };
}
