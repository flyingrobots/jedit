export const JEDIT_WSC_HISTORY_LISTED = 'JEDIT_WSC_HISTORY_LISTED';
export const JEDIT_WSC_HISTORY_LIST_OBSTRUCTED = 'JEDIT_WSC_HISTORY_LIST_OBSTRUCTED';

export const JEDIT_WSC_HISTORY_EVENT_EDIT_SETTLEMENT = 'edit_settlement';
export const JEDIT_WSC_HISTORY_EVENT_UNSUPPORTED_ENVELOPE = 'unsupported_envelope';

export const JEDIT_WSC_HISTORY_EVIDENCE_AVAILABLE = 'available';
export const JEDIT_WSC_HISTORY_EVIDENCE_DERIVED = 'derived_app_safe';
export const JEDIT_WSC_HISTORY_EVIDENCE_MISSING = 'missing';
export const JEDIT_WSC_HISTORY_EVIDENCE_UNSUPPORTED = 'unsupported';

export const JEDIT_WSC_HISTORY_WSC_STORE_OBSTRUCTED = 'wsc_store_obstructed';
export const JEDIT_WSC_HISTORY_MALFORMED_ENVELOPE = 'malformed_envelope';
export const JEDIT_WSC_HISTORY_UNSUPPORTED_SCHEMA = 'unsupported_schema';
export const JEDIT_WSC_HISTORY_MISSING_SUBMISSION = 'missing_submission_id';
export const JEDIT_WSC_HISTORY_MISSING_OUTCOME = 'missing_outcome_id';
export const JEDIT_WSC_HISTORY_MISSING_RECEIPT = 'missing_receipt_id';
export const JEDIT_WSC_HISTORY_MISSING_READING = 'missing_reading_id';
export const JEDIT_WSC_HISTORY_MISSING_CHECKPOINT = 'missing_checkpoint_ref';
export const JEDIT_WSC_HISTORY_MISSING_EXPORT = 'missing_export_ref';

export type JeditWscHistoryEventKind =
  | typeof JEDIT_WSC_HISTORY_EVENT_EDIT_SETTLEMENT
  | typeof JEDIT_WSC_HISTORY_EVENT_UNSUPPORTED_ENVELOPE;

export type JeditWscHistoryEvidenceStatus =
  | typeof JEDIT_WSC_HISTORY_EVIDENCE_AVAILABLE
  | typeof JEDIT_WSC_HISTORY_EVIDENCE_DERIVED
  | typeof JEDIT_WSC_HISTORY_EVIDENCE_MISSING
  | typeof JEDIT_WSC_HISTORY_EVIDENCE_UNSUPPORTED;

export interface JeditWscHistoryEvidenceRef {
  readonly status: JeditWscHistoryEvidenceStatus;
  readonly id?: string;
  readonly reason?: string;
}

export interface JeditWscHistoryEvidenceRefs {
  readonly submission: JeditWscHistoryEvidenceRef;
  readonly outcome: JeditWscHistoryEvidenceRef;
  readonly receipt: JeditWscHistoryEvidenceRef;
  readonly reading: JeditWscHistoryEvidenceRef;
  readonly checkpoint: JeditWscHistoryEvidenceRef;
  readonly export: JeditWscHistoryEvidenceRef;
}

export interface JeditWscHistoryEntry {
  readonly sequence: number;
  readonly basisId: string;
  readonly envelopeId: string;
  readonly eventKind: JeditWscHistoryEventKind;
  readonly filePath?: string;
  readonly commandKind?: string;
  readonly submittedAtMs?: number;
  readonly lineCount?: number;
  readonly refs: JeditWscHistoryEvidenceRefs;
}

export interface JeditWscHistoryListed {
  readonly status: typeof JEDIT_WSC_HISTORY_LISTED;
  readonly entries: readonly JeditWscHistoryEntry[];
}

export interface JeditWscHistoryListObstruction {
  readonly code: string;
  readonly message: string;
  readonly envelopeId?: string;
}

export interface JeditWscHistoryListObstructed {
  readonly status: typeof JEDIT_WSC_HISTORY_LIST_OBSTRUCTED;
  readonly obstruction: JeditWscHistoryListObstruction;
}

export type JeditWscHistoryListingResult =
  | JeditWscHistoryListed
  | JeditWscHistoryListObstructed;
