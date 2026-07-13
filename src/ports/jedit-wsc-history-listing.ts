export const JEDIT_WSC_HISTORY_LISTED = 'JEDIT_WSC_HISTORY_LISTED';
export const JEDIT_WSC_HISTORY_LIST_OBSTRUCTED = 'JEDIT_WSC_HISTORY_LIST_OBSTRUCTED';
export const JEDIT_WSC_HISTORY_APPLIED = 'applied';
export const JEDIT_WSC_HISTORY_REJECTED = 'rejected';
export const JEDIT_WSC_HISTORY_MISSING_EVIDENCE = 'missing_evidence';
export const JEDIT_WSC_HISTORY_SETTLEMENT_EVIDENCE = 'settlement_envelope';
export const JEDIT_WSC_HISTORY_REJECTION_EVIDENCE = 'rejection_envelope';
export const JEDIT_WSC_HISTORY_UNSUPPORTED_EVIDENCE = 'unsupported_envelope';
export const JEDIT_WSC_HISTORY_MALFORMED_EVIDENCE = 'malformed_envelope';
export const JEDIT_WSC_HISTORY_READ_OBSTRUCTED_EVIDENCE = 'read_obstructed';
export const JEDIT_WSC_HISTORY_REJECTION_SCHEMA_VERSION = 'jedit.workspace_text_edit_rejection.v1';

export interface JeditWscHistoryRecord {
  readonly basisId: string;
  readonly envelopeId: string;
  readonly sequence: number;
  readonly outcomeStatus: string;
  readonly evidencePosture: string;
  readonly filePath?: string;
  readonly bufferId?: string;
  readonly commandKind?: string;
  readonly provenanceKind?: string;
  readonly reversedReceiptId?: string;
  readonly submittedAtMs?: number;
  readonly receiptId?: string;
  readonly readingId?: string;
  readonly readingCoverage?: string;
  readonly readingStartLine?: number;
  readonly readingLineCount?: number;
  readonly readingReturnedLineCount?: number;
  readonly readingTotalLineCount?: number;
  readonly readingTruncated?: boolean;
  readonly readingTextDigest?: string;
  readonly checkpointId?: string;
  readonly exportEvidenceId?: string;
  readonly submissionId?: string;
  readonly admissionId?: string;
  readonly ticketId?: string;
  readonly executionId?: string;
  readonly rejectionReason?: string;
  readonly obstructionCode?: string;
  readonly obstructionMessage?: string;
}

export interface JeditWscHistoryFileSummary {
  readonly filePath: string;
  readonly recordCount: number;
  readonly appliedCount: number;
  readonly rejectedCount: number;
  readonly missingEvidenceCount: number;
  readonly latestBasisId: string;
}

export interface JeditWscHistoryListed {
  readonly status: typeof JEDIT_WSC_HISTORY_LISTED;
  readonly records: readonly JeditWscHistoryRecord[];
  readonly files: readonly JeditWscHistoryFileSummary[];
}

export interface JeditWscHistoryListObstruction {
  readonly code: string;
  readonly message: string;
}

export interface JeditWscHistoryListObstructed {
  readonly status: typeof JEDIT_WSC_HISTORY_LIST_OBSTRUCTED;
  readonly obstruction: JeditWscHistoryListObstruction;
}

export type JeditWscHistoryListResult =
  | JeditWscHistoryListed
  | JeditWscHistoryListObstructed;
