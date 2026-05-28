export const JEDIT_SUBMISSION_LEDGER_ACCEPTED = 'JEDIT_SUBMISSION_LEDGER_ACCEPTED';
export const JEDIT_SUBMISSION_LEDGER_DUPLICATE = 'JEDIT_SUBMISSION_LEDGER_DUPLICATE';
export const JEDIT_SUBMISSION_LEDGER_READ_FOUND = 'JEDIT_SUBMISSION_LEDGER_READ_FOUND';
export const JEDIT_SUBMISSION_LEDGER_READ_MISSING = 'JEDIT_SUBMISSION_LEDGER_READ_MISSING';

export interface JeditAcceptedSubmissionRecord {
  readonly submissionId: string;
  readonly packageId: string;
  readonly operationName: string;
  readonly canonicalRequestBytesHex: string;
}

export interface JeditSubmissionLedgerPort {
  recordAcceptedSubmission(
    record: JeditAcceptedSubmissionRecord,
  ): JeditSubmissionLedgerWriteResult;
  readSubmission(submissionId: string): JeditSubmissionLedgerReadResult;
}

export interface JeditSubmissionLedgerAccepted {
  readonly status: typeof JEDIT_SUBMISSION_LEDGER_ACCEPTED;
  readonly record: JeditAcceptedSubmissionRecord;
}

export interface JeditSubmissionLedgerDuplicate {
  readonly status: typeof JEDIT_SUBMISSION_LEDGER_DUPLICATE;
  readonly record: JeditAcceptedSubmissionRecord;
}

export interface JeditSubmissionLedgerReadFound {
  readonly status: typeof JEDIT_SUBMISSION_LEDGER_READ_FOUND;
  readonly record: JeditAcceptedSubmissionRecord;
}

export interface JeditSubmissionLedgerReadMissing {
  readonly status: typeof JEDIT_SUBMISSION_LEDGER_READ_MISSING;
  readonly submissionId: string;
}

export type JeditSubmissionLedgerWriteResult =
  | JeditSubmissionLedgerAccepted
  | JeditSubmissionLedgerDuplicate;

export type JeditSubmissionLedgerReadResult =
  | JeditSubmissionLedgerReadFound
  | JeditSubmissionLedgerReadMissing;
