export {
  JEDIT_SUBMISSION_LEDGER_ACCEPTED,
  JEDIT_SUBMISSION_LEDGER_DUPLICATE,
  JEDIT_SUBMISSION_LEDGER_READ_FOUND,
  JEDIT_SUBMISSION_LEDGER_READ_MISSING,
} from '../ports/jedit-submission-ledger.js';
import {
  JEDIT_SUBMISSION_LEDGER_ACCEPTED,
  JEDIT_SUBMISSION_LEDGER_DUPLICATE,
  JEDIT_SUBMISSION_LEDGER_READ_FOUND,
  JEDIT_SUBMISSION_LEDGER_READ_MISSING,
  type JeditAcceptedSubmissionRecord,
  type JeditSubmissionLedgerPort,
  type JeditSubmissionLedgerReadResult,
  type JeditSubmissionLedgerWriteResult,
} from '../ports/jedit-submission-ledger.js';
import type { HashPort } from '../ports/hash.js';

const JEDIT_SUBMISSION_ID_PREFIX = 'jedit-submission:';

export function createInMemoryJeditSubmissionLedgerPort(): JeditSubmissionLedgerPort {
  const submissions = new Map<string, JeditAcceptedSubmissionRecord>();

  return {
    recordAcceptedSubmission(record) {
      const existing = submissions.get(record.submissionId);
      if (existing != null) {
        return {
          status: JEDIT_SUBMISSION_LEDGER_DUPLICATE,
          record: existing,
        };
      }

      submissions.set(record.submissionId, record);
      return {
        status: JEDIT_SUBMISSION_LEDGER_ACCEPTED,
        record,
      };
    },
    readSubmission(submissionId) {
      return readSubmission(submissions, submissionId);
    },
  };
}

export function createJeditSubmissionId(
  canonicalRequestBytesHex: string,
  hash: HashPort,
): string {
  return `${JEDIT_SUBMISSION_ID_PREFIX}${hash.sha256Hex(canonicalRequestBytesHex)}`;
}

export function recordAcceptedJeditSubmission(
  ledger: JeditSubmissionLedgerPort,
  record: JeditAcceptedSubmissionRecord,
): JeditSubmissionLedgerWriteResult {
  return ledger.recordAcceptedSubmission(record);
}

function readSubmission(
  submissions: ReadonlyMap<string, JeditAcceptedSubmissionRecord>,
  submissionId: string,
): JeditSubmissionLedgerReadResult {
  const record = submissions.get(submissionId);
  return record == null ? {
    status: JEDIT_SUBMISSION_LEDGER_READ_MISSING,
    submissionId,
  } : {
    status: JEDIT_SUBMISSION_LEDGER_READ_FOUND,
    record,
  };
}
